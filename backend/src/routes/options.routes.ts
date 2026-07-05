import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as optionsController from '../controllers/options.controller';

const router = Router();
router.use(authenticate);

router.get('/chain/:symbol', optionsController.getOptionsChain);
router.post('/signals', optionsController.getOptionsSignals);

export default router;
