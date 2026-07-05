import { Request, Response } from 'express';
import { MarketService } from '../services/market.service';
import { asyncHandler } from '../middleware/error.middleware';
import { isMarketOpen } from '../utils/helpers';

export const getQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await MarketService.getQuote(req.params.symbol, req.user?.id);
  res.status(200).json({ success: true, data: quote });
});

export const getQuotes = asyncHandler(async (req: Request, res: Response) => {
  const { symbols } = req.body;
  if (!Array.isArray(symbols)) {
    res.status(400).json({ success: false, message: 'Symbols must be an array' });
    return;
  }
  const quotes = await MarketService.getQuotes(symbols, req.user!.id);
  res.status(200).json({ success: true, data: quotes });
});

export const getHistoricalData = asyncHandler(async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const data = await MarketService.getHistoricalData(req.params.symbol, days);
  res.status(200).json({
    success: true,
    data: { symbol: req.params.symbol, interval: req.query.interval || 'day', data }
  });
});

export const getIndices = asyncHandler(async (_req: Request, res: Response) => {
  const indices = await MarketService.getIndices();
  res.status(200).json({ success: true, data: indices });
});

export const searchSymbols = asyncHandler(async (req: Request, res: Response) => {
  const { query } = req.query;
  if (!query) {
    res.status(400).json({ success: false, message: 'Search query is required' });
    return;
  }
  const results = MarketService.searchSymbols(query as string);
  res.status(200).json({ success: true, data: results });
});

export const getMarketStatus = asyncHandler(async (_req: Request, res: Response) => {
  const isOpen = isMarketOpen();
  res.status(200).json({
    success: true,
    data: {
      isOpen,
      status: isOpen ? 'OPEN' : 'CLOSED',
      nextOpen: isOpen ? null : 'Next trading day 9:15 AM IST',
      timestamp: new Date().toISOString()
    }
  });
});
