import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import {
  createVendor,
  getVendor,
  listAllVendors,
  listVendor,
  printAllVendorDataForExcel,
  updateVendor,
} from '../controllers/vendor.controllers';

const router = Router();

// List Vendor data using pagination
router.get('/list', isAuthenticated, listVendor);

// List all vendors for Select dropdown
router.get('/list-all', isAuthenticated, listAllVendors);

// Get a single vendor data
router.get('/', isAuthenticated, getVendor);

// Create new vendor
router.post('/create', isAuthenticated, createVendor);

// Update vendor
router.put('/update', isAuthenticated, updateVendor);

// Get All Vendor data for Excel export using xlsx on frontend
router.get(
  '/list-all-for-excel-export',
  isAuthenticated,
  printAllVendorDataForExcel
);

export default router;
