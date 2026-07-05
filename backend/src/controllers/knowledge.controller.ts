import { Request, Response } from 'express';
import { RagService } from '../services/rag.service';
import { asyncHandler } from '../middleware/error.middleware';

export const listDocuments = asyncHandler(async (req: Request, res: Response) => {
  const symbol = req.query.symbol as string | undefined;
  const docs = await RagService.listDocuments(req.user!.id, symbol);
  res.json({ success: true, data: docs });
});

export const createDocument = asyncHandler(async (req: Request, res: Response) => {
  const doc = await RagService.createDocument(req.user!.id, req.body);
  res.status(201).json({ success: true, message: 'Document added', data: doc });
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const result = await RagService.deleteDocument(req.user!.id, req.params.id);
  res.json({ success: true, ...result });
});

export const queryKnowledge = asyncHandler(async (req: Request, res: Response) => {
  const { query, symbol, topK } = req.body;
  const result = await RagService.query(req.user!.id, query, symbol, topK || 5);
  res.json({ success: true, data: result });
});

export const reindex = asyncHandler(async (req: Request, res: Response) => {
  const count = await RagService.reindexUser(req.user!.id);
  res.json({ success: true, data: { chunksIndexed: count } });
});
