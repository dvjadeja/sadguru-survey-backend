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
    gst: z.string().optional(),
    pan: z.string().optional(),
    totalAmount: z.string(),
    pendingAmount: z.string(),
    paidAmount: z.string(),
  });
  try {
    vendorValidator.parse(req.body);
    const { userId } = res.locals.user;
    const vendorPayload = req.body;

    // find vendor with same gst or pan
    // if (vendorPayload.gst) {
    //   const vendor = await Vendor.findOne({
    //     $or: [{ gst: vendorPayload.gst }],
    //   });
    //   if (vendor) {
    //     throw new Error('Vendor already exists with same gst');
    //   }
    // }

    // if (vendorPayload.pan) {
    //   const vendor = await Vendor.findOne({
    //     $or: [{ pan: vendorPayload.pan }],
    //   });
    //   if (vendor) {
    //     throw new Error('Vendor already exists with same pan');
    //   }
    // }

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

// List all vendor of user
export const listAllVendors = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const vendors = await Vendor.find({ createdBy: userId }, ['name'], {
      sort: { createdAt: -1 },
    });

    const newVendors = vendors.map((vendor) => ({
      label: vendor.name,
      value: vendor._id,
    }));

    handleSuccess(res, {
      message: 'Vendors Fetched Successfully',
      data: newVendors,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vendors',
      error,
    });
  }
};

export const printAllVendorDataForExcel = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = res.locals.user;
    const vendors = await Vendor.find(
      { createdBy: userId },
      ['name', 'totalAmount', 'pendingAmount', 'paidAmount'],
      {
        sort: { createdAt: -1 },
      }
    );

    if (!vendors) throw new Error('No vendors found');

    const totalPaidAmount = vendors
      .map((vendor) => Number(vendor.paidAmount))
      .reduce((a, b) => a + b, 0)
      .toFixed(2);

    const totalPendingAmount = vendors
      .map((vendor) => Number(vendor.pendingAmount))
      .reduce((a, b) => a + b, 0)
      .toFixed(2);

    const totalAmount = vendors
      .map((vendor) => Number(vendor.totalAmount))
      .reduce((a, b) => a + b, 0)
      .toFixed(2);

    const newVendors = vendors.map((vendor) => ({
      name: vendor.name,
      totalAmount: Number(vendor.totalAmount).toFixed(2),
      pendingAmount: Number(vendor.pendingAmount).toFixed(2),
      paidAmount: Number(vendor.paidAmount).toFixed(2),
    }));

    handleSuccess(res, {
      message: 'Vendors Fetched Successfully',
      data: {
        data: newVendors,
        totalPaidAmount,
        totalPendingAmount,
        totalAmount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching vendors',
      error,
    });
  }
};
