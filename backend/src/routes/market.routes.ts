import { Router } from 'express';
import {
  getQuote,
  getQuotes,
  getHistoricalData,
  getIndices,
  searchSymbols,
  getMarketStatus,
  getTopGainers,
  getTopLosers,
  getSmallCapStocks,
  getSectorPerformance,
  getMarketBreadth,
  getDhanStatus
} from '../controllers/market.controller';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { validateSymbolParam } from '../middleware/validation.middleware';

const router = Router();

// Public routes (no authentication required)
router.get('/status', getMarketStatus);
router.get('/indices', getIndices);
router.get('/search', searchSymbols);
router.get('/gainers', getTopGainers);
router.get('/losers', getTopLosers);
router.get('/smallcap', getSmallCapStocks);
router.get('/sectors', getSectorPerformance);
router.get('/breadth', getMarketBreadth);
router.get('/dhan-status', getDhanStatus);

// Authenticated routes
router.get('/quote/:symbol', optionalAuth, validateSymbolParam, getQuote);
router.post('/quotes', authenticate, getQuotes);
router.get('/historical/:symbol', optionalAuth, validateSymbolParam, getHistoricalData);

export default router;
