import { Request, Response } from 'express';
import { PredictionService } from '../services/prediction.service';
import { asyncHandler } from '../middleware/error.middleware';

export const listEngines = asyncHandler(async (req: Request, res: Response) => {
  const engines = await PredictionService.listEngines(req.user!.id);
  res.status(200).json({ success: true, data: engines });
});

export const getEngine = asyncHandler(async (req: Request, res: Response) => {
  const engine = await PredictionService.getEngine(req.user!.id, req.params.id);
  res.status(200).json({ success: true, data: engine });
});

export const createEngine = asyncHandler(async (req: Request, res: Response) => {
  const engine = await PredictionService.createEngine(req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'Prediction engine created', data: engine });
});

export const updateEngine = asyncHandler(async (req: Request, res: Response) => {
  const engine = await PredictionService.updateEngine(req.user!.id, req.params.id, req.body);
  res.status(200).json({ success: true, message: 'Engine updated', data: engine });
});

export const deleteEngine = asyncHandler(async (req: Request, res: Response) => {
  const result = await PredictionService.deleteEngine(req.user!.id, req.params.id);
  res.status(200).json({ success: true, ...result });
});

export const trainEngine = asyncHandler(async (req: Request, res: Response) => {
  const engine = await PredictionService.trainEngine(req.user!.id, req.params.id);
  res.status(200).json({ success: true, message: 'Engine trained successfully', data: engine });
});

export const runPredictions = asyncHandler(async (req: Request, res: Response) => {
  const predictions = await PredictionService.runPredictions(req.user!.id, req.params.id);
  res.status(200).json({ success: true, data: predictions });
});

export const deployEngine = asyncHandler(async (req: Request, res: Response) => {
  const { target } = req.body;
  const engine = await PredictionService.deployEngine(req.user!.id, req.params.id, target);
  res.status(200).json({
    success: true,
    message: `Engine deployed to ${target}`,
    data: engine
  });
});

// Public inference endpoint for deployed engines
export const publicPredict = asyncHandler(async (req: Request, res: Response) => {
  const engineId = req.params.id || (req.query.engineId as string);
  const userId = req.user!.id;
  const predictions = await PredictionService.runPredictions(userId, engineId);
  res.status(200).json({ success: true, data: predictions, timestamp: new Date().toISOString() });
});
