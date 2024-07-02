import { Router } from 'express';

import { isAuthenticated } from '../middleware';
import {
  createLedgerTransaction,
  listLedgerTransactions,
} from '../controllers/ledgerTransaction.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLedgerTransactions);

router.post('/create', isAuthenticated, createLedgerTransaction);

export default router;
