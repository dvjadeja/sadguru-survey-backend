import { Request, Response } from 'express';
import { DailyLog } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import { z } from 'zod';
import db from '../setups/mongo';

export const listDailyLogs = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page, limit = 10, search }: any = req.query;

    const dailyLogs: any = await DailyLog.aggregate([
      {
        $lookup: {
          from: 'vehicles',
          localField: 'vehicleId',
          foreignField: '_id',
          as: 'vehicleId',
        },
      },
      {
        $unwind: '$vehicleId',
      },
      {
        $match: {
          createdBy: new db.Types.ObjectId(userId),
          ...(search && {
            'vehicleId.registration.plateNumber': new RegExp(search, 'i'),
          }),
        },
      },
      {
        $project: {
          date: 1,
          trips: 1,
          fuel: 1,
          tripIncentive: 1,
          remarks: 1,
          'vehicleId.registration.plateNumber': 1,
        },
      },
      {
        $facet: {
          data: [
            { $skip: parseInt(page) * parseInt(limit) },
            { $limit: parseInt(limit) },
          ],
          totalCount: [
            {
              $count: 'count',
            },
          ],
        },
      },
      {
        $unwind: '$totalCount',
      },
    ]);

    handleSuccess(res, {
      message: 'Daily Logs Fetched Successfully',
      data: {
        data: dailyLogs[0]?.data,
        count: dailyLogs[0]?.totalCount?.count,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching daily logs',
      error,
    });
  }
};

export const createDailyLog = async (req: Request, res: Response) => {
  const dailyLogsValidator = z.object({
    date: z.string(),
    vehicleId: z.string(),
    trips: z.number(),
    fuel: z.number(),
    tripIncentive: z.number().optional(),
    remarks: z.string().optional(),
  });
  try {
    dailyLogsValidator.parse(req.body);
    const { userId } = res.locals.user;

    const { date, vehicleId, trips, fuel, tripIncentive, remarks } = req.body;

    const newDailyLog = new DailyLog({
      date,
      vehicleId,
      trips,
      fuel,
      tripIncentive,
      remarks,
      createdBy: userId,
    });

    const registerDailyLog = await newDailyLog.save();

    if (registerDailyLog) {
      handleSuccess(res, {
        message: 'Daily Log Created Successfully',
        data: registerDailyLog,
      });
    }
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while creating daily log',
      error,
    });
  }
};

// Get Single Daily Log
export const getDailyLog = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id } = req.query;
    const dailyLog = await DailyLog.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    }).populate('vehicleId', ['registration.plateNumber']);

    if (!dailyLog) throw new Error(`Daily Log with ${id} not found`);

    handleSuccess(res, {
      message: 'Daily Log Fetched Successfully',
      data: dailyLog,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching daily log',
      error,
    });
  }
};

export const updateDailyLog = async (req: Request, res: Response) => {
  const dailyLogsValidator = z.object({
    dailyLogId: z.string(),
    date: z.string().optional(),
    vehicleId: z.string().optional(),
    trips: z.number().optional(),
    fuel: z.number().optional(),
    tripIncentive: z.number().optional(),
    remarks: z.string().optional(),
  });
  try {
    dailyLogsValidator.parse(req.body);

    const { userId } = res.locals.user;
    const { dailyLogId, ...dailyLogPayload } = req.body;

    const dailyLog = await DailyLog.findOneAndUpdate(
      {
        $and: [{ _id: dailyLogId }, { createdBy: userId }],
      },
      dailyLogPayload,
      { new: true }
    );

    if (!dailyLog) throw new Error(`Daily Log with ${dailyLogId} not found`);

    handleSuccess(res, {
      message: 'Daily Log Updated Successfully',
      data: dailyLog,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while updating daily log',
      error,
    });
  }
};

// Delete Daily Log
export const deleteDailyLog = async (req: Request, res: Response) => {
  const dailyLogsValidator = z.object({
    dailyLogId: z.string(),
  });
  try {
    dailyLogsValidator.parse(req.body);
    const { userId } = res.locals.user;
    const { dailyLogId } = req.body;
    const dailyLog = await DailyLog.findOneAndDelete({
      $and: [{ _id: dailyLogId }, { createdBy: userId }],
    });

    if (!dailyLog) throw new Error(`Daily Log with ${dailyLogId} not found`);

    handleSuccess(res, {
      message: 'Daily Log Deleted Successfully',
      data: dailyLog,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while deleting daily log',
      error,
    });
  }
};

export const printDailyLog = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { startDate, endDate, vehicleIds }: any = req.query;

    const dailyLogCondition: any = {
      createdBy: userId,
    };

    if (startDate && endDate) {
      dailyLogCondition.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    if (vehicleIds) {
      const vehicleId = vehicleIds.split(',');
      dailyLogCondition.vehicleId = { $in: vehicleId };
    }

    const dailyLogs = await DailyLog.find(dailyLogCondition).populate(
      'vehicleId',
      ['registration.plateNumber']
    );

    if (!dailyLogs) throw new Error('Daily Logs not found');

    handleSuccess(res, {
      message: 'Daily Logs Fetched Successfully',
      data: dailyLogs,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching daily logs',
      error,
    });
  }
};
