import { Request, Response } from 'express';
import { Driver, Fuel, Users, Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { z } from 'zod';
import db from '../setups/mongo';

export const listFuel = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10, search }: any = req.query;

    const fuel = await Fuel.aggregate([
      {
        $match: {
          createdBy: new db.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: 'drivers',
          let: { driverId: '$driverId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$driverId'] },
              },
            },
            {
              $project: {
                _id: 1, // Include driver ID
                firstName: 1, // Include firstName
                lastName: 1, // Include lastName
              },
            },
          ],
          as: 'driver',
        },
      },
      {
        $unwind: '$driver', // Convert driver array to object
      },
      {
        $lookup: {
          from: 'vehicles',
          let: { vehicleId: '$vehicleId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$_id', '$$vehicleId'] },
              },
            },
            {
              $project: {
                _id: 1, // Include driver ID
                registration: {
                  plateNumber: 1, // Include plateNumber
                }, // Include firstName
              },
            },
          ],
          as: 'vehicle',
        },
      },
      {
        $unwind: '$vehicle', // Convert driver array to object
      },
      {
        $match: search
          ? {
              $or: [
                { receiptId: { $regex: new RegExp(search, 'i') } }, // Case-insensitive search for receiptId
                { 'driver.firstName': { $regex: new RegExp(search, 'i') } }, // Case-insensitive search for driver's firstName
                { 'driver.lastName': { $regex: new RegExp(search, 'i') } }, // Case-insensitive search for driver's lastName
                {
                  'vehicle.registration.plateNumber': {
                    $regex: new RegExp(search, 'i'),
                  },
                }, // Case-insensitive search for vehicle's plateNumber
              ],
            }
          : {},
      },
      {
        $addFields: {
          totalAmount: {
            $toDouble: '$totalAmount',
          },
        },
      },
      {
        $unset: 'expenses', // Remove the expenses array from the document
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 }, // Count documents
          results: { $push: '$$ROOT' }, // Push documents to results array
        },
      },
      {
        $project: {
          _id: 0, // Exclude _id field
          count: 1, // Include count field
          results: {
            $slice: [
              '$results',
              parseInt(page) * parseInt(limit),
              parseInt(limit),
            ],
          }, // Apply pagination to results array
        },
      },
      {
        $unwind: '$results', // Unwind the results array before sorting
      },
      {
        $sort: { 'results.createdAt': -1 }, // Sort by createdAt date in descending order
      },
      {
        $group: {
          _id: null,
          count: { $first: '$count' }, // Preserve the count field
          results: { $push: '$results' }, // Push sorted results to the array
        },
      },
      {
        $project: {
          _id: 0,
          count: 1,
          results: {
            $slice: [
              '$results',
              parseInt(page) * parseInt(limit),
              parseInt(limit),
            ],
          }, // Apply pagination to sorted results array
        },
      },
    ]);

    // const fuel = await Fuel.find({
    //   createdBy: userId,
    // });

    handleSuccess(res, {
      message: 'Fuel List Fetched Successfully',
      data: fuel && fuel.length > 0 ? fuel[0] : { count: 0, results: [] },
      // data: fuel,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching Fuels',
      error,
    });
  }
};

export const createFuel = async (req: Request, res: Response) => {
  const fuelValidator = z.object({
    to: z.string(),
    vehicleId: z.string(),
    date: z.string(),
    expenses: z.array(
      z.object({
        description: z.string(),
        quantity: z.string(),
        rate: z.string(),
        amount: z.string(),
      })
    ),
    totalAmount: z.string(),
  });

  const session = await db.startSession();

  // Begin a transaction
  session.startTransaction();

  try {
    fuelValidator.parse(req.body);

    const { userId } = res.locals.user;
    const fuelPayload = req.body;

    // Find User
    const user = await Users.findOne({ _id: userId });

    if (!user) throw new Error('User not found');

    const fuelCount = await Fuel.countDocuments({ createdBy: userId });

    // Find driverId from Vehicle
    const vehicleFound = await Vehicle.findOne({
      _id: fuelPayload.vehicleId,
      createdBy: userId,
    });

    if (!vehicleFound) throw new Error('Vehicle not found');

    if (!vehicleFound.assignedDriver)
      throw new Error('Please Select a vehicle with driver assigned');

    const fuel = new Fuel({
      to: fuelPayload.to,
      vehicleId: fuelPayload.vehicleId,
      date: fuelPayload.date,
      driverId: vehicleFound.assignedDriver,
      receiptId: `${user?.company?.prefix}/fuel/${fuelCount + 1}`,
      createdBy: userId,
      expenses: fuelPayload.expenses,
      totalAmount: fuelPayload.totalAmount,
    });

    const newFuel = await fuel.save({ session: session });

    if (!newFuel) throw new Error('Fuel not created');

    /*  
      Update Driver and Vehicle avialable fuel if the fuelPayload.expenses 
      array contains diesel as in the description and add the quantity 
      from the object to the availableFuel
    */
    const dieselExpense = fuelPayload.expenses.find(
      (expense: any) => expense.description.toLowerCase() === 'diesel'
    );

    if (dieselExpense) {
      const driver = await Driver.findOneAndUpdate(
        { _id: vehicleFound.assignedDriver, createdBy: userId },
        { $inc: { availableFuel: parseInt(dieselExpense.quantity) } },
        { new: true, session: session }
      );
      const vehicle = await Vehicle.findOneAndUpdate(
        { _id: fuelPayload.vehicleId, createdBy: userId },
        { $inc: { 'fuel.availableFuel': parseInt(dieselExpense.quantity) } },
        { new: true, session: session }
      );

      if (!driver || !vehicle) throw new Error('Driver or Vehicle not found');
    }

    // If all updates succeed, commit the transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: 'Fuel Created Successfully',
      data: {
        data: newFuel,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating Fuel',
      error,
    });
  }
};

export const getFuel = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const fuel = await Fuel.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    }).populate('vehicleId', ['registration.plateNumber']);

    if (!fuel) throw new Error(`Fuel not found`);

    const data = {
      ...fuel.toObject(),
      totalAmount: fuel.totalAmount?.toString(),
      expenses: fuel.expenses?.map((expense) => ({
        _id: expense._id,
        description: expense.description,
        quantity: expense.quantity.toString(),
        rate: expense.rate.toString(),
        amount: expense.amount.toString(),
      })),
    };

    handleSuccess(res, {
      message: 'Fuel Fetched Successfully',
      data: data,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching Fuel',
      error,
    });
  }
};
