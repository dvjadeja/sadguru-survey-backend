import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createMaintenance,
  getMaintenance,
  listMaintenances,
  printMaintenances,
  updateMaintenance,
} from '../controllers/maintenance.controller';

const router = Router();

router.get('/list', isAuthenticated, listMaintenances);
router.get('/', isAuthenticated, getMaintenance);
router.post('/create', isAuthenticated, createMaintenance);
router.put('/update', isAuthenticated, updateMaintenance);
router.get('/print', isAuthenticated, printMaintenances);

export default router;
