import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createDriver,
  deleteDriver,
  getDriver,
  listAllActiveDrivers,
  listDriver,
  updateDriver,
} from '../controllers/driver.controllers';

const router = Router();

router.get('/list', isAuthenticated, listDriver);
router.get('/', isAuthenticated, getDriver);
router.post('/create', isAuthenticated, createDriver);
router.put('/update', isAuthenticated, updateDriver);
router.delete('/delete', isAuthenticated, deleteDriver);

router.get('/list-all-active', isAuthenticated, listAllActiveDrivers);

export default router;
