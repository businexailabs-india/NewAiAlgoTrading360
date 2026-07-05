import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as screenerController from '../controllers/screener.controller';

const router = Router();
router.use(authenticate);

router.post('/run', screenerController.runScreener);
router.get('/history', screenerController.getScreenerHistory);

export default router;
