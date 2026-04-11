import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  getApAging,
  getArAging,
  getComplianceAlerts,
  getDashboardOverview,
  getFuelAnalytics,
  getInvoiceAnalytics,
  getMaintenanceAnalytics,
  getPaymentMethodAnalytics,
  getPayrollAnalytics,
  getProfitability,
  getTripAnalytics,
  getVehicleWidgetData,
} from '../controllers/dashboard.controllers';

const router = Router();

router.get('/vehicle-widget-data', isAuthenticated, getVehicleWidgetData);
router.get('/overview', isAuthenticated, getDashboardOverview);
router.get('/fuel-analytics', isAuthenticated, getFuelAnalytics);
router.get('/maintenance-analytics', isAuthenticated, getMaintenanceAnalytics);
router.get('/trip-analytics', isAuthenticated, getTripAnalytics);
router.get('/invoice-analytics', isAuthenticated, getInvoiceAnalytics);
router.get(
  '/payment-method-analytics',
  isAuthenticated,
  getPaymentMethodAnalytics
);
router.get('/ar-aging', isAuthenticated, getArAging);
router.get('/ap-aging', isAuthenticated, getApAging);
router.get('/payroll-analytics', isAuthenticated, getPayrollAnalytics);
router.get('/compliance-alerts', isAuthenticated, getComplianceAlerts);
router.get('/profitability', isAuthenticated, getProfitability);

export default router;
