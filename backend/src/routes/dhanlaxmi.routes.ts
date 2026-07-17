import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  advisory,
  approve,
  chat,
  createTradeApproval,
  getApproval,
  getConversation,
  intent,
  modify,
  paperTest,
  reject,
  strategyDraft,
  transcribe,
  voiceCommand,
  voiceRespond
} from '../controllers/dhanlaxmi.controller';

const router = Router();
router.use(authenticate);

router.post('/dhanlaxmi/chat', chat);
router.post('/dhanlaxmi/intent', intent);
router.post('/dhanlaxmi/strategy-draft', strategyDraft);
router.post('/dhanlaxmi/advisory', advisory);
router.post('/dhanlaxmi/paper-test', paperTest);
router.post('/dhanlaxmi/trade-approval', createTradeApproval);
router.get('/dhanlaxmi/conversation/:id', getConversation);

router.post('/voice/transcribe', transcribe);
router.post('/voice/respond', voiceRespond);
router.post('/voice/command', voiceCommand);

router.post('/approvals/trade', createTradeApproval);
router.get('/approvals/:id', getApproval);
router.post('/approvals/:id/approve', approve);
router.post('/approvals/:id/reject', reject);
router.post('/approvals/:id/modify', modify);

export default router;
