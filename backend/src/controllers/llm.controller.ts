import { Request, Response } from 'express';
import { LlmTrainingService } from '../services/llm-training.service';
import { asyncHandler } from '../middleware/error.middleware';

export const getLlmStatus = asyncHandler(async (_req: Request, res: Response) => {
  const status = await LlmTrainingService.getStatus();
  res.json({ success: true, data: status });
});

export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await LlmTrainingService.listJobs(req.user!.id);
  res.json({ success: true, data: jobs });
});

export const listAdapters = asyncHandler(async (req: Request, res: Response) => {
  const adapters = await LlmTrainingService.listAdapters(req.user!.id);
  res.json({ success: true, data: adapters });
});

export const startTraining = asyncHandler(async (req: Request, res: Response) => {
  const job = await LlmTrainingService.startTraining(req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'Training started', data: job });
});
