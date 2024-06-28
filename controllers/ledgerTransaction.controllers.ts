import { Request, Response } from 'express';
import { z } from 'zod';

import db from '../setups/mongo';
import { LedgerTransaction } from '../models';

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
      ['paymentDate', 'amount', 'paymentMethod'],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    ).populate('ledgerId', ['legalName']);

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
