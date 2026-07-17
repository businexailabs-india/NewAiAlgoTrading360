import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  listCapabilities,
  listMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  testMcpServer,
  listAccounts,
  upsertDhanAccount,
  validateAccount,
  setAccountEnabled,
  syncAccountPortfolio,
  bootstrapEnvDhan,
  getExecutionContext,
  updateExecutionContext,
  updateTradingControl,
  featureStatus
} from '../controllers/integration.controller';

const router = Router();

router.use(authenticate);

router.get('/capabilities', listCapabilities);
router.get('/status', featureStatus);

router.get('/mcp-servers', listMcpServers);
router.post('/mcp-servers', createMcpServer);
router.put('/mcp-servers/:id', updateMcpServer);
router.delete('/mcp-servers/:id', deleteMcpServer);
router.post('/mcp-servers/:id/test', testMcpServer);

router.get('/accounts', listAccounts);
router.post('/accounts/dhan', upsertDhanAccount);
router.post('/accounts/dhan/bootstrap-env', bootstrapEnvDhan);
router.post('/accounts/:id/validate', validateAccount);
router.post('/accounts/:id/enable', setAccountEnabled);
router.post('/accounts/:id/sync', syncAccountPortfolio);

router.get('/execution-context', getExecutionContext);
router.put('/execution-context', updateExecutionContext);

// Live controls: admin for GLOBAL, user can manage own USER/ACCOUNT scopes
router.put('/trading-controls', updateTradingControl);
router.put('/trading-controls/global', authorize('admin'), updateTradingControl);

export default router;
