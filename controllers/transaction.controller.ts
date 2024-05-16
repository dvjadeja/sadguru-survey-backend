import { Request, Response } from 'express';
import { Maintenance, Transaction, Vendor } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { z } from 'zod';
import db from '../setups/mongo';
import { PAYMENT_TYPE } from '../constants';

export const listTransactions = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10 }: any = req.query;

    const transactions = await Transaction.find(
      {
        createdBy: userId,
      },
      ['paymentDate', 'amount', 'paymentMethod'],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    ).populate('vendorId', ['name']);

    const transactionsCount = await Transaction.find({
      createdBy: userId,
    }).countDocuments();
    handleSuccess(res, {
      message: 'Transactions Fetched Successfully',
      data: {
        data: transactions,
        count: transactionsCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching transactions',
      error,
    });
  }
};

export const getTransaction = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    if (!id) throw new Error('id is required');

    const transaction = await Transaction.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    }).populate('vendorId');

    if (!transaction) throw new Error(`Transaction with ${id} not found`);

    handleSuccess(res, {
      message: 'Transaction Fetched Successfully',
      data: transaction,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching transaction',
      error,
    });
  }
};

export const createTransaction = async (req: Request, res: Response) => {
  const transactionValidator = z
    .object({
      vendorId: z.string(),
      amount: z.string().or(z.number()),
      paymentDate: z.string(),
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
    })
    .superRefine(
      (
        { paymentMethod: { paymentType, paymentReferenceNumber } },
        refinementContext
      ) => {
        if (paymentType !== PAYMENT_TYPE.CASH && !paymentReferenceNumber) {
          refinementContext.addIssue({
            code: 'custom',
            message:
              'Payment Reference Number is required for non cash payment type',
            path: ['paymentMethod.paymentReferenceNumber'],
          });
        }
      }
    );

  const session = await db.startSession();

  session.startTransaction();

  try {
    transactionValidator.parse(req.body);
    const { userId } = res.locals.user;
    const { vendorId, ...transactionPayload } = req.body;

    const newTransaction = new Transaction({
      ...transactionPayload,
      vendorId,
      createdBy: userId,
    });

    const registerTransaction = await newTransaction.save({ session });

    if (registerTransaction) {
      // Increment the Vendor pending amount and totalAmount from the Vendor Model
      const vendor = await Vendor.findOne({ _id: vendorId });

      if (!vendor) throw new Error(`Vendor with ${vendorId} not found`);

      // check if the vendor totalAmount is greater than the transaction amount

      if (Number(vendor.totalAmount) < Number(transactionPayload.amount)) {
        throw new Error(
          'Vendor total amount is less than the transaction amount'
        );
      }

      vendor.paidAmount = (
        Number(vendor.paidAmount) + Number(transactionPayload.amount)
      ).toString();

      // check if the vendor pendingAmount is greater than the transaction amount

      if (Number(vendor.pendingAmount) < Number(transactionPayload.amount)) {
        throw new Error(
          'Vendor pending amount is less than the transaction amount'
        );
      }

      vendor.pendingAmount = (
        Number(vendor.pendingAmount) - Number(transactionPayload.amount)
      ).toString();

      await vendor.save({ session });

      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Transaction Created Successfully',
        data: registerTransaction,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating transaction',
      error,
    });
  }
};

export const printTransactions = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { startDate, endDate, vendorIds }: any = req.query;

    const transactionCondition: any = {
      createdBy: userId,
    };

    if (startDate && endDate) {
      transactionCondition.paymentDate = { $gte: startDate, $lte: endDate };
    }

    if (vendorIds) {
      const venderId = vendorIds.split(',');
      console.log('venderId :: ', venderId);
      transactionCondition.vendorId = { $in: venderId };
    }

    const transaction = await Transaction.find(transactionCondition, [
      'amount',
      'paymentDate',
      'paymentMethod',
    ])
      .sort({ paymentDate: 1 })
      .populate('vendorId', ['name']);

    if (!transaction) throw new Error('Transaction not found');

    const totalAmount = transaction.reduce(
      (acc: number, item: any) => acc + Number(item.amount),
      0
    );

    console.log('totalAmount :: ', totalAmount);

    handleSuccess(res, {
      message: 'Transaction Fetched Successfully',
      data: {
        transaction,
        totalAmount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching Transaction',
      error,
    });
  }
};
