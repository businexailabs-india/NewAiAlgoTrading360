import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { Request, Response } from 'express';
import { TradingViewConnectService } from '../services/tradingview/tradingview-connect.service';
import type { PayloadKind } from '../libs/tradingview/payload-builder';

const router = Router();

/** Public webhook — secret inside body */
router.post(
  '/tradingview/webhook/:connection_id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.ingestWebhook(
      req.params.connection_id,
      (req.body || {}) as Record<string, unknown>,
      {
        'user-agent': String(req.headers['user-agent'] || ''),
        'x-tv-secret': String(req.headers['x-tv-secret'] || '')
      }
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/tradingview/webhook/:connection_id/test',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const conn = await TradingViewConnectService.getConnection(req.user!.id, req.params.connection_id);
    // Test endpoint requires secret in body (user pastes current secret)
    const data = await TradingViewConnectService.ingestWebhook(
      conn.id,
      {
        secret: req.body?.secret,
        symbol: req.body?.symbol || 'RELIANCE',
        side: req.body?.side || 'BUY',
        signal_type: req.body?.signal_type || 'TV_TEST',
        price: req.body?.price || 1400,
        quantity: req.body?.quantity || 1,
        timestamp: new Date().toISOString(),
        ...(req.body || {})
      },
      {}
    );
    res.json({ success: true, data });
  })
);

router.use(authenticate);

router.post(
  '/tradingview/connections',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.createConnection(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/tradingview/connections',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.listConnections(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/tradingview/connections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.getConnection(req.user!.id, req.params.id);
    res.json({ success: true, data });
  })
);

router.delete(
  '/tradingview/connections/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.deleteConnection(req.user!.id, req.params.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/tradingview/connections/:id/rotate-secret',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.rotateSecret(req.user!.id, req.params.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/tradingview/connections/:id/setup-guide',
  asyncHandler(async (req: Request, res: Response) => {
    const data = TradingViewConnectService.setupGuide(req.params.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/tradingview/webhook-events',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.listWebhookEvents(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/tradingview/webhook-events/:event_id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.getWebhookEvent(req.user!.id, req.params.event_id);
    res.json({ success: true, data });
  })
);

router.get(
  '/tradingview/payload-templates',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, data: TradingViewConnectService.listPayloadTemplates() });
  })
);

router.post(
  '/tradingview/payload-templates',
  asyncHandler(async (req: Request, res: Response) => {
    // Persist custom template lightly via system generator for now
    const kind = String(req.body?.kind || 'STANDARD') as PayloadKind;
    const data = TradingViewConnectService.generatePayload(kind, req.body?.secret);
    res.json({ success: true, data: { name: req.body?.name || kind, kind, templateJson: data } });
  })
);

router.post(
  '/tradingview/payload-builder/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const kind = String(req.body?.kind || 'BUY') as PayloadKind;
    const data = TradingViewConnectService.generatePayload(kind, req.body?.secret);
    res.json({ success: true, data });
  })
);

router.get(
  '/signals',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.listSignals(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/signals/:signal_id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.getSignal(req.user!.id, req.params.signal_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/signals/:signal_id/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.validateSignal(req.user!.id, req.params.signal_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/signals/:signal_id/paper-test',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.paperTest(req.user!.id, req.params.signal_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/signals/:signal_id/convert-to-strategy',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.convertToStrategy(req.user!.id, req.params.signal_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/signals/:signal_id/request-live-approval',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.requestLiveApproval(req.user!.id, req.params.signal_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/signals/:signal_id/ignore',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.ignoreSignal(req.user!.id, req.params.signal_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/signals/:signal_id/allocate',
  asyncHandler(async (req: Request, res: Response) => {
    const accounts = Array.isArray(req.body?.accounts) ? req.body.accounts : [];
    const data = await TradingViewConnectService.allocate(req.user!.id, req.params.signal_id, accounts);
    res.json({ success: true, data });
  })
);

router.get(
  '/signals/:signal_id/child-orders',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingViewConnectService.childOrders(req.user!.id, req.params.signal_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/alert-to-algo/convert',
  asyncHandler(async (req: Request, res: Response) => {
    const signalId = String(req.body?.signal_id || '');
    const data = await TradingViewConnectService.convertToStrategy(req.user!.id, signalId);
    res.json({ success: true, data });
  })
);

router.post(
  '/alert-to-algo/generate-risk-rules',
  asyncHandler(async (req: Request, res: Response) => {
    const { defaultPaperRiskRules } = await import('../libs/tradingview/payload-builder');
    res.json({ success: true, data: defaultPaperRiskRules(Number(req.body?.capital) || 100000) });
  })
);

router.post(
  '/alert-to-algo/save-strategy',
  asyncHandler(async (req: Request, res: Response) => {
    const signalId = String(req.body?.signal_id || '');
    const data = await TradingViewConnectService.convertToStrategy(req.user!.id, signalId);
    res.json({ success: true, data });
  })
);

export default router;
