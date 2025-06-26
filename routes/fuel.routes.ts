import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createFuel,
  deleteFuel,
  getFuel,
  listFuel,
  printFuel,
} from '../controllers/fuel.controller';

const router = Router();

router.get('/list', isAuthenticated, listFuel);
router.get('/', isAuthenticated, getFuel);
router.post('/create', isAuthenticated, createFuel);
router.get('/print', isAuthenticated, printFuel);
router.delete('/delete', isAuthenticated, deleteFuel);

export default router;
