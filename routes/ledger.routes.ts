import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLedger,
  deleteLedger,
  getLedger,
  listAllLedgers,
  listLedger,
  updateLedger,
} from '../controllers/ledger.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLedger);
router.get('/', isAuthenticated, getLedger);
router.post('/create', isAuthenticated, createLedger);
router.put('/update', isAuthenticated, updateLedger);
router.delete('/delete', isAuthenticated, deleteLedger);
router.get('/all', isAuthenticated, listAllLedgers);

export default router;
