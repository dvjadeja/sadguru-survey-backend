import { Request, Response } from 'express';
import { z } from 'zod';

import { OtherOrganization } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';

export const listOtherOrganizations = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;

    const otherOrganizations = await OtherOrganization.find({
      createdBy: userId,
    });

    if (!otherOrganizations) throw new Error('Other organizations not found');

    handleSuccess(res, {
      message: 'Other organizations fetched successfully',
      data: otherOrganizations,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching other organizations',
      error,
    });
  }
};

export const createOtherOrganization = async (req: Request, res: Response) => {
  const otherOrganizationValidator = z.object({
    companyName: z.string(),
    gst: z.string().optional(),
    pan: z.string().optional(),
    address: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    logo: z.string().optional(),
    stamp: z.string().optional(),
    bankDetails: z
      .object({
        accountHolderName: z.string().optional(),
        accountNumber: z.string().optional(),
        bankName: z.string().optional(),
        ifscCode: z.string().optional(),
        branch: z.string().optional(),
      })
      .optional(),
  });

  try {
    otherOrganizationValidator.parse(req.body);
    const { userId } = res.locals.user;
    const { ...otherOrganizationPayload } = req.body;

    // Check if the same companyName orrganization already exists
    const existingOtherOrganization = await OtherOrganization.findOne({
      companyName: otherOrganizationPayload.companyName,
      createdBy: userId,
    });

    if (existingOtherOrganization) {
      throw new Error('Other organization already exists');
    }

    const otherOrganization = new OtherOrganization({
      ...otherOrganizationPayload,
      createdBy: userId,
    });

    const newOtherOrganization = await otherOrganization.save();

    if (!newOtherOrganization)
      throw new Error('Other organization not created');

    handleSuccess(res, {
      message: 'Other organization created successfully',
      data: newOtherOrganization,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while creating other organization',
      error,
    });
  }
};

export const getOtherOrganizationDetail = async (
  req: Request,
  res: Response
) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const otherOrganization = await OtherOrganization.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    });

    if (!otherOrganization)
      throw new Error(`Other organization with ${id} not found`);

    handleSuccess(res, {
      message: 'Other organization fetched successfully',
      data: otherOrganization,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching other organization',
      error,
    });
  }
};

export const updateOtherOrganization = async (req: Request, res: Response) => {
  const otherOrganizationValidator = z.object({
    _id: z.string(),
    companyName: z.string().optional(),
    gst: z.string().optional(),
    pan: z.string().optional(),
    address: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    logo: z.string().optional(),
    stamp: z.string().optional(),
    bankDetails: z
      .object({
        accountHolderName: z.string().optional(),
        accountNumber: z.string().optional(),
        bankName: z.string().optional(),
        ifscCode: z.string().optional(),
        branch: z.string().optional(),
      })
      .optional(),
  });

  try {
    otherOrganizationValidator.parse(req.body);
    const { userId } = res.locals.user;
    const { _id, ...otherOrganizationPayload } = req.body;

    const otherOrganization = await OtherOrganization.findOneAndUpdate(
      { _id, createdBy: userId },
      { ...otherOrganizationPayload },
      { new: true }
    );

    if (!otherOrganization) throw new Error('Other organization not found');

    handleSuccess(res, {
      message: 'Other organization updated successfully',
      data: otherOrganization,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating other organization',
      error,
    });
  }
};
