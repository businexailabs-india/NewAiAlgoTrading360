import { Router } from 'express';
import {
  getPortfolios,
  getPortfolioById,
  createPortfolio,
  updatePortfolio,
  getHoldings,
  getPortfolioSummary,
  getTrades,
  getPerformanceComparison,
  getAdvancedMetrics,
  getPositions
} from '../controllers/portfolio.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validatePagination } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Portfolio routes (user-owned containers — not broker executions)
router.get('/portfolios', getPortfolios);
router.get('/portfolios/:id', getPortfolioById);
router.post('/portfolios', createPortfolio);
router.put('/portfolios/:id', updatePortfolio);

// Holdings — read only on public path (mutations via broker sync / paper / admin import)
router.get('/holdings', getHoldings);

// Live / paper positions (broker when linked, else open orders + holdings)
router.get('/positions', getPositions);

// Summary
router.get('/summary', getPortfolioSummary);

// Trades — read only (writes via order execution / admin import)
router.get('/trades', validatePagination, getTrades);

// Performance comparison
router.get('/performance-comparison', getPerformanceComparison);

// Advanced metrics
router.get('/advanced-metrics', getAdvancedMetrics);

export default router;
