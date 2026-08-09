import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { Request, Response } from 'express';
import { RiskJourneyService } from '../services/risk-journey/risk-journey.service';

const router = Router();
router.use(authenticate);

function uid(req: Request, paramId?: string) {
  const requested = paramId || (req.params.user_id as string | undefined);
  if (requested && requested !== req.user!.id && req.user!.role !== 'admin') {
    return req.user!.id;
  }
  return requested || req.user!.id;
}

/** POST /risk-onboarding/profile */
router.post(
  '/risk-onboarding/profile',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.upsertRiskProfile(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

/** GET /risk-onboarding/profile/:user_id */
router.get(
  '/risk-onboarding/profile/:user_id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.getRiskProfile(uid(req));
    res.json({ success: true, data });
  })
);

/** POST /capital-profile/create */
router.post(
  '/capital-profile/create',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.createCapitalProfile(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

/** GET /capital-profile/:user_id */
router.get(
  '/capital-profile/:user_id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.getCapitalPolicy(uid(req));
    res.json({ success: true, data });
  })
);

/** POST /risk-budget/daily */
router.post(
  '/risk-budget/daily',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.ensureDailyBudget(req.user!.id);
    res.json({ success: true, data });
  })
);

/** GET /risk-budget/today/:user_id */
router.get(
  '/risk-budget/today/:user_id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.refreshBudgetFromOrders(uid(req));
    res.json({ success: true, data });
  })
);

/** POST /algo-suitability/recommend */
router.post(
  '/algo-suitability/recommend',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.recommendAlgos(req.user!.id);
    res.json({ success: true, data });
  })
);

/** POST /algo-suitability/score */
router.post(
  '/algo-suitability/score',
  asyncHandler(async (req: Request, res: Response) => {
    const algoId = String(req.body?.algo_id || req.body?.algoId || '');
    const data = await RiskJourneyService.scoreAlgoForUser(req.user!.id, algoId);
    res.json({ success: true, data });
  })
);

/** POST /live-unlock/request */
router.post(
  '/live-unlock/request',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.requestLiveUnlock(req.user!.id, {
      userApproval: !!req.body?.userApproval
    });
    res.json({ success: true, data });
  })
);

/** GET /live-unlock/status/:user_id */
router.get(
  '/live-unlock/status/:user_id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.getLiveUnlockStatus(uid(req));
    res.json({ success: true, data });
  })
);

/** GET /control-room/daily-status */
router.get(
  '/control-room/daily-status',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.controlRoomStatus(req.user!.id);
    res.json({ success: true, data });
  })
);

/** POST /risk/kill-switch/trigger — also under journey router; risk.routes may alias */
router.post(
  '/risk/kill-switch/trigger',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.triggerKillSwitch(
      req.user!.id,
      String(req.body?.reason || 'Manual kill switch')
    );
    res.json({ success: true, data });
  })
);

/** POST /risk/no-trade-mode/enable */
router.post(
  '/risk/no-trade-mode/enable',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskJourneyService.enableNoTradeMode(
      req.user!.id,
      String(req.body?.reason || 'No-trade advisory')
    );
    res.json({ success: true, data });
  })
);

/** POST /risk-journey/dhanlaxmi — assistant probe */
router.post(
  '/risk-journey/dhanlaxmi',
  asyncHandler(async (req: Request, res: Response) => {
    const profile = await RiskJourneyService.getRiskProfile(req.user!.id).catch(() => null);
    const language = String(req.body?.language || profile?.language || 'hinglish');
    const data = RiskJourneyService.dhanLaxmiRiskReply(String(req.body?.message || ''), language);
    res.json({ success: true, data });
  })
);

export default router;
