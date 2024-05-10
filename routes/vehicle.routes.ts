import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listAllVehicles,
  listAssignedVehicles,
  listUnassignedVehicles,
  listVehicle,
  updateVehicle,
} from '../controllers/vehicle.controllers';

const router = Router();

router.get('/list', isAuthenticated, listVehicle);
router.get('/list-all', isAuthenticated, listAllVehicles);
router.get('/', isAuthenticated, getVehicle);
router.post('/create', isAuthenticated, createVehicle);
router.put('/update', isAuthenticated, updateVehicle);
router.delete('/delete', isAuthenticated, deleteVehicle);
router.get('/unassigned', isAuthenticated, listUnassignedVehicles);
router.get('/assigned', isAuthenticated, listAssignedVehicles);

export default router;
