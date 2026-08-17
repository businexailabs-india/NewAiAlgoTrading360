/**
 * IBKR US Stocks Manual Trading routes.
 * Mounted at /api/trade/us-stocks
 *
 * Paper vs Live is selected via connection profiles — never a client isPaper flag.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { getUsStocksTradingService } from '../services/ibkr-us-stocks';
import type { ManualOrderIntent, ModifyOrderRequest } from '../services/ibkr-us-stocks';

const router = Router();
router.use(authenticate);

function uid(req: Request): string {
  if (!req.user?.id) throw new AppError('Unauthorized', 401);
  return req.user.id;
}

const svc = () => getUsStocksTradingService();

router.get(
  '/session',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getSessionStatus(uid(req));
    res.json({ success: true, data });
  })
);

router.post(
  '/session/establish',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().establishBrokerageSession(uid(req));
    res.json({ success: true, data });
  })
);

router.get(
  '/profiles',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getConnectionProfiles(uid(req));
    res.json({ success: true, data });
  })
);

router.post(
  '/profiles/select',
  asyncHandler(async (req: Request, res: Response) => {
    const profileId = req.body?.profileId as string;
    if (!profileId) throw new AppError('profileId required', 400);
    // Explicitly ignore client isPaper — environment comes from profile
    if (req.body?.isPaper != null) {
      throw new AppError(
        'isPaper is not accepted. Select a PAPER or LIVE connection profile by profileId.',
        400,
        { reason: 'CLIENT_ISPAPER_REJECTED' }
      );
    }
    const data = await svc().selectConnectionProfile(uid(req), profileId);
    res.json({ success: true, data });
  })
);

router.get(
  '/accounts',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getAccounts(uid(req));
    res.json({ success: true, data });
  })
);

router.get(
  '/accounts/:accountId/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getAccountSummary(uid(req), req.params.accountId);
    res.json({ success: true, data });
  })
);

router.get(
  '/instruments/search',
  asyncHandler(async (req: Request, res: Response) => {
    const q = String(req.query.q || '');
    const data = await svc().searchInstruments(uid(req), q);
    res.json({ success: true, data });
  })
);

router.get(
  '/instruments/:conId',
  asyncHandler(async (req: Request, res: Response) => {
    const conId = Number(req.params.conId);
    if (!Number.isFinite(conId)) throw new AppError('Invalid conId', 400);
    const data = await svc().getContractDetails(uid(req), conId);
    res.json({ success: true, data });
  })
);

router.get(
  '/instruments/:conId/capabilities',
  asyncHandler(async (req: Request, res: Response) => {
    const conId = Number(req.params.conId);
    if (!Number.isFinite(conId)) throw new AppError('Invalid conId', 400);
    const data = await svc().getOrderCapabilities(uid(req), conId);
    res.json({ success: true, data });
  })
);

router.get(
  '/quotes/:conId',
  asyncHandler(async (req: Request, res: Response) => {
    const conId = Number(req.params.conId);
    if (!Number.isFinite(conId)) throw new AppError('Invalid conId', 400);
    const data = await svc().getQuote(uid(req), conId);
    res.json({ success: true, data });
  })
);

router.get(
  '/market-session',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getMarketSession(uid(req));
    res.json({ success: true, data });
  })
);

router.get(
  '/accounts/:accountId/positions',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getPositions(uid(req), req.params.accountId);
    res.json({ success: true, data });
  })
);

router.get(
  '/accounts/:accountId/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getOpenOrders(uid(req), req.params.accountId);
    res.json({ success: true, data });
  })
);

router.get(
  '/accounts/:accountId/executions',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getExecutions(uid(req), req.params.accountId);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const intent = req.body as ManualOrderIntent;
    const data = await svc().previewOrder(uid(req), intent);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/submit',
  asyncHandler(async (req: Request, res: Response) => {
    const { liveConfirmPhrase, isPaper, ...rest } = req.body || {};
    if (isPaper != null) {
      throw new AppError(
        'isPaper is not accepted. Select a PAPER or LIVE connection profile.',
        400,
        { reason: 'CLIENT_ISPAPER_REJECTED' }
      );
    }
    const intent = rest as ManualOrderIntent;
    const data = await svc().submitOrder(uid(req), intent, { liveConfirmPhrase });
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/reply/:messageId/confirm',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().confirmBrokerReply(uid(req), req.params.messageId);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/reply/:messageId/reject',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().rejectBrokerReply(uid(req), req.params.messageId);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/:orderId/modify',
  asyncHandler(async (req: Request, res: Response) => {
    const patch = req.body as ModifyOrderRequest;
    const data = await svc().modifyOrder(uid(req), req.params.orderId, patch);
    res.json({ success: true, data });
  })
);

router.delete(
  '/orders/:orderId',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().cancelOrder(uid(req), req.params.orderId);
    res.json({ success: true, data });
  })
);

router.get(
  '/orders/:orderId',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getOrderStatus(uid(req), req.params.orderId);
    res.json({ success: true, data });
  })
);

router.get(
  '/orders/:orderId/events',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getOrderEvents(uid(req), req.params.orderId);
    res.json({ success: true, data });
  })
);

router.get(
  '/audit',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await svc().getAuditEvents(uid(req));
    res.json({ success: true, data });
  })
);

export default router;
