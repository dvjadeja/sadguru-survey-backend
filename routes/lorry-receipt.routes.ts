import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLorryReceipt,
  getLorryReceipt,
  listLorryReceipt,
  updateLorryReceipt,
} from '../controllers/lorryReceipt.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLorryReceipt);
router.get('/', isAuthenticated, getLorryReceipt);
router.post('/create', isAuthenticated, createLorryReceipt);
router.put('/update', isAuthenticated, updateLorryReceipt);

export default router;
