import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createVendor,
  getVendor,
  listVendor,
  updateVendor,
} from '../controllers/vendor.controllers';

const router = Router();

router.get('/list', isAuthenticated, listVendor);
router.get('/', isAuthenticated, getVendor);
router.post('/create', isAuthenticated, createVendor);
router.put('/update', isAuthenticated, updateVendor);

export default router;
