import { Request, Response } from 'express';
import { date, z } from 'zod';
import { Ledger } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';

export const listLedger = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10, search }: any = req.query;

    const ledger = await Ledger.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [
            { gstin: new RegExp(search, 'i') },
            { tradeName: new RegExp(search, 'i') },
            { legalName: new RegExp(search, 'i') },
            { gstStatus: new RegExp(search, 'i') },
            { pan: new RegExp(search, 'i') },
          ],
        }),
      },
      [
        'legalName',
        'contactName',
        'contactNumber',
        'gstin',
        'totalAmount',
        'paidAmount',
        'pendingAmount',
      ]
    )
      .sort({ createdAt: -1 })
      .skip(parseInt(page) * parseInt(limit))
      .limit(parseInt(limit));

    const ledgerCount = await Ledger.find({
      createdBy: userId,
      ...(search && {
        $or: [
          { gstin: new RegExp(search, 'i') },
          { tradeName: new RegExp(search, 'i') },
          { legalName: new RegExp(search, 'i') },
          { gstStatus: new RegExp(search, 'i') },
          { pan: new RegExp(search, 'i') },
        ],
      }),
    }).countDocuments();

    const newLedger: any = ledger.map((ledger) => {
      return {
        ...ledger.toJSON(),
        gstin: ledger.gstin,
        tradeName: ledger.tradeName,
        legalName: ledger.legalName,
        gstStatus: ledger.gstStatus,
        pan: ledger.pan,
        totalAmount: ledger.totalAmount.toString(),
        paidAmount: ledger.paidAmount.toString(),
        pendingAmount: ledger.pendingAmount.toString(),
      };
    });

    handleSuccess(res, {
      message: 'Ledger fetched successfully',
      data: {
        data: newLedger,
        count: ledgerCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      error,
      message: 'Error while fetching ledger',
    });
  }
};
export const createLedger = async (req: Request, res: Response) => {
  const ledgerValidator = z.object({
    gstin: z.string(),
    totalAmount: z.number().min(0),
    paidAmount: z.number().min(0),
    pendingAmount: z.number().min(0),
    tradeName: z.string(),
    legalName: z.string(),
    gstStatus: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']),
    pan: z.string().optional(),
    address: z
      .object({
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        pincode: z.string().optional(),
      })
      .optional(),
    contactName: z.string().optional(),
    contactNumber: z.string().optional(),
    email: z.string().optional(),
    remarks: z.string().optional(),
  });
  try {
    ledgerValidator.parse(req.body);

    const { userId } = res.locals.user;
    const { ...ledgerPayload } = req.body;

    const ledger = new Ledger({
      ...ledgerPayload,
      createdBy: userId,
    });

    const newLedger = await ledger.save();

    if (!newLedger) throw new Error('Ledger not created');

    handleSuccess(res, {
      message: 'Ledger created successfully',
      data: newLedger,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while creating ledger',
      error,
    });
  }
};

export const updateLedger = async (req: Request, res: Response) => {
  const ledgerValidator = z.object({
    ledgerId: z.string(),
    gstin: z.string().optional(),
    totalAmount: z.number().min(0).optional(),
    paidAmount: z.number().min(0).optional(),
    pendingAmount: z.number().min(0).optional(),
    tradeName: z.string().optional(),
    legalName: z.string().optional(),
    gstStatus: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
    pan: z.string().optional(),
    address: z
      .object({
        address: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        pincode: z.string().optional(),
      })
      .optional(),
    contactName: z.string().optional(),
    contactNumber: z.string().optional(),
    email: z.string().optional(),
    remarks: z.string().optional(),
  });

  try {
    ledgerValidator.parse(req.body);

    const { userId } = res.locals.user;
    const { ledgerId, ...ledgerPayload } = req.body;

    const ledger = await Ledger.findOne({ _id: ledgerId, createdBy: userId });

    if (!ledger) throw new Error('Ledger not found');

    const updatedLedger = await Ledger.findOneAndUpdate(
      { _id: ledgerId, createdBy: userId },
      ledgerPayload,
      { new: true }
    );

    if (!updatedLedger) throw new Error('Ledger not updated');

    handleSuccess(res, {
      message: 'Ledger updated successfully',
      data: updatedLedger,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating ledger',
      error,
    });
  }
};

export const deleteLedger = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { ledgerId } = req.body;

    const deletedLedger = await Ledger.findOneAndDelete({
      _id: ledgerId,
      createdBy: userId,
    });

    if (!deletedLedger) throw new Error('Ledger not found');

    handleSuccess(res, {
      message: 'Ledger deleted successfully',
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while deleting ledger',
      error,
    });
  }
};

export const getLedger = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { ledgerId } = req.query;

    const ledger = await Ledger.findOne({ _id: ledgerId, createdBy: userId });

    if (!ledger) throw new Error('Ledger not found');

    // change decimal toString() of totalAmount, paidAmount, pendingAmount
    const data = {
      ...ledger.toObject(),
      totalAmount: ledger.totalAmount?.toString(),
      paidAmount: ledger.paidAmount?.toString(),
      pendingAmount: ledger.pendingAmount?.toString(),
    };

    handleSuccess(res, {
      message: 'Ledger fetched successfully',
      data: data,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching ledger',
      error,
    });
  }
};
