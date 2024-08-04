import { Request, Response } from 'express';
import { z } from 'zod';

import { Driver, DriverSalary } from '../models';
import { PAYMENT_TYPE } from '../constants';
import { handleErrors, handleSuccess } from '../utils/response.utils';

export const listDriverSalary = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search }: any = req.query;

    const driverSalarys = await DriverSalary.find(
      {
        createdBy: userId,
        ...(search && {
          $or: [{ driverName: new RegExp(search, 'i') }],
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
    );

    if (!driverSalarys) throw new Error('Driver salary not found');

    const driverSalarysCount = await DriverSalary.find({
      createdBy: userId,
      ...(search && {
        $or: [{ driverName: new RegExp(search, 'i') }],
      }),
    }).countDocuments();

    handleSuccess(res, {
      message: 'Driver salary retrieved successfully',
      data: {
        data: driverSalarys,
        count: driverSalarysCount,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching driver salary',
      error,
    });
  }
};

export const createDriverSalary = async (req: Request, res: Response) => {
  const driverSalaryValidator = z
    .object({
      driverId: z.string(),
      month: z.enum([
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ]),
      year: z.number(),
      basicSalary: z.number(),
      incentives: z.number(),
      deductions: z.number(),
      totalSalary: z.number(),
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
      paymentDate: z.string().optional(),
      remarks: z.string().optional(),
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

  try {
    driverSalaryValidator.parse(req.body);
    const { userId } = res.locals.user;
    const driverSalaryPayload = req.body;

    const driver = await Driver.findOne({
      _id: driverSalaryPayload.driverId,
      createdBy: userId,
    });

    if (!driver) throw new Error('Driver not found');

    // Before creating the salary check if the driver already has a salary
    const driverSalary = await DriverSalary.findOne({
      driverId: driverSalaryPayload.driverId,
      month: driverSalaryPayload.month,
      year: driverSalaryPayload.year,
    });

    if (driverSalary) throw new Error('Driver salary already exists');

    const newDriverSalary = new DriverSalary({
      ...driverSalaryPayload,
      driverName: `${driver.firstName} ${driver.lastName}`,
      createdBy: userId,
    });

    const registeredDriverSalary = await newDriverSalary.save();

    if (!registeredDriverSalary) throw new Error('Driver salary not created');

    handleSuccess(res, {
      message: 'Driver salary created successfully',
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while creating driver salary',
      error,
    });
  }
};

export const getDriverSalary = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id } = req.query;

    const driverSalary = await DriverSalary.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    }).populate('driverId');

    if (!driverSalary) throw new Error('Driver salary not found');

    handleSuccess(res, {
      message: 'Driver salary fetched successfully',
      data: driverSalary,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching driver salary',
      error,
    });
  }
};
