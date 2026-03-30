import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  addDiesel,
  createFuel,
  deleteFuel,
  getFuel,
  listFuel,
  printFuel,
  updateFuel,
} from '../controllers/fuel.controller';

const router = Router();

router.get('/list', isAuthenticated, listFuel);
router.get('/', isAuthenticated, getFuel);
router.post('/create', isAuthenticated, createFuel);
router.get('/print', isAuthenticated, printFuel);
router.delete('/delete', isAuthenticated, deleteFuel);
router.put('/update/:fuelId', isAuthenticated, updateFuel);
router.post('/add-diesel', isAuthenticated, addDiesel);

export default router;
