import { Request, Response } from "express";
import { Driver, Fuel, Users, Vehicle, Vendor } from "../models";
import { handleErrors, handleSuccess } from "../utils/response.utils";
import { z } from "zod";
import db from "../setups/mongo";
import { getStartAndEnd } from "../utils/utilities";

export const listFuel = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search }: any = req.query;

    // const fuel = await Fuel.aggregate([
    //   {
    //     $match: {
    //       createdBy: new db.Types.ObjectId(userId),
    //     },
    //   },
    //   {
    //     $lookup: {
    //       from: 'drivers',
    //       let: { driverId: '$driverId' },
    //       pipeline: [
    //         {
    //           $match: {
    //             $expr: { $eq: ['$_id', '$$driverId'] },
    //           },
    //         },
    //         {
    //           $project: {
    //             _id: 1, // Include driver ID
    //             firstName: 1, // Include firstName
    //             lastName: 1, // Include lastName
    //           },
    //         },
    //       ],
    //       as: 'driver',
    //     },
    //   },
    //   {
    //     $unwind: '$driver', // Convert driver array to object
    //   },
    //   {
    //     $lookup: {
    //       from: 'vehicles',
    //       let: { vehicleId: '$vehicleId' },
    //       pipeline: [
    //         {
    //           $match: {
    //             $expr: { $eq: ['$_id', '$$vehicleId'] },
    //           },
    //         },
    //         {
    //           $project: {
    //             _id: 1, // Include driver ID
    //             registration: {
    //               plateNumber: 1, // Include plateNumber
    //             }, // Include firstName
    //           },
    //         },
    //       ],
    //       as: 'vehicle',
    //     },
    //   },
    //   {
    //     $unwind: '$vehicle', // Convert driver array to object
    //   },
    //   {
    //     $match: search
    //       ? {
    //           $or: [
    //             { receiptId: { $regex: new RegExp(search, 'i') } }, // Case-insensitive search for receiptId
    //             { 'driver.firstName': { $regex: new RegExp(search, 'i') } }, // Case-insensitive search for driver's firstName
    //             { 'driver.lastName': { $regex: new RegExp(search, 'i') } }, // Case-insensitive search for driver's lastName
    //             {
    //               'vehicle.registration.plateNumber': {
    //                 $regex: new RegExp(search, 'i'),
    //               },
    //             }, // Case-insensitive search for vehicle's plateNumber
    //           ],
    //         }
    //       : {},
    //   },
    //   {
    //     $addFields: {
    //       totalAmount: {
    //         $toDouble: '$totalAmount',
    //       },
    //     },
    //   },
    //   {
    //     $unset: 'expenses', // Remove the expenses array from the document
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       count: { $sum: 1 }, // Count documents
    //       results: { $push: '$$ROOT' }, // Push documents to results array
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0, // Exclude _id field
    //       count: 1, // Include count field
    //       results: {
    //         $slice: [
    //           '$results',
    //           parseInt(page) * parseInt(limit),
    //           parseInt(limit),
    //         ],
    //       }, // Apply pagination to results array
    //     },
    //   },
    //   {
    //     $unwind: '$results', // Unwind the results array before sorting
    //   },
    //   {
    //     $sort: { 'results.createdAt': -1 }, // Sort by createdAt date in descending order
    //   },
    //   {
    //     $group: {
    //       _id: null,
    //       count: { $first: '$count' }, // Preserve the count field
    //       results: { $push: '$results' }, // Push sorted results to the array
    //     },
    //   },
    //   {
    //     $project: {
    //       _id: 0,
    //       count: 1,
    //       results: {
    //         $slice: [
    //           '$results',
    //           parseInt(page) * parseInt(limit),
    //           parseInt(limit),
    //         ],
    //       }, // Apply pagination to sorted results array
    //     },
    //   },
    // ]);

    const fuel = await Fuel.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [{ receiptId: new RegExp(search, "i") }],
        }),
      },
      ["date", "receiptId", "totalAmount"],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      },
    )
      .populate("vendorId", ["name"])
      .populate("vehicleId", ["registration.plateNumber"])
      .populate("driverId", ["firstName", "lastName"]);

    if (!fuel) throw new Error(`Error while fetching Fuels`);

    const newFuel = fuel.map((fuel) => ({
      ...fuel.toObject(),
      totalAmount: parseFloat(fuel.totalAmount?.toString() || "0").toFixed(2),
    }));

    const fuelCount = await Fuel.find({
      createdBy: userId,
      ...(search && {
        $or: [{ receiptId: new RegExp(search, "i") }],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: "Fuel List Fetched Successfully",
      data: {
        results: newFuel,
        count: fuelCount,
      },
      // data: fuel,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching Fuels",
      error,
    });
  }
};

export const createFuel = async (req: Request, res: Response) => {
  const fuelValidator = z.object({
    vendorId: z.string(),
    vehicleId: z.string(),
    date: z.string(),
    expenses: z.array(
      z.object({
        description: z.string(),
        quantity: z.string().or(z.number()),
        rate: z.string().or(z.number()),
        amount: z.string().or(z.number()),
      }),
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

    if (!user) throw new Error("User not found");

    const fuelCount = await Fuel.countDocuments({ createdBy: userId });

    // Find driverId from Vehicle
    const vehicleFound = await Vehicle.findOne({
      _id: fuelPayload.vehicleId,
      createdBy: userId,
    });

    if (!vehicleFound) throw new Error("Vehicle not found");

    if (!vehicleFound.assignedDriver)
      throw new Error("Please Select a vehicle with driver assigned");

    const fuel = new Fuel({
      vehicleId: fuelPayload.vehicleId,
      date: fuelPayload.date,
      driverId: vehicleFound.assignedDriver,
      receiptId: `${user?.company?.prefix}/fuel/${fuelCount + 1}`,
      createdBy: userId,
      expenses: fuelPayload.expenses,
      totalAmount: fuelPayload.totalAmount,
      vendorId: fuelPayload.vendorId,
    });

    const newFuel = await fuel.save({ session: session });

    if (!newFuel) throw new Error("Fuel not created");

    /*  
      Update Driver and Vehicle avialable fuel if the fuelPayload.expenses 
      array contains diesel as in the description and add the quantity 
      from the object to the availableFuel
    */
    const dieselExpense = fuelPayload.expenses.find(
      (expense: any) => expense.description.toLowerCase() === "diesel",
    );

    if (dieselExpense) {
      const driver = await Driver.findOneAndUpdate(
        { _id: vehicleFound.assignedDriver, createdBy: userId },
        { $inc: { availableFuel: parseInt(dieselExpense.quantity) } },
        { new: true, session: session },
      );
      const vehicle = await Vehicle.findOneAndUpdate(
        { _id: fuelPayload.vehicleId, createdBy: userId },
        { $inc: { "fuel.availableFuel": parseInt(dieselExpense.quantity) } },
        { new: true, session: session },
      );

      if (!driver || !vehicle) throw new Error("Driver or Vehicle not found");
    }

    // Update Vendor totalAmount & pending amount
    const vendor = await Vendor.findOne({
      _id: fuelPayload.vendorId,
      createdBy: userId,
    });

    if (!vendor) throw new Error("Vendor not found");

    if (!isNaN(parseFloat(fuelPayload.totalAmount))) {
      vendor.totalAmount = (
        parseFloat(vendor.totalAmount) + parseFloat(fuelPayload.totalAmount)
      ).toString();
      vendor.pendingAmount = (
        parseFloat(vendor.pendingAmount) + parseFloat(fuelPayload.totalAmount)
      ).toString();

      await vendor.save({ session: session });
    } else {
      throw new Error("Invalid bill amount");
    }

    // If all updates succeed, commit the transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Fuel Created Successfully",
      data: {
        data: newFuel,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: "Error while creating Fuel",
      error,
    });
  }
};

export const updateFuel = async (req: Request, res: Response) => {
  const fuelValidator = z.object({
    vendorId: z.string(),
    vehicleId: z.string(),
    date: z.string(),
    expenses: z.array(
      z.object({
        _id: z.string().optional(),
        description: z.string(),
        quantity: z.string().or(z.number()),
        rate: z.string().or(z.number()),
        amount: z.string().or(z.number()),
      }),
    ),
    totalAmount: z.string(),
  });

  const session = await db.startSession();

  // Begin transaction
  session.startTransaction();

  try {
    const { userId } = res.locals.user;
    const { fuelId } = req.params;
    const fuelPayload = fuelValidator.parse(req.body);

    const parseNumber = (value: string | number) => {
      const parsed = parseFloat(value.toString());
      if (isNaN(parsed)) {
        throw new Error("Invalid numeric value");
      }
      return parsed;
    };

    const isDieselExpense = (description: string) =>
      description.trim().toLowerCase() === "diesel";

    const getDieselQuantity = (
      expenses: Array<{ description: string; quantity: any }>,
    ) => {
      return expenses.reduce((total, expense) => {
        if (!isDieselExpense(expense.description)) return total;
        return total + parseNumber(expense.quantity);
      }, 0);
    };

    // Find fuel
    const fuel = await Fuel.findOne({
      $and: [{ _id: fuelId }, { createdBy: userId }],
    }).session(session);

    if (!fuel) throw new Error(`Fuel not found`);

    const oldVehicleId = fuel.vehicleId.toString();
    const oldDriverId = fuel.driverId.toString();
    const oldVendorId = fuel.vendorId.toString();
    const newVehicleId = fuelPayload.vehicleId;
    const newVendorId = fuelPayload.vendorId;
    const oldTotalAmount = parseNumber(fuel.totalAmount?.toString() || "0");
    const newTotalAmount = parseNumber(fuelPayload.totalAmount);
    const oldDieselQuantity = getDieselQuantity(fuel.expenses as any);
    const newDieselQuantity = getDieselQuantity(fuelPayload.expenses as any);

    // Update vendor amounts with old/new total deltas
    if (oldVendorId !== newVendorId) {
      const oldVendor = await Vendor.findOne({
        _id: oldVendorId,
        createdBy: userId,
      }).session(session);

      if (!oldVendor) throw new Error(`Vendor not found`);

      oldVendor.totalAmount = (
        parseFloat(oldVendor.totalAmount) - oldTotalAmount
      ).toString();
      oldVendor.pendingAmount = (
        parseFloat(oldVendor.pendingAmount) - oldTotalAmount
      ).toString();
      await oldVendor.save({ session });

      const newVendor = await Vendor.findOne({
        _id: newVendorId,
        createdBy: userId,
      }).session(session);

      if (!newVendor) throw new Error(`Vendor not found`);

      newVendor.totalAmount = (
        parseFloat(newVendor.totalAmount || "0") + newTotalAmount
      ).toString();
      newVendor.pendingAmount = (
        parseFloat(newVendor.pendingAmount || "0") + newTotalAmount
      ).toString();
      await newVendor.save({ session });
    } else if (oldTotalAmount !== newTotalAmount) {
      const vendor = await Vendor.findOne({
        _id: oldVendorId,
        createdBy: userId,
      }).session(session);

      if (!vendor) throw new Error(`Vendor not found`);

      const totalDelta = newTotalAmount - oldTotalAmount;
      vendor.totalAmount = (
        parseFloat(vendor.totalAmount) + totalDelta
      ).toString();
      vendor.pendingAmount = (
        parseFloat(vendor.pendingAmount) + totalDelta
      ).toString();
      await vendor.save({ session });
    }

    // Update Vehicle/Driver availableFuel with old/new diesel quantity deltas
    if (oldVehicleId !== newVehicleId) {
      const newVehicle = await Vehicle.findOne({
        _id: newVehicleId,
        createdBy: userId,
      }).session(session);
      if (!newVehicle) throw new Error("Vehicle not found");
      if (!newVehicle.assignedDriver) {
        throw new Error("Please Select a vehicle with driver assigned");
      }

      if (oldDieselQuantity !== 0) {
        const oldVehicle = await Vehicle.findOneAndUpdate(
          { _id: oldVehicleId, createdBy: userId },
          { $inc: { "fuel.availableFuel": -oldDieselQuantity } },
          { new: true, session },
        );
        if (!oldVehicle) throw new Error("Vehicle not found");

        const oldDriver = await Driver.findOneAndUpdate(
          { _id: oldDriverId, createdBy: userId },
          { $inc: { availableFuel: -oldDieselQuantity } },
          { new: true, session },
        );
        if (!oldDriver) throw new Error("Driver not found");
      }

      if (newDieselQuantity !== 0) {
        const vehicleAfterAdd = await Vehicle.findOneAndUpdate(
          { _id: newVehicleId, createdBy: userId },
          { $inc: { "fuel.availableFuel": newDieselQuantity } },
          { new: true, session },
        );
        if (!vehicleAfterAdd) throw new Error("Vehicle not found");

        const newDriver = await Driver.findOneAndUpdate(
          { _id: newVehicle.assignedDriver, createdBy: userId },
          { $inc: { availableFuel: newDieselQuantity } },
          { new: true, session },
        );
        if (!newDriver) throw new Error("Driver not found");
      }
    } else {
      const dieselDelta = newDieselQuantity - oldDieselQuantity;
      if (dieselDelta !== 0) {
        const updatedVehicle = await Vehicle.findOneAndUpdate(
          { _id: oldVehicleId, createdBy: userId },
          { $inc: { "fuel.availableFuel": dieselDelta } },
          { new: true, session },
        );
        if (!updatedVehicle) throw new Error("Vehicle not found");

        const updatedDriver = await Driver.findOneAndUpdate(
          { _id: oldDriverId, createdBy: userId },
          { $inc: { availableFuel: dieselDelta } },
          { new: true, session },
        );
        if (!updatedDriver) throw new Error("Driver not found");
      }
    }

    // Update fuel fields
    fuel.vendorId = new db.Types.ObjectId(newVendorId);
    fuel.vehicleId = new db.Types.ObjectId(newVehicleId);
    fuel.date = new Date(fuelPayload.date);
    fuel.totalAmount = new db.Types.Decimal128(fuelPayload.totalAmount);

    if (oldVehicleId !== newVehicleId) {
      const vehicleForDriver = await Vehicle.findOne({
        _id: newVehicleId,
        createdBy: userId,
      }).session(session);
      if (!vehicleForDriver?.assignedDriver) {
        throw new Error("Please Select a vehicle with driver assigned");
      }
      fuel.driverId = new db.Types.ObjectId(vehicleForDriver.assignedDriver);
    }

    const existingExpenseIds = new Set(
      fuel.expenses.map((expense: any) => expense._id.toString()),
    );
    for (const expense of fuelPayload.expenses) {
      if (expense._id && !existingExpenseIds.has(expense._id.toString())) {
        throw new Error(`Expense not found`);
      }
    }

    fuel.expenses = fuelPayload.expenses.map((expense) => ({
      ...(expense._id ? { _id: new db.Types.ObjectId(expense._id) } : {}),
      description: expense.description,
      quantity: new db.Types.Decimal128(expense.quantity.toString()),
      rate: new db.Types.Decimal128(expense.rate.toString()),
      amount: new db.Types.Decimal128(expense.amount.toString()),
    })) as any;

    await fuel.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Fuel updated successfully",
      data: fuel,
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: "Error while updating Fuel",
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
    })
      .populate("vendorId", ["name"])
      .populate("vehicleId", ["registration.plateNumber"])
      .populate("driverId", ["firstName", "lastName"]);

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
      message: "Fuel Fetched Successfully",
      data: data,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching Fuel",
      error,
    });
  }
};

export const printFuel = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { startDate, endDate, vehicleIds, vendorIds, singleDate }: any =
      req.query;

    const fuelCondition: any = {
      createdBy: userId,
    };

    if (startDate && endDate) {
      fuelCondition.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    if (singleDate) {
      const { startDate: singleStartDate, endDate: singleEndDate } =
        getStartAndEnd(singleDate);
      fuelCondition.date = {
        $gte: singleStartDate,
        $lt: singleEndDate,
      };
    }

    if (vehicleIds) {
      const vehicleId = vehicleIds.split(",");
      fuelCondition.vehicleId = { $in: vehicleId };
    }

    if (vendorIds) {
      const vendorId = vendorIds.split(",");
      fuelCondition.vendorId = { $in: vendorId };
    }

    const fuel = await Fuel.find(fuelCondition)
      .populate("vehicleId", ["registration.plateNumber"])
      .populate("driverId", ["firstName", "lastName"])
      .populate("vendorId", ["name"]);

    if (!fuel) throw new Error(`Fuel not found`);

    handleSuccess(res, {
      message: "Fuel Fetched Successfully",
      data: fuel,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching Fuel",
      error,
    });
  }
};

export const deleteFuel = async (req: Request, res: Response) => {
  const deleteFuelValidaotr = z.object({
    id: z.string(),
  });

  const session = await db.startSession();

  // Begin a transaction
  session.startTransaction();

  try {
    deleteFuelValidaotr.parse(req.body);

    const { userId } = res.locals.user;
    const { id } = req.body;

    // find fuel
    const fuel = await Fuel.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (!fuel) throw new Error(`Fuel not found`);

    // find vendor
    const vendor = await Vendor.findOne({
      _id: fuel.vendorId,
      createdBy: userId,
    });

    if (!vendor) throw new Error(`Vendor not found`);

    // find vehicle
    const vehicle = await Vehicle.findOne({
      _id: fuel.vehicleId,
      createdBy: userId,
    });

    if (!vehicle) throw new Error(`Vehicle not found`);

    // find driver
    const driver = await Driver.findOne({
      _id: fuel.driverId,
      createdBy: userId,
    });

    if (!driver) throw new Error(`Driver not found`);

    if (fuel.totalAmount) {
      // update vendor total amount and pending amount
      vendor.totalAmount = (
        parseFloat(vendor.totalAmount) - parseFloat(fuel.totalAmount.toString())
      ).toString();
      vendor.pendingAmount = (
        parseFloat(vendor.pendingAmount) -
        parseFloat(fuel.totalAmount.toString())
      ).toString();

      await vendor.save({ session });
    }

    // calculate total quantity in a fuel.expenses
    let totalQuantity = 0;
    for (let i = 0; i < fuel.expenses.length; i++) {
      if (fuel.expenses[i].description.toLowerCase() === "diesel") {
        totalQuantity += parseFloat(fuel.expenses[i].quantity.toString());
      }
    }

    if (
      vehicle.fuel?.availableFuel &&
      totalQuantity &&
      vehicle.fuel.availableFuel >= totalQuantity
    ) {
      // update vehicle fuel
      vehicle.fuel.availableFuel = vehicle.fuel.availableFuel - totalQuantity;

      await vehicle.save({ session });
    }

    // update driver.availableFuel
    if (
      driver.availableFuel &&
      totalQuantity &&
      driver.availableFuel >= totalQuantity
    ) {
      driver.availableFuel = driver.availableFuel - totalQuantity;

      await driver.save({ session });
    }

    // delete fuel
    await Fuel.deleteOne({ _id: id }, { session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Fuel deleted successfully",
    });
  } catch (error) {
    // Abort the transaction
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: "Error while deleting fuel",
      error,
    });
  }
};

export const addDiesel = async (req: Request, res: Response) => {
  const addDieselValidator = z.object({
    vendorId: z.string(),
    vehicleId: z.string(),
    diesel: z.number(),
    rate: z.number(),
    amount: z.number(),
    date: z.string(),
  });

  const session = await db.startSession();

  session.startTransaction();

  try {
    const { userId } = res.locals.user;
    const { vendorId, vehicleId, diesel, rate, amount, date } =
      addDieselValidator.parse(req.body);

    const user = await Users.findOne({ _id: userId });

    if (!user) throw new Error(`User not found`);

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      createdBy: userId,
    });

    if (!vehicle) throw new Error(`Vehicle not found`);

    if (!vehicle.assignedDriver)
      throw new Error(`Please select a vehicle with driver assigned`);

    const driver = await Driver.findOne({
      _id: vehicle.assignedDriver,
      createdBy: userId,
    });

    if (!driver) throw new Error(`Driver not found`);

    const vendor = await Vendor.findOne({
      _id: vendorId,
      createdBy: userId,
    });

    if (!vendor) throw new Error(`Vendor not found`);

    const fuelCount = await Fuel.countDocuments({ createdBy: userId });

    const fuelPayload = {
      receiptId: `${user?.company?.prefix}/fuel/${fuelCount + 1}`,
      date,
      vehicleId,
      driverId: vehicle.assignedDriver,
      vendorId,
      expenses: [
        {
          description: "Diesel",
          quantity: diesel,
          rate,
          amount,
        },
      ],
      totalAmount: amount,
      createdBy: userId,
    };

    const newFuel = new Fuel(fuelPayload);
    const registeredFuel = await newFuel.save({ session: session });

    if (!registeredFuel) throw new Error(`Fuel not created`);

    // update vendor total amount and pending amount
    if (!isNaN(parseFloat(amount.toString()))) {
      vendor.totalAmount = (
        parseFloat(vendor.totalAmount) + parseFloat(amount.toString())
      ).toString();
      vendor.pendingAmount = (
        parseFloat(vendor.pendingAmount) + parseFloat(amount.toString())
      ).toString();

      await vendor.save({ session });
    } else {
      throw new Error(`Invalid amount`);
    }

    // update vehicle fuel
    const updatedVehicle = await Vehicle.findOneAndUpdate(
      { _id: vehicleId, createdBy: userId },
      { $inc: { "fuel.availableFuel": diesel } },
      { new: true, session },
    );

    if (!updatedVehicle) throw new Error(`Vehicle not found`);

    // update driver available fuel
    const updatedDriver = await Driver.findOneAndUpdate(
      { _id: driver.id, createdBy: userId },
      { $inc: { availableFuel: diesel } },
      { new: true, session },
    );

    if (!updatedDriver) throw new Error(`Driver not found`);

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Diesel added successfully",
      data: registeredFuel,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: "Error while adding diesel",
      error,
    });
  }
};
