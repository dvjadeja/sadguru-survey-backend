import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createLorryReceipt,
  getLorryReceipt,
  getOtherOrganizationNameFromLRByLedger,
  getPendingLorryReceiptByLedger,
  listLorryReceipt,
  printLorryReceipt,
  updateLorryReceipt,
  updateManyLorryReceiptStatus,
  updateManyLRStatusByLRInvoiceId,
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
router.get(
  '/other-org-by-ledger',
  isAuthenticated,
  getOtherOrganizationNameFromLRByLedger
);

router.put(
  '/update-many-status',
  isAuthenticated,
  updateManyLorryReceiptStatus
);

router.put(
  '/update-many-status-by-lrInvoice',
  isAuthenticated,
  updateManyLRStatusByLRInvoiceId
);

export default router;
