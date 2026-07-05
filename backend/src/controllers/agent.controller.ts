import { Request, Response } from 'express';
import { TradingAgentService } from '../services/trading-agent.service';
import { asyncHandler } from '../middleware/error.middleware';

export const listAgents = asyncHandler(async (req: Request, res: Response) => {
  const agents = await TradingAgentService.listAgents(req.user!.id);
  res.json({ success: true, data: agents });
});

export const getAgent = asyncHandler(async (req: Request, res: Response) => {
  const agent = await TradingAgentService.getAgent(req.user!.id, req.params.id);
  res.json({ success: true, data: agent });
});

export const createAgent = asyncHandler(async (req: Request, res: Response) => {
  const agent = await TradingAgentService.createAgent(req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'Trading agent created', data: agent });
});

export const updateAgent = asyncHandler(async (req: Request, res: Response) => {
  const agent = await TradingAgentService.updateAgent(req.user!.id, req.params.id, req.body);
  res.json({ success: true, message: 'Agent updated', data: agent });
});

export const deleteAgent = asyncHandler(async (req: Request, res: Response) => {
  const result = await TradingAgentService.deleteAgent(req.user!.id, req.params.id);
  res.json({ success: true, ...result });
});

export const runAgent = asyncHandler(async (req: Request, res: Response) => {
  const result = await TradingAgentService.runAgent(req.user!.id, req.params.id);
  res.json({ success: true, message: 'Agent run completed', data: result });
});
