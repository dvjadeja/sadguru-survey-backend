import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLorryReceipt,
  listLorryReceipt,
} from '../controllers/lorryReceipt.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLorryReceipt);
router.post('/create', isAuthenticated, createLorryReceipt);

export default router;
