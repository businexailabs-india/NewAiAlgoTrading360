import { Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { AnalyticsService } from '../services/analytics.service';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { prisma } from '../config/database';

export const getPortfolios = asyncHandler(async (req: Request, res: Response) => {
  const portfolios = await DatabaseService.getPortfolios(req.user!.id);
  res.status(200).json({ success: true, data: portfolios });
});

export const getPortfolioById = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await DatabaseService.getPortfolioById(req.params.id, req.user!.id);
  res.status(200).json({ success: true, data: portfolio });
});

export const createPortfolio = asyncHandler(async (req: Request, res: Response) => {
  const { name, description } = req.body;
  const portfolio = await DatabaseService.createPortfolio({
    userId: req.user!.id,
    name,
    description
  });
  res.status(201).json({ success: true, message: 'Portfolio created successfully', data: portfolio });
});

export const updatePortfolio = asyncHandler(async (req: Request, res: Response) => {
  const portfolio = await DatabaseService.updatePortfolio(req.params.id, req.body, req.user!.id);
  res.status(200).json({ success: true, message: 'Portfolio updated successfully', data: portfolio });
});

export const getHoldings = asyncHandler(async (req: Request, res: Response) => {
  const holdings = await DatabaseService.getHoldings(req.user!.id);
  res.status(200).json({ success: true, data: holdings });
});

/** Manual COMPLETE holdings are blocked on the public API — use broker sync or admin import. */
export const createHolding = asyncHandler(async (_req: Request, res: Response) => {
  throw new AppError(
    'Manual holding creation is disabled. Holdings come from broker sync, paper execution, or admin import.',
    403
  );
});

export const updateHolding = asyncHandler(async (req: Request, res: Response) => {
  const holding = await DatabaseService.updateHolding(req.params.id, req.body, req.user!.id);
  res.status(200).json({ success: true, message: 'Holding updated successfully', data: holding });
});

export const deleteHolding = asyncHandler(async (req: Request, res: Response) => {
  await DatabaseService.deleteHolding(req.params.id, req.user!.id);
  res.status(200).json({ success: true, message: 'Holding deleted successfully' });
});

export const getPortfolioSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await DatabaseService.getPortfolioSummary(req.user!.id);
  res.status(200).json({ success: true, data: summary });
});

export const getTrades = asyncHandler(async (req: Request, res: Response) => {
  const trades = await DatabaseService.getTrades(req.user!.id, {
    startDate: req.query.startDate as string,
    endDate: req.query.endDate as string
  });
  res.status(200).json({ success: true, data: trades });
});

/** Manual COMPLETE trade creation is blocked — use order execution or admin import. */
export const createTrade = asyncHandler(async (_req: Request, res: Response) => {
  throw new AppError(
    'Manual trade creation is disabled. Trades are recorded via paper/live order execution or admin import.',
    403
  );
});

/** Admin-only import of holdings with explicit source labeling */
export const importHolding = asyncHandler(async (req: Request, res: Response) => {
  const source = (req.body.source as string) || 'admin_import';
  const holding = await DatabaseService.createHolding({
    ...req.body,
    userId: req.body.userId || req.user!.id
  });
  res.status(201).json({
    success: true,
    message: 'Holding imported',
    data: holding,
    source,
    imported: true
  });
});

/** Admin-only import of trades with explicit source labeling */
export const importTrade = asyncHandler(async (req: Request, res: Response) => {
  const source = (req.body.source as string) || 'admin_import';
  const userId = req.body.userId || req.user!.id;
  const trade = await prisma.trade.create({
    data: {
      userId,
      brokerConnectionId: req.body.brokerConnectionId,
      orderId: req.body.orderId,
      symbol: req.body.symbol,
      exchange: req.body.exchange || 'NSE',
      tradeType: req.body.tradeType,
      quantity: req.body.quantity,
      price: req.body.price,
      orderType: req.body.orderType || 'MARKET',
      product: req.body.product || 'CNC',
      status: req.body.status || 'COMPLETE',
      executedAt: req.body.executedAt ? new Date(req.body.executedAt) : new Date()
    }
  });
  res.status(201).json({
    success: true,
    message: 'Trade imported',
    data: trade,
    source,
    imported: true
  });
});

export const getAdvancedMetrics = asyncHandler(async (req: Request, res: Response) => {
  const data = await AnalyticsService.getAdvancedMetrics(req.user!.id);
  res.status(200).json({ success: true, data });
});

export const getPerformanceComparison = asyncHandler(async (req: Request, res: Response) => {
  const timeRange = (req.query.timeRange as string) || '1Y';
  const data = await AnalyticsService.getPerformanceComparison(req.user!.id, timeRange);
  res.status(200).json({ success: true, data });
});
