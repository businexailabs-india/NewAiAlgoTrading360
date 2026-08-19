import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { Request, Response } from 'express';
import { LiveOptionsService } from '../services/options/live-options.service';
import {
  analyzeStrategy,
  STRATEGY_TEMPLATES
} from '../services/options/strategy-analytics.service';

const router = Router();
router.use(authenticate);

router.post(
  '/orders/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const legs = req.body?.legs;
    if (!Array.isArray(legs)) throw new AppError('legs array required', 400);
    const data = await LiveOptionsService.preview(req.user!.id, legs, {
      pin: req.body?.pin,
      confirmLive: !!req.body?.confirmLive
    });
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/clone-from-paper',
  asyncHandler(async (req: Request, res: Response) => {
    const strategyId = String(req.body?.strategyId || '');
    if (!strategyId) throw new AppError('strategyId required', 400);
    const data = await LiveOptionsService.cloneFromPaperStrategy(req.user!.id, strategyId);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const legs = req.body?.legs;
    if (!Array.isArray(legs)) throw new AppError('legs array required', 400);
    const data = await LiveOptionsService.submit(req.user!.id, legs, {
      pin: String(req.body?.pin || ''),
      confirmLive: !!req.body?.confirmLive
    });
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/:id/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await LiveOptionsService.cancel(req.user!.id, req.params.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/:id/modify',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await LiveOptionsService.modify(req.user!.id, req.params.id, {
      quantity: req.body?.quantity != null ? Number(req.body.quantity) : undefined,
      price: req.body?.price != null ? Number(req.body.price) : undefined,
      triggerPrice: req.body?.triggerPrice != null ? Number(req.body.triggerPrice) : undefined,
      orderType: req.body?.orderType
    });
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/:id/square-off',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await LiveOptionsService.squareOff(req.user!.id, req.params.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const { OrderExecutionService } = await import('../services/order-execution.service');
    const data = await OrderExecutionService.getOrders(req.user!.id, {
      isPaper: req.query.isPaper === 'true' ? true : req.query.isPaper === 'false' ? false : undefined,
      status: req.query.status as string | undefined
    });
    // Prefer option / NFO orders for this desk
    const filtered = data.filter(
      (o) => o.instrumentType === 'OPTION' || o.exchange === 'NFO' || o.exchange === 'BFO'
    );
    res.json({ success: true, data: filtered });
  })
);

router.get(
  '/positions',
  asyncHandler(async (req: Request, res: Response) => {
    const { FnoPositionService } = await import('../services/options/fno-position.service');
    const isPaper =
      req.query.isPaper === 'true' ? true : req.query.isPaper === 'false' ? false : undefined;
    // Always re-mark on load so Paper Positions LTP/MTM move (broker when available, else model).
    const refresh =
      req.query.refresh !== '0' && req.query.refresh !== 'false';
    if (refresh) {
      const mtm = await FnoPositionService.refreshMtm(req.user!.id, {
        isPaper,
        underlying: req.query.underlying ? String(req.query.underlying) : undefined
      });
      res.json({
        success: true,
        data: mtm.positions,
        meta: {
          quoteSource: mtm.quoteSource,
          brokerMarks: mtm.brokerMarks,
          modelMarks: mtm.modelMarks
        }
      });
      return;
    }
    const data = await FnoPositionService.list(req.user!.id, isPaper);
    res.json({ success: true, data });
  })
);

router.post(
  '/positions/mtm',
  asyncHandler(async (req: Request, res: Response) => {
    const { FnoPositionService } = await import('../services/options/fno-position.service');
    const data = await FnoPositionService.refreshMtm(req.user!.id, {
      isPaper: req.body?.isPaper,
      underlying: req.body?.underlying
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/strategies/templates',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: STRATEGY_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description
      }))
    });
  })
);

router.post(
  '/strategies/analyze',
  asyncHandler(async (req: Request, res: Response) => {
    const legs = req.body?.legs;
    if (!Array.isArray(legs)) throw new AppError('legs array required', 400);
    const data = analyzeStrategy(legs, req.body?.spot != null ? Number(req.body.spot) : undefined);
    res.json({ success: true, data });
  })
);

router.post(
  '/strategies/template/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tpl = STRATEGY_TEMPLATES.find((t) => t.id === req.params.id);
    if (!tpl) throw new AppError('Unknown template', 404);
    const atm = Number(req.body?.atm || 24000);
    const step = Number(req.body?.step || 50);
    const premium = Number(req.body?.premium || 100);
    const lotSize = Number(req.body?.lotSize || 25);
    const legs = tpl.build(atm, step, premium).map((l) => ({ ...l, lotSize }));
    const analytics = analyzeStrategy(legs, atm);
    res.json({ success: true, data: { template: tpl.id, legs, analytics } });
  })
);

router.post(
  '/strategies/bind',
  asyncHandler(async (req: Request, res: Response) => {
    const underlying = String(req.body?.underlying || '');
    const expiry = String(req.body?.expiry || '');
    const legs = req.body?.legs;
    if (!underlying || !expiry || !Array.isArray(legs)) {
      throw new AppError('underlying, expiry, and legs required', 400);
    }
    const { StrategyBindService } = await import('../services/options/strategy-bind.service');
    const data = await StrategyBindService.bindLegs({
      userId: req.user!.id,
      underlying,
      expiry,
      legs
    });
    res.json({ success: true, data });
  })
);

export default router;
