import { Router } from 'express';
import {
  authMe,
  getUserData,
  login,
  register,
  updatePassword,
  updateUser,
} from '../controllers/auth.controllers';
import { isAuthenticated } from '../middleware';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', isAuthenticated, authMe);
router.get('/user', isAuthenticated, getUserData);
router.post('/update', isAuthenticated, updateUser);
router.post('/update-password', isAuthenticated, updatePassword);

export default router;
