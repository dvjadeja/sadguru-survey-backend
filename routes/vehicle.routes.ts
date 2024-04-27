import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicle,
  updateVehicle,
} from '../controllers/vehicle.controllers';

const router = Router();

router.get('/list', isAuthenticated, listVehicle);
router.get('/', isAuthenticated, getVehicle);
router.post('/create', isAuthenticated, createVehicle);
router.put('/update', isAuthenticated, updateVehicle);
router.delete('/delete', isAuthenticated, deleteVehicle);

export default router;
