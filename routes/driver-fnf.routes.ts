import { Router } from 'express';

import { isAuthenticated } from '../middleware';
import {
  createDriverFNF,
  getDriverFNF,
  listDriverFNF,
} from '../controllers/driverFNF.controllers';

const router = Router();

router.get('/list', isAuthenticated, listDriverFNF);
router.get('/', isAuthenticated, getDriverFNF);

/**
 * * Create a new DriverFNF
 */
router.post('/create', isAuthenticated, createDriverFNF);

export default router;
