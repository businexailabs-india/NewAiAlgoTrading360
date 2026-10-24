import { Request, Response } from 'express';
import { IntegrationService } from '../services/integration.service';
import { asyncHandler } from '../middleware/error.middleware';

export const listCapabilities = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: IntegrationService.capabilityCatalog() });
});

export const listMcpServers = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.listMcpServers(req.user!.id);
  res.json({ success: true, data });
});

export const createMcpServer = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.createMcpServer(req.user!.id, req.body);
  res.status(201).json({ success: true, data });
});

export const updateMcpServer = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.updateMcpServer(req.user!.id, req.params.id, req.body);
  res.json({ success: true, data });
});

export const deleteMcpServer = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.deleteMcpServer(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const testMcpServer = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.testMcpServer(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const listIndianMcpCatalog = asyncHandler(async (_req: Request, res: Response) => {
  const data = IntegrationService.listIndianMcpCatalog();
  res.json({ success: true, data });
});

export const scanIndianMcpServers = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.scanIndianMcpServers(req.user!.id, {
    probe: req.body?.probe !== false,
    providers: Array.isArray(req.body?.providers) ? req.body.providers : undefined
  });
  res.json({ success: true, data });
});

export const addIndianMcpServers = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.addIndianMcpServers(req.user!.id, {
    providers: Array.isArray(req.body?.providers) ? req.body.providers : undefined,
    onlyReachable: !!req.body?.onlyReachable,
    updateExisting: !!req.body?.updateExisting,
    probeFirst: req.body?.probeFirst !== false
  });
  res.status(201).json({ success: true, data });
});

export const listAccounts = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.listAccounts(req.user!.id);
  res.json({ success: true, data });
});

export const upsertDhanAccount = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.upsertDhanAccount(req.user!.id, req.body);
  res.status(201).json({ success: true, data });
});

export const upsertFyersAccount = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.upsertFyersAccount(req.user!.id, req.body);
  res.status(201).json({ success: true, data });
});

export const validateAccount = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.validateAccount(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const setAccountEnabled = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.setAccountEnabled(req.user!.id, req.params.id, !!req.body.enabled);
  res.json({ success: true, data });
});

export const syncAccountPortfolio = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.syncAccountPortfolio(req.user!.id, req.params.id);
  res.json({ success: true, message: 'Dhan portfolio synced', data });
});

export const bootstrapEnvDhan = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.bootstrapEnvDhanAndSync(req.user!.id);
  res.json({ success: true, message: 'Dhan account connected from env and portfolio synced', data });
});

export const bootstrapEnvFyers = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.bootstrapEnvFyersAndSync(req.user!.id);
  res.json({ success: true, message: 'Fyers account connected from env', data });
});

export const getExecutionContext = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.getExecutionContext(req.user!.id);
  res.json({ success: true, data });
});

export const updateExecutionContext = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.updateExecutionContext(req.user!.id, req.body);
  res.json({ success: true, data });
});

export const updateTradingControl = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.updateTradingControl(req.user!.id, req.body, {
    isAdmin: req.user?.role === 'admin'
  });
  res.json({ success: true, data });
});

export const featureStatus = asyncHandler(async (req: Request, res: Response) => {
  const data = await IntegrationService.featureStatus(req.user!.id);
  res.json({ success: true, data });
});
