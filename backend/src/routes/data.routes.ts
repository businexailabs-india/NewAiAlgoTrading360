import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as dataController from '../controllers/data.controller';

const router = Router();

router.use(authenticate);

router.get('/status', dataController.getDatasetStatus);
router.get('/symbol/:symbol', dataController.getSymbolData);
router.post('/collect', dataController.collectData);

export default router;
