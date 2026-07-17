import { Router } from 'express';
import { register, login, logout, refreshToken, getProfile, updateProfile, localGuest } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/local-guest', localGuest);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);

export default router;
