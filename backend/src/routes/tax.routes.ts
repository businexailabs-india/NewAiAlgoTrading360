import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';
import { asyncHandler } from '../middleware/error.middleware';

const router = Router();

router.use(authenticate);

router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const metrics = await AnalyticsService.getAdvancedMetrics(req.user!.id);
  res.json({
    success: true,
    data: {
      taxImpact: metrics.taxImpact,
      multiPeriodStats: metrics.multiPeriodStats
    }
  });
}));

export default router;
