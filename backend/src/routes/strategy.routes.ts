import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Strategy routes - to be implemented
router.get('/', (req, res) => {
  res.json({ success: true, data: [], message: 'Strategy endpoints coming soon' });
});

export default router;
