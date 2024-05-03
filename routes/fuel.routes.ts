import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import { createFuel, getFuel, listFuel } from '../controllers/fuel.controller';

const router = Router();

router.get('/list', isAuthenticated, listFuel);
router.get('/', isAuthenticated, getFuel);
router.post('/create', isAuthenticated, createFuel);

export default router;
