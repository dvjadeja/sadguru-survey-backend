import { Express } from 'express';

import authRoutes from './auth.routes';
import vehicleRoutes from './vehicle.routes';
import driverRoutes from './driver.routes';

export const registerRoutes = (app: Express) => {
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/vehicle', vehicleRoutes);
  app.use('/api/v1/driver', driverRoutes);
};
