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
  const range =
    (req.query.range as string) ||
    (req.query.tf as string) ||
    (req.query.days as string) ||
    '1mo';
  const interval = (req.query.interval as string) || undefined;
  const resolved = MarketService.resolveYahooHistoryParams(range, interval);
  const series = await MarketService.getHistoricalSeries(req.params.symbol, range, interval);
  res.status(200).json({
    success: true,
    data: {
      symbol: req.params.symbol,
      range: resolved.range,
      interval: resolved.interval,
      fetchInterval: resolved.fetchInterval,
      data: series.bars,
      source: series.source,
      stale: series.stale,
      asOf: series.asOf
    }
  });
});

export const getIndices = asyncHandler(async (_req: Request, res: Response) => {
  const indices = await MarketService.getIndices();
  res.status(200).json({ success: true, data: indices });
});

export const searchSymbols = asyncHandler(async (req: Request, res: Response) => {
  const query = String(req.query.query ?? req.query.q ?? '');
  const results = MarketService.searchSymbols(query);
  res.status(200).json({ success: true, data: results });
});

export const getMarketStatus = asyncHandler(async (_req: Request, res: Response) => {
  const isOpen = isMarketOpen();
  res.status(200).json({
    success: true,
    data: {
      isOpen,
      status: isOpen ? 'OPEN' : 'CLOSED',
      timezone: 'Asia/Kolkata',
      session: '09:15-15:30 IST',
      nextOpen: isOpen ? null : 'Next trading day 9:15 AM IST',
      timestamp: new Date().toISOString()
    }
  });
});

export const getTopGainers = asyncHandler(async (req: Request, res: Response) => {
  const count = parseInt(req.query.count as string) || 10;
  const result = await MarketService.getTopMovers('gainers', count);
  res.status(200).json({
    success: true,
    data: result.data,
    source: result.source,
    sampleSize: result.sampleSize,
    universeSize: result.universeSize
  });
});

export const getTopLosers = asyncHandler(async (req: Request, res: Response) => {
  const count = parseInt(req.query.count as string) || 10;
  const result = await MarketService.getTopMovers('losers', count);
  res.status(200).json({
    success: true,
    data: result.data,
    source: result.source,
    sampleSize: result.sampleSize,
    universeSize: result.universeSize
  });
});

export const getSmallCapStocks = asyncHandler(async (req: Request, res: Response) => {
  const count = parseInt(req.query.count as string) || 20;
  const result = await MarketService.getSmallCapStocks(count);
  res.status(200).json({
    success: true,
    data: result.data,
    source: result.source,
    sampleSize: result.sampleSize,
    universeSize: result.universeSize
  });
});

export const getSectorPerformance = asyncHandler(async (_req: Request, res: Response) => {
  const result = await MarketService.getSectorPerformance();
  res.status(200).json({
    success: true,
    data: result.data,
    source: result.source,
    coverage: result.coverage
  });
});

export const getMarketBreadth = asyncHandler(async (_req: Request, res: Response) => {
  const data = await MarketService.getMarketBreadth();
  res.status(200).json({ success: true, data });
});

export const getDhanStatus = asyncHandler(async (_req: Request, res: Response) => {
  const { DhanService } = await import('../services/dhan.service');
  const data = await DhanService.status();
  res.status(200).json({ success: true, data });
});
