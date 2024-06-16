import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLocalTrip,
  getLocalTrip,
  listLocalTrips,
} from '../controllers/localTrips.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLocalTrips);
router.post('/create', isAuthenticated, createLocalTrip);
router.get('/', isAuthenticated, getLocalTrip);

export default router;
