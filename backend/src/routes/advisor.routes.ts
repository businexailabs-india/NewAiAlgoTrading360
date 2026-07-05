import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as advisorController from '../controllers/advisor.controller';

const router = Router();
router.use(authenticate);

router.post('/chat', advisorController.chat);

export default router;
