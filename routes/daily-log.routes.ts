import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createDailyLog,
  deleteDailyLog,
  getDailyLog,
  listDailyLogs,
  printDailyLog,
  updateDailyLog,
} from '../controllers/dailyLogs.controllers';

const router = Router();

router.get('/list', isAuthenticated, listDailyLogs);
router.get('/', isAuthenticated, getDailyLog);
router.get('/print', isAuthenticated, printDailyLog);
router.post('/create', isAuthenticated, createDailyLog);
router.put('/update', isAuthenticated, updateDailyLog);
router.delete('/delete', isAuthenticated, deleteDailyLog);

export default router;
