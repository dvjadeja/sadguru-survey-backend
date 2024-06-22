import { Request, Response } from 'express';
import { z } from 'zod';

import db from '../setups/mongo';
import { LorryReceipt, Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { getStartAndEnd } from '../utils/utilities';

export const createLorryReceipt = async (req: Request, res: Response) => {
  const lorryReceiptValidator = z.object({
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
    organizationDetails: z
      .object({
        companyName: z.string(),
        gst: z.string(),
        pan: z.string(),
        address: z.string(),
        state: z.string(),
        zipCode: z.string(),
        country: z.string(),
      })
      .optional(),
  });

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
            },
          },
          { new: true, session: session }
        );

        if (!updatedVehicle) throw new Error('Vehicle not updated');
      }
    }

    /*
        update the ledger.pendingAmount & ledger.totalAmount by adding the charges
        from lorryReceiptPayload.rate + lorryReceiptPayload.detentionAmount +
        lorryReceiptPayload.tollPlazaAmount + lorryReceiptPayload.adaniFee
    */
    // const totalCharges =
    //   lorryReceiptPayload.rate +
    //   lorryReceiptPayload.detentionAmount +
    //   lorryReceiptPayload.tollPlazaAmount +
    //   lorryReceiptPayload.adaniFee;

    // const updatedLedger = await Ledger.findOneAndUpdate(
    //   { _id: lorryReceiptPayload.billingParty },
    //   {
    //     $inc: {
    //       pendingAmount: totalCharges,
    //       totalAmount: totalCharges,
    //     },
    //   },
    //   { new: true, session: session }
    // );

    // if (!updatedLedger) throw new Error('Ledger not updated');

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
      .populate('vehicleId');

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
  const lorryReceiptValidator = z.object({
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
    organizationDetails: z
      .object({
        companyName: z.string().optional(),
        gst: z.string().optional(),
        pan: z.string().optional(),
        address: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),
  });

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
      });

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

export const getPendingLorryReceiptByLedger = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = res.locals.user;
    const { ledgerId }: any = req.query;

    const lorryReceipts = await LorryReceipt.find(
      {
        createdBy: userId,
        billingParty: ledgerId,
        invoiceStatus: 'PENDING',
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
      .populate('vehicleId', ['registration.plateNumber']);

    if (!lorryReceipts) throw new Error('Lorry receipt not found');

    // count documents
    const count = await LorryReceipt.countDocuments({
      createdBy: userId,
      billingParty: ledgerId,
      invoiceStatus: 'PENDING',
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
