import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/error.middleware';
import { DhanLaxmiGatewayService } from '../services/dhanlaxmi-gateway.service';

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.chat(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});

export const intent = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.intent(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});

export const strategyDraft = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.strategyDraft(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});

export const advisory = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.advisory(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});

export const paperTest = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.paperTest(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});

export const createTradeApproval = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.createTradeApproval(
    req.user!.id,
    req.user!.role,
    req.body || {}
  );
  res.json({ success: true, data });
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.getConversation(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const getApproval = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.getApproval(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.approve(
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.body || {}
  );
  res.json({ success: true, data });
});

export const reject = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.reject(req.user!.id, req.user!.role, req.params.id);
  res.json({ success: true, data });
});

export const modify = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.modify(
    req.user!.id,
    req.user!.role,
    req.params.id,
    req.body || {}
  );
  res.json({ success: true, data });
});

export const transcribe = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.transcribe(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});

export const voiceRespond = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.voiceRespond(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});

export const voiceCommand = asyncHandler(async (req: Request, res: Response) => {
  const data = await DhanLaxmiGatewayService.voiceCommand(req.user!.id, req.user!.role, req.body || {});
  res.json({ success: true, data });
});
