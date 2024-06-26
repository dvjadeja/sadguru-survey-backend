import { Request, Response } from 'express';

import { z } from 'zod';
import puppeteer from 'puppeteer';
import { readFileSync } from 'fs';
import hbs from 'handlebars';

import { Ledger, LorryReceipt, LorryReceiptInvoice } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import db from '../setups/mongo';

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
    }).populate('organizationDetails', [
      'companyName',
      'gst',
      'pan',
      'address',
      'country',
      'state',
      'zipCode',
      'logo',
      'stamp',
      'bankDetails',
    ]);

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

export const createLorryReceiptInvoice = async (
  req: Request,
  res: Response
) => {
  const lorryReceiptInvoiceValidator = z.object({
    invoiceNo: z.string(),
    ledgerId: z.string(),
    invoiceDate: z.string(),
    dueDate: z.string(),
    lorryReceiptIds: z.array(z.string()),
    ownOrganization: z.boolean(),
    organizationDetails: z.string().optional(),
    gstApplicable: z.boolean(),
    gstPercentage: z.number().optional(),
    gstType: z.enum(['SGST-CGST', 'IGST']).optional(),
    gstAmount: z.number().optional(),
    subTotal: z.number(),
    totalAmount: z.number(),
    remarks: z.string().optional(),
  });

  // Initiate transaction
  const session = await db.startSession();

  // Start transaction
  session.startTransaction();

  try {
    lorryReceiptInvoiceValidator.parse(req.body);

    const { userId } = res.locals.user;

    const lorryReceiptInvoicePayload = req.body;

    // Check if the same invoiceNo already exists
    const existingInvoice = await LorryReceiptInvoice.findOne({
      invoiceNo: lorryReceiptInvoicePayload.invoiceNo,
      createdBy: userId,
    });

    if (existingInvoice) {
      throw new Error('Invoice No already exists');
    }

    const lorryReceiptInvoice = new LorryReceiptInvoice({
      ...lorryReceiptInvoicePayload,
      createdBy: userId,
    });

    const newLorryReceiptInvoice = await lorryReceiptInvoice.save({
      session: session,
    });

    if (!newLorryReceiptInvoice)
      throw new Error('Lorry receipt invoice not created');

    // Update the totalAmount & pendingAmount in the Ledger document
    const ledger = await Ledger.findOneAndUpdate(
      {
        _id: lorryReceiptInvoicePayload.ledgerId,
        createdBy: userId,
      },
      {
        $inc: {
          totalAmount: lorryReceiptInvoicePayload.totalAmount,
          pendingAmount: lorryReceiptInvoicePayload.totalAmount,
        },
      },
      {
        session: session,
      }
    );

    if (!ledger) throw new Error('Ledger not found');

    // Update all the ledgers in the LorryReceipt to be GENERATED in invoiceStatus

    const lorryReceipts = await LorryReceipt.find(
      {
        _id: { $in: lorryReceiptInvoicePayload.lorryReceiptIds },
        createdBy: userId,
      },
      [],
      { session: session }
    );

    if (!lorryReceipts) throw new Error('Lorry receipt not found');

    for (const lorryReceipt of lorryReceipts) {
      lorryReceipt.invoiceStatus = 'GENERATED';
      await lorryReceipt.save({ session: session });
    }

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: 'Lorry receipt invoice created successfully',
      data: newLorryReceiptInvoice,
    });
  } catch (error) {
    // Rollback transaction
    await session.abortTransaction();
    session.endSession();

    handleErrors(req, res, {
      message: 'Error while creating lorry receipt invoice',
      error,
    });
  }
};

export const printLorryReceiptInvoice = async (req: Request, res: Response) => {
  try {
    const { userId, company } = res.locals.user;
    const html = readFileSync('./templates/invoice/lr/index.html', 'utf-8');

    const template = hbs.compile(html);

    const payloadData = {
      companyName: company.name,
    };

    const htmlToSend = template(payloadData);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--headless',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();

    await page.setContent(htmlToSend);

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
    });

    await browser.close();

    res.setHeader('Content-Type', 'application/pdf');

    const buffer = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);

    res.status(200).send(buffer);

    // handleSuccess(res, {
    //   message: 'Lorry receipt invoice printed successfully',
    //   data: buffer,
    // });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while printing lorry receipt invoice',
      error,
    });
  }
};
