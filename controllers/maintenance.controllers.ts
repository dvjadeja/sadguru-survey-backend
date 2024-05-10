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

      vendor.totalAmount = (
        parseFloat(vendor.totalAmount) +
        parseFloat(maintenancePayload.billAmount)
      ).toString();

      vendor.pendingAmount = (
        parseFloat(vendor.pendingAmount) +
        parseFloat(maintenancePayload.billAmount)
      ).toString();

      await vendor.save({ session: session });

      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Maintenance Created Successfully',
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
