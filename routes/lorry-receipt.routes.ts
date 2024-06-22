import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLorryReceipt,
  getLorryReceipt,
  getPendingLorryReceiptByLedger,
  listLorryReceipt,
  printLorryReceipt,
  updateLorryReceipt,
} from '../controllers/lorryReceipt.controllers';

const router = Router();

router.get('/list', isAuthenticated, listLorryReceipt);
router.get('/', isAuthenticated, getLorryReceipt);
router.post('/create', isAuthenticated, createLorryReceipt);
router.put('/update', isAuthenticated, updateLorryReceipt);
router.get('/print', isAuthenticated, printLorryReceipt);
router.get(
  '/pending-lr-by-ledger',
  isAuthenticated,
  getPendingLorryReceiptByLedger
);

export default router;
