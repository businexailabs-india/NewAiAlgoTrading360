import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as llmController from '../controllers/llm.controller';

const router = Router();
router.use(authenticate);

router.get('/status', llmController.getLlmStatus);
router.get('/jobs', llmController.listJobs);
router.get('/adapters', llmController.listAdapters);
router.post('/train', llmController.startTraining);

export default router;
