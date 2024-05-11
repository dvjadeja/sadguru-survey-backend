import { Express } from 'express';

import authRoutes from './auth.routes';
import vehicleRoutes from './vehicle.routes';
import driverRoutes from './driver.routes';
import fuelRoutes from './fuel.routes';
import vendorRoutes from './vendor.routes';
import maintenanceRoutes from './maintenance.routes';
import transactionRoutes from './transaction.routes';

export const registerRoutes = (app: Express) => {
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/vehicle', vehicleRoutes);
  app.use('/api/v1/driver', driverRoutes);
  app.use('/api/v1/fuel', fuelRoutes);
  app.use('/api/v1/vendor', vendorRoutes);
  app.use('/api/v1/maintenance', maintenanceRoutes);
  app.use('/api/v1/transaction', transactionRoutes);
};
