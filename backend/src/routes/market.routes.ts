import { Router } from 'express';
import {
  getQuote,
  getQuotes,
  getHistoricalData,
  getIndices,
  searchSymbols,
  getMarketStatus
} from '../controllers/market.controller';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { validateSymbolParam } from '../middleware/validation.middleware';

const router = Router();

// Public routes (no authentication required)
router.get('/status', getMarketStatus);
router.get('/indices', getIndices);
router.get('/search', searchSymbols);

// Authenticated routes
router.get('/quote/:symbol', optionalAuth, validateSymbolParam, getQuote);
router.post('/quotes', authenticate, getQuotes);
router.get('/historical/:symbol', authenticate, validateSymbolParam, getHistoricalData);

export default router;
