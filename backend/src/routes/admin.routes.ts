import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// Admin routes - to be implemented
router.get('/users', (req, res) => {
  res.json({ success: true, data: [], message: 'Admin endpoints coming soon' });
});

router.get('/stats', (req, res) => {
  res.json({ success: true, data: {}, message: 'Stats endpoint coming soon' });
});

export default router;
