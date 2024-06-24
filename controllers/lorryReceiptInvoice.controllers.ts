import { Request, Response } from 'express';
import { Ledger, LorryReceipt, LorryReceiptInvoice } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import db from '../setups/mongo';
import { z } from 'zod';

export const listLorryReceiptInvoices = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search = '' }: any = req.query;

    const lorryReceiptInvoices = await LorryReceiptInvoice.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [{ invoiceNo: new RegExp(search, 'i') }],
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
    ).populate('ledgerId', ['ledgerName']);

    if (!lorryReceiptInvoices)
      throw new Error('Lorry receipt invoice not found');

    const lorryReceiptInvoicesCount = await LorryReceiptInvoice.find({
      createdBy: userId,
      ...(search && {
        $or: [{ invoiceNo: new RegExp(search, 'i') }],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: 'Lorry receipt invoices fetched successfully',
      data: {
        data: lorryReceiptInvoices,
        count: lorryReceiptInvoicesCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching lorry receipt invoices',
      error,
    });
  }
};

export const getDataFromLrIds = async (req: Request, res: Response) => {
  try {
    const {
      userId,
      company: { prefix },
    } = res.locals.user;
    const { lorryReceiptIds } = req.body;

    // Find all the lorryReciepts in the lorryReceiptIds array also check if the invoiceStatus is PENDING

    const lorryReceipts = await LorryReceipt.find({
      _id: { $in: lorryReceiptIds },
      createdBy: userId,
      invoiceStatus: 'PENDING',
    });

    if (lorryReceipts.length !== lorryReceiptIds.length)
      throw new Error('Lorry receipt(s) not found');

    // Make a Invoice number based on the User Company Prefix/currentyear-nextYear/lenght of lorryReceiptInvoice + 1

    const invoiceCount = await LorryReceiptInvoice.countDocuments({
      createdBy: userId,
    });

    let invoiceNo = '';
    if (prefix) {
      invoiceNo = `${prefix}/INV/${new Date().getFullYear()}-${
        new Date().getFullYear() + 1
      }/${invoiceCount + 1}`;
    } else {
      invoiceNo = `INV/${new Date().getFullYear()}/${
        new Date().getFullYear() + 1
      }/${invoiceCount + 1}`;
    }

    // Check if in all the lorryReceipts billigParty is same or not and after that fetch the details of blijgParty
    // Extract billingParty from each object
    const billingParties = lorryReceipts.map((item) => {
      const newitem = item.toObject();

      return newitem.billingParty.toString();
    });

    // Check if all billingParty values are the same
    const allSameBillingParty = billingParties.every(
      (billingParty) => billingParty === billingParties[0]
    );

    if (!allSameBillingParty)
      throw new Error('All lorry receipts should have same billing party');

    // Fetch the details of billingParty
    const billingParty = await Ledger.findOne({
      _id: billingParties[0],
      createdBy: userId,
    });

    if (!billingParty) throw new Error('Billing party not found');

    // Calculate totalAmount from all of the lorryReceipt by adding rate, detentionAmount, advance, tollPlazaAmount, adaniFee
    // const totalAmount = lorryReceipts.reduce((acc, lorryReceipt) => {
    //   const receipt = lorryReceipt.toObject(); // Convert the document to a plain object

    //   const rate = parseFloat(receipt.rate?.toFixed(2) || '0');
    //   const detentionAmount = parseFloat(
    //     receipt.detentionAmount?.toFixed(2) || '0'
    //   );
    //   const advance = parseFloat(receipt.advance?.toFixed(2) || '0');
    //   const tollPlazaAmount = parseFloat(
    //     receipt.tollPlazaAmount?.toFixed(2) || '0'
    //   );
    //   const adaniFee = parseFloat(receipt.adaniFee?.toFixed(2) || '0');

    //   const totalAmount =
    //     rate + detentionAmount + advance + tollPlazaAmount + adaniFee;

    //   return acc + totalAmount;
    // }, 0);

    handleSuccess(res, {
      message: 'Lorry receipt fetched successfully',
      data: { data: lorryReceipts, invoiceNo, billingParty },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching lorry receipt data',
      error,
    });
  }
};
