import { Router } from 'express';
import { isAuthenticated } from '../middleware';

import {
  listDriverSalary,
  createDriverSalary,
  getDriverSalary,
} from '../controllers/driverSalary.controllers';

const router = Router();

router.get('/list', isAuthenticated, listDriverSalary);
router.post('/create', isAuthenticated, createDriverSalary);
router.get('/', isAuthenticated, getDriverSalary);

export default router;
