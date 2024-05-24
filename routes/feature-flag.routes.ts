import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createFeatureFlag,
  getFeatureFlagsForUser,
  toggleFeatureForUser,
} from '../controllers/featureFlag.controllers';

const router = Router();

router.get('/list', isAuthenticated, getFeatureFlagsForUser);
router.post('/create', isAuthenticated, createFeatureFlag);
router.post('/toggle', isAuthenticated, toggleFeatureForUser);

export default router;
