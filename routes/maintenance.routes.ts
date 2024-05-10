import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createMaintenance,
  getMaintenance,
  listMaintenances,
} from '../controllers/maintenance.controllers';

const router = Router();

router.get('/list', isAuthenticated, listMaintenances);
router.get('/', isAuthenticated, getMaintenance);
router.post('/create', isAuthenticated, createMaintenance);

export default router;
