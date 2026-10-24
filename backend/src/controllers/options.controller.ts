import { Request, Response } from 'express';
import { OptionsService } from '../services/options.service';
import { asyncHandler } from '../middleware/error.middleware';

export const getOptionsChain = asyncHandler(async (req: Request, res: Response) => {
  const underlying = req.params.symbol;
  const chain = await OptionsService.getOptionsChain(underlying, req.user?.id);
  res.json({ success: true, data: chain });
});

export const getOptionsSignals = asyncHandler(async (req: Request, res: Response) => {
  const underlyings = (req.body.underlyings || ['NIFTY', 'BANKNIFTY', 'RELIANCE']) as string[];
  const signals = await OptionsService.getOptionsSignals(underlyings, req.user!.id);
  res.json({ success: true, data: signals });
});
