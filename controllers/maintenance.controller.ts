import { Request, Response } from 'express';
import { Maintenance, Vendor } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { z } from 'zod';
import db from '../setups/mongo';

export const listMaintenances = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10, search }: any = req.query;

    const maintenances = await Maintenance.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [{ billNumber: new RegExp(search, 'i') }],
        }),
      },
      ['billNumber', 'billDate', 'billAmount'],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    )
      .populate('vendorId', ['name'])
      .populate('vehicleId', ['registration.plateNumber']);

    const maintenancesCount = await Maintenance.find({
      createdBy: userId,
      ...(search && {
        $or: [{ billNumber: new RegExp(search, 'i') }],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: 'Maintenance List Fetched Successfully',
      data: {
        data: maintenances,
        count: maintenancesCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching maintenances',
      error,
    });
  }
};

export const getMaintenance = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id } = req.query;

    const maintenance = await Maintenance.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    })
      .populate('vehicleId')
      .populate('vendorId');

    if (!maintenance) throw new Error(`Maintenance with ${id} not found`);

    handleSuccess(res, {
      message: 'Maintenance Fetched Successfully',
      data: {
        data: maintenance,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching maintenance',
      error,
    });
  }
};

export const createMaintenance = async (req: Request, res: Response) => {
  const maintenanceValidator = z.object({
    billNumber: z.string(),
    billDate: z.string(),
    vendorId: z.string(),
    vehicleId: z.string(),
    billAmount: z.string(),
    remarks: z.string().optional(),
  });

  const session = await db.startSession();

  session.startTransaction();

  try {
    maintenanceValidator.parse(req.body);
    const { userId } = res.locals.user;
    const maintenancePayload = req.body;

    const maintenance = await Maintenance.findOne({
      $and: [
        { createdBy: userId },
        { billNumber: maintenancePayload.billNumber },
      ],
    });

    if (maintenance)
      throw new Error(
        `Maintenance with ${maintenancePayload.billNumber} already exists`
      );

    const newMaintenance = new Maintenance({
      ...maintenancePayload,
      createdBy: userId,
    });

    const registerMaintenance = await newMaintenance.save({ session: session });

    if (registerMaintenance) {
      // Increment the Vendor pending amount and totalAmount from the Vendor Model
      const vendor = await Vendor.findOne({ _id: maintenancePayload.vendorId });

      if (!vendor)
        throw new Error(`Vendor with ${maintenancePayload.vendorId} not found`);

      if (!isNaN(parseFloat(maintenancePayload.billAmount))) {
        vendor.totalAmount = (
          parseFloat(vendor.totalAmount) +
          parseFloat(maintenancePayload.billAmount)
        ).toString();

        vendor.pendingAmount = (
          parseFloat(vendor.pendingAmount) +
          parseFloat(maintenancePayload.billAmount)
        ).toString();
      } else {
        throw new Error('Invalid bill amount');
      }

      await vendor.save({ session: session });

      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Maintenance Created Successfully',
        data: registerMaintenance,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating maintenance',
      error,
    });
  }
};

export const updateMaintenance = async (req: Request, res: Response) => {
  const maintenanceValidator = z.object({
    maintenanceId: z.string(),
    billNumber: z.string().optional(),
    billDate: z.string().optional(),
    billAmount: z.string().optional(),
    previousBillAmount: z.string().optional(),
    vendorId: z.string(),
    vehicleId: z.string().optional(),
    remarks: z.string().optional(),
  });

  const session = await db.startSession();

  session.startTransaction();

  try {
    maintenanceValidator.parse(req.body);

    const { userId } = res.locals.user;

    const maintenancePayload = req.body;

    const maintenance = await Maintenance.findOne({
      $and: [{ createdBy: userId }, { _id: maintenancePayload.maintenanceId }],
    });

    if (!maintenance)
      throw new Error(
        `Maintenance with ${maintenancePayload.billNumber} not found`
      );

    if (
      maintenancePayload?.vendorId === maintenance?.vendorId.toString() &&
      maintenancePayload.billAmount !== maintenancePayload.previousBillAmount
    ) {
      // Decrement the Vendor pending amount and totalAmount from the Vendor Model
      const vendor = await Vendor.findOne({
        _id: maintenancePayload.vendorId,
        createdBy: userId,
      });

      if (!vendor)
        throw new Error(`Vendor with ${maintenancePayload.vendorId} not found`);

      if (!isNaN(parseFloat(maintenancePayload.previousBillAmount))) {
        vendor.totalAmount = (
          parseFloat(vendor.totalAmount) -
          parseFloat(maintenancePayload.previousBillAmount)
        ).toString();

        vendor.pendingAmount = (
          parseFloat(vendor.pendingAmount) -
          parseFloat(maintenancePayload.previousBillAmount)
        ).toString();

        await vendor.save({ session: session });

        // Increment the Vendor pending amount and totalAmount from the Vendor Model
        if (!isNaN(parseFloat(maintenancePayload.billAmount))) {
          vendor.totalAmount = (
            parseFloat(vendor.totalAmount) +
            parseFloat(maintenancePayload.billAmount)
          ).toString();

          vendor.pendingAmount = (
            parseFloat(vendor.pendingAmount) +
            parseFloat(maintenancePayload.billAmount)
          ).toString();

          await vendor.save({ session: session });
        } else {
          throw new Error('Invalid bill amount');
        }
      } else {
        throw new Error('Invalid bill amount');
      }
    } else if (
      maintenancePayload?.vendorId !== maintenance?.vendorId.toString()
    ) {
      // Decrement the Vendor pending amount and totalAmount from the Old Vendor Vendor Model
      const oldVendor = await Vendor.findOne({
        _id: maintenance?.vendorId,
        createdBy: userId,
      });

      if (!oldVendor)
        throw new Error(`Vendor with ${maintenance?.vendorId} not found`);

      if (!oldVendor?.totalAmount) throw new Error('Invalid Total amount');
      if (!oldVendor?.pendingAmount) throw new Error('Invalid Pending amount');

      if (isNaN(parseFloat(maintenancePayload.previousBillAmount)))
        throw new Error('Invalid bill amount');

      if (
        oldVendor?.totalAmount &&
        !isNaN(parseFloat(maintenancePayload.billAmount)) &&
        parseFloat(oldVendor?.totalAmount) <
          parseFloat(maintenancePayload.billAmount)
      ) {
        throw new Error(
          `Insufficient Total amount. Please add more amount to ${oldVendor?.name} vendor`
        );
      }

      if (
        oldVendor?.pendingAmount &&
        !isNaN(parseFloat(maintenancePayload.billAmount)) &&
        parseFloat(oldVendor?.pendingAmount) <
          parseFloat(maintenancePayload.billAmount)
      ) {
        throw new Error(
          `Insufficient Pending amount. Please add more amount to ${oldVendor?.name} vendor`
        );
      }

      if (
        oldVendor?.totalAmount &&
        !isNaN(parseFloat(maintenancePayload.billAmount)) &&
        parseFloat(oldVendor?.totalAmount) >=
          parseFloat(maintenancePayload.billAmount)
      ) {
        // Decrement the Vendor totalAmount from the Old Vendor Vendor Model
        oldVendor.totalAmount = (
          parseFloat(oldVendor?.totalAmount) -
          parseFloat(maintenancePayload.billAmount)
        ).toString();
      }

      if (
        oldVendor?.pendingAmount &&
        !isNaN(parseFloat(maintenancePayload.billAmount)) &&
        parseFloat(oldVendor?.pendingAmount) >=
          parseFloat(maintenancePayload.billAmount)
      ) {
        // Decrement the Vendor pending amount from the Old Vendor Vendor Model
        oldVendor.pendingAmount = (
          parseFloat(oldVendor?.pendingAmount) -
          parseFloat(maintenancePayload.billAmount)
        ).toString();
      }

      await oldVendor.save({ session: session });

      const newVendor = await Vendor.findOne({
        _id: maintenancePayload.vendorId,
        createdBy: userId,
      });

      if (!newVendor)
        throw new Error(`Vendor with ${maintenancePayload.vendorId} not found`);

      if (!newVendor?.totalAmount) throw new Error('Invalid Total amount');
      if (!newVendor?.pendingAmount) throw new Error('Invalid Pending amount');

      if (isNaN(parseFloat(maintenancePayload.billAmount)))
        throw new Error('Invalid bill amount');

      // Increment the newVendor totalAmount and pendingAmount from the New Vendor Vendor Model
      newVendor.totalAmount = (
        parseFloat(newVendor?.totalAmount) +
        parseFloat(maintenancePayload.billAmount)
      ).toString();

      newVendor.pendingAmount = (
        parseFloat(newVendor?.pendingAmount) +
        parseFloat(maintenancePayload.billAmount)
      ).toString();

      await newVendor.save({ session: session });
    }

    const updatedMaintenance = await Maintenance.findOneAndUpdate(
      { _id: maintenancePayload.maintenanceId },
      maintenancePayload,
      { new: true, session: session }
    );

    if (updatedMaintenance) {
      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();
      handleSuccess(res, {
        message: 'Maintenance Updated Successfully',
        data: updatedMaintenance,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while updating maintenance',
      error,
    });
  }
};

// API to list the data from maintenance from startDate, endDate, optional parameters:- vendorIds, vehicleIds

export const printMaintenances = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { startDate, endDate, vendorIds, vehicleIds }: any = req.query;

    const maintenanceCondition: any = {
      createdBy: userId,
    };

    if (startDate && endDate) {
      maintenanceCondition.billDate = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    if (vendorIds) {
      const vendorId = vendorIds.split(',');
      maintenanceCondition.vendorId = { $in: vendorId };
    }

    if (vehicleIds) {
      const vehicleId = vehicleIds.split(',');
      maintenanceCondition.vehicleId = { $in: vehicleId };
    }

    const maintenances = await Maintenance.find(maintenanceCondition, [
      'billNumber',
      'billDate',
      'billAmount',
    ])
      .populate('vehicleId', ['registration.plateNumber'])
      .populate('vendorId', ['name']);

    if (!maintenances) throw new Error('Maintenances not found');

    // calculate total amount from maintenance.billAmount
    const totalAmount = maintenances.reduce(
      (acc: number, item: any) => acc + Number(item.billAmount),
      0
    );

    handleSuccess(res, {
      message: 'Maintenances Fetched Successfully',
      data: {
        maintenances,
        totalAmount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching maintenances',
      error,
    });
  }
};
