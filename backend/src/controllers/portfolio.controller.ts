import { Request, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { AnalyticsService } from '../services/analytics.service';
import { asyncHandler, AppError } from '../middleware/error.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

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
  const funds = await DatabaseService.getFunds(req.user!.id);
  res.status(200).json({
    success: true,
    data: {
      ...summary,
      availableCash: funds.availableCash,
      capitalAllocated: funds.availableCash + Number(summary.totalCurrent || 0)
    }
  });
});

export const getFunds = asyncHandler(async (req: Request, res: Response) => {
  const data = await DatabaseService.getFunds(req.user!.id);
  res.status(200).json({ success: true, data });
});

export const addFunds = asyncHandler(async (req: Request, res: Response) => {
  const amount = Number(req.body.amount);
  const note = typeof req.body.note === 'string' ? req.body.note : undefined;
  const data = await DatabaseService.transferFunds(req.user!.id, 'add', amount, note);
  res.status(200).json({ success: true, message: 'Funds added', data });
});

export const withdrawFunds = asyncHandler(async (req: Request, res: Response) => {
  const amount = Number(req.body.amount);
  const note = typeof req.body.note === 'string' ? req.body.note : undefined;
  const data = await DatabaseService.transferFunds(req.user!.id, 'withdraw', amount, note);
  res.status(200).json({ success: true, message: 'Funds withdrawn', data });
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

/**
 * Live broker positions when a Dhan account is linked; otherwise open orders + holdings.
 */
export const getPositions = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.id;
  let source: 'broker' | 'orders' | 'holdings' | 'mixed' = 'orders';
  const positions: Array<Record<string, unknown>> = [];

  try {
    const { ExecutionTargetResolver } = await import('../services/execution-target.resolver');
    const target = await ExecutionTargetResolver.resolve(userId, { requireLive: true });
    if (target.adapter === 'direct' && target.direct) {
      const raw = await target.direct.getPositions();
      const list = Array.isArray(raw) ? raw : Array.isArray((raw as { data?: unknown[] })?.data) ? (raw as { data: unknown[] }).data : [];
      for (const p of list as Array<Record<string, unknown>>) {
        const qty = Number(p.netQty ?? p.quantity ?? p.qty ?? 0);
        if (!qty) continue;
        positions.push({
          id: String(p.positionId || p.securityId || p.tradingSymbol || `${p.symbol}-${positions.length}`),
          symbol: String(p.tradingSymbol || p.symbol || '—'),
          side: qty >= 0 ? 'BUY' : 'SELL',
          quantity: Math.abs(qty),
          averagePrice: Number(p.costPrice ?? p.averagePrice ?? p.avgPrice ?? 0),
          lastPrice: Number(p.ltp ?? p.lastPrice ?? p.close ?? 0),
          pnl: Number(p.unrealizedProfit ?? p.unrealized ?? p.pnl ?? 0),
          product: String(p.productType || p.product || ''),
          status: 'open',
          isPaper: false,
          broker: target.broker || 'dhan'
        });
      }
      if (positions.length) source = 'broker';
    } else if (target.adapter === 'mcp' && target.mcp && typeof (target.mcp as { getPositions?: () => Promise<unknown> }).getPositions === 'function') {
      const raw = await (target.mcp as { getPositions: () => Promise<unknown> }).getPositions();
      const list = Array.isArray(raw) ? raw : [];
      for (const p of list as Array<Record<string, unknown>>) {
        const qty = Number(p.netQty ?? p.quantity ?? p.qty ?? 0);
        if (!qty) continue;
        positions.push({
          id: String(p.positionId || p.tradingSymbol || positions.length),
          symbol: String(p.tradingSymbol || p.symbol || '—'),
          side: qty >= 0 ? 'BUY' : 'SELL',
          quantity: Math.abs(qty),
          averagePrice: Number(p.costPrice ?? p.averagePrice ?? 0),
          lastPrice: Number(p.ltp ?? p.lastPrice ?? 0),
          pnl: Number(p.unrealizedProfit ?? p.pnl ?? 0),
          product: String(p.productType || p.product || ''),
          status: 'open',
          isPaper: false,
          broker: target.broker || 'dhan'
        });
      }
      if (positions.length) source = 'broker';
    }
  } catch {
    /* no live broker — fall through */
  }

  if (!positions.length) {
    try {
      const openOrders = await prisma.order.findMany({
        where: {
          userId,
          status: { in: ['PENDING', 'OPEN', 'PLACED', 'PARTIAL', 'TRIGGER_PENDING'] }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
      for (const o of openOrders) {
        positions.push({
          id: o.id,
          symbol: o.symbol,
          side: o.tradeType,
          quantity: o.quantity,
          averagePrice: o.price != null ? Number(o.price) : 0,
          lastPrice: o.price != null ? Number(o.price) : 0,
          pnl: 0,
          product: o.product,
          status: 'open',
          isPaper: o.isPaper,
          agentId: o.agentId,
          orderId: o.id
        });
      }
      source = openOrders.length ? 'orders' : source;
    } catch (err) {
      logger.warn(`Positions open-orders skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const holdings = await DatabaseService.getHoldings(userId);
      for (const h of holdings as Array<Record<string, unknown>>) {
        const qty = Number(h.quantity ?? 0);
        if (!qty) continue;
        positions.push({
          id: String(h.id || h.symbol),
          symbol: String(h.symbol || '—'),
          side: 'BUY',
          quantity: Math.abs(qty),
          averagePrice: Number(h.averagePrice ?? h.avgPrice ?? 0),
          lastPrice: Number(h.currentPrice ?? h.lastPrice ?? h.averagePrice ?? 0),
          pnl: Number(h.pnl ?? h.unrealizedPnl ?? 0),
          product: String(h.product || 'CNC'),
          status: 'open',
          isPaper: Boolean(h.isPaper),
          source: 'holding'
        });
      }
      if (holdings?.length && source === 'orders') source = 'mixed';
      else if (holdings?.length) source = 'holdings';
    } catch (err) {
      logger.warn(`Positions holdings skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const { FnoPositionService } = await import('../services/options/fno-position.service');
      const fno = await FnoPositionService.list(userId, true);
      for (const p of fno as Array<Record<string, unknown>>) {
        const qty = Number(p.quantity ?? p.netQty ?? 0);
        if (!qty) continue;
        positions.push({
          id: String(p.id || p.tradingSymbol || positions.length),
          symbol: String(p.tradingSymbol || p.symbol || '—'),
          side: qty >= 0 ? 'BUY' : 'SELL',
          quantity: Math.abs(qty),
          averagePrice: Number(p.averagePrice ?? p.avgPrice ?? 0),
          lastPrice: Number(p.ltp ?? p.lastPrice ?? 0),
          pnl: Number(p.unrealizedPnl ?? p.pnl ?? 0),
          product: String(p.product || 'NRML'),
          status: 'open',
          isPaper: true,
          source: 'paper_fno'
        });
      }
      if (fno?.length) source = source === 'orders' || source === 'holdings' || source === 'mixed' ? 'mixed' : 'paper';
    } catch (err) {
      logger.warn(`Positions paper F&O skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let closed: Array<Record<string, unknown>> = [];
  try {
    const closedOrders = await prisma.order.findMany({
      where: {
        userId,
        status: { in: ['COMPLETE', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'] }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });
    closed = closedOrders.map((o) => ({
      id: `closed-${o.id}`,
      symbol: o.symbol,
      side: o.tradeType,
      quantity: o.quantity,
      averagePrice: o.price != null ? Number(o.price) : 0,
      lastPrice: o.price != null ? Number(o.price) : 0,
      pnl: 0,
      product: o.product,
      status: 'closed' as const,
      isPaper: o.isPaper,
      agentId: o.agentId,
      orderId: o.id
    }));
  } catch (err) {
    logger.warn(`Positions closed-orders skipped: ${err instanceof Error ? err.message : String(err)}`);
  }

  res.status(200).json({
    success: true,
    data: {
      positions: [...positions, ...closed],
      source,
      openCount: positions.length,
      closedCount: closed.length
    }
  });
});
