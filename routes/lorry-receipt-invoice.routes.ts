import { Router } from 'express';

import { isAuthenticated } from '../middleware';

import {
  createLorryReceiptInvoice,
  getDataFromLrIds,
  listLorryReceiptInvoices,
  printLorryReceiptInvoice,
} from '../controllers/lorryReceiptInvoice.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLorryReceiptInvoices);

router.post('/lr-ids', isAuthenticated, getDataFromLrIds);

router.post('/create', isAuthenticated, createLorryReceiptInvoice);

router.get('/print', isAuthenticated, printLorryReceiptInvoice);

export default router;
