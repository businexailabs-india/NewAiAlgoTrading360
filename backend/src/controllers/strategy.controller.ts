import { Request, Response } from 'express';
import { StrategyService } from '../services/strategy.service';
import { asyncHandler } from '../middleware/error.middleware';

export const listStrategies = asyncHandler(async (req: Request, res: Response) => {
  const data = await StrategyService.listStrategies(req.user!.id);
  res.json({ success: true, data });
});

export const getPresets = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: StrategyService.getPresets() });
});

export const getStrategy = asyncHandler(async (req: Request, res: Response) => {
  const data = await StrategyService.getStrategy(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const createStrategy = asyncHandler(async (req: Request, res: Response) => {
  const data = await StrategyService.createStrategy(req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'Strategy created', data });
});

export const updateStrategy = asyncHandler(async (req: Request, res: Response) => {
  const data = await StrategyService.updateStrategy(req.user!.id, req.params.id, req.body);
  res.json({ success: true, message: 'Strategy updated', data });
});

export const deleteStrategy = asyncHandler(async (req: Request, res: Response) => {
  const result = await StrategyService.deleteStrategy(req.user!.id, req.params.id);
  res.json({ success: true, ...result });
});

export const evaluateStrategy = asyncHandler(async (req: Request, res: Response) => {
  const data = await StrategyService.evaluateStrategy(req.user!.id, req.params.id);
  res.json({ success: true, data });
});

export const backtestStrategy = asyncHandler(async (req: Request, res: Response) => {
  const horizonDays = parseInt(req.body.horizonDays as string) || 5;
  const data = await StrategyService.backtestStrategy(req.user!.id, req.params.id, horizonDays);
  res.json({ success: true, message: 'Backtest complete', data });
});
