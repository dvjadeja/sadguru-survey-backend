import { Router } from 'express';

import { isAuthenticated } from '../middleware';
import { listLedgerTransactions } from '../controllers/ledgerTransaction.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLedgerTransactions);

export default router;
