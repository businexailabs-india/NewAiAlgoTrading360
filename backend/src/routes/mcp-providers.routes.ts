import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as ctrl from '../controllers/mcp-providers.controller';

/** Admin role, or local/dev bypass for MCP console demos. */
function requireMcpAdmin(req: Request, res: Response, next: NextFunction) {
  if (process.env.LOCAL_MCP_ADMIN_BYPASS === 'true' || process.env.LOCAL_AUTH_BYPASS === 'true') {
    next();
    return;
  }
  return authorize('admin')(req, res, next);
}

const router = Router();
router.use(authenticate);

// Provider catalog (any authenticated user; admin UI gates separately)
router.get('/mcp/providers', ctrl.listProviders);
router.post('/mcp/providers/reload', requireMcpAdmin, ctrl.reloadProviders);
router.get('/mcp/providers/:providerId', ctrl.getProvider);
router.get('/mcp/providers/:providerId/capabilities', ctrl.getProviderCapabilities);
router.get('/mcp/providers/:providerId/required-credentials', ctrl.getProviderRequiredCredentials);
router.post('/mcp/providers/:providerId/validate-config', ctrl.validateProviderConfig);

// Connections
router.post('/mcp/connections', ctrl.createConnection);
router.get('/mcp/connections', ctrl.listConnections);
router.get('/mcp/connections/:connectionId', ctrl.getConnection);
router.delete('/mcp/connections/:connectionId', ctrl.disconnectConnection);
router.post('/mcp/connections/:connectionId/test', ctrl.testConnection);
router.post('/mcp/connections/:connectionId/refresh-session', ctrl.refreshConnectionSession);
router.get('/mcp/connections/:connectionId/health', ctrl.getConnectionHealth);
router.get('/mcp/connections/:connectionId/snapshot', ctrl.getAccountSnapshot);
router.get('/mcp/connections/:connectionId/margins', ctrl.getMargins);
router.get('/mcp/connections/:connectionId/holdings', ctrl.getHoldings);
router.get('/mcp/connections/:connectionId/positions', ctrl.getPositions);
router.get('/mcp/connections/:connectionId/orders', ctrl.getOrders);
router.get('/mcp/connections/:connectionId/trades', ctrl.getTrades);
router.get('/mcp/connections/:connectionId/quote/:symbol', ctrl.getQuote);
router.post('/mcp/connections/:connectionId/orders/preview', ctrl.previewOrder);

// Assistants / advisory context
router.get('/mcp/dhanlaxmi/context', ctrl.dhanlaxmiContext);
router.get('/mcp/dhanlaxmi/dhan-status', ctrl.dhanlaxmiStatus);
router.get('/mcp/advisory/provider-context', ctrl.advisoryProviderContext);
router.get('/mcp/live-trading/status', ctrl.liveTradingHealth);

// Admin MCP console
router.get('/admin/mcp/providers', requireMcpAdmin, ctrl.adminListProviders);
router.put('/admin/mcp/providers/:providerId/enable', requireMcpAdmin, ctrl.enableProvider);
router.put('/admin/mcp/providers/:providerId/disable', requireMcpAdmin, ctrl.disableProvider);
router.put(
  '/admin/mcp/providers/:providerId/capabilities',
  requireMcpAdmin,
  ctrl.updateProviderCapabilities
);
router.get('/admin/mcp/provider-health', requireMcpAdmin, ctrl.listProviderHealth);
router.get('/admin/mcp/connections', requireMcpAdmin, ctrl.adminListConnections);
router.put(
  '/admin/mcp/connections/:connectionId/live-trading',
  requireMcpAdmin,
  ctrl.setConnectionLiveTrading
);
router.get('/admin/mcp/audit', requireMcpAdmin, ctrl.listProviderAuditLogs);

export default router;
