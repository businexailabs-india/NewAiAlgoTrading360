import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { AdvisoryGatewayService } from '../services/advisory-gateway.service';

export const generateAdvisory = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.generate(req.user!.id, req.user!.role);
  res.json({ success: true, data });
});

export const latestAdvisory = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.latest(req.user!.id, req.user!.role);
  res.json({ success: true, data });
});

export const getAdvisory = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.get(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const listRecommendations = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.recommendations(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const convertToAlgo = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.convert(
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.params.recommendationId
  );
  res.json({ success: true, data });
});

export const dismissAdvisory = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.dismiss(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const refreshAdvisory = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.refresh(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const listStrategyOptions = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.listOptions(req.user!.id, req.user!.role);
  res.json({ success: true, data });
});

export const getStrategyOption = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.getOption(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const updateStrategyOption = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.updateOption(req.user!.id, req.user!.role, req.params.id, req.body);
  res.json({ success: true, data });
});

export const paperTestStrategy = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.paperTest(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const saveStrategyOption = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.saveOption(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const deployPaperStrategy = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.deployPaper(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const requestLiveApproval = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.requestLive(req.user!.id, req.user!.role, req.params.id, {
    ...req.body,
    live_env_enabled: process.env.LIVE_TRADING_ENABLED === 'true',
  });
  res.json({ success: true, data });
});

export const discoverExternal = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.discoverExternal(req.user!.id, req.user!.role);
  res.json({ success: true, data });
});

export const listExternal = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.listExternal(req.user!.id, req.user!.role);
  res.json({ success: true, data });
});

export const getExternal = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.getExternal(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const normalizeExternal = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.normalizeExternal(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const riskScanExternal = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.riskScanExternal(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const listMcpConnectors = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.listMcp(req.user!.id, req.user!.role);
  res.json({ success: true, data });
});

export const mcpAccountSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const data = await AdvisoryGatewayService.mcpSnapshot(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});
