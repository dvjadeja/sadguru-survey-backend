import { Request, Response } from 'express';
import { z } from 'zod';

import db from '../setups/mongo';
import { Driver, LorryReceipt, OtherOrganization, Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { getStartAndEnd } from '../utils/utilities';

export const createLorryReceipt = async (req: Request, res: Response) => {
  const lorryReceiptValidator = z
    .object({
      date: z.string(),
      lorryReceiptId: z.string(),
      vehicleId: z.string().optional(),
      modeOfTrade: z.enum(['IMPORT', 'EXPORT']),
      bookingNo: z.string().optional(),
      containerNo: z.string().optional(),
      lineSeal: z.string().optional(),
      containerSize: z.string().optional(),
      billingParty: z.string(),
      rate: z.number().optional(),
      detentionAmount: z.number().optional(),
      from: z.string(),
      to: z.string(),
      diesel: z.number().optional(),
      advance: z.number().optional(),
      tollPlazaAmount: z.number().optional(),
      adaniFee: z.number().optional(),
      remarks: z.string().optional(),
      ownVehicle: z.boolean(),
      marketTruckDetails: z
        .object({
          companyName: z.string(),
          marketRate: z.number(),
          vehiclePlateNumber: z.string(),
          driverName: z.string(),
          driverPhone: z.string(),
        })
        .optional(),
      ownOrganization: z.boolean(),
      organizationDetails: z.string().optional(),
      containerStatus: z.enum(['EMPTY', 'LOADED']),
    })
    .superRefine(
      ({ ownOrganization, organizationDetails }, refinementContext) => {
        if (ownOrganization === false && !organizationDetails) {
          return refinementContext.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please provide organizationDetails',
            path: ['organizationDetails'],
          });
        }
      }
    );

  const session = await db.startSession();

  // Begin a transaction
  session.startTransaction();

  try {
    lorryReceiptValidator.parse(req.body);

    const { userId } = res.locals.user;
    const lorryReceiptPayload = req.body;

    // Find Lorry receipt with same lorryReceiptId
    const lorryReceipt = await LorryReceipt.findOne({
      $or: [
        {
          lorryReceiptId: lorryReceiptPayload.lorryReceiptId,
          createdBy: userId,
        },
      ],
    });

    if (lorryReceipt)
      throw new Error(
        `Lorry receipt with ${lorryReceiptPayload.lorryReceiptId} already exists`
      );

    //   Create LR
    const newLorryReceipt = new LorryReceipt({
      ...lorryReceiptPayload,
      createdBy: userId,
    });

    const registeredLorryReceipt = await newLorryReceipt.save({
      session: session,
    });

    if (!registeredLorryReceipt) throw new Error('Lorry receipt not created');

    /*
        check that lorryReceiptPayload.ownVehicle is true and lorryReceiptPayload.fuel is lesser than the fuel.available
        fuel in Vehicle model and reduce the fuel.availableFuel from the vehicle model 
        by the amount of fuel used in lorry receipt
     */

    if (lorryReceiptPayload.ownVehicle === true) {
      const vehicle = await Vehicle.findOne({
        _id: lorryReceiptPayload.vehicleId,
        createdBy: userId,
      });

      if (!vehicle) throw new Error('Vehicle not found');

      if (vehicle?.fuel?.availableFuel) {
        if (vehicle.fuel.availableFuel < lorryReceiptPayload.diesel)
          throw new Error('Fuel not available');

        const updatedVehicle = await Vehicle.findOneAndUpdate(
          { _id: lorryReceiptPayload.vehicleId },
          {
            fuel: {
              availableFuel:
                vehicle.fuel.availableFuel - lorryReceiptPayload.diesel,
              fuelCapacity: vehicle.fuel.fuelCapacity || 0,
            },
          },
          { new: true, session: session }
        );

        if (!updatedVehicle) throw new Error('Vehicle not updated');
      }

      // Deduct Available fuel from Driver
      const driver = await Driver.findOne({
        assignedVehicle: lorryReceiptPayload.vehicleId,
        createdBy: userId,
      });

      if (!driver) throw new Error('Driver not found');

      if (driver?.availableFuel < lorryReceiptPayload.diesel)
        throw new Error('Fuel not available');

      const updatedDriver = await Driver.findOneAndUpdate(
        { _id: driver._id },
        {
          availableFuel: driver.availableFuel - lorryReceiptPayload.diesel,
        },
        { new: true, session: session }
      );

      if (!updatedDriver) throw new Error('Driver not updated');
    }

    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: 'Lorry receipt created successfully',
      data: registeredLorryReceipt,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating lorry receipt',
      error,
    });
  }
};

export const listLorryReceipt = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search }: any = req.query;

    const LR = await LorryReceipt.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [{ lorryReceiptId: new RegExp(search, 'i') }],
        }),
      },
      [
        'date',
        'lorryReceiptId',
        'bookingNo',
        'from',
        'to',
        'containerNo',
        'containerSize',
        'rate',
        'detentionAmount',
        'invoiceStatus',
        'ownVehicle',
        'marketTruckDetails.vehiclePlateNumber',
        'paymentStatus',
      ],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    )
      .populate('billingParty', ['legalName'])
      .populate('vehicleId', ['registration.plateNumber']);

    if (!LR) throw new Error('Lorry receipt not found');

    const LRCount = await LorryReceipt.find({
      createdBy: userId,
      ...(search && {
        $or: [{ lorryReceiptId: new RegExp(search, 'i') }],
      }),
    }).countDocuments();

    const newLorryReceipt = LR.map((lorryReceipt) => ({
      ...lorryReceipt.toObject(),
      billingParty: (lorryReceipt.billingParty as any)?.legalName,
      vehicleId: (lorryReceipt.vehicleId as any)?.registration.plateNumber,
    }));

    handleSuccess(res, {
      message: 'Lorry Receipt List Fetched Successfully',
      data: {
        data: newLorryReceipt,
        count: LRCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching lorry receipt',
      error,
    });
  }
};

export const getLorryReceipt = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const lorryReceipt = await LorryReceipt.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    })
      .populate('billingParty')
      .populate('vehicleId')
      .populate('organizationDetails');

    if (!lorryReceipt) throw new Error(`Lorry receipt with ${id} not found`);

    handleSuccess(res, {
      message: 'Lorry receipt fetched successfully',
      data: lorryReceipt,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching lorry receipt',
      error,
    });
  }
};

export const updateLorryReceipt = async (req: Request, res: Response) => {
  const lorryReceiptValidator = z
    .object({
      lrId: z.string(),
      date: z.string().optional(),
      lorryReceiptId: z.string().optional(),
      vehicleId: z.string().optional(),
      modeOfTrade: z.enum(['IMPORT', 'EXPORT']),
      bookingNo: z.string().optional(),
      containerNo: z.string().optional(),
      lineSeal: z.string().optional(),
      containerSize: z.string().optional(),
      billingParty: z.string().optional(),
      rate: z.number().optional(),
      detentionAmount: z.number().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      diesel: z.number().optional(),
      advance: z.number().optional(),
      tollPlazaAmount: z.number().optional(),
      adaniFee: z.number().optional(),
      remarks: z.string().optional(),
      ownVehicle: z.boolean().optional(),
      marketTruckDetails: z
        .object({
          companyName: z.string().optional(),
          marketRate: z.number().optional(),
          vehiclePlateNumber: z.string().optional(),
          driverName: z.string().optional(),
          driverPhone: z.string().optional(),
        })
        .optional(),
      ownOrganization: z.boolean().optional(),
      organizationDetails: z.string().optional(),
      containerStatus: z.enum(['EMPTY', 'LOADED']),
    })
    .superRefine(
      ({ ownOrganization, organizationDetails }, refinementContext) => {
        if (ownOrganization === false && !organizationDetails) {
          return refinementContext.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Please provide organizationDetails',
            path: ['organizationDetails'],
          });
        }
      }
    );

  const session = await db.startSession();

  // Begin a transaction
  session.startTransaction();

  try {
    lorryReceiptValidator.parse(req.body);

    const { userId } = res.locals.user;
    const { lrId, ...lorryReceiptReqPayload } = req.body;

    // Find Lorry receipt with lrId
    const lorryReceipt = await LorryReceipt.findOne({
      $and: [{ _id: lrId }, { createdBy: userId }],
    });

    if (!lorryReceipt) throw new Error(`Lorry receipt with ${lrId} not found`);

    if (
      lorryReceiptReqPayload?.lorryReceiptId !== lorryReceipt.lorryReceiptId
    ) {
      // Find Lorry receipt with same lorryReceiptId
      const sameLorryReceipt = await LorryReceipt.findOne({
        $and: [
          { lorryReceiptId: lorryReceiptReqPayload?.lorryReceiptId },
          { createdBy: userId },
        ],
      });

      if (sameLorryReceipt)
        throw new Error(
          `Lorry receipt with ${lorryReceiptReqPayload?.lorryReceiptId} already exists`
        );
    }

    // update Lorry receipt
    const updatedLorryReceipt = await LorryReceipt.findOneAndUpdate(
      { _id: lrId },
      { ...lorryReceiptReqPayload },
      { new: true, session: session }
    );

    if (!updatedLorryReceipt)
      throw new Error(`Lorry receipt with ${lrId} not found`);

    if (
      lorryReceiptReqPayload?.ownVehicle === true &&
      lorryReceiptReqPayload?.diesel !== lorryReceipt?.diesel
    ) {
      // update the vehicle?.fuel?.available quantity by adding the old quantity and then reducing the new quantity
      const vehicle = await Vehicle.findOne({
        _id: updatedLorryReceipt?.vehicleId,
      });

      if (!vehicle) throw new Error(`Vehicle with ${lrId} not found`);

      const newFuelOfVehicle =
        vehicle?.fuel?.availableFuel! + lorryReceipt?.diesel!;

      if (newFuelOfVehicle < lorryReceiptReqPayload?.diesel)
        throw new Error('Fuel not enough');

      const caculatedFuel = newFuelOfVehicle - lorryReceiptReqPayload?.diesel!;

      const updatedVehicle = await Vehicle.findOneAndUpdate(
        { _id: updatedLorryReceipt?.vehicleId },
        { fuel: { availableFuel: caculatedFuel } },
        { new: true, session: session }
      );

      if (!updatedVehicle) throw new Error(`Vehicle with ${lrId} not found`);

      // update the driver?.availableFuel
      const driver = await Driver.findOne({
        assignedVehicle: lorryReceipt?.vehicleId,
        createdBy: userId,
      });

      if (!driver) throw new Error(`Driver with ${lrId} not found`);

      const newFuelOfDriver = driver?.availableFuel! + lorryReceipt?.diesel!;

      if (newFuelOfDriver < lorryReceiptReqPayload?.diesel)
        throw new Error('Fuel not enough');

      const calculatedDriverFuel =
        newFuelOfDriver - lorryReceiptReqPayload?.diesel!;

      const updatedDriver = await Driver.findOneAndUpdate(
        { _id: driver?._id },
        { availableFuel: calculatedDriverFuel },
        { new: true, session: session }
      );

      if (!updatedDriver) throw new Error(`Driver with ${lrId} not found`);
    }

    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: 'Lorry receipt updated successfully',
      data: updatedLorryReceipt,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating lorry receipt',
      error,
    });
  }
};

export const printLorryReceipt = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { startDate, endDate, ledgerIds, vehicleIds, singleDate }: any =
      req.query;

    const lorryReceiptCondition: any = {
      createdBy: userId,
    };

    if (startDate && endDate) {
      lorryReceiptCondition.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    if (singleDate) {
      const { startDate: singleStartDate, endDate: singleEndDate } =
        getStartAndEnd(singleDate);

      lorryReceiptCondition.date = {
        $gte: singleStartDate,
        $lte: singleEndDate,
      };
    }

    if (ledgerIds) {
      const billingParty = ledgerIds.split(',');
      lorryReceiptCondition.billingParty = { $in: billingParty };
    }

    if (vehicleIds) {
      const vehicleId = vehicleIds.split(',');
      lorryReceiptCondition.vehicleId = { $in: vehicleId };
    }

    const lorryReceipts = await LorryReceipt.find(lorryReceiptCondition)
      .populate('billingParty', ['legalName'])
      .populate({
        path: 'vehicleId',
        model: 'Vehicle',
        select: 'registration.plateNumber',
        populate: {
          path: 'assignedDriver',
          model: 'Driver',
          select: {
            firstName: 1,
            lastName: 1,
            'phoneNumber.primary': 1,
          },
        },
      })
      .populate('organizationDetails');

    if (!lorryReceipts) throw new Error('Lorry receipt not found');

    handleSuccess(res, {
      message: 'Lorry receipt fetched successfully',
      data: lorryReceipts,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching lorry receipt',
      error,
    });
  }
};

export const getOtherOrganizationNameFromLRByLedger = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      userId,
      company: { name: ownCompany },
    } = res.locals.user;
    const { ledgerId }: any = req.query;

    const otherOrganizationsId = await LorryReceipt.aggregate([
      {
        $match: {
          ownOrganization: false,
          invoiceStatus: 'PENDING',
          billingParty: new db.Types.ObjectId(ledgerId),
          createdBy: new db.Types.ObjectId(userId),
        },
      },
      {
        $group: {
          _id: '$organizationDetails',
        },
      },
    ]);

    // Fetch all other organizations from otherOrganizations
    const otherOrganizations = await OtherOrganization.find({
      _id: {
        $in: otherOrganizationsId.map((organization: any) => organization._id),
      },
      createdBy: userId,
    });

    if (!otherOrganizations) throw new Error('No are other organizations');

    // Convert it into array of label and value
    const newOtherOrg = otherOrganizations.map((organization) => {
      return {
        label: organization.companyName,
        value: organization._id.toString(),
      };
    });

    newOtherOrg.unshift({
      label: ownCompany,
      value: ownCompany,
    });

    handleSuccess(res, {
      message: 'Other organizations fetched successfully',
      data: newOtherOrg,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching other organizations',
      error,
    });
  }
};

export const getPendingLorryReceiptByLedger = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = res.locals.user;
    const { ledgerId, ownOrganization, otherOrganization }: any = req.query;
    const boolOwnOrganization = ownOrganization === 'true' ? true : false;

    const lorryReceipts = await LorryReceipt.find(
      {
        createdBy: userId,
        billingParty: ledgerId,
        invoiceStatus: 'PENDING',
        ownOrganization: boolOwnOrganization,
        ...(boolOwnOrganization === false && {
          organizationDetails: otherOrganization,
        }),
      },
      [
        'date',
        'lorryReceiptId',
        'bookingNo',
        'from',
        'to',
        'containerNo',
        'containerSize',
        'rate',
        'detentionAmount',
        'ownVehicle',
        'marketTruckDetails.vehiclePlateNumber',
        'ownOrganization',
      ],
      {
        sort: {
          createdAt: -1,
        },
      }
    )
      .populate('billingParty', ['legalName'])
      .populate('vehicleId', ['registration.plateNumber'])
      .populate('organizationDetails');

    if (!lorryReceipts) throw new Error('Lorry receipt not found');

    // count documents
    const count = await LorryReceipt.countDocuments({
      createdBy: userId,
      billingParty: ledgerId,
      invoiceStatus: 'PENDING',
      ownOrganization: boolOwnOrganization,
      ...(boolOwnOrganization === false && {
        organizationDetails: otherOrganization,
      }),
    });

    const newLorryReceipt = lorryReceipts.map((lorryReceipt) => ({
      ...lorryReceipt.toObject(),
      billingParty: (lorryReceipt.billingParty as any)?.legalName,
      vehicleId: lorryReceipt?.ownVehicle
        ? (lorryReceipt.vehicleId as any)?.registration.plateNumber
        : lorryReceipt.marketTruckDetails?.vehiclePlateNumber,
    }));

    handleSuccess(res, {
      message: 'Lorry receipt fetched successfully',
      data: {
        data: newLorryReceipt,
        count,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching lorry receipt',
      error,
    });
  }
};

export const updateManyLorryReceiptStatus = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = res.locals.user;
    const { newStatus, oldStatus }: any = req.body;

    const lorryReceipt = await LorryReceipt.updateMany(
      {
        createdBy: userId,
        invoiceStatus: oldStatus,
      },
      {
        $set: { invoiceStatus: newStatus },
      }
    );

    if (!lorryReceipt) throw new Error('Lorry receipt not found');

    handleSuccess(res, {
      message: 'Lorry receipt status updated successfully',
      data: lorryReceipt,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating lorry receipt status',
      error,
    });
  }
};
