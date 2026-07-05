import { Request, Response } from 'express';
import { AdvisorService } from '../services/advisor.service';
import { asyncHandler } from '../middleware/error.middleware';

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const { message, symbol, adapterJobId } = req.body;
  if (!message?.trim()) {
    res.status(400).json({ success: false, message: 'Message is required' });
    return;
  }
  const result = await AdvisorService.chat(req.user!.id, message.trim(), symbol, adapterJobId);
  res.json({ success: true, data: result });
});
