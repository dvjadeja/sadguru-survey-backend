import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createTransaction,
  getTransaction,
  listTransactions,
  printTransactions,
} from '../controllers/transaction.controller';

const router = Router();

router.get('/list', isAuthenticated, listTransactions);
router.get('/', isAuthenticated, getTransaction);
router.post('/create', isAuthenticated, createTransaction);
router.get('/print', isAuthenticated, printTransactions);

export default router;
