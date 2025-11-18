import { Router } from 'express';
import {
  getPortfolios,
  getPortfolioById,
  createPortfolio,
  updatePortfolio,
  getHoldings,
  createHolding,
  updateHolding,
  deleteHolding,
  getPortfolioSummary,
  getTrades,
  createTrade,
  getPerformanceComparison,
  getAdvancedMetrics
} from '../controllers/portfolio.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validatePagination } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Portfolio routes
router.get('/portfolios', getPortfolios);
router.get('/portfolios/:id', getPortfolioById);
router.post('/portfolios', createPortfolio);
router.put('/portfolios/:id', updatePortfolio);

// Holdings routes
router.get('/holdings', getHoldings);
router.post('/holdings', createHolding);
router.put('/holdings/:id', updateHolding);
router.delete('/holdings/:id', deleteHolding);

// Summary
router.get('/summary', getPortfolioSummary);

// Trades routes
router.get('/trades', validatePagination, getTrades);
router.post('/trades', createTrade);

// Performance comparison
router.get('/performance-comparison', getPerformanceComparison);

// Advanced metrics
router.get('/advanced-metrics', getAdvancedMetrics);

export default router;
