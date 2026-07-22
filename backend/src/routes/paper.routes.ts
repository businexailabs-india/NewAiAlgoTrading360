import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { Request, Response } from 'express';
import { PaperOptionsService } from '../services/options/paper-options.service';
import { analyzeStrategy } from '../services/options/strategy-analytics.service';

const router = Router();
router.use(authenticate);

router.get(
  '/account',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await PaperOptionsService.getOrCreateAccount(req.user!.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/account/topup',
  asyncHandler(async (req: Request, res: Response) => {
    const amount = Number(req.body?.amount);
    const data = await PaperOptionsService.topUp(req.user!.id, amount);
    res.json({ success: true, data });
  })
);

router.post(
  '/account/reset',
  asyncHandler(async (req: Request, res: Response) => {
    const capital = req.body?.capital != null ? Number(req.body.capital) : undefined;
    const data = await PaperOptionsService.reset(req.user!.id, capital);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const legs = req.body?.legs;
    if (!Array.isArray(legs)) throw new AppError('legs array required', 400);
    const data = await PaperOptionsService.preview(req.user!.id, legs);
    res.json({ success: true, data });
  })
);

router.post(
  '/orders',
  asyncHandler(async (req: Request, res: Response) => {
    const legs = req.body?.legs;
    if (!Array.isArray(legs)) throw new AppError('legs array required', 400);
    const data = await PaperOptionsService.place(req.user!.id, legs, {
      strategyId: req.body?.strategyId,
      strategyTag: req.body?.strategyTag
    });
    // Explicit isolation marker for acceptance tests
    if (data.liveBrokerSubmit !== false) {
      throw new AppError('Paper path leaked live submit flag', 500);
    }
    res.json({ success: true, data });
  })
);

router.get(
  '/strategies',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await PaperOptionsService.listStrategies(req.user!.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/strategies',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, legs, meta } = req.body || {};
    if (!name || !Array.isArray(legs)) throw new AppError('name and legs required', 400);
    const data = await PaperOptionsService.saveStrategy(req.user!.id, name, legs, meta);
    res.json({ success: true, data });
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

router.get(
  '/journal/by-strategy',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await PaperOptionsService.journalByStrategyTag(req.user!.id);
    res.json({ success: true, data });
  })
);

export default router;
