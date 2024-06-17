import { Request, Response } from 'express';

import { LocalTrip, Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import db from '../setups/mongo';
import { z } from 'zod';

export const listLocalTrips = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search }: any = req.query;

    const localTrips = await LocalTrip.aggregate([
      {
        $match: {
          createdBy: new db.Types.ObjectId(userId),
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicleId',
          foreignField: '_id',
          as: 'vehicleId',
        },
      },
      {
        $unwind: '$vehicleId',
      },
      {
        $lookup: {
          from: 'ledgers',
          localField: 'billingParty',
          foreignField: '_id',
          as: 'billingParty',
        },
      },
      {
        $unwind: '$billingParty',
      },
      {
        // Match from vehicleId or billingParty
        $match: search
          ? {
              $or: [
                {
                  'vehicleId.registration.plateNumber': new RegExp(search, 'i'),
                },
                { 'billingParty.legalName': new RegExp(search, 'i') },
              ],
            }
          : {},
      },
      {
        $project: {
          date: 1,
          'vehicleId.registration.plateNumber': 1,
          containerNo: 1,
          containerSize: 1,
          containerType: 1,
          gateInOutMode: 1,
          'billingParty.legalName': 1,
          from: 1,
          to: 1,
          invoiceStatus: 1,
        },
      },
      {
        $facet: {
          data: [
            { $skip: parseInt(page) * parseInt(limit) },
            { $limit: parseInt(limit) },
          ],
          totalCount: [
            {
              $count: 'count',
            },
          ],
        },
      },
      {
        $unwind: '$totalCount',
      },
    ]);

    handleSuccess(res, {
      message: 'Local Trips Fetched Successfully',
      data: {
        data: localTrips[0]?.data,
        count: localTrips[0]?.totalCount?.count,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching local trips',
      error,
    });
  }
};

export const createLocalTrip = async (req: Request, res: Response) => {
  const localTripValidator = z.object({
    date: z.string(),
    vehicleId: z.string(),
    containerNo: z.string(),
    containerSize: z.enum(['20', '40']),
    containerType: z.enum(['EMPTY', 'LOADED']),
    gateInOutMode: z.enum(['INBLOCK', 'RE EXPORT']),
    billingParty: z.string(),
    from: z.string(),
    to: z.string(),
    rate: z.number(),
    diesel: z.number(),
    driverIncentive: z.number().optional(),
    tollPlazaAmount: z.number().optional(),
    advance: z.number().optional(),
    remarks: z.string().optional(),
  });

  // Initial transaction
  const session = await db.startSession();

  // Start transaction
  session.startTransaction();

  try {
    localTripValidator.parse(req.body);

    const { userId } = res.locals.user;

    const newLocalTrip = new LocalTrip({
      ...req.body,
      createdBy: userId,
    });

    const registerLocalTrip = await newLocalTrip.save({ session: session });

    if (!registerLocalTrip) throw new Error('Error While Creating Local Trip');

    // Reduce the vehicle.fuel.availableFuel by diesel
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.body.vehicleId, createdBy: userId },
      { $inc: { 'fuel.availableFuel': -req.body.diesel } },
      { new: true, session: session }
    );

    if (!vehicle) throw new Error('Vehicle not found');

    if (registerLocalTrip) {
      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Local Trip Created Successfully',
        data: registerLocalTrip,
      });
    }
  } catch (error) {
    await session.commitTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating local trip',
      error,
    });
  }
};

export const getLocalTrip = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const localTrip = await LocalTrip.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    })
      .populate('vehicleId', ['registration.plateNumber'])
      .populate('billingParty', ['legalName']);

    if (!localTrip) throw new Error(`Local Trip not found`);

    handleSuccess(res, {
      message: 'Local Trip Fetched Successfully',
      data: localTrip,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching local trip',
      error,
    });
  }
};

export const updateLocalTrip = async (req: Request, res: Response) => {
  const localTripValidator = z.object({
    localTripId: z.string(),
    date: z.string().optional(),
    vehicleId: z.string().optional(),
    containerNo: z.string().optional(),
    containerSize: z.enum(['20', '40']).optional(),
    containerType: z.enum(['EMPTY', 'LOADED']).optional(),
    gateInOutMode: z.enum(['INBLOCK', 'RE EXPORT']).optional(),
    billingParty: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    rate: z.number().optional(),
    diesel: z.number().optional(),
    driverIncentive: z.number().optional(),
    tollPlazaAmount: z.number().optional(),
    advance: z.number().optional(),
    remarks: z.string().optional(),
  });

  // Initiate transaction
  const session = await db.startSession();
  // Start transaction
  session.startTransaction();

  try {
    localTripValidator.parse(req.body);

    const { userId } = res.locals.user;
    const localTrip = await LocalTrip.findOne({
      $and: [{ _id: req.body.localTripId }, { createdBy: userId }],
    });

    if (!localTrip) throw new Error('Local Trip not found');

    const updatedLocalTrip = await LocalTrip.findOneAndUpdate(
      { _id: req.body.localTripId, createdBy: userId },
      { ...req.body },
      { new: true, session: session }
    );

    if (!updatedLocalTrip) throw new Error('Error While Updating Local Trip');

    /*  Update Vehicle fuel.availableFuel by adding old fuel 
        from old record of local trip diesel and then subtracting the new fuel
    */
    if (req.body?.diesel && localTrip?.diesel !== req.body?.diesel) {
      const vehicle = await Vehicle.findOne({
        _id: localTrip.vehicleId,
      });

      if (!vehicle) throw new Error('Vehicle not found');

      if (vehicle.fuel && vehicle.fuel.availableFuel) {
        const oldFuel = vehicle?.fuel?.availableFuel + localTrip.diesel;
        const newFuel = oldFuel - req.body?.diesel;

        const updatedVehicle = await Vehicle.findOneAndUpdate(
          { _id: localTrip.vehicleId, createdBy: userId },
          {
            $set: {
              fuel: {
                availableFuel: newFuel,
                fuelCapacity: vehicle.fuel.fuelCapacity,
              },
            },
          },
          { new: true, session: session }
        );

        if (!updatedVehicle) throw new Error('Error While Updating Vehicle');
      }
    }

    if (updatedLocalTrip) {
      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Local Trip Updated Successfully',
        data: updatedLocalTrip,
      });
    }
  } catch (error) {
    await session.commitTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while updating local trip',
      error,
    });
  }
};
