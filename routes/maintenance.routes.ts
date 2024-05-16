import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createMaintenance,
  getMaintenance,
  listMaintenances,
  updateMaintenance,
} from '../controllers/maintenance.controllers';

const router = Router();

router.get('/list', isAuthenticated, listMaintenances);
router.get('/', isAuthenticated, getMaintenance);
router.post('/create', isAuthenticated, createMaintenance);
router.put('/update', isAuthenticated, updateMaintenance);

export default router;
