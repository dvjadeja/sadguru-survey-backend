import { Router } from 'express';
import { isAuthenticated } from '../middleware';
import { upload } from '../utils/multer.utils';
import { deleteFile, uploadFile } from '../controllers/files.controllers';

const router = Router();

// Upload Logo
router.post('/upload-logo', isAuthenticated, upload.single('logo'), uploadFile);

// Upload Stamp
router.post(
  '/upload-stamp',
  isAuthenticated,
  upload.single('stamp'),
  uploadFile
);

// Upload Driver aadhar
router.post(
  '/upload-driver-aadhar',
  isAuthenticated,
  upload.single('driver/aadhar'),
  uploadFile
);

// Upload Driver licence
router.post(
  '/upload-driver-licence',
  isAuthenticated,
  upload.single('driver/licence'),
  uploadFile
);

// Upload Vehicle PUC
router.post(
  '/upload-vehicle-puc',
  isAuthenticated,
  upload.single('vehicle/puc'),
  uploadFile
);

// Upload Vehicle RC
router.post(
  '/upload-vehicle-rc',
  isAuthenticated,
  upload.single('vehicle/rc'),
  uploadFile
);

// Upload Vehicle permit
router.post(
  '/upload-vehicle-permit',
  isAuthenticated,
  upload.single('vehicle/permit'),
  uploadFile
);

// Upload Vehicle insurance
router.post(
  '/upload-vehicle-insurance',
  isAuthenticated,
  upload.single('vehicle/insurance'),
  uploadFile
);

// Upload Vehicle tax
router.post(
  '/upload-vehicle-tax',
  isAuthenticated,
  upload.single('vehicle/tax'),
  uploadFile
);

// Upload Vehicle Fitness
router.post(
  '/upload-vehicle-fitness',
  isAuthenticated,
  upload.single('vehicle/fitness'),
  uploadFile
);

router.delete('/delete', isAuthenticated, deleteFile);

export default router;
