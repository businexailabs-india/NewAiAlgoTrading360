import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { TradingTerminalService } from '../services/trading-terminal/trading-terminal.service';
import type { ChartOrderActionRequest, OrderPreviewRequest } from '../libs/trading/order-ticket';

const router = Router();

router.get(
  '/instruments/search',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.searchInstruments(
      String(req.query.query || req.query.q || ''),
      Number(req.query.limit) || 20
    );
    res.json({ success: true, data });
  })
);

router.get(
  '/instruments/:instrument_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.getInstrument(req.params.instrument_id);
    res.json({ success: true, data });
  })
);

router.get(
  '/instruments/:instrument_id/tradability',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.getTradability(req.user!.id, req.params.instrument_id);
    res.json({ success: true, data });
  })
);

router.get(
  '/instruments/:instrument_id/derivatives',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.getDerivatives(req.params.instrument_id);
    res.json({ success: true, data });
  })
);

/** Prefer /api/orders/preview (order.routes). Aliases under /terminal for clarity. */
router.post(
  '/terminal/orders/preview',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.previewOrder(
      req.user!.id,
      (req.body || {}) as OrderPreviewRequest
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/terminal/orders/submit',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const previewId = String(req.body?.preview_id || req.body?.previewId || '');
    const data = await TradingTerminalService.submitOrder(req.user!.id, previewId);
    res.json({ success: true, data });
  })
);

router.post(
  '/terminal/orders/approve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const previewId = String(req.body?.preview_id || req.body?.previewId || '');
    const data = await TradingTerminalService.approveOrder(req.user!.id, previewId, true);
    res.json({ success: true, data });
  })
);

router.post(
  '/terminal/orders/reject',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const previewId = String(req.body?.preview_id || req.body?.previewId || '');
    const data = await TradingTerminalService.approveOrder(req.user!.id, previewId, false);
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.createBasket(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/baskets',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.listBaskets(req.user!.id);
    res.json({ success: true, data });
  })
);

router.get(
  '/baskets/:basket_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.getBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.put(
  '/baskets/:basket_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.updateBasket(req.user!.id, req.params.basket_id, req.body || {});
    res.json({ success: true, data });
  })
);

router.delete(
  '/baskets/:basket_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.deleteBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets/:basket_id/legs',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.addBasketLeg(req.user!.id, req.params.basket_id, req.body || {});
    res.json({ success: true, data });
  })
);

router.put(
  '/baskets/:basket_id/legs/:leg_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.updateBasketLeg(
      req.user!.id,
      req.params.basket_id,
      req.params.leg_id,
      req.body || {}
    );
    res.json({ success: true, data });
  })
);

router.delete(
  '/baskets/:basket_id/legs/:leg_id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.deleteBasketLeg(
      req.user!.id,
      req.params.basket_id,
      req.params.leg_id
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets/:basket_id/preview',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.previewBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets/:basket_id/risk-check',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.riskCheckBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets/:basket_id/approve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.approveBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets/:basket_id/submit',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.submitBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets/:basket_id/cancel',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.cancelBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.post(
  '/baskets/:basket_id/duplicate',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.duplicateBasket(req.user!.id, req.params.basket_id);
    res.json({ success: true, data });
  })
);

router.get(
  '/chart/positions',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.getChartPositions(
      req.user!.id,
      req.query.instrument_id ? String(req.query.instrument_id) : undefined,
      req.query.symbol ? String(req.query.symbol) : undefined
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/chart/orders/preview',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body || {};
    const data = await TradingTerminalService.previewOrder(req.user!.id, {
      ...body,
      source: 'CHART',
      mode: body.mode === 'LIVE' ? 'LIVE' : 'PAPER'
    } as OrderPreviewRequest);
    res.json({ success: true, data });
  })
);

router.post(
  '/chart/orders/add-quantity',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.chartOrderAction(req.user!.id, {
      ...(req.body || {}),
      action: 'ADD_QTY',
      source: 'CHART'
    } as ChartOrderActionRequest);
    res.json({ success: true, data });
  })
);

router.post(
  '/chart/orders/reduce-quantity',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.chartOrderAction(req.user!.id, {
      ...(req.body || {}),
      action: 'REDUCE_QTY',
      source: 'CHART'
    } as ChartOrderActionRequest);
    res.json({ success: true, data });
  })
);

router.post(
  '/chart/orders/exit-quantity',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.chartOrderAction(req.user!.id, {
      ...(req.body || {}),
      action: 'EXIT_QTY',
      source: 'CHART'
    } as ChartOrderActionRequest);
    res.json({ success: true, data });
  })
);

router.post(
  '/chart/orders/exit-full',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.chartOrderAction(req.user!.id, {
      ...(req.body || {}),
      action: 'EXIT_FULL',
      source: 'CHART'
    } as ChartOrderActionRequest);
    res.json({ success: true, data });
  })
);

router.post(
  '/chart/basket/add-leg',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.addChartLegToBasket(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/trading-terminal/audits',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.listAudits(req.user!.id, Number(req.query.limit) || 50);
    res.json({ success: true, data });
  })
);

export default router;
