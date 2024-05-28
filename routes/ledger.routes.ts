import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLedger,
  deleteLedger,
  getLedger,
  listLedger,
  updateLedger,
} from '../controllers/ledger.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLedger);
router.get('/', isAuthenticated, getLedger);
router.post('/create', isAuthenticated, createLedger);
router.put('/update', isAuthenticated, updateLedger);
router.delete('/delete', isAuthenticated, deleteLedger);

export default router;
