import { Request, Response } from "express";
import { z } from "zod";

import db from "../setups/mongo";
import { LorryReceipt, MarketTruckFuel, Vendor } from "../models";
import { handleErrors, handleSuccess } from "../utils/response.utils";
import { escapeRegex, getStartAndEnd } from "../utils/utilities";

const toNumber = (value: unknown) => parseFloat(value?.toString() || "0");
const parseAmount = (value: unknown) => parseFloat(value?.toString() || "0");

const applyVendorAmountDelta = async ({
  vendorId,
  amountDelta,
  userId,
  session,
}: {
  vendorId: string;
  amountDelta: number;
  userId: string;
  session: any;
}) => {
  const vendor = await Vendor.findOne({
    _id: vendorId,
    createdBy: userId,
  }).session(session);

  if (!vendor) throw new Error("Vendor not found");

  vendor.totalAmount = (
    parseAmount(vendor.totalAmount) + amountDelta
  ).toString();
  vendor.pendingAmount = (
    parseAmount(vendor.pendingAmount) + amountDelta
  ).toString();

  await vendor.save({ session });
};

export const listMarketTruckFuel = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search }: any = req.query;
    const parsedPage = Number.parseInt(page?.toString() || "0", 10);
    const parsedLimit = Number.parseInt(limit?.toString() || "10", 10);
    const safePage =
      Number.isNaN(parsedPage) || parsedPage < 0 ? 0 : parsedPage;
    const safeLimit =
      Number.isNaN(parsedLimit) || parsedLimit <= 0
        ? 10
        : Math.min(parsedLimit, 100);

    const normalizedSearch = search?.toString().trim();

    const pipeline: any[] = [
      {
        $match: {
          createdBy: new db.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "vendors",
          localField: "vendorId",
          foreignField: "_id",
          as: "vendor",
        },
      },
      {
        $unwind: {
          path: "$vendor",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "lorryreceipts",
          localField: "lorryReceiptId",
          foreignField: "_id",
          as: "lorryReceipt",
        },
      },
      {
        $unwind: {
          path: "$lorryReceipt",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          vendorName: { $ifNull: ["$vendor.name", ""] },
          lorryReceiptNo: { $ifNull: ["$lorryReceipt.lorryReceiptId", ""] },
          quantityNumber: { $toDouble: "$quantity" },
          rateNumber: { $toDouble: "$rate" },
          totalAmountNumber: { $toDouble: "$totalAmount" },
          quantityText: { $toString: "$quantity" },
          rateText: { $toString: "$rate" },
          totalAmountText: { $toString: "$totalAmount" },
          dateText: {
            $dateToString: {
              date: "$date",
              format: "%Y-%m-%d",
            },
          },
        },
      },
    ];

    if (normalizedSearch) {
      const searchRegex = new RegExp(escapeRegex(normalizedSearch), "i");
      pipeline.push({
        $match: {
          $or: [
            { vendorName: { $regex: searchRegex } },
            { lorryReceiptNo: { $regex: searchRegex } },
            { quantityText: { $regex: searchRegex } },
            { rateText: { $regex: searchRegex } },
            { totalAmountText: { $regex: searchRegex } },
            { dateText: { $regex: searchRegex } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          results: [
            { $skip: safePage * safeLimit },
            { $limit: safeLimit },
            {
              $project: {
                _id: 1,
                lorryReceiptId: "$lorryReceiptNo",
                vendorId: "$vendorName",
                marketTruckDetails: {
                  companyName: {
                    $ifNull: [
                      "$lorryReceipt.marketTruckDetails.companyName",
                      "",
                    ],
                  },
                  vehiclePlateNumber: {
                    $ifNull: [
                      "$lorryReceipt.marketTruckDetails.vehiclePlateNumber",
                      "",
                    ],
                  },
                },
                date: 1,
                quantity: "$quantityNumber",
                rate: "$rateNumber",
                totalAmount: "$totalAmountNumber",
              },
            },
          ],
          metadata: [{ $count: "count" }],
        },
      },
    );

    const [aggregatedResult] = await MarketTruckFuel.aggregate(pipeline);
    const formattedData = aggregatedResult?.results || [];
    const count = aggregatedResult?.metadata?.[0]?.count || 0;

    handleSuccess(res, {
      message: "Market truck fuel list fetched successfully",
      data: {
        results: formattedData,
        count,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching market truck fuel list",
      error,
    });
  }
};

export const getMarketTruckFuel = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const marketTruckFuel = await MarketTruckFuel.findOne({
      _id: id,
      createdBy: userId,
    })
      .populate("vendorId", ["name"])
      .populate("lorryReceiptId", ["lorryReceiptId"]);

    if (!marketTruckFuel) throw new Error("Market truck fuel not found");

    // Decimal128 to Number
    const quantity = toNumber(marketTruckFuel.quantity);
    const rate = toNumber(marketTruckFuel.rate);
    const totalAmount = toNumber(marketTruckFuel.totalAmount);

    handleSuccess(res, {
      message: "Market truck fuel fetched successfully",
      data: {
        ...marketTruckFuel.toObject(),
        quantity: quantity.toString(),
        rate: rate.toString(),
        totalAmount: totalAmount.toString(),
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while fetching market truck fuel",
      error,
    });
  }
};

export const createMarketTruckFuel = async (req: Request, res: Response) => {
  const validator = z.object({
    lorryReceiptId: z.string(),
    vendorId: z.string(),
    date: z.string(),
    quantity: z.number(),
    rate: z.number(),
  });

  const session = await db.startSession();
  session.startTransaction();

  try {
    const { userId } = res.locals.user;
    const payload = validator.parse(req.body);

    const lorryReceipt = await LorryReceipt.findOne({
      _id: payload.lorryReceiptId,
      createdBy: userId,
    }).session(session);

    if (!lorryReceipt) throw new Error("Lorry receipt not found");
    if (lorryReceipt.ownVehicle)
      throw new Error("Market truck fuel can only be added for market trucks");
    if (lorryReceipt.marketTruckFuelId)
      throw new Error("Market truck fuel already exists for this LR");

    const parsedQuantity = toNumber(payload.quantity);
    const parsedRate = toNumber(payload.rate);

    if (
      isNaN(parsedQuantity) ||
      isNaN(parsedRate) ||
      parsedQuantity <= 0 ||
      parsedRate <= 0
    ) {
      throw new Error("Invalid market truck fuel quantity or rate");
    }

    const totalAmount = parsedQuantity * parsedRate;

    const marketTruckFuel = new MarketTruckFuel({
      lorryReceiptId: payload.lorryReceiptId,
      vendorId: payload.vendorId,
      date: payload.date,
      quantity: new db.Types.Decimal128(parsedQuantity.toString()),
      rate: new db.Types.Decimal128(parsedRate.toString()),
      totalAmount: new db.Types.Decimal128(totalAmount.toString()),
      createdBy: userId,
    });

    const registeredMarketTruckFuel = await marketTruckFuel.save({ session });

    await applyVendorAmountDelta({
      vendorId: payload.vendorId,
      amountDelta: totalAmount,
      userId,
      session,
    });

    await LorryReceipt.findOneAndUpdate(
      { _id: lorryReceipt._id, createdBy: userId },
      {
        marketFuelProvidedByUs: true,
        marketTruckFuelId: registeredMarketTruckFuel._id,
      },
      { new: true, session },
    );

    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Market truck fuel created successfully",
      data: registeredMarketTruckFuel,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: "Error while creating market truck fuel",
      error,
    });
  }
};

export const updateMarketTruckFuel = async (req: Request, res: Response) => {
  const validator = z.object({
    lorryReceiptId: z.string().optional(),
    vendorId: z.string().optional(),
    date: z.string().optional(),
    quantity: z.number().optional(),
    rate: z.number().optional(),
  });

  const session = await db.startSession();
  session.startTransaction();

  try {
    const { userId } = res.locals.user;
    const { marketTruckFuelId } = req.params;
    const payload = validator.parse(req.body);

    const marketTruckFuel = await MarketTruckFuel.findOne({
      _id: marketTruckFuelId,
      createdBy: userId,
    }).session(session);

    if (!marketTruckFuel) throw new Error("Market truck fuel not found");

    const oldLorryReceiptId = marketTruckFuel.lorryReceiptId.toString();
    const oldVendorId = marketTruckFuel.vendorId.toString();
    const oldTotalAmount = parseAmount(marketTruckFuel.totalAmount);
    const nextLorryReceiptId = payload.lorryReceiptId || oldLorryReceiptId;

    const nextVendorId = payload.vendorId || oldVendorId;

    if (payload.date) {
      marketTruckFuel.date = new Date(payload.date);
    }

    const quantity =
      payload.quantity !== undefined
        ? toNumber(payload.quantity)
        : toNumber(marketTruckFuel.quantity);
    const rate =
      payload.rate !== undefined
        ? toNumber(payload.rate)
        : toNumber(marketTruckFuel.rate);

    if (isNaN(quantity) || isNaN(rate) || quantity <= 0 || rate <= 0) {
      throw new Error("Invalid market truck fuel quantity or rate");
    }

    const newTotalAmount = quantity * rate;

    if (nextVendorId !== oldVendorId) {
      await applyVendorAmountDelta({
        vendorId: oldVendorId,
        amountDelta: -oldTotalAmount,
        userId,
        session,
      });
      await applyVendorAmountDelta({
        vendorId: nextVendorId,
        amountDelta: newTotalAmount,
        userId,
        session,
      });
    } else {
      const amountDelta = newTotalAmount - oldTotalAmount;
      if (amountDelta !== 0) {
        await applyVendorAmountDelta({
          vendorId: oldVendorId,
          amountDelta,
          userId,
          session,
        });
      }
    }

    marketTruckFuel.vendorId = new db.Types.ObjectId(nextVendorId);
    marketTruckFuel.quantity = new db.Types.Decimal128(quantity.toString());
    marketTruckFuel.rate = new db.Types.Decimal128(rate.toString());
    marketTruckFuel.totalAmount = new db.Types.Decimal128(
      newTotalAmount.toString(),
    );

    if (
      payload.lorryReceiptId &&
      payload.lorryReceiptId !== oldLorryReceiptId
    ) {
      const nextLorryReceipt = await LorryReceipt.findOne({
        _id: payload.lorryReceiptId,
        createdBy: userId,
      }).session(session);

      if (!nextLorryReceipt) throw new Error("Lorry receipt not found");
      if (nextLorryReceipt.ownVehicle) {
        throw new Error(
          "Market truck fuel can only be linked to market truck LR",
        );
      }

      await LorryReceipt.findOneAndUpdate(
        { _id: oldLorryReceiptId, createdBy: userId },
        {
          $set: { marketFuelProvidedByUs: false },
          $unset: { marketTruckFuelId: "" },
        },
        { new: true, session },
      );

      await LorryReceipt.findOneAndUpdate(
        { _id: payload.lorryReceiptId, createdBy: userId },
        {
          marketFuelProvidedByUs: true,
          marketTruckFuelId: marketTruckFuel._id,
        },
        { new: true, session },
      );
    } else {
      await LorryReceipt.findOneAndUpdate(
        { _id: nextLorryReceiptId, createdBy: userId },
        {
          marketFuelProvidedByUs: true,
          marketTruckFuelId: marketTruckFuel._id,
        },
        { new: true, session },
      );
    }

    marketTruckFuel.lorryReceiptId = new db.Types.ObjectId(nextLorryReceiptId);
    await marketTruckFuel.save({ session });

    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Market truck fuel updated successfully",
      data: marketTruckFuel,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: "Error while updating market truck fuel",
      error,
    });
  }
};

export const deleteMarketTruckFuel = async (req: Request, res: Response) => {
  const validator = z.object({
    id: z.string(),
  });

  const session = await db.startSession();
  session.startTransaction();

  try {
    const { userId } = res.locals.user;
    const { id } = validator.parse(req.body);

    const marketTruckFuel = await MarketTruckFuel.findOne({
      _id: id,
      createdBy: userId,
    }).session(session);

    if (!marketTruckFuel) throw new Error("Market truck fuel not found");

    const oldTotalAmount = parseAmount(marketTruckFuel.totalAmount);
    const oldVendorId = marketTruckFuel.vendorId.toString();

    await applyVendorAmountDelta({
      vendorId: oldVendorId,
      amountDelta: -oldTotalAmount,
      userId,
      session,
    });

    await LorryReceipt.findOneAndUpdate(
      { _id: marketTruckFuel.lorryReceiptId, createdBy: userId },
      {
        $set: { marketFuelProvidedByUs: false },
        $unset: { marketTruckFuelId: "" },
      },
      { new: true, session },
    );

    await MarketTruckFuel.deleteOne(
      { _id: id, createdBy: userId },
      { session },
    );

    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: "Market truck fuel deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: "Error while deleting market truck fuel",
      error,
    });
  }
};

export const printMarketFuel = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { startDate, endDate, vendorIds, singleDate }: any = req.query;

    const marketTruckFuelCondition: any = {
      createdBy: new db.Types.ObjectId(userId),
    };

    if (startDate && endDate) {
      marketTruckFuelCondition.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    if (singleDate) {
      const { startDate: singleStartDate, endDate: singleEndDate } =
        getStartAndEnd(singleDate);

      marketTruckFuelCondition.date = {
        $gte: new Date(singleStartDate),
        $lt: new Date(singleEndDate),
      };
    }

    if (vendorIds) {
      const vendorId = vendorIds
        .split(",")
        .filter((id: string) => db.Types.ObjectId.isValid(id))
        .map((id: string) => new db.Types.ObjectId(id));

      marketTruckFuelCondition.vendorId = { $in: vendorId };
    }

    const marketTruckFuel = await MarketTruckFuel.aggregate([
      { $match: marketTruckFuelCondition },
      {
        $lookup: {
          from: "lorryreceipts",
          localField: "lorryReceiptId",
          foreignField: "_id",
          as: "lorryReceipt",
        },
      },
      {
        $unwind: {
          path: "$lorryReceipt",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "vendors",
          localField: "vendorId",
          foreignField: "_id",
          as: "vendor",
        },
      },
      {
        $unwind: {
          path: "$vendor",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $project: {
          _id: 1,
          lorryReceiptId: "$lorryReceipt.lorryReceiptId",
          vendorId: "$vendor.name",
          marketTruckDetails: {
            $ifNull: ["$lorryReceipt.marketTruckDetails", {}],
          },
          date: 1,
          quantity: { $toDouble: "$quantity" },
          rate: { $toDouble: "$rate" },
          totalAmount: { $toDouble: "$totalAmount" },
        },
      },
    ]);

    handleSuccess(res, {
      message: "Market truck fuel fetched successfully",
      data: marketTruckFuel,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: "Error while printing market truck fuel",
      error,
    });
  }
};
