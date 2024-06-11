import { Request, Response } from 'express';
import { Vehicle } from '../models';
import { VEHICLE_STATUS } from '../constants';
import { handleErrors, handleSuccess } from '../utils/response.utils';

export const getVehicleWidgetData = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;

    const totalVehicles = await Vehicle.countDocuments({ createdBy: userId });

    // if (!totalVehicles) throw new Error('No vehicles found');

    const activeVehicles = await Vehicle.countDocuments({
      createdBy: userId,
      currentStatus: VEHICLE_STATUS.ACTIVE,
    });

    // if (!activeVehicles) throw new Error('No active vehicles found');

    const inactiveVehicles = await Vehicle.countDocuments({
      createdBy: userId,
      currentStatus: VEHICLE_STATUS.INACTIVE,
    });

    // if (!inactiveVehicles) throw new Error('No inactive vehicles found');

    const underMaintenanceVehicles = await Vehicle.countDocuments({
      createdBy: userId,
      currentStatus: VEHICLE_STATUS.UNDER_MAINTENANCE,
    });

    // if (!underMaintenanceVehicles)
    //   throw new Error('No under maintenance vehicles found');

    handleSuccess(res, {
      message: 'Vehicle Widget Data Fetched Successfully',
      data: {
        totalVehicles,
        activeVehicles,
        inactiveVehicles,
        underMaintenanceVehicles,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while fetching vehicle widget data.',
      error,
    });
  }
};
