import { Router } from 'express';

import { isAuthenticated } from '../middleware';

import {
  createLorryReceiptInvoice,
  getDataFromLrIds,
  listLorryReceiptInvoices,
} from '../controllers/lorryReceiptInvoice.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLorryReceiptInvoices);

router.post('/lr-ids', isAuthenticated, getDataFromLrIds);

router.post('/create', isAuthenticated, createLorryReceiptInvoice);

export default router;
