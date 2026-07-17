import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  convertToAlgo,
  deployPaperStrategy,
  dismissAdvisory,
  discoverExternal,
  generateAdvisory,
  getAdvisory,
  getExternal,
  getStrategyOption,
  latestAdvisory,
  listExternal,
  listMcpConnectors,
  listRecommendations,
  listStrategyOptions,
  mcpAccountSnapshot,
  normalizeExternal,
  paperTestStrategy,
  refreshAdvisory,
  requestLiveApproval,
  riskScanExternal,
  saveStrategyOption,
  updateStrategyOption
} from '../controllers/advisory-marketplace.controller';

const router = Router();
router.use(authenticate);

router.post('/advisory/generate', generateAdvisory);
router.get('/advisory/latest', latestAdvisory);
router.get('/advisory/:id', getAdvisory);
router.get('/advisory/:id/recommendations', listRecommendations);
router.post('/advisory/:id/recommendations/:recommendationId/convert-to-algo', convertToAlgo);
router.post('/advisory/:id/dismiss', dismissAdvisory);
router.post('/advisory/:id/refresh', refreshAdvisory);

router.get('/strategy-options', listStrategyOptions);
router.get('/strategy-options/:id', getStrategyOption);
router.put('/strategy-options/:id', updateStrategyOption);
router.post('/strategy-options/:id/paper-test', paperTestStrategy);
router.post('/strategy-options/:id/save', saveStrategyOption);
router.post('/strategy-options/:id/deploy-paper', deployPaperStrategy);
router.post('/strategy-options/:id/request-live-approval', requestLiveApproval);

router.post('/external-algos/discover', discoverExternal);
router.get('/external-algos/candidates', listExternal);
router.get('/external-algos/candidates/:id', getExternal);
router.post('/external-algos/candidates/:id/normalize', normalizeExternal);
router.post('/external-algos/candidates/:id/risk-scan', riskScanExternal);

router.get('/mcp/connectors', listMcpConnectors);
router.get('/mcp/accounts/:id/snapshot', mcpAccountSnapshot);

export default router;
