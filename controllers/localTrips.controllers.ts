import { Request, Response } from 'express';
import xlxs from 'xlsx';

import { Ledger, LocalTrip, Vehicle } from '../models';
import { handleErrors, handleSuccess } from '../utils/response.utils';
import db from '../setups/mongo';
import { z } from 'zod';
import { excelDateToJSDate, isDateSerial } from '../utils/xlxs.utils';

interface VehicleDieselTotals {
  [key: string]: number;
}

interface RowData {
  date?: Date;
  containerNo?: string;
  containerSize?: string | number;
  containerType?: string;
  gateInOutMode?: string;
  from?: string;
  to?: string;
  rate?: number;
  diesel?: number;
  driverIncentive?: number;
  tollPlazaAmount?: number;
  advance?: number;
  remarks?: string;
  vehicleId?: string;
  billingParty?: string;
  createdBy?: string;
}

interface ValidationError {
  row: number;
  errors: string[];
}

// Define the mapping of Excel headers to schema fields
const headerMapping: { [key: string]: string } = {
  DATE: 'date',
  'VEHICLE NO': 'vehicleId',
  'CONTAINER NO': 'containerNo',
  SIZE: 'containerSize',
  'CONTAINER TYPE': 'containerType',
  'TRIP TYPE': 'gateInOutMode',
  'BILLING PARTY': 'billingParty',
  FROM: 'from',
  TO: 'to',
  RATE: 'rate',
  DIESEL: 'diesel',
  'DRIVER INCENTIVE': 'driverIncentive',
  TOLL: 'tollPlazaAmount',
  ADVANCE: 'advance',
  REMARKS: 'remarks',
};

export const listLocalTrips = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { page = 0, limit = 10, search }: any = req.query;

    const localTrips = await LocalTrip.aggregate([
      {
        $match: {
          createdBy: new db.Types.ObjectId(userId),
        },
      },
      {
        $sort: { createdAt: -1 },
      },
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
        $lookup: {
          from: 'ledgers',
          localField: 'billingParty',
          foreignField: '_id',
          as: 'billingParty',
        },
      },
      {
        $unwind: '$billingParty',
      },
      {
        // Match from vehicleId or billingParty
        $match: search
          ? {
              $or: [
                {
                  'vehicleId.registration.plateNumber': new RegExp(search, 'i'),
                },
                { 'billingParty.legalName': new RegExp(search, 'i') },
              ],
            }
          : {},
      },
      {
        $project: {
          date: 1,
          'vehicleId.registration.plateNumber': 1,
          containerNo: 1,
          containerSize: 1,
          containerType: 1,
          gateInOutMode: 1,
          'billingParty.legalName': 1,
          from: 1,
          to: 1,
          invoiceStatus: 1,
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
      message: 'Local Trips Fetched Successfully',
      data: {
        data: localTrips[0]?.data,
        count: localTrips[0]?.totalCount?.count,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching local trips',
      error,
    });
  }
};

export const createLocalTrip = async (req: Request, res: Response) => {
  const localTripValidator = z.object({
    date: z.string(),
    vehicleId: z.string(),
    containerNo: z.string(),
    containerSize: z.enum(['20', '40']),
    containerType: z.enum(['EMPTY', 'LOADED']),
    gateInOutMode: z.enum(['INBLOCK', 'RE EXPORT']),
    billingParty: z.string(),
    from: z.string(),
    to: z.string(),
    rate: z.number(),
    diesel: z.number(),
    driverIncentive: z.number().optional(),
    tollPlazaAmount: z.number().optional(),
    advance: z.number().optional(),
    remarks: z.string().optional(),
  });

  // Initial transaction
  const session = await db.startSession();

  // Start transaction
  session.startTransaction();

  try {
    localTripValidator.parse(req.body);

    const { userId } = res.locals.user;

    const newLocalTrip = new LocalTrip({
      ...req.body,
      createdBy: userId,
    });

    const registerLocalTrip = await newLocalTrip.save({ session: session });

    if (!registerLocalTrip) throw new Error('Error While Creating Local Trip');

    // Reduce the vehicle.fuel.availableFuel by diesel
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.body.vehicleId, createdBy: userId },
      { $inc: { 'fuel.availableFuel': -req.body.diesel } },
      { new: true, session: session }
    );

    if (!vehicle) throw new Error('Vehicle not found');

    if (registerLocalTrip) {
      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Local Trip Created Successfully',
        data: registerLocalTrip,
      });
    }
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while creating local trip',
      error,
    });
  }
};

export const getLocalTrip = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const { id }: any = req.query;

    const localTrip = await LocalTrip.findOne({
      $and: [{ _id: id }, { createdBy: userId }],
    })
      .populate('vehicleId', ['registration.plateNumber'])
      .populate('billingParty', ['legalName']);

    if (!localTrip) throw new Error(`Local Trip not found`);

    handleSuccess(res, {
      message: 'Local Trip Fetched Successfully',
      data: localTrip,
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching local trip',
      error,
    });
  }
};

export const updateLocalTrip = async (req: Request, res: Response) => {
  const localTripValidator = z.object({
    localTripId: z.string(),
    date: z.string().optional(),
    vehicleId: z.string().optional(),
    containerNo: z.string().optional(),
    containerSize: z.enum(['20', '40']).optional(),
    containerType: z.enum(['EMPTY', 'LOADED']).optional(),
    gateInOutMode: z.enum(['INBLOCK', 'RE EXPORT']).optional(),
    billingParty: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    rate: z.number().optional(),
    diesel: z.number().optional(),
    driverIncentive: z.number().optional(),
    tollPlazaAmount: z.number().optional(),
    advance: z.number().optional(),
    remarks: z.string().optional(),
  });

  // Initiate transaction
  const session = await db.startSession();
  // Start transaction
  session.startTransaction();

  try {
    localTripValidator.parse(req.body);

    const { userId } = res.locals.user;
    const localTrip = await LocalTrip.findOne({
      $and: [{ _id: req.body.localTripId }, { createdBy: userId }],
    });

    if (!localTrip) throw new Error('Local Trip not found');

    const updatedLocalTrip = await LocalTrip.findOneAndUpdate(
      { _id: req.body.localTripId, createdBy: userId },
      { ...req.body },
      { new: true, session: session }
    );

    if (!updatedLocalTrip) throw new Error('Error While Updating Local Trip');

    /*  Update Vehicle fuel.availableFuel by adding old fuel 
        from old record of local trip diesel and then subtracting the new fuel
    */
    if (req.body?.diesel && localTrip?.diesel !== req.body?.diesel) {
      const vehicle = await Vehicle.findOne({
        _id: localTrip.vehicleId,
      });

      if (!vehicle) throw new Error('Vehicle not found');

      if (vehicle.fuel && vehicle.fuel.availableFuel) {
        const oldFuel = vehicle?.fuel?.availableFuel + localTrip.diesel;
        const newFuel = oldFuel - req.body?.diesel;

        const updatedVehicle = await Vehicle.findOneAndUpdate(
          { _id: localTrip.vehicleId, createdBy: userId },
          {
            $set: {
              fuel: {
                availableFuel: newFuel,
                fuelCapacity: vehicle.fuel.fuelCapacity,
              },
            },
          },
          { new: true, session: session }
        );

        if (!updatedVehicle) throw new Error('Error While Updating Vehicle');
      }
    }

    if (updatedLocalTrip) {
      // If all updates succeed, commit the transaction
      await session.commitTransaction();
      session.endSession();

      handleSuccess(res, {
        message: 'Local Trip Updated Successfully',
        data: updatedLocalTrip,
      });
    }
  } catch (error) {
    await session.commitTransaction();
    session.endSession();
    handleErrors(req, res, {
      message: 'Error while updating local trip',
      error,
    });
  }
};

export const validateExcelImport = async (req: Request, res: Response) => {
  // Initiate transaction
  const session = await db.startSession();

  // Start transaction
  session.startTransaction();
  try {
    if (!req.file) throw new Error('File not found');

    const { userId } = res.locals.user;

    // Read and parse Excel file
    const workbook = xlxs.read(req.file.buffer, {
      type: 'buffer',
    });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = xlxs.utils.sheet_to_json(sheet, { header: 1 });

    // Extract Headers
    const headers = data[0];
    const rows = data.slice(1);

    let errors: ValidationError[] = [];
    let validRows: RowData[] = [];
    let vehicleDieselTotals: VehicleDieselTotals = {}; // To store total diesel required for each vehicle

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      let row = rows[rowIndex];
      let rowErrors: string[] = [];
      let rowData: RowData = {};

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const schemaKey = headerMapping[header];
        const value = row[i];

        // Validate and process fields
        switch (schemaKey) {
          case 'date':
            let dateValue: Date | null = null;
            if (typeof value === 'string' && !isNaN(Date.parse(value))) {
              dateValue = new Date(value);
            } else if (isDateSerial(value)) {
              dateValue = excelDateToJSDate(value);
            }

            if (!dateValue) {
              rowErrors.push(`Invalid date at row ${rowIndex + 2}`);
            } else {
              rowData.date = dateValue;
            }
            break;
          case 'containerNo':
            if (!value) {
              rowErrors.push(`${header} is required at row ${rowIndex + 2}`);
            } else {
              rowData[schemaKey] = value;
            }
            break;
          case 'containerSize':
            if (!['20', '40', 20, 40].includes(value)) {
              rowErrors.push(`Invalid value for SIZE at row ${rowIndex + 2}`);
            } else {
              rowData[schemaKey] = value;
            }
            break;
          case 'containerType':
            if (!['EMPTY', 'LOADED'].includes(value)) {
              rowErrors.push(
                `Invalid value for CONTAINER TYPE at row ${rowIndex + 2}`
              );
            } else {
              rowData[schemaKey] = value;
            }
            break;
          case 'gateInOutMode':
            if (!['INBLOCK', 'RE EXPORT'].includes(value)) {
              rowErrors.push(
                `Invalid value for TRIP TYPE at row ${rowIndex + 2}`
              );
            } else {
              rowData[schemaKey] = value;
            }
            break;
          case 'from':
            if (!value) {
              rowErrors.push(`${header} is required at row ${rowIndex + 2}`);
            } else {
              rowData[schemaKey] = value;
            }
            break;
          case 'to':
            if (!value) {
              rowErrors.push(`${header} is required at row ${rowIndex + 2}`);
            } else {
              rowData[schemaKey] = value;
            }
            break;
          case 'rate':
            if (value === undefined || isNaN(value)) {
              rowErrors.push(
                `Invalid number for ${header} at row ${rowIndex + 2}`
              );
            } else {
              rowData[schemaKey] = Number(value);
            }
            break;
          case 'diesel':
            if (value === undefined || isNaN(value)) {
              rowErrors.push(
                `Invalid number for ${header} at row ${rowIndex + 2}`
              );
            } else {
              rowData[schemaKey] = Number(value);
            }
            break;
          case 'driverIncentive':
            if (value !== undefined && isNaN(value)) {
              rowErrors.push(
                `Invalid number for ${header} at row ${rowIndex + 2}`
              );
            } else {
              rowData[schemaKey] = value !== undefined ? Number(value) : 0;
            }
            break;
          case 'tollPlazaAmount':
            if (value !== undefined && isNaN(value)) {
              rowErrors.push(
                `Invalid number for ${header} at row ${rowIndex + 2}`
              );
            } else {
              rowData[schemaKey] = value !== undefined ? Number(value) : 0;
            }
          case 'advance':
            if (value !== undefined && isNaN(value)) {
              rowErrors.push(
                `Invalid number for ${header} at row ${rowIndex + 2}`
              );
            } else {
              rowData[schemaKey] = value !== undefined ? Number(value) : 0;
            }
            break;
          case 'remarks':
            if (value !== undefined && typeof value !== 'string') {
              rowErrors.push(`${header} is required at row ${rowIndex + 2}`);
            } else {
              rowData[schemaKey] = value !== undefined ? value : '';
            }
            break;
          default:
            break;
        }
      }

      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        const schemaKey = headerMapping[header];
        const value = row[i];

        if (schemaKey === 'vehicleId') {
          const vehicle = await Vehicle.findOne({
            createdBy: userId,
            'registration.plateNumber': value,
          });

          if (!vehicle) {
            rowErrors.push(
              `Vehicle not found for VEHICLE NO: ${value} at row ${
                rowIndex + 2
              }`
            );
          } else {
            rowData.vehicleId = vehicle._id.toString();

            // Track total diesel required for this vehicle
            if (rowData.diesel !== undefined) {
              if (!vehicleDieselTotals[rowData.vehicleId]) {
                vehicleDieselTotals[rowData.vehicleId] = 0;
              }

              vehicleDieselTotals[rowData.vehicleId] += rowData.diesel;
            }

            // Check if diesel amount is greater than availableFuel
            // if (
            //   rowData.diesel !== undefined &&
            //   vehicle?.fuel?.availableFuel &&
            //   rowData.diesel > vehicle.fuel.availableFuel
            // ) {
            //   rowErrors.push(
            //     `Diesel amount (${
            //       rowData.diesel
            //     }) is greater than available fuel (${
            //       vehicle.fuel.availableFuel
            //     }) for VEHICLE NO: ${value} at row ${rowIndex + 2}`
            //   );
            // }
          }
        } else if (schemaKey === 'billingParty') {
          const ledger = await Ledger.findOne({
            createdBy: userId,
            legalName: value,
          });

          if (!ledger) {
            rowErrors.push(
              `Ledger not found for BILLING PARTY: ${value} at row ${
                rowIndex + 2
              }`
            );
          } else {
            rowData.billingParty = ledger._id.toString();
          }
        }
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowIndex + 2,
          errors: rowErrors,
        });
      } else {
        validRows.push({
          ...rowData,
          createdBy: userId,
        });
      }
    }

    // Check if available fuel is sufficient for each vehicle
    for (let vehicleId in vehicleDieselTotals) {
      const vehicle = await Vehicle.findById(vehicleId);
      if (
        vehicle &&
        vehicle.fuel?.availableFuel &&
        vehicle.fuel.availableFuel < vehicleDieselTotals[vehicleId]
      ) {
        errors.push({
          row: 0, // Adjust as necessary to indicate a vehicle-level error
          errors: [
            `VEHICLE NO: ${vehicle?.registration?.plateNumber} -> Total diesel required is (${vehicleDieselTotals[vehicleId]}L) is greater than available fuel (${vehicle.fuel.availableFuel}L)`,
          ],
        });
      }
    }

    if (errors.length > 0) {
      await session.abortTransaction();
      session.endSession();

      console.log({
        responseId: res.locals.responseId,
        method: res.req.method,
        url: res.req.originalUrl,
        body: res.req.body,
        params: res.req.params,
        query: res.req.query,
        code: 'SUCCESS',
        status: 400,
        errors,
        message: 'Excel file validation failed',
      });

      return res.status(400).json({
        code: 'SUCCESS',
        message: 'Excel file validation failed',
        errors,
      });
    }

    // Update Vehicle.fuel.availableFuel using the vehicleDieselTotals
    for (let vehicleId in vehicleDieselTotals) {
      await Vehicle.findOneAndUpdate(
        { _id: vehicleId },
        {
          $inc: { 'fuel.availableFuel': -vehicleDieselTotals[vehicleId] },
        },
        {
          new: true,
          session,
        }
      );
    }

    // insert validRows into database
    for (let row of validRows) {
      await LocalTrip.create([row], { session });
    }

    await session.commitTransaction();
    session.endSession();

    handleSuccess(res, {
      message: 'Excel file validation & Added to Local Trips',
      status: 200,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    handleErrors(req, res, {
      status: 500,
      message: 'Error while validating excel file',
      error,
    });
  }
};
