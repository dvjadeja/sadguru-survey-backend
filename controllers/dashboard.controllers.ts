import { Request, Response } from 'express';
import db from '../setups/mongo';
import {
  Driver,
  DriverFNF,
  DriverSalary,
  Fuel,
  Ledger,
  LocalTrip,
  LorryReceipt,
  LorryReceiptInvoice,
  Maintenance,
  MarketTruckFuel,
  Transaction,
  Vehicle,
  Vendor,
} from '../models';
import { VEHICLE_STATUS } from '../constants';
import { handleErrors, handleSuccess } from '../utils/response.utils';

type BooleanFilter = boolean | undefined;

type DashboardFilters = {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  singleDate?: Date;
  vehicleIds: any[];
  vendorIds: any[];
  ledgerIds: any[];
  driverIds: any[];
  ownVehicle?: boolean;
  marketTruck?: boolean;
  invoiceStatus?: string;
  paymentStatus?: string;
};

const toObjectIds = (value: unknown): any[] => {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => db.Types.ObjectId.isValid(item))
    .map((item) => new db.Types.ObjectId(item));
};

const parseBoolean = (value: unknown): BooleanFilter => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
};

const parseDate = (value: unknown): Date | undefined => {
  if (!value || typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

const parseFilters = (req: Request, userId: string): DashboardFilters => {
  const query = req.query as Record<string, unknown>;
  return {
    userId,
    startDate: parseDate(query.startDate),
    endDate: parseDate(query.endDate),
    singleDate: parseDate(query.singleDate),
    vehicleIds: toObjectIds(query.vehicleIds),
    vendorIds: toObjectIds(query.vendorIds),
    ledgerIds: toObjectIds(query.ledgerIds),
    driverIds: toObjectIds(query.driverIds),
    ownVehicle: parseBoolean(query.ownVehicle),
    marketTruck: parseBoolean(query.marketTruck),
    invoiceStatus:
      typeof query.invoiceStatus === 'string' ? query.invoiceStatus : undefined,
    paymentStatus:
      typeof query.paymentStatus === 'string' ? query.paymentStatus : undefined,
  };
};

const applyDateMatch = (
  match: Record<string, any>,
  field: string,
  filters: DashboardFilters
) => {
  if (filters.singleDate) {
    const start = new Date(filters.singleDate);
    const end = new Date(filters.singleDate);
    end.setDate(end.getDate() + 1);
    match[field] = { $gte: start, $lt: end };
    return;
  }

  if (filters.startDate || filters.endDate) {
    match[field] = {};
    if (filters.startDate) match[field].$gte = filters.startDate;
    if (filters.endDate) match[field].$lte = filters.endDate;
  }
};

const applyOwnVehicleMatch = (
  match: Record<string, any>,
  filters: DashboardFilters
) => {
  if (filters.ownVehicle !== undefined) {
    match.ownVehicle = filters.ownVehicle;
    return;
  }

  if (filters.marketTruck !== undefined) {
    match.ownVehicle = !filters.marketTruck;
  }
};

const sumFromAggregation = (data: Array<{ total?: number }>) =>
  data?.[0]?.total || 0;

const getVehicleWidgetPayload = async (userId: string) => {
  const totalVehicles = await Vehicle.countDocuments({ createdBy: userId });
  const activeVehicles = await Vehicle.countDocuments({
    createdBy: userId,
    currentStatus: VEHICLE_STATUS.ACTIVE,
  });
  const inactiveVehicles = await Vehicle.countDocuments({
    createdBy: userId,
    currentStatus: VEHICLE_STATUS.INACTIVE,
  });
  const underMaintenanceVehicles = await Vehicle.countDocuments({
    createdBy: userId,
    currentStatus: VEHICLE_STATUS.UNDER_MAINTENANCE,
  });

  return {
    totalVehicles,
    activeVehicles,
    inactiveVehicles,
    underMaintenanceVehicles,
  };
};

export const getVehicleWidgetData = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const data = await getVehicleWidgetPayload(userId);
    handleSuccess(res, {
      message: 'Vehicle Widget Data Fetched Successfully',
      data,
    });
  } catch (error) {
    handleErrors(req, res, {
      status: 500,
      message: 'Error while fetching vehicle widget data.',
      error,
    });
  }
};

export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);

    const fuelMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const maintenanceMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const vendorMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const ledgerMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const lorryReceiptMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const localTripMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const invoiceMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };

    applyDateMatch(fuelMatch, 'date', filters);
    applyDateMatch(maintenanceMatch, 'billDate', filters);
    applyDateMatch(lorryReceiptMatch, 'date', filters);
    applyDateMatch(localTripMatch, 'date', filters);
    applyDateMatch(invoiceMatch, 'invoiceDate', filters);
    applyOwnVehicleMatch(lorryReceiptMatch, filters);

    if (filters.vehicleIds.length) {
      fuelMatch.vehicleId = { $in: filters.vehicleIds };
      maintenanceMatch.vehicleId = { $in: filters.vehicleIds };
      lorryReceiptMatch.vehicleId = { $in: filters.vehicleIds };
      localTripMatch.vehicleId = { $in: filters.vehicleIds };
    }
    if (filters.vendorIds.length) {
      fuelMatch.vendorId = { $in: filters.vendorIds };
      maintenanceMatch.vendorId = { $in: filters.vendorIds };
      vendorMatch._id = { $in: filters.vendorIds };
    }
    if (filters.ledgerIds.length) {
      ledgerMatch._id = { $in: filters.ledgerIds };
      lorryReceiptMatch.billingParty = { $in: filters.ledgerIds };
      localTripMatch.billingParty = { $in: filters.ledgerIds };
      invoiceMatch.ledgerId = { $in: filters.ledgerIds };
    }
    if (filters.driverIds.length) {
      fuelMatch.driverId = { $in: filters.driverIds };
    }
    if (filters.invoiceStatus) {
      lorryReceiptMatch.invoiceStatus = filters.invoiceStatus;
      localTripMatch.invoiceStatus = filters.invoiceStatus;
    }
    if (filters.paymentStatus) {
      invoiceMatch.paymentStatus = filters.paymentStatus;
    }

    const [
      vehicleData,
      fuelTotalAgg,
      maintenanceTotalAgg,
      vendorTotalAgg,
      ledgerTotalAgg,
      lorryReceiptCount,
      localTripCount,
      invoiceTotalAgg,
      paidInvoiceAgg,
      unpaidInvoiceAgg,
    ] = await Promise.all([
      getVehicleWidgetPayload(userId),
      Fuel.aggregate([
        { $match: fuelMatch },
        { $group: { _id: null, total: { $sum: { $toDouble: '$totalAmount' } } } },
      ]),
      Maintenance.aggregate([
        { $match: maintenanceMatch },
        { $group: { _id: null, total: { $sum: { $toDouble: '$billAmount' } } } },
      ]),
      Vendor.aggregate([
        { $match: vendorMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $toDouble: '$totalAmount' } },
            pendingAmount: { $sum: { $toDouble: '$pendingAmount' } },
            paidAmount: { $sum: { $toDouble: '$paidAmount' } },
          },
        },
      ]),
      Ledger.aggregate([
        { $match: ledgerMatch },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: { $toDouble: '$totalAmount' } },
            pendingAmount: { $sum: { $toDouble: '$pendingAmount' } },
            paidAmount: { $sum: { $toDouble: '$paidAmount' } },
          },
        },
      ]),
      LorryReceipt.countDocuments(lorryReceiptMatch),
      LocalTrip.countDocuments(localTripMatch),
      LorryReceiptInvoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      LorryReceiptInvoice.aggregate([
        { $match: { ...invoiceMatch, paymentStatus: 'PAID' } },
        {
          $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } },
        },
      ]),
      LorryReceiptInvoice.aggregate([
        { $match: { ...invoiceMatch, paymentStatus: 'UNPAID' } },
        {
          $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$totalAmount' } },
        },
      ]),
    ]);

    handleSuccess(res, {
      message: 'Dashboard overview fetched successfully',
      data: {
        vehicles: vehicleData,
        spend: {
          fuel: sumFromAggregation(fuelTotalAgg),
          maintenance: sumFromAggregation(maintenanceTotalAgg),
        },
        payables: {
          totalAmount: vendorTotalAgg?.[0]?.totalAmount || 0,
          paidAmount: vendorTotalAgg?.[0]?.paidAmount || 0,
          pendingAmount: vendorTotalAgg?.[0]?.pendingAmount || 0,
        },
        receivables: {
          totalAmount: ledgerTotalAgg?.[0]?.totalAmount || 0,
          paidAmount: ledgerTotalAgg?.[0]?.paidAmount || 0,
          pendingAmount: ledgerTotalAgg?.[0]?.pendingAmount || 0,
        },
        trips: {
          lorryReceipts: lorryReceiptCount,
          localTrips: localTripCount,
        },
        invoices: {
          totalAmount: sumFromAggregation(invoiceTotalAgg),
          paidCount: paidInvoiceAgg?.[0]?.count || 0,
          paidAmount: paidInvoiceAgg?.[0]?.amount || 0,
          unpaidCount: unpaidInvoiceAgg?.[0]?.count || 0,
          unpaidAmount: unpaidInvoiceAgg?.[0]?.amount || 0,
        },
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching dashboard overview',
      error,
    });
  }
};

export const getFuelAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);

    const fuelMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const marketFuelMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };

    applyDateMatch(fuelMatch, 'date', filters);
    applyDateMatch(marketFuelMatch, 'date', filters);

    if (filters.vehicleIds.length) fuelMatch.vehicleId = { $in: filters.vehicleIds };
    if (filters.vendorIds.length) {
      fuelMatch.vendorId = { $in: filters.vendorIds };
      marketFuelMatch.vendorId = { $in: filters.vendorIds };
    }
    if (filters.driverIds.length) fuelMatch.driverId = { $in: filters.driverIds };

    const [totalsAgg, trendAgg, vendorAgg, vehicleAgg, marketTotalsAgg] = await Promise.all([
      Fuel.aggregate([
        { $match: fuelMatch },
        {
          $unwind: {
            path: '$expenses',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: { $toDouble: '$totalAmount' } },
            totalDieselQuantity: {
              $sum: {
                $cond: [
                  { $eq: [{ $toLower: '$expenses.description' }, 'diesel'] },
                  { $toDouble: '$expenses.quantity' },
                  0,
                ],
              },
            },
          },
        },
      ]),
      Fuel.aggregate([
        { $match: fuelMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            spend: { $sum: { $toDouble: '$totalAmount' } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Fuel.aggregate([
        { $match: fuelMatch },
        {
          $group: {
            _id: '$vendorId',
            spend: { $sum: { $toDouble: '$totalAmount' } },
            transactions: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'vendors',
            localField: '_id',
            foreignField: '_id',
            as: 'vendor',
          },
        },
        { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 0, vendorId: '$_id', vendorName: '$vendor.name', spend: 1, transactions: 1 } },
        { $sort: { spend: -1 } },
      ]),
      Fuel.aggregate([
        { $match: fuelMatch },
        {
          $group: {
            _id: '$vehicleId',
            spend: { $sum: { $toDouble: '$totalAmount' } },
            transactions: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'vehicles',
            localField: '_id',
            foreignField: '_id',
            as: 'vehicle',
          },
        },
        { $unwind: { path: '$vehicle', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            vehicleId: '$_id',
            plateNumber: '$vehicle.registration.plateNumber',
            spend: 1,
            transactions: 1,
          },
        },
        { $sort: { spend: -1 } },
      ]),
      MarketTruckFuel.aggregate([
        { $match: marketFuelMatch },
        {
          $group: {
            _id: null,
            marketTruckSpend: { $sum: { $toDouble: '$totalAmount' } },
          },
        },
      ]),
    ]);

    const ownFuelSpend = totalsAgg?.[0]?.totalSpend || 0;
    const marketTruckSpend = marketTotalsAgg?.[0]?.marketTruckSpend || 0;

    handleSuccess(res, {
      message: 'Fuel analytics fetched successfully',
      data: {
        summary: {
          totalFuelSpend: ownFuelSpend + marketTruckSpend,
          ownFleetFuelSpend: ownFuelSpend,
          marketTruckFuelSpend: marketTruckSpend,
          totalDieselQuantity: totalsAgg?.[0]?.totalDieselQuantity || 0,
        },
        trend: trendAgg,
        spendByVendor: vendorAgg,
        spendByVehicle: vehicleAgg,
        ownVsMarketSplit: {
          ownFleet: ownFuelSpend,
          marketTruck: marketTruckSpend,
        },
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching fuel analytics',
      error,
    });
  }
};

export const getMaintenanceAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);

    const match: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    applyDateMatch(match, 'billDate', filters);
    if (filters.vehicleIds.length) match.vehicleId = { $in: filters.vehicleIds };
    if (filters.vendorIds.length) match.vendorId = { $in: filters.vendorIds };

    const [summaryAgg, trendAgg, byVehicleAgg, byVendorAgg] = await Promise.all([
      Maintenance.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalSpend: { $sum: { $toDouble: '$billAmount' } },
            totalBills: { $sum: 1 },
          },
        },
      ]),
      Maintenance.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$billDate' } },
            spend: { $sum: { $toDouble: '$billAmount' } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Maintenance.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$vehicleId',
            spend: { $sum: { $toDouble: '$billAmount' } },
            bills: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'vehicles',
            localField: '_id',
            foreignField: '_id',
            as: 'vehicle',
          },
        },
        { $unwind: { path: '$vehicle', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            vehicleId: '$_id',
            plateNumber: '$vehicle.registration.plateNumber',
            spend: 1,
            bills: 1,
          },
        },
        { $sort: { spend: -1 } },
      ]),
      Maintenance.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$vendorId',
            spend: { $sum: { $toDouble: '$billAmount' } },
            bills: { $sum: 1 },
          },
        },
        {
          $lookup: {
            from: 'vendors',
            localField: '_id',
            foreignField: '_id',
            as: 'vendor',
          },
        },
        { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            vendorId: '$_id',
            vendorName: '$vendor.name',
            spend: 1,
            bills: 1,
          },
        },
        { $sort: { spend: -1 } },
      ]),
    ]);

    const totalSpend = summaryAgg?.[0]?.totalSpend || 0;
    const totalBills = summaryAgg?.[0]?.totalBills || 0;

    handleSuccess(res, {
      message: 'Maintenance analytics fetched successfully',
      data: {
        summary: {
          totalSpend,
          totalBills,
          averageBillAmount: totalBills ? totalSpend / totalBills : 0,
        },
        trend: trendAgg,
        spendByVehicle: byVehicleAgg,
        spendByVendor: byVendorAgg,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching maintenance analytics',
      error,
    });
  }
};

export const getTripAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);

    const lorryMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const localMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    applyDateMatch(lorryMatch, 'date', filters);
    applyDateMatch(localMatch, 'date', filters);
    applyOwnVehicleMatch(lorryMatch, filters);

    if (filters.vehicleIds.length) {
      lorryMatch.vehicleId = { $in: filters.vehicleIds };
      localMatch.vehicleId = { $in: filters.vehicleIds };
    }
    if (filters.ledgerIds.length) {
      lorryMatch.billingParty = { $in: filters.ledgerIds };
      localMatch.billingParty = { $in: filters.ledgerIds };
    }
    if (filters.invoiceStatus) {
      lorryMatch.invoiceStatus = filters.invoiceStatus;
      localMatch.invoiceStatus = filters.invoiceStatus;
    }

    const [
      lorryCount,
      localCount,
      ownVsMarketAgg,
      modeOfTradeAgg,
      lorryContainerAgg,
      localContainerAgg,
      lorryTrendAgg,
      localTrendAgg,
      lorryRouteAgg,
      localRouteAgg,
    ] = await Promise.all([
      LorryReceipt.countDocuments(lorryMatch),
      LocalTrip.countDocuments(localMatch),
      LorryReceipt.aggregate([
        { $match: lorryMatch },
        { $group: { _id: '$ownVehicle', count: { $sum: 1 } } },
      ]),
      LorryReceipt.aggregate([
        { $match: lorryMatch },
        { $group: { _id: '$modeOfTrade', count: { $sum: 1 } } },
      ]),
      LorryReceipt.aggregate([
        { $match: lorryMatch },
        {
          $group: {
            _id: {
              size: '$containerSize',
              status: '$containerStatus',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      LocalTrip.aggregate([
        { $match: localMatch },
        {
          $group: {
            _id: {
              size: '$containerSize',
              status: '$containerType',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),
      LorryReceipt.aggregate([
        { $match: lorryMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            count: { $sum: 1 },
          },
        },
      ]),
      LocalTrip.aggregate([
        { $match: localMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            count: { $sum: 1 },
          },
        },
      ]),
      LorryReceipt.aggregate([
        { $match: lorryMatch },
        { $group: { _id: { from: '$from', to: '$to' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
      LocalTrip.aggregate([
        { $match: localMatch },
        { $group: { _id: { from: '$from', to: '$to' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const ownTrips = ownVsMarketAgg.find((row) => row._id === true)?.count || 0;
    const marketTrips = ownVsMarketAgg.find((row) => row._id === false)?.count || 0;

    const trendMap = new Map<string, { month: string; lorryReceipts: number; localTrips: number }>();
    lorryTrendAgg.forEach((row) => {
      trendMap.set(row._id, {
        month: row._id,
        lorryReceipts: row.count,
        localTrips: 0,
      });
    });
    localTrendAgg.forEach((row) => {
      const existing = trendMap.get(row._id);
      if (existing) {
        existing.localTrips = row.count;
      } else {
        trendMap.set(row._id, {
          month: row._id,
          lorryReceipts: 0,
          localTrips: row.count,
        });
      }
    });

    const routeMap = new Map<string, { from: string; to: string; lorryReceipts: number; localTrips: number; total: number }>();
    lorryRouteAgg.forEach((row) => {
      const key = `${row._id.from}__${row._id.to}`;
      routeMap.set(key, {
        from: row._id.from,
        to: row._id.to,
        lorryReceipts: row.count,
        localTrips: 0,
        total: row.count,
      });
    });
    localRouteAgg.forEach((row) => {
      const key = `${row._id.from}__${row._id.to}`;
      const existing = routeMap.get(key);
      if (existing) {
        existing.localTrips = row.count;
        existing.total = existing.lorryReceipts + row.count;
      } else {
        routeMap.set(key, {
          from: row._id.from,
          to: row._id.to,
          lorryReceipts: 0,
          localTrips: row.count,
          total: row.count,
        });
      }
    });

    handleSuccess(res, {
      message: 'Trip analytics fetched successfully',
      data: {
        summary: {
          lorryReceipts: lorryCount,
          localTrips: localCount,
          ownTrips,
          marketTrips,
        },
        ownVsMarket: {
          ownVehicle: ownTrips,
          marketTruck: marketTrips,
        },
        modeOfTrade: modeOfTradeAgg,
        containerMix: {
          lorryReceipts: lorryContainerAgg,
          localTrips: localContainerAgg,
        },
        trend: Array.from(trendMap.values()).sort((a, b) =>
          a.month.localeCompare(b.month)
        ),
        routes: Array.from(routeMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 20),
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching trip analytics',
      error,
    });
  }
};

export const getInvoiceAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);

    const invoiceMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const lorryMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const localMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };

    applyDateMatch(invoiceMatch, 'invoiceDate', filters);
    applyDateMatch(lorryMatch, 'date', filters);
    applyDateMatch(localMatch, 'date', filters);

    if (filters.ledgerIds.length) {
      invoiceMatch.ledgerId = { $in: filters.ledgerIds };
      lorryMatch.billingParty = { $in: filters.ledgerIds };
      localMatch.billingParty = { $in: filters.ledgerIds };
    }
    if (filters.paymentStatus) invoiceMatch.paymentStatus = filters.paymentStatus;
    if (filters.invoiceStatus) {
      lorryMatch.invoiceStatus = filters.invoiceStatus;
      localMatch.invoiceStatus = filters.invoiceStatus;
    }

    const [summaryAgg, paymentSplitAgg, trendAgg, gstSplitAgg, pendingTripStatuses] =
      await Promise.all([
        LorryReceiptInvoice.aggregate([
          { $match: invoiceMatch },
          {
            $group: {
              _id: null,
              totalInvoices: { $sum: 1 },
              totalValue: { $sum: '$totalAmount' },
              totalGst: { $sum: '$gstAmount' },
            },
          },
        ]),
        LorryReceiptInvoice.aggregate([
          { $match: invoiceMatch },
          {
            $group: {
              _id: '$paymentStatus',
              count: { $sum: 1 },
              amount: { $sum: '$totalAmount' },
            },
          },
        ]),
        LorryReceiptInvoice.aggregate([
          { $match: invoiceMatch },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } },
              count: { $sum: 1 },
              amount: { $sum: '$totalAmount' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        LorryReceiptInvoice.aggregate([
          { $match: invoiceMatch },
          {
            $group: {
              _id: '$gstApplicable',
              count: { $sum: 1 },
              amount: { $sum: '$totalAmount' },
            },
          },
        ]),
        Promise.all([
          LorryReceipt.aggregate([
            { $match: lorryMatch },
            { $group: { _id: '$invoiceStatus', count: { $sum: 1 } } },
          ]),
          LocalTrip.aggregate([
            { $match: localMatch },
            { $group: { _id: '$invoiceStatus', count: { $sum: 1 } } },
          ]),
        ]),
      ]);

    const paid = paymentSplitAgg.find((row) => row._id === 'PAID');
    const unpaid = paymentSplitAgg.find((row) => row._id === 'UNPAID');

    handleSuccess(res, {
      message: 'Invoice analytics fetched successfully',
      data: {
        summary: {
          totalInvoices: summaryAgg?.[0]?.totalInvoices || 0,
          totalValue: summaryAgg?.[0]?.totalValue || 0,
          totalGst: summaryAgg?.[0]?.totalGst || 0,
          paidCount: paid?.count || 0,
          paidValue: paid?.amount || 0,
          unpaidCount: unpaid?.count || 0,
          unpaidValue: unpaid?.amount || 0,
        },
        trend: trendAgg,
        paymentSplit: paymentSplitAgg,
        gstSplit: gstSplitAgg,
        invoiceGenerationStatus: {
          lorryReceipts: pendingTripStatuses[0],
          localTrips: pendingTripStatuses[1],
        },
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching invoice analytics',
      error,
    });
  }
};

export const getPaymentMethodAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);

    const transactionMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const salaryMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const fnfMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    applyDateMatch(transactionMatch, 'paymentDate', filters);
    applyDateMatch(salaryMatch, 'paymentDate', filters);
    applyDateMatch(fnfMatch, 'date', filters);
    if (filters.vendorIds.length) transactionMatch.vendorId = { $in: filters.vendorIds };
    if (filters.driverIds.length) {
      salaryMatch.driverId = { $in: filters.driverIds };
      fnfMatch.driverId = { $in: filters.driverIds };
    }

    const [vendorPayments, salaryPayments, fnfPayments] = await Promise.all([
      Transaction.aggregate([
        { $match: transactionMatch },
        {
          $group: {
            _id: '$paymentMethod.paymentType',
            amount: { $sum: { $toDouble: '$amount' } },
            count: { $sum: 1 },
          },
        },
      ]),
      DriverSalary.aggregate([
        { $match: salaryMatch },
        {
          $group: {
            _id: '$paymentMethod.paymentType',
            amount: { $sum: '$totalSalary' },
            count: { $sum: 1 },
          },
        },
      ]),
      DriverFNF.aggregate([
        { $match: fnfMatch },
        {
          $group: {
            _id: '$paymentMethod.paymentType',
            amount: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const combined = new Map<string, { paymentMethod: string; amount: number; count: number }>();
    const mergeBreakdown = (rows: Array<{ _id: string; amount: number; count: number }>) => {
      rows.forEach((row) => {
        const key = row._id || 'UNKNOWN';
        const existing = combined.get(key);
        if (existing) {
          existing.amount += row.amount || 0;
          existing.count += row.count || 0;
        } else {
          combined.set(key, {
            paymentMethod: key,
            amount: row.amount || 0,
            count: row.count || 0,
          });
        }
      });
    };

    mergeBreakdown(vendorPayments);
    mergeBreakdown(salaryPayments);
    mergeBreakdown(fnfPayments);

    handleSuccess(res, {
      message: 'Payment method analytics fetched successfully',
      data: {
        bySource: {
          vendorPayments,
          salaryPayments,
          fnfPayments,
        },
        combined: Array.from(combined.values()).sort((a, b) => b.amount - a.amount),
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching payment method analytics',
      error,
    });
  }
};

const buildAgingBuckets = (entries: Array<{ amount: number; dueDate: Date | string }>) => {
  const now = new Date();
  const bucketData = {
    '0-30': { amount: 0, count: 0 },
    '31-60': { amount: 0, count: 0 },
    '61-90': { amount: 0, count: 0 },
    '90+': { amount: 0, count: 0 },
  };

  entries.forEach((entry) => {
    const dueDate = new Date(entry.dueDate);
    const dayDiff = Math.floor(
      (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const amount = entry.amount || 0;

    if (dayDiff <= 30) {
      bucketData['0-30'].amount += amount;
      bucketData['0-30'].count += 1;
    } else if (dayDiff <= 60) {
      bucketData['31-60'].amount += amount;
      bucketData['31-60'].count += 1;
    } else if (dayDiff <= 90) {
      bucketData['61-90'].amount += amount;
      bucketData['61-90'].count += 1;
    } else {
      bucketData['90+'].amount += amount;
      bucketData['90+'].count += 1;
    }
  });

  return bucketData;
};

export const getArAging = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);

    const invoiceMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
      paymentStatus: 'UNPAID',
    };
    const ledgerMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    applyDateMatch(invoiceMatch, 'invoiceDate', filters);
    if (filters.ledgerIds.length) {
      invoiceMatch.ledgerId = { $in: filters.ledgerIds };
      ledgerMatch._id = { $in: filters.ledgerIds };
    }

    const [invoices, ledgerSnapshot] = await Promise.all([
      LorryReceiptInvoice.find(invoiceMatch, ['ledgerId', 'invoiceNo', 'dueDate', 'totalAmount'])
        .sort({ dueDate: 1 })
        .lean(),
      Ledger.aggregate([
        { $match: ledgerMatch },
        {
          $project: {
            tradeName: 1,
            legalName: 1,
            pendingAmount: { $toDouble: '$pendingAmount' },
            paidAmount: { $toDouble: '$paidAmount' },
            totalAmount: { $toDouble: '$totalAmount' },
          },
        },
        { $sort: { pendingAmount: -1 } },
        { $limit: 20 },
      ]),
    ]);

    const buckets = buildAgingBuckets(
      invoices.map((invoice) => ({
        amount: invoice.totalAmount || 0,
        dueDate: invoice.dueDate,
      }))
    );

    const totals = ledgerSnapshot.reduce(
      (acc, ledger) => {
        acc.totalReceivable += ledger.totalAmount || 0;
        acc.totalPaid += ledger.paidAmount || 0;
        acc.totalPending += ledger.pendingAmount || 0;
        return acc;
      },
      { totalReceivable: 0, totalPaid: 0, totalPending: 0 }
    );

    handleSuccess(res, {
      message: 'AR aging analytics fetched successfully',
      data: {
        totals: {
          ...totals,
          collectionRate: totals.totalReceivable
            ? (totals.totalPaid / totals.totalReceivable) * 100
            : 0,
        },
        agingBuckets: buckets,
        topDebtors: ledgerSnapshot,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching AR aging analytics',
      error,
    });
  }
};

export const getApAging = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);
    const vendorMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    if (filters.vendorIds.length) vendorMatch._id = { $in: filters.vendorIds };

    const vendors = await Vendor.find(
      vendorMatch,
      ['name', 'totalAmount', 'paidAmount', 'pendingAmount', 'updatedAt'],
      { sort: { pendingAmount: -1 } }
    ).lean();

    const pendingVendors = vendors
      .map((vendor) => ({
        ...vendor,
        totalAmountNumber: parseFloat(vendor.totalAmount || '0'),
        paidAmountNumber: parseFloat(vendor.paidAmount || '0'),
        pendingAmountNumber: parseFloat(vendor.pendingAmount || '0'),
      }))
      .filter((vendor) => vendor.pendingAmountNumber > 0);

    const buckets = buildAgingBuckets(
      pendingVendors.map((vendor) => ({
        amount: vendor.pendingAmountNumber,
        dueDate: vendor.updatedAt || new Date(),
      }))
    );

    const totals = pendingVendors.reduce(
      (acc, vendor) => {
        acc.totalPayable += vendor.totalAmountNumber;
        acc.totalPaid += vendor.paidAmountNumber;
        acc.totalPending += vendor.pendingAmountNumber;
        return acc;
      },
      { totalPayable: 0, totalPaid: 0, totalPending: 0 }
    );

    handleSuccess(res, {
      message: 'AP aging analytics fetched successfully',
      data: {
        totals,
        agingBuckets: buckets,
        topOutstandingVendors: pendingVendors.slice(0, 20),
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching AP aging analytics',
      error,
    });
  }
};

export const getPayrollAnalytics = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);
    const salaryMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const fnfMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    applyDateMatch(salaryMatch, 'paymentDate', filters);
    applyDateMatch(fnfMatch, 'date', filters);
    if (filters.driverIds.length) {
      salaryMatch.driverId = { $in: filters.driverIds };
      fnfMatch.driverId = { $in: filters.driverIds };
    }

    const [salarySummaryAgg, fnfSummaryAgg, salaryTrendAgg, fnfTrendAgg] = await Promise.all([
      DriverSalary.aggregate([
        { $match: salaryMatch },
        {
          $group: {
            _id: null,
            totalSalary: { $sum: '$totalSalary' },
            totalIncentive: { $sum: '$incentives' },
            totalDeductions: { $sum: '$deductions' },
            count: { $sum: 1 },
          },
        },
      ]),
      DriverFNF.aggregate([
        { $match: fnfMatch },
        {
          $group: {
            _id: null,
            totalFnf: { $sum: '$totalAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      DriverSalary.aggregate([
        { $match: salaryMatch },
        {
          $project: {
            month: {
              $dateToString: {
                format: '%Y-%m',
                date: { $ifNull: ['$paymentDate', '$createdAt'] },
              },
            },
            totalSalary: 1,
            incentives: 1,
            deductions: 1,
          },
        },
        {
          $group: {
            _id: '$month',
            salary: { $sum: '$totalSalary' },
            incentives: { $sum: '$incentives' },
            deductions: { $sum: '$deductions' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      DriverFNF.aggregate([
        { $match: fnfMatch },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
            totalFnf: { $sum: '$totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    handleSuccess(res, {
      message: 'Payroll analytics fetched successfully',
      data: {
        summary: {
          totalSalaryPaid: salarySummaryAgg?.[0]?.totalSalary || 0,
          totalIncentivePaid: salarySummaryAgg?.[0]?.totalIncentive || 0,
          totalDeductions: salarySummaryAgg?.[0]?.totalDeductions || 0,
          totalFnfPaid: fnfSummaryAgg?.[0]?.totalFnf || 0,
          salaryRecords: salarySummaryAgg?.[0]?.count || 0,
          fnfRecords: fnfSummaryAgg?.[0]?.count || 0,
        },
        salaryTrend: salaryTrendAgg,
        fnfTrend: fnfTrendAgg,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching payroll analytics',
      error,
    });
  }
};

export const getComplianceAlerts = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);
    const vehicleMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const driverMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    if (filters.vehicleIds.length) vehicleMatch._id = { $in: filters.vehicleIds };
    if (filters.driverIds.length) driverMatch._id = { $in: filters.driverIds };

    const [vehicles, drivers] = await Promise.all([
      Vehicle.find(
        vehicleMatch,
        [
          'registration.plateNumber',
          'insuranceExpirationDate',
          'permit',
          'fitness',
          'puc',
          'tax.lastTaxDate',
        ],
        { sort: { createdAt: -1 } }
      ).lean(),
      Driver.find(
        driverMatch,
        ['firstName', 'lastName', 'licenseNumber', 'licenseExpirationDate'],
        { sort: { createdAt: -1 } }
      ).lean(),
    ]);

    const now = new Date();
    const alerts: Array<{
      entityType: 'VEHICLE' | 'DRIVER';
      entityName: string;
      documentType: string;
      expiryDate: Date;
      daysRemaining: number;
      status: 'EXPIRED' | 'DUE_SOON';
    }> = [];

    const registerAlert = (
      entityType: 'VEHICLE' | 'DRIVER',
      entityName: string,
      documentType: string,
      dateValue: Date | string | null | undefined
    ) => {
      if (!dateValue) return;
      const expiryDate = new Date(dateValue);
      if (Number.isNaN(expiryDate.getTime())) return;
      const daysRemaining = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysRemaining > 90) return;

      alerts.push({
        entityType,
        entityName,
        documentType,
        expiryDate,
        daysRemaining,
        status: daysRemaining < 0 ? 'EXPIRED' : 'DUE_SOON',
      });
    };

    vehicles.forEach((vehicle) => {
      const plate = vehicle.registration?.plateNumber || String(vehicle._id);
      registerAlert('VEHICLE', plate, 'INSURANCE', vehicle.insuranceExpirationDate);
      registerAlert('VEHICLE', plate, 'PERMIT', vehicle.permit);
      registerAlert('VEHICLE', plate, 'FITNESS', vehicle.fitness);
      registerAlert('VEHICLE', plate, 'PUC', vehicle.puc);
      registerAlert('VEHICLE', plate, 'TAX', vehicle.tax?.lastTaxDate);
    });

    drivers.forEach((driver) => {
      const name = `${driver.firstName || ''} ${driver.lastName || ''}`.trim();
      registerAlert(
        'DRIVER',
        name || String(driver._id),
        'LICENSE',
        driver.licenseExpirationDate
      );
    });

    const countWithin = (days: number) =>
      alerts.filter((alert) => alert.daysRemaining >= 0 && alert.daysRemaining <= days)
        .length;

    handleSuccess(res, {
      message: 'Compliance alerts fetched successfully',
      data: {
        summary: {
          expiringIn30Days: countWithin(30),
          expiringIn60Days: countWithin(60),
          expiringIn90Days: countWithin(90),
          expiredItems: alerts.filter((alert) => alert.daysRemaining < 0).length,
        },
        alerts: alerts.sort((a, b) => a.daysRemaining - b.daysRemaining),
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching compliance alerts',
      error,
    });
  }
};

export const getProfitability = async (req: Request, res: Response) => {
  try {
    const { userId } = res.locals.user;
    const filters = parseFilters(req, userId);
    const invoiceMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const fuelMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const marketFuelMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const maintenanceMatch: Record<string, any> = {
      createdBy: new db.Types.ObjectId(userId),
    };
    const salaryMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };
    const fnfMatch: Record<string, any> = { createdBy: new db.Types.ObjectId(userId) };

    applyDateMatch(invoiceMatch, 'invoiceDate', filters);
    applyDateMatch(fuelMatch, 'date', filters);
    applyDateMatch(marketFuelMatch, 'date', filters);
    applyDateMatch(maintenanceMatch, 'billDate', filters);
    applyDateMatch(salaryMatch, 'paymentDate', filters);
    applyDateMatch(fnfMatch, 'date', filters);

    if (filters.ledgerIds.length) invoiceMatch.ledgerId = { $in: filters.ledgerIds };
    if (filters.vehicleIds.length) {
      fuelMatch.vehicleId = { $in: filters.vehicleIds };
      maintenanceMatch.vehicleId = { $in: filters.vehicleIds };
    }
    if (filters.vendorIds.length) {
      fuelMatch.vendorId = { $in: filters.vendorIds };
      marketFuelMatch.vendorId = { $in: filters.vendorIds };
      maintenanceMatch.vendorId = { $in: filters.vendorIds };
    }
    if (filters.driverIds.length) {
      fuelMatch.driverId = { $in: filters.driverIds };
      salaryMatch.driverId = { $in: filters.driverIds };
      fnfMatch.driverId = { $in: filters.driverIds };
    }

    const [
      revenueAgg,
      fuelCostAgg,
      marketFuelCostAgg,
      maintenanceCostAgg,
      salaryCostAgg,
      fnfCostAgg,
    ] = await Promise.all([
      LorryReceiptInvoice.aggregate([
        { $match: invoiceMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Fuel.aggregate([
        { $match: fuelMatch },
        { $group: { _id: null, total: { $sum: { $toDouble: '$totalAmount' } } } },
      ]),
      MarketTruckFuel.aggregate([
        { $match: marketFuelMatch },
        { $group: { _id: null, total: { $sum: { $toDouble: '$totalAmount' } } } },
      ]),
      Maintenance.aggregate([
        { $match: maintenanceMatch },
        { $group: { _id: null, total: { $sum: { $toDouble: '$billAmount' } } } },
      ]),
      DriverSalary.aggregate([
        { $match: salaryMatch },
        { $group: { _id: null, total: { $sum: '$totalSalary' } } },
      ]),
      DriverFNF.aggregate([
        { $match: fnfMatch },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const revenue = revenueAgg?.[0]?.total || 0;
    const costs = {
      fuel: fuelCostAgg?.[0]?.total || 0,
      marketTruckFuel: marketFuelCostAgg?.[0]?.total || 0,
      maintenance: maintenanceCostAgg?.[0]?.total || 0,
      payrollSalary: salaryCostAgg?.[0]?.total || 0,
      payrollFnf: fnfCostAgg?.[0]?.total || 0,
    };
    const totalOperatingCost =
      costs.fuel +
      costs.marketTruckFuel +
      costs.maintenance +
      costs.payrollSalary +
      costs.payrollFnf;

    handleSuccess(res, {
      message: 'Profitability analytics fetched successfully',
      data: {
        revenue,
        operatingCost: totalOperatingCost,
        marginProxy: revenue - totalOperatingCost,
        costBreakdown: costs,
      },
    });
  } catch (error) {
    handleErrors(req, res, {
      message: 'Error while fetching profitability analytics',
      error,
    });
  }
};
