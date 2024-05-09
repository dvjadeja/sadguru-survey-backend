import { Request, Response } from 'express';
import { Vendor } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { z } from 'zod';

export const listVendor = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10, search }: any = req.query;

    const vendors = await Vendor.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [
            { name: new RegExp(search, 'i') },
            { phone: new RegExp(search, 'i') },
            { gst: new RegExp(search, 'i') },
            { pan: new RegExp(search, 'i') },
          ],
        }),
      },
      ['name', 'phone', 'totalAmount', 'pendingAmount', 'paidAmount'],
      {
        sort: {
          createdAt: -1,
        },
        skip: parseInt(page) * parseInt(limit),
        limit: parseInt(limit),
      }
    );

    const vendorsCount = await Vendor.find({
      createdBy: userId,
      ...(search && {
        $or: [
          { name: new RegExp(search, 'i') },
          { phone: new RegExp(search, 'i') },
          { gst: new RegExp(search, 'i') },
          { pan: new RegExp(search, 'i') },
        ],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: 'Vendors List Fetched Successfully',
      data: {
        data: vendors,
        count: vendorsCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vendors',
      error,
    });
  }
};

// Get Single Vendor
export const getVendor = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id } = req.query;
    const vendor = await Vendor.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (!vendor) throw new Error(`Vendor with ${id} not found`);

    handleSuccess(res, {
      message: 'Vendor Fetched Successfully',
      data: vendor,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vendor',
      error,
    });
  }
};

// Create Vendor with yup validations
export const createVendor = async (req: Request, res: Response) => {
  const vendorValidator = z.object({
    name: z.string(),
    phone: z.string(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),
    gst: z.string(),
    pan: z.string(),
    totalAmount: z.string(),
    pendingAmount: z.string(),
    paidAmount: z.string(),
  });
  try {
    vendorValidator.parse(req.body);
    const { userId } = res.locals.user;
    const vendorPayload = req.body;

    // find vendor with same gst or pan or phone or name
    const vendor = await Vendor.findOne({
      $or: [
        { gst: vendorPayload.gst },
        { pan: vendorPayload.pan },
        { phone: vendorPayload.phone },
        { name: vendorPayload.name },
      ],
    });
    if (vendor) {
      throw new Error('Vendor already exists');
    }

    const newVendor = new Vendor({
      ...vendorPayload,
      createdBy: userId,
    });

    const registerVendor = await newVendor.save();

    if (registerVendor) {
      handleSuccess(res, {
        message: 'Vendor Created Successfully',
        data: registerVendor,
      });
    }
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while creating vendor',
      error,
    });
  }
};

// Update the Vendor
export const updateVendor = async (req: Request, res: Response) => {
  const vendorValidator = z.object({
    vendorId: z.string(),
    name: z.string().optional(),
    phone: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipCode: z.string().optional(),
        country: z.string().optional(),
      })
      .optional(),
    gst: z.string().optional(),
    pan: z.string().optional(),
    totalAmount: z.string().optional(),
    pendingAmount: z.string().optional(),
    paidAmount: z.string().optional(),
  });
  try {
    vendorValidator.parse(req.body);
    const { userId } = res.locals.user;
    const { vendorId, ...vendorPayload } = req.body;
    const vendor = await Vendor.findOne({
      $and: [{ _id: vendorId }, { createdBy: userId }],
    });

    if (!vendor) throw new Error(`Vendor with ${vendorId} not found`);

    const updatedVendor = await Vendor.findOneAndUpdate(
      { $and: [{ _id: vendorId }, { createdBy: userId }] },
      vendorPayload,
      { new: true }
    );

    if (!updatedVendor) throw new Error(`Error while updating vendor`);

    handleSuccess(res, {
      message: 'Vendor Updated Successfully',
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating vendor',
      error,
    });
  }
};
