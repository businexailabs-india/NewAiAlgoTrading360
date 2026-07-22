import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { TradingModeService } from '../services/trading-mode.service';
import { Request, Response } from 'express';

const router = Router();
router.use(authenticate);

router.get(
  '/mode',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingModeService.getMode(req.user!.id);
    res.json({ success: true, data });
  })
);

router.post(
  '/mode/switch',
  asyncHandler(async (req: Request, res: Response) => {
    const { mode, pin, confirmLive } = req.body || {};
    const data = await TradingModeService.switchMode(req.user!.id, {
      mode,
      pin: String(pin || ''),
      confirmLive: !!confirmLive
    });
    res.json({ success: true, data });
  })
);

router.put(
  '/mode/pin',
  asyncHandler(async (req: Request, res: Response) => {
    const { pin, currentPin } = req.body || {};
    const data = await TradingModeService.setTradingPin(req.user!.id, String(pin || ''), currentPin);
    res.json({ success: true, data });
  })
);

router.post(
  '/mode/pin/reset',
  asyncHandler(async (req: Request, res: Response) => {
    const { pin, confirmPin } = req.body || {};
    const data = await TradingModeService.resetTradingPin(
      req.user!.id,
      String(pin || ''),
      String(confirmPin || '')
    );
    res.json({ success: true, data });
  })
);

router.get(
  '/brokers/status',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await TradingModeService.getBrokersStatus(req.user!.id);
    res.json({ success: true, data });
  })
);

export default router;
