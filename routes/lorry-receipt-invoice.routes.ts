import { Router } from 'express';

import { isAuthenticated } from '../middleware';

import {
  getDataFromLrIds,
  listLorryReceiptInvoices,
} from '../controllers/lorryReceiptInvoice.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLorryReceiptInvoices);

router.post('/lr-ids', isAuthenticated, getDataFromLrIds);

export default router;
