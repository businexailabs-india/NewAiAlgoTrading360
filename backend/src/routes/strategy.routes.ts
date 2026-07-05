import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as strategyController from '../controllers/strategy.controller';

const router = Router();
router.use(authenticate);

router.get('/presets', strategyController.getPresets);
router.get('/', strategyController.listStrategies);
router.post('/', strategyController.createStrategy);
router.get('/:id', strategyController.getStrategy);
router.put('/:id', strategyController.updateStrategy);
router.delete('/:id', strategyController.deleteStrategy);
router.post('/:id/evaluate', strategyController.evaluateStrategy);
router.post('/:id/backtest', strategyController.backtestStrategy);

export default router;
