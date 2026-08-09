import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import * as orderController from '../controllers/order.controller';
import { TradingTerminalService } from '../services/trading-terminal/trading-terminal.service';
import type { OrderPreviewRequest } from '../libs/trading/order-ticket';

const router = Router();
router.use(authenticate);

router.post('/place', orderController.placeOrder);

/** Preview → approve → submit (paper default; live locked) */
router.post(
  '/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingTerminalService.previewOrder(
      req.user!.id,
      (req.body || {}) as OrderPreviewRequest
    );
    res.json({ success: true, data });
  })
);
router.post(
  '/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const previewId = String(req.body?.preview_id || req.body?.previewId || '');
    const data = await TradingTerminalService.submitOrder(req.user!.id, previewId);
    res.json({ success: true, data });
  })
);
router.post(
  '/approve',
  asyncHandler(async (req: Request, res: Response) => {
    const previewId = String(req.body?.preview_id || req.body?.previewId || '');
    const data = await TradingTerminalService.approveOrder(req.user!.id, previewId, true);
    res.json({ success: true, data });
  })
);
router.post(
  '/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const previewId = String(req.body?.preview_id || req.body?.previewId || '');
    const data = await TradingTerminalService.approveOrder(req.user!.id, previewId, false);
    res.json({ success: true, data });
  })
);

router.get('/', orderController.getOrders);
router.get('/:id', orderController.getOrder);
router.post('/:id/reconcile', orderController.reconcileOrder);
router.delete('/:id', orderController.cancelOrder);

export default router;
