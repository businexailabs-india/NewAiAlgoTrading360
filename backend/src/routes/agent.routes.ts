import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as agentController from '../controllers/agent.controller';

const router = Router();
router.use(authenticate);

router.get('/', agentController.listAgents);
router.post('/', agentController.createAgent);
router.get('/:id', agentController.getAgent);
router.put('/:id', agentController.updateAgent);
router.delete('/:id', agentController.deleteAgent);
router.post('/:id/run', agentController.runAgent);

export default router;
