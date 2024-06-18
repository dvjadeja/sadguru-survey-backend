import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLocalTrip,
  getLocalTrip,
  listLocalTrips,
  updateLocalTrip,
  validateExcelImport,
} from '../controllers/localTrips.controllers';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

router.get('/list', isAuthenticated, listLocalTrips);
router.post('/create', isAuthenticated, createLocalTrip);
router.get('/', isAuthenticated, getLocalTrip);
router.put('/update', isAuthenticated, updateLocalTrip);
router.post(
  '/validate-excel-import',
  isAuthenticated,
  upload.single('excel-file'),
  validateExcelImport
);

export default router;
