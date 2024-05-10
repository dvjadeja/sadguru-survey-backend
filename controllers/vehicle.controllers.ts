import { Request, Response } from 'express';
import { Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { z } from 'zod';
import { VEHICLE_STATUS } from '../constants';

export const listVehicle = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10, search }: any = req.query;

    const vehicles = await Vehicle.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [
            { 'registration.plateNumber': new RegExp(search, 'i') },
            { make: new RegExp(search, 'i') },
            { model: new RegExp(search, 'i') },
          ],
        }),
      },
      [
        'make',
        'model',
        'registrationDate',
        'fuel.availableFuel',
        'registration.plateNumber',
        'currentStatus',
        'assignedDriver',
      ],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    )
      .populate('assignedDriver', ['firstName', 'lastName'])
      .exec();

    const vehiclesCount = await Vehicle.find({
      createdBy: userId,
      ...(search && {
        $or: [
          { 'registration.plateNumber': new RegExp(search, 'i') },
          { make: new RegExp(search, 'i') },
          { model: new RegExp(search, 'i') },
        ],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: 'Vehicle List Fetched Successfully',
      data: {
        data: vehicles,
        count: vehiclesCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vehicles',
      error,
    });
  }
};

export const getVehicle = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const vehicle = await Vehicle.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (!vehicle) throw new Error(`Vehicle with ${id} not found`);

    handleSuccess(res, {
      message: 'Vehicle Fetched Successfully',
      data: {
        data: vehicle,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vehicle',
      error,
    });
  }
};

export const createVehicle = async (req: Request, res: Response) => {
  const vehicleValidator = z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    vin: z.string().optional(),
    registration: z.object({
      plateNumber: z.string(),
    }),
    currentStatus: z.enum([
      VEHICLE_STATUS.ACTIVE,
      VEHICLE_STATUS.INACTIVE,
      VEHICLE_STATUS.UNDER_MAINTENANCE,
    ]),
    fuel: z
      .object({
        fuelCapacity: z.number().optional(),
        availableFuel: z.number().optional(),
      })
      .optional(),
    insuranceExpirationDate: z.string(),
    registrationDate: z.string(),
    fitness: z.string(),
    tax: z.object({
      taxType: z.string(),
      lastTaxDate: z.string().optional(),
    }),
    puc: z.string(),
    permit: z.string(),
  });
  try {
    vehicleValidator.parse(req.body);
    const { userId } = res.locals.user;
    const vehiclePayload = req.body;

    const vehicle = await Vehicle.findOne({
      $and: [
        { createdBy: userId },
        {
          registration: {
            plateNumber: vehiclePayload.registration.plateNumber,
          },
        },
      ],
    });

    if (vehicle)
      throw new Error(
        `Vehicle with ${vehiclePayload.registration.plateNumber} already exists`
      );

    const newVehicle = new Vehicle({ ...vehiclePayload, createdBy: userId });

    const registeredVehicle = await newVehicle.save();

    if (registeredVehicle) {
      handleSuccess(res, {
        message: 'Vehicle Created Successfully',
        data: {
          data: registeredVehicle,
        },
      });
    }
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while creating vehicle',
      error,
    });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  const vehicleValidator = z.object({
    vehicleId: z.string(),
    make: z.string().optional(),
    model: z.string().optional(),
    vin: z.string().optional(),
    registration: z
      .object({
        plateNumber: z.string().optional(),
      })
      .optional(),
    currentStatus: z
      .enum([
        VEHICLE_STATUS.ACTIVE,
        VEHICLE_STATUS.INACTIVE,
        VEHICLE_STATUS.UNDER_MAINTENANCE,
      ])
      .optional(),
    fuel: z
      .object({
        fuelCapacity: z.number().optional(),
        availableFuel: z.number().optional(),
      })
      .optional(),
    insuranceExpirationDate: z.string(),
    registrationDate: z.string(),
    fitness: z.string(),
    tax: z.object({
      taxType: z.string(),
      lastTaxDate: z.string().optional(),
    }),
    puc: z.string(),
    permit: z.string(),
  });
  try {
    vehicleValidator.parse(req.body);
    const { userId } = res.locals.user;
    const { vehicleId, ...vehiclePayload } = req.body;

    const edited = await Vehicle.findOneAndUpdate(
      { $and: [{ _id: vehicleId }, { createdBy: userId }] },
      vehiclePayload,
      { new: true }
    );

    if (!edited) throw new Error(`Error while updating vehicle`);

    handleSuccess(res, {
      message: 'Vehicle Updated Successfully',
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating vehicle',
      error,
    });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const vehicle = await Vehicle.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (!vehicle) throw new Error(`vehicle with ${id} not found`);

    const deleted = await Vehicle.findOneAndDelete({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (deleted) {
      handleSuccess(res, {
        message: 'Vehicle Deleted Successfully',
      });
    }
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while deleting vehicle',
      error,
    });
  }
};

export const listUnassignedVehicles = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;

    const vehicles = await Vehicle.find(
      {
        createdBy: userId,
        assignedDriver: null,
        currentStatus: 'ACTIVE',
      },
      ['registration.plateNumber', 'fuel.availableFuel'],
      {
        sort: { createdAt: -1 },
      }
    );

    const newVehicles = vehicles.map((vehicle) => ({
      label: vehicle?.registration?.plateNumber,
      value: vehicle._id,
      availableFuel: vehicle?.fuel?.availableFuel,
    }));

    handleSuccess(res, {
      message: 'Vehicle List Fetched Successfully',
      data: {
        data: newVehicles,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vehicles',
      error,
    });
  }
};

// List assigned vehicles

export const listAssignedVehicles = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const vehicles = await Vehicle.find(
      {
        createdBy: userId,
        assignedDriver: { $ne: null },
        currentStatus: 'ACTIVE',
      },
      ['registration.plateNumber'],
      {
        sort: { createdAt: -1 },
      }
    );

    const newVehicles = vehicles.map((vehicle) => ({
      label: vehicle?.registration?.plateNumber,
      value: vehicle._id,
    }));

    handleSuccess(res, {
      message: 'Vehicle List Fetched Successfully',
      data: {
        data: newVehicles,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vehicles',
      error,
    });
  }
};

// List all vehicle of user

export const listAllVehicles = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const vehicles = await Vehicle.find(
      {
        createdBy: userId,
      },
      ['registration.plateNumber'],
      {
        sort: { createdAt: -1 },
      }
    );

    const newVehicles = vehicles.map((vehicle) => ({
      label: vehicle?.registration?.plateNumber,
      value: vehicle._id,
    }));

    handleSuccess(res, {
      message: 'Vehicle List Fetched Successfully',
      data: {
        data: newVehicles,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vehicles',
      error,
    });
  }
};
