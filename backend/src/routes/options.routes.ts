import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/error.middleware';
import { Request, Response } from 'express';
import { OptionsChainService } from '../services/options/options-chain.service';
import { InstrumentMasterService } from '../services/options/instrument-master.service';
import * as optionsController from '../controllers/options.controller';

const router = Router();
router.use(authenticate);

/** Legacy heuristic chain */
router.get('/chain/:symbol', optionsController.getOptionsChain);
router.post('/signals', optionsController.getOptionsSignals);

router.get(
  '/underlyings',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await OptionsChainService.getUnderlyings();
    res.json({ success: true, data });
  })
);

router.get(
  '/expiries',
  asyncHandler(async (req: Request, res: Response) => {
    const underlying = String(req.query.underlying || '');
    if (!underlying) {
      res.status(400).json({ success: false, message: 'underlying query required' });
      return;
    }
    const data = await OptionsChainService.getExpiries(underlying);
    res.json({ success: true, data });
  })
);

router.get(
  '/chain',
  asyncHandler(async (req: Request, res: Response) => {
    const underlying = String(req.query.underlying || '');
    const expiry = req.query.expiry ? String(req.query.expiry) : undefined;
    if (!underlying) {
      res.status(400).json({ success: false, message: 'underlying query required' });
      return;
    }
    const data = await OptionsChainService.getChain({
      underlying,
      expiry,
      userId: req.user!.id,
      includeGreeks: req.query.greeks === '1'
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/greeks',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await OptionsChainService.getGreeks({
      underlying: String(req.query.underlying || ''),
      expiry: req.query.expiry ? String(req.query.expiry) : undefined,
      strike: Number(req.query.strike),
      optionType: String(req.query.optionType || 'CE').toUpperCase() as 'CE' | 'PE',
      userId: req.user!.id
    });
    res.json({ success: true, data });
  })
);

router.get(
  '/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await OptionsChainService.getAnalytics(
      String(req.query.underlying || 'NIFTY'),
      req.query.expiry ? String(req.query.expiry) : undefined,
      req.user!.id
    );
    res.json({ success: true, data });
  })
);

router.post(
  '/sync',
  asyncHandler(async (req: Request, res: Response) => {
    const brokerSource = String(req.body?.brokerSource || 'dhan');
    const data = await InstrumentMasterService.sync(brokerSource);
    res.json({ success: true, data });
  })
);

export default router;
