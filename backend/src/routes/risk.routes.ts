import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { Request, Response } from 'express';
import { RiskGateService } from '../services/risk-gate.service';
import { prisma } from '../config/database';

const router = Router();
router.use(authenticate);

router.get(
  '/check',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskGateService.check(req.user!.id, {
      instrumentId: req.query.instrumentId,
      side: req.query.side,
      lots: req.query.lots,
      quantity: req.query.quantity,
      premium: req.query.premium,
      isPaper: req.query.isPaper !== 'false'
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/limits',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskGateService.getOrCreateRiskProfile(req.user!.id);
    res.json({ success: true, data });
  })
);

router.put(
  '/limits',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await RiskGateService.updateRiskLimits(req.user!.id, req.body || {});
    res.json({ success: true, data });
  })
);

router.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await prisma.riskEvent.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/portfolio',
  asyncHandler(async (req: Request, res: Response) => {
    const isPaper = req.query.isPaper !== 'false';
    const data = await RiskGateService.portfolioSnapshot(req.user!.id, isPaper);
    res.json({ success: true, data });
  })
);

export default router;
