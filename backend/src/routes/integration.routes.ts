import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { Request, Response } from 'express';
import { DhanHqSidecarClient } from '../services/dhanhq-sidecar.client';
import {
  listCapabilities,
  listMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  testMcpServer,
  listIndianMcpCatalog,
  scanIndianMcpServers,
  addIndianMcpServers,
  listAccounts,
  upsertDhanAccount,
  upsertFyersAccount,
  validateAccount,
  setAccountEnabled,
  syncAccountPortfolio,
  bootstrapEnvDhan,
  bootstrapEnvFyers,
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
router.get('/mcp-servers/indian/catalog', listIndianMcpCatalog);
router.post('/mcp-servers/indian/scan', scanIndianMcpServers);
router.post('/mcp-servers/indian/add', addIndianMcpServers);
router.put('/mcp-servers/:id', updateMcpServer);
router.delete('/mcp-servers/:id', deleteMcpServer);
router.post('/mcp-servers/:id/test', testMcpServer);

router.get('/accounts', listAccounts);
router.post('/accounts/dhan', upsertDhanAccount);
router.post('/accounts/fyers', upsertFyersAccount);
router.post('/accounts/dhan/bootstrap-env', bootstrapEnvDhan);
router.post('/accounts/fyers/bootstrap-env', bootstrapEnvFyers);
router.post('/accounts/:id/validate', validateAccount);
router.post('/accounts/:id/enable', setAccountEnabled);
router.post('/accounts/:id/sync', syncAccountPortfolio);

router.get('/execution-context', getExecutionContext);
router.put('/execution-context', updateExecutionContext);

// Live controls: admin for GLOBAL, user can manage own USER/ACCOUNT scopes
router.put('/trading-controls', updateTradingControl);
router.put('/trading-controls/global', authorize('admin'), updateTradingControl);

/** Official DhanHQ-py Python sidecar (optional). */
router.get(
  '/dhanhq/health',
  asyncHandler(async (_req: Request, res: Response) => {
    const health = await DhanHqSidecarClient.health();
    res.json({
      success: true,
      data: {
        sidecarUrl: DhanHqSidecarClient.url(),
        envConfigured: DhanHqSidecarClient.configured(),
        ...health
      }
    });
  })
);

router.get(
  '/dhanhq/funds',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await DhanHqSidecarClient.funds({
      client_id: typeof req.query.client_id === 'string' ? req.query.client_id : undefined,
      access_token: typeof req.query.access_token === 'string' ? req.query.access_token : undefined
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/dhanhq/expiry-list',
  asyncHandler(async (req: Request, res: Response) => {
    const under = Number(req.query.under_security_id || 13);
    const segment = String(req.query.under_exchange_segment || 'IDX_I');
    const data = await DhanHqSidecarClient.expiryList(under, segment);
    res.json({ success: true, data });
  })
);

router.post(
  '/dhanhq/option-chain',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await DhanHqSidecarClient.optionChain(req.body || {});
    res.json({ success: true, data });
  })
);

router.post(
  '/dhanhq/quotes/ohlc',
  asyncHandler(async (req: Request, res: Response) => {
    const { securities, client_id, access_token } = req.body || {};
    const data = await DhanHqSidecarClient.quotesOhlc(securities || { NSE_EQ: [1333] }, {
      client_id,
      access_token
    });
    res.json({ success: true, data });
  })
);

export default router;
