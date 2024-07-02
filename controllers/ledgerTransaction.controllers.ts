import { Request, Response } from 'express';
import { z } from 'zod';

import db from '../setups/mongo';
import { Ledger, LedgerTransaction, LorryReceiptInvoice } from '../models';

import { handleErrors, handleSuccess } from '../utils/response.utils';

import { PAYMENT_TYPE } from '../constants';

export const listLedgerTransactions = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10 }: any = req.query;

    const ledgerTransactions = await LedgerTransaction.find(
      {
        createdBy: userId,
      },
      [
        'paymentDate',
        'invoiceType',
        'invoiceAmount',
        'tds',
        'paymentMethod',
        'amountAfterTds',
      ],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    )
      .populate('ledgerId', ['legalName'])
      .populate('invoiceId', ['invoiceNo']);

    const ledgerTransactionsCount = await LedgerTransaction.find({
      createdBy: userId,
    }).countDocuments();

    handleSuccess(res, {
      message: 'Ledger Transactions Fetched Successfully',
      data: {
        data: ledgerTransactions,
        count: ledgerTransactionsCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching ledger transactions',
      error,
    });
  }
};

export const createLedgerTransaction = async (req: Request, res: Response) => {
  const ledgerTransactionValidator = z
    .object({
      invoiceType: z.enum(['LorryReceiptInvoice', 'LocalTripInvoice']),
      invoiceId: z.string(),
      invoiceAmount: z.number(),
      tds: z.number(),
      amountAfterTds: z.number(),
      paymentDate: z.string(),
      paymentMethod: z
        .object({
          paymentType: z
            .enum(['CASH', 'RTGS', 'NEFT', 'CHEQUE', 'UPI'])
            .optional(),
          paymentReferenceNumber: z.string().optional(),
        })
        .optional(),
    })
    .superRefine(({ paymentMethod }, refinementContext) => {
      if (
        paymentMethod?.paymentType !== PAYMENT_TYPE.CASH &&
        !paymentMethod?.paymentReferenceNumber
      ) {
        refinementContext.addIssue({
          code: 'custom',
          message:
            'Payment Reference Number is required for non cash payment type',
          path: ['paymentMethod.paymentReferenceNumber'],
        });
      }
    });

  const session = await db.startSession();

  session.startTransaction();

  try {
    ledgerTransactionValidator.parse(req.body);
    const { userId } = res.locals.user;
    const {
      invoiceType,
      invoiceId,
      invoiceAmount,
      tds,
      amountAfterTds,
      paymentDate,
      paymentMethod: { paymentType, paymentReferenceNumber },
    } = req.body;

    if (invoiceType === 'LorryReceiptInvoice') {
      // Find Lorry Receipt Invoice
      const lorryReceiptInvoice = await LorryReceiptInvoice.findOne({
        _id: invoiceId,
        createdBy: userId,
      });

      if (!lorryReceiptInvoice) {
        throw new Error('Lorry Receipt Invoice Not Found');
      }

      // Check if the lorryReceiptInvoice.paymentStatus is PAID
      if (lorryReceiptInvoice.paymentStatus === 'PAID')
        throw new Error('Lorry Receipt Invoice is Already Paid');

      // Check if the lorryReceiptInvoice.totalAmount is equal to invoiceAmount
      if (lorryReceiptInvoice.totalAmount !== invoiceAmount)
        throw new Error(
          'Lorry Receipt Invoice Total Amount is Not Equal to Invoice Amount'
        );

      // Check if the ledgers pendingAmount is greater than the invoiceAmount
      const ledger = await Ledger.findOne({
        _id: lorryReceiptInvoice?.ledgerId,
      });

      if (!ledger) throw new Error('Ledger Not Found');

      if (Number(ledger.pendingAmount) < invoiceAmount)
        throw new Error(
          'Ledger pending amount is less than the invoice amount'
        );

      // Create Ledger Transaction
      const newLedgerTransaction = new LedgerTransaction({
        ledgerId: lorryReceiptInvoice?.ledgerId,
        invoiceType,
        invoiceId,
        invoiceAmount,
        tds,
        amountAfterTds,
        paymentDate,
        paymentMethod: {
          paymentType,
          ...(paymentType !== 'CASH' && { paymentReferenceNumber }),
        },
        createdBy: userId,
      });

      const registerLedgerTransaction = await newLedgerTransaction.save({
        session,
      });

      if (registerLedgerTransaction) {
        // Update Lorry Receipt Invoice
        const updateLorryReceiptInvoice =
          await LorryReceiptInvoice.findOneAndUpdate(
            {
              _id: invoiceId,
              createdBy: userId,
            },
            {
              $set: {
                paymentStatus: 'PAID',
              },
            },
            { session }
          );

        if (!updateLorryReceiptInvoice)
          throw new Error('Lorry Receipt Invoice Not Found');

        // Update Ledger by deducting invoiceAmount in ledgers pendingAmount and inc the paidAmount by invoiceAmount
        const updateLedger = await Ledger.findOneAndUpdate(
          {
            _id: ledger?._id,
            createdBy: userId,
          },
          {
            $inc: {
              pendingAmount: -invoiceAmount,
              paidAmount: invoiceAmount,
            },
          },
          { session }
        );

        if (!updateLedger) throw new Error('Ledger Not Found');

        if (updateLorryReceiptInvoice && updateLedger) {
          await session.commitTransaction();
          session.endSession();

          handleSuccess(res, {
            message: 'Ledger Transaction Created Successfully',
            data: registerLedgerTransaction,
          });
        }
      }
    } else if (invoiceType === 'LocalTripInvoice') {
      // TODO: Implement After Local Trip Invoice
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating ledger transaction',
      error,
    });
  }
};
