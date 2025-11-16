import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Tax routes - to be implemented
router.get('/summary', (req, res) => {
  res.json({ success: true, data: {}, message: 'Tax endpoints coming soon' });
});

export default router;
