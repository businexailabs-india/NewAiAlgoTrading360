import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { IntegrationService } from '../services/integration.service';
import { RiskGateService } from '../services/risk-gate.service';
import { asyncHandler } from '../middleware/error.middleware';
import { prisma } from '../config/database';
import { importHolding, importTrade } from '../controllers/portfolio.controller';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/users', asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const result = await DatabaseService.getUsers(page, limit);
  res.json({ success: true, data: result });
}));

router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const stats = await DatabaseService.getAdminStats();
  res.json({ success: true, data: stats });
}));

router.get('/integrations/status', asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.featureStatus(req.user!.id);
  res.json({ success: true, data });
}));

router.get('/trading-controls', asyncHandler(async (_req: Request, res: Response) => {
  await RiskGateService.ensureGlobalControl();
  const controls = await prisma.tradingControl.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json({ success: true, data: controls });
}));

router.put('/trading-controls', asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.updateTradingControl(req.user!.id, {
    ...req.body,
    scope: req.body.scope || 'GLOBAL'
  }, { isAdmin: true });
  res.json({ success: true, data });
}));

router.get('/audit-logs', asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit
  });
  res.json({ success: true, data: logs });
}));

router.get('/mcp-servers', asyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.mcpServerConfig.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
  res.json({
    success: true,
    data: rows.map(r => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      provider: r.provider,
      transport: r.transport,
      endpoint: r.endpoint,
      isEnabled: r.isEnabled,
      lastHealthStatus: r.lastHealthStatus,
      lastHealthCheckedAt: r.lastHealthCheckedAt,
      latencyMs: r.latencyMs,
      capabilities: r.capabilities,
      toolCount: Array.isArray(r.discoveredTools) ? r.discoveredTools.length : 0
    }))
  });
}));

/** Explicitly labeled imports — not public authenticated mutation */
router.post('/import/holdings', importHolding);
router.post('/import/trades', importTrade);

export default router;
