import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createOtherOrganization,
  getOtherOrganizationDetail,
  listOtherOrganizations,
  updateOtherOrganization,
} from '../controllers/otherOrganization.controllers';

const router = Router();

router.get('/list', isAuthenticated, listOtherOrganizations);
router.get('/', isAuthenticated, getOtherOrganizationDetail);

router.post('/create', isAuthenticated, createOtherOrganization);

router.put('/update', isAuthenticated, updateOtherOrganization);

export default router;
