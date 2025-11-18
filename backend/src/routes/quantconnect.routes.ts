/**
 * QuantConnect Routes
 * API endpoints for QuantConnect integration
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as quantconnectController from '../controllers/quantconnect.controller';

const router = Router();

// All QuantConnect routes require authentication
router.use(authenticate);

// Project management
router.get('/projects', quantconnectController.getProjects);
router.post('/projects', quantconnectController.createProject);

// Backtesting
router.post('/backtest', quantconnectController.runBacktest);
router.get('/backtest/:projectId/:backtestId', quantconnectController.getBacktestResults);
router.get('/backtest/:projectId/:backtestId/monthly-returns', quantconnectController.getMonthlyReturns);
router.get('/backtest/:projectId/:backtestId/metrics', quantconnectController.getStrategyMetrics);

// Live trading
router.get('/live/:projectId/:deployId', quantconnectController.getLiveAlgorithm);
router.post('/live/deploy', quantconnectController.deployLive);
router.delete('/live/:projectId/:deployId', quantconnectController.stopLiveAlgorithm);
router.get('/live/:projectId/:algorithmId/logs', quantconnectController.getLiveLogs);

export default router;
