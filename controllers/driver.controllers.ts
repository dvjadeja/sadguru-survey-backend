import { Request, Response } from 'express';
import { Driver, Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { z } from 'zod';
import db from '../setups/mongo';

export const listDriver = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10, search }: any = req.query;

    const drivers = await Driver.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [
            { firstName: new RegExp(search, 'i') },
            { lastName: new RegExp(search, 'i') },
          ],
        }),
      },
      [
        'firstName',
        'lastName',
        'licenseNumber',
        'phoneNumber',
        'assignedVehicle',
      ],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    )
      .populate('assignedVehicle', ['registration.plateNumber'])
      .exec();

    const driversCount = await Driver.find({
      createdBy: userId,
      ...(search && {
        $or: [
          { firstName: new RegExp(search, 'i') },
          { lastName: new RegExp(search, 'i') },
        ],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: 'Drivers List Fetched Successfully',
      data: {
        data: drivers,
        count: driversCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching Drivers',
      error,
    });
  }
};

export const getDriver = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const driver = await Driver.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    }).populate('assignedVehicle', ['registration.plateNumber']);

    if (!driver) throw new Error(`driver with ${id} not found`);

    handleSuccess(res, {
      message: 'driver Fetched Successfully',
      data: {
        data: driver,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching driver',
      error,
    });
  }
};

export const createDriver = async (req: Request, res: Response) => {
  const driverValidator = z.object({
    firstName: z.string(),
    lastName: z.string(),
    licenseNumber: z.string(),
    licenseExpirationDate: z.string(),
    phoneNumber: z.object({
      primary: z.string(),
      secondary: z.string().optional(),
    }),
    address: z
      .object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zipCode: z.string(),
        country: z.string(),
      })
      .optional(),
    assignedVehicle: z.string().optional(),
    adharCard: z.string(),
    joiningDate: z.string(),
    joiningFuelFinger: z.number(),
  });

  const session = await db.startSession();

  session.startTransaction();

  try {
    driverValidator.parse(req.body);

    const { userId } = res.locals.user;
    const driverPayload = req.body;

    const driver = await Driver.findOne({
      $and: [
        { createdBy: userId },
        { licenseNumber: driverPayload.licenseNumber },
      ],
    });

    if (driver)
      throw new Error(
        `Driver with ${driverPayload.licenseNumber} already exists`
      );

    const vehicle = await Vehicle.findOne({
      $and: [{ createdBy: userId }, { _id: driverPayload.assignedVehicle }],
    });

    if (!vehicle)
      throw new Error(
        `Vehicle with ${driverPayload.assignedVehicle} not found`
      );

    if (vehicle.currentStatus !== 'ACTIVE')
      throw new Error(
        `Vehicle with ${vehicle.registration?.plateNumber} is not active`
      );

    if (vehicle.assignedDriver)
      throw new Error(
        `Vehicle with ${vehicle.registration?.plateNumber} is already assigned to another driver`
      );

    const newDriver = new Driver({
      ...driverPayload,
      createdBy: userId,
    });

    const registeredDriver = await newDriver.save({ session: session });

    if (registeredDriver) {
      const vehiclePayload = {
        assignedDriver: registeredDriver._id,
        fuel: {
          fuelCapacity: vehicle?.fuel?.fuelCapacity,
          availableFuel: 0,
        },
      };

      await Vehicle.findOneAndUpdate(
        {
          $and: [{ createdBy: userId }, { _id: driverPayload.assignedVehicle }],
        },
        vehiclePayload,
        { new: true, session: session }
      );

      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Driver Created Successfully',
        data: {
          data: registeredDriver,
        },
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating driver',
      error,
    });
  }
};

export const updateDriver = async (req: Request, res: Response) => {
  const driverValidator = z.object({
    driverId: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    licenseNumber: z.string().optional(),
    licenseExpirationDate: z.string().optional(),
    phoneNumber: z
      .object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
      })
      .optional(),
    email: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),
    assignedVehicle: z.string().optional(),
    availableFuel: z.number().optional(),
    adharCard: z.string().optional(),
    joiningDate: z.string().optional(),
    joiningFuelFinger: z.number().optional(),
  });

  try {
    driverValidator.parse(req.body);

    const { userId } = res.locals.user;
    const driverPayload = req.body;

    const driver = await Driver.findOne({
      $and: [{ _id: driverPayload.driverId }, { createdBy: userId }],
    });

    if (!driver) throw new Error(`driver not found`);

    const updatedDriver = await Driver.findOneAndUpdate(
      { $and: [{ _id: driverPayload.driverId }, { createdBy: userId }] },
      driverPayload,
      { new: true }
    );

    if (updatedDriver) {
      handleSuccess(res, {
        message: 'Driver Updated Successfully',
        data: {
          data: updatedDriver,
        },
      });
    }
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating driver',
      error,
    });
  }
};

export const deleteDriver = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const driver = await Driver.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (!driver) throw new Error(`driver with ${id} not found`);

    const deleted = await Driver.findOneAndDelete({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (deleted) {
      handleSuccess(res, {
        message: 'Driver Deleted Successfully',
      });
    }
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while deleting driver',
      error,
    });
  }
};
