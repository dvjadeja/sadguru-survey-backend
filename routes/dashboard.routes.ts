import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import { getVehicleWidgetData } from '../controllers/dashboard.controllers';

const router = Router();

router.get('/vehicle-widget-data', isAuthenticated, getVehicleWidgetData);

export default router;
