import { Request, Response } from 'express';
import { z } from 'zod';

import { Driver, DriverFNF, Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { PAYMENT_TYPE, VEHICLE_STATUS } from '../constants';
import { db } from '../setups/mongo';

interface IDriverFNF {
  date: string;
  driverId: string;
  driverSalary: number;
  driverIncentive: number;
  availableFuel: number;
  fuelTankFinger: number;
  fuelRate: number;
  additionalAmount: {
    name: string;
    amount: number;
  }[];
  deductionAmount: {
    name: string;
    amount: number;
  }[];
  totalAmount: number;
  paymentMethod: {
    paymentType: string;
    paymentReferenceNumber: string | null;
  };
  remarks: string | '';
}

/**
 * Retrieves a paginated list of DriverFNF documents based on the provided query parameters.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @return {Promise<void>} A Promise that resolves when the list of DriverFNF documents is successfully retrieved and sent in the response.
 * @throws {Error} If no DriverFNF documents are found.
 */
export const listDriverFNF = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search }: any = req.query;

    const driverFNFs = await DriverFNF.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [{ driverName: new RegExp(search, 'i') }],
        }),
      },
      [],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    ).populate('driverId', ['firstName', 'lastName']);

    const driverFNFsCount = await DriverFNF.find({
      createdBy: userId,
      ...(search && {
        $or: [{ driverName: new RegExp(search, 'i') }],
      }),
    }).countDocuments();

    if (!driverFNFs) throw new Error('DriverFNF not found');

    handleSuccess(res, {
      message: 'DriverFNF List Fetched Successfully',
      data: {
        data: driverFNFs,
        count: driverFNFsCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching DriverFNF',
      error,
    });
  }
};

/**
 * Retrieves a DriverFNF document based on the provided id and user, populating the driverId field.
 *
 * @param {Request} req - The Express request object.
 * @param {Response} res - The Express response object.
 * @return {Promise<void>} A Promise that resolves when the DriverFNF document is successfully fetched and sent in the response.
 */
export const getDriverFNF = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id } = req.query;

    const driverFNF = await DriverFNF.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    }).populate('driverId');

    if (!driverFNF) throw new Error('DriverFNF not found');

    handleSuccess(res, {
      message: 'DriverFNF Fetched Successfully',
      data: driverFNF,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching DriverFNF',
      error,
    });
  }
};

export const createDriverFNF = async (req: Request, res: Response) => {
  const driverFnfValidator = z
    .object({
      date: z.string(),
      driverId: z.string(),
      vehicleId: z.string(),
      driverSalary: z.number(),
      driverIncentive: z.number(),
      availableFuel: z.number(),
      fuelTankFinger: z.number(),
      fuelPerFinger: z.number(),
      fuelRate: z.number(),
      additionalAmount: z
        .array(
          z
            .object({
              description: z.string(),
              amount: z.number(),
            })
            .strict()
        )
        .optional(),
      deductionAmount: z
        .array(
          z
            .object({
              description: z.string(),
              amount: z.number(),
            })
            .strict()
        )
        .optional(),
      totalAmount: z.number(),
      paymentMethod: z.object({
        paymentType: z.enum([
          PAYMENT_TYPE.CASH,
          PAYMENT_TYPE.CHEQUE,
          PAYMENT_TYPE.UPI,
          PAYMENT_TYPE.NEFT,
          PAYMENT_TYPE.RTGS,
        ]),
        paymentReferenceNumber: z.string().optional(),
      }),
      remarks: z.string().optional(),
    })
    .superRefine(
      (
        { paymentMethod: { paymentType, paymentReferenceNumber } },
        refinementContext
      ) => {
        if (paymentType !== PAYMENT_TYPE.CASH && !paymentReferenceNumber) {
          refinementContext.addIssue({
            code: 'custom',
            message: 'Payment reference number is required',
            path: ['paymentMethod.paymentReferenceNumber'],
          });
        }
      }
    );

  const session = await db.startSession();

  session.startTransaction();

  try {
    driverFnfValidator.parse(req.body);
    const { userId } = res.locals.user;
    const driverFNFPayload: IDriverFNF = req.body;

    const newDriverFNF = new DriverFNF({
      ...driverFNFPayload,
      createdBy: userId,
    });

    const registerDriverFNF = await newDriverFNF.save({ session });

    if (!registerDriverFNF) throw new Error('DriverFNF not created');

    /**
     * * DRIVER UPDATES
     * update the assignedVehicle to null
     * update the status to INACTIVE
     * update the availableFuel to 0
     * update the joiningFuelFinger to 0
     * update the incentive to 0
     */
    const driver = await Driver.findOne({
      _id: driverFNFPayload.driverId,
    }).lean();

    if (!driver)
      throw new Error(`Driver with ${driverFNFPayload.driverId} not found`);

    await Driver.updateOne(
      { _id: driver?._id },
      {
        assignedVehicle: null,
        status: 'INACTIVE',
        availableFuel: 0,
        joiningFuelFinger: 0,
        incentive: 0,
      },
      { session }
    );

    /**
     * * VEHICLE UPDATES
     * update the currentStatus to INACTIVE
     * update the fuel: { fuelCapacity: previousFuelCapacity, availableFuel: 0 }
     * update the assignedDriver to null
     */
    const vehicle = await Vehicle.findOne({
      _id: driver?.assignedVehicle,
    }).lean();

    if (!vehicle)
      throw new Error(`Vehicle with ${driver?.assignedVehicle} not found`);

    await Vehicle.updateOne(
      { _id: vehicle?._id },
      {
        currentStatus: VEHICLE_STATUS.INACTIVE,
        fuel: {
          fuelCapacity: vehicle?.fuel?.fuelCapacity,
          availableFuel: 0,
        },
        assignedDriver: null,
      },
      { session }
    );

    // If all updates succeed, commit the transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: 'DriverFNF Created Successfully',
      data: registerDriverFNF,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating DriverFNF',
      error,
    });
  }
};
