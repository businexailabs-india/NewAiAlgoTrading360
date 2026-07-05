import { Request, Response } from 'express';
import { ScreenerService } from '../services/screener.service';
import { asyncHandler } from '../middleware/error.middleware';

export const runScreener = asyncHandler(async (req: Request, res: Response) => {
  const result = await ScreenerService.runScreener(req.user!.id, req.body);
  res.json({ success: true, data: result });
});

export const getScreenerHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await ScreenerService.getHistory(req.user!.id);
  res.json({ success: true, data: history });
});
