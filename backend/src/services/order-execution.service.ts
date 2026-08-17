import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { DatabaseService } from './database.service';
import { MarketService } from './market.service';
import { ExecutionTargetResolver } from './execution-target.resolver';
import { RiskGateService } from './risk-gate.service';
import { OrderReconcilerService } from './order-reconciler.service';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { FnoPositionService } from './options/fno-position.service';

export interface PlaceOrderParams {
  userId: string;
  symbol: string;
  exchange?: string;
  tradeType: 'BUY' | 'SELL';
  quantity: number;
  orderType?: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product?: 'CNC' | 'MIS' | 'NRML';
  price?: number;
  triggerPrice?: number;
  instrumentType?: 'EQUITY' | 'OPTION';
  optionDetails?: {
    strike: number;
    expiry: string;
    optionType: 'CE' | 'PE';
    strategyId?: string;
    strategyTag?: string;
  };
  isPaper?: boolean;
  brokerConnectionId?: string;
  agentId?: string;
  idempotencyKey?: string;
  source?: 'MANUAL' | 'AGENT' | 'STRATEGY' | 'MCP' | 'SCHEDULER' | 'TRADINGVIEW' | 'CHART' | 'BASKET';
  /** F&O security id from instrument master */
  instrumentToken?: string;
  exchangeSegment?: string;
  meta?: Record<string, unknown>;
  /** ExecutionGovernance360 — only OMS should call broker for live */
  callerService?: 'OMS' | 'FRONTEND' | 'AI' | 'TRADINGVIEW' | 'DHANLAXMI' | 'STRATEGY' | 'MANUAL';
  governanceIntentId?: string;
  rmsDecisionId?: string;
  approvalId?: string;
  preapprovalRuleId?: string;
}

export class OrderExecutionService {
  static async placeOrder(params: PlaceOrderParams) {
    const {
      userId, symbol, exchange = 'NSE', tradeType, quantity,
      orderType = 'MARKET', product = 'CNC', price, triggerPrice,
      instrumentType = 'EQUITY', optionDetails,
      agentId, source = 'MANUAL',
      instrumentToken, exchangeSegment, meta,
      callerService = 'MANUAL',
      governanceIntentId, rmsDecisionId, approvalId, preapprovalRuleId
    } = params;

    // Default paper-first; live only when explicitly false
    const isPaper = params.isPaper !== false ? true : false;
    const idempotencyKey = params.idempotencyKey || `ord-${randomUUID()}`;

    if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

    // Broker / OMS guardrail: live orders must come from OMS with RMS + approval
    if (!isPaper) {
      const { ExecutionGovernanceService } = await import('./execution-governance/execution-governance.service');
      await ExecutionGovernanceService.assertBrokerCaller({
        userId,
        callerService: callerService === 'OMS' ? 'OMS' : callerService || 'FRONTEND',
        mode: 'LIVE',
        rmsDecisionId,
        approvalId,
        preapprovalRuleId,
        idempotencyKey,
        intentId: governanceIntentId
      });
    }

    // Non-OMS sources cannot claim broker execution for live
    if (!isPaper && callerService !== 'OMS') {
      throw new AppError('Only OMS may submit live orders to broker adapters', 403);
    }

    // Hard guard: live options path cannot run when feature flag off or user mode is PAPER
    if (!isPaper && instrumentType === 'OPTION') {
      if (process.env.FEATURE_LIVE_OPTIONS !== 'true') {
        throw new AppError(
          'Live options submit is disabled (FEATURE_LIVE_OPTIONS=false). Use Paper Options Terminal.',
          403,
          {
            reason: 'FEATURE_LIVE_OPTIONS_OFF',
            correctiveAction: 'Complete paper acceptance tests before enabling FEATURE_LIVE_OPTIONS'
          }
        );
      }
      const seg = (exchangeSegment || '').toUpperCase();
      if (!instrumentToken) {
        throw new AppError('Live F&O order requires instrumentToken (securityId) from instrument master', 400, {
          reason: 'MISSING_FNO_TOKEN',
          correctiveAction: 'Place from master-backed chain / live preview legs'
        });
      }
      if (seg && seg !== 'NSE_FNO' && seg !== 'BSE_FNO') {
        throw new AppError(`Live F&O requires NSE_FNO/BSE_FNO segment, got ${seg}`, 400, {
          reason: 'INVALID_FNO_SEGMENT',
          correctiveAction: 'Use NFO/BFO exchange mapping'
        });
      }
      if (!seg) {
        // default later in execute path; require NFO exchange hint
        if (exchange !== 'NFO' && exchange !== 'BFO' && exchange !== 'NSE' && exchange !== 'BSE') {
          throw new AppError('Live F&O exchange must be NFO/BFO', 400);
        }
      }
    }
    if (!isPaper) {
      const settings = await prisma.userSettings.findUnique({ where: { userId } });
      const mode = (settings?.settings as { tradingMode?: string } | null)?.tradingMode;
      if (mode !== 'live') {
        throw new AppError('Trading mode is PAPER — live broker submit blocked', 403, {
          reason: 'PAPER_MODE_ACTIVE',
          correctiveAction: 'Switch to LIVE MODE with PIN, or place a paper order'
        });
      }
    }

    const target = await ExecutionTargetResolver.resolve(userId, {
      brokerConnectionId: params.brokerConnectionId,
      preferPaper: isPaper,
      requireLive: !isPaper
    });

    let estPrice = price && price > 0 ? price : 0;
    try {
      const quote = await MarketService.getQuote(symbol, userId);
      if (quote.price > 0 && !(price && price > 0)) {
        estPrice = quote.price;
      } else if (quote.price > 0 && price && price > 0) {
        estPrice = price;
      } else if (!(estPrice > 0) && quote.price > 0) {
        estPrice = quote.price;
      }
    } catch {
      /* paper options may use explicit premium without equity quote */
    }
    if (!(estPrice > 0)) {
      if (isPaper && price && price > 0) {
        estPrice = price;
      } else {
        throw new AppError(`Market quote unavailable or invalid for ${symbol}`, 503);
      }
    }

    await RiskGateService.preflight({
      userId,
      symbol,
      tradeType,
      quantity,
      price: estPrice,
      isPaper,
      source,
      idempotencyKey,
      target
    });

    const order = await prisma.order.create({
      data: {
        userId,
        brokerConnectionId: isPaper ? null : target.brokerConnectionId,
        symbol: symbol.toUpperCase(),
        exchange,
        instrumentType,
        optionDetails: {
          ...(optionDetails || {}),
          ...(instrumentToken ? { instrumentToken } : {}),
          ...(exchangeSegment ? { exchangeSegment } : {})
        } as object | undefined,
        tradeType,
        quantity,
        price: estPrice,
        triggerPrice,
        orderType,
        product,
        status: 'PENDING',
        isPaper,
        agentId,
        source,
        meta: { source, ...(meta || {}) }
      }
    });

    await prisma.executionAttempt.create({
      data: {
        userId,
        orderId: order.id,
        brokerConnectionId: target.brokerConnectionId,
        mcpServerConfigId: target.mcpServerConfigId,
        idempotencyKey,
        source,
        requestRedacted: {
          symbol, tradeType, quantity, orderType, product, isPaper, exchange
        },
        brokerStatus: 'PENDING',
        correlationId: order.id.slice(0, 30)
      }
    });

    try {
      if (isPaper) {
        return await this.executePaperOrder(order.id, userId);
      }
      return await this.executeLiveViaTarget(order.id, userId, target);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Order failed';
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'REJECTED', rejectionReason: message }
      });
      await prisma.executionAttempt.updateMany({
        where: { orderId: order.id },
        data: { brokerStatus: 'REJECTED', errorMessage: message }
      });
      throw new AppError(message, 400);
    }
  }

  private static async executePaperOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404);

    let fillPrice =
      order.price && Number(order.price) > 0 ? Number(order.price) : 0;

    const looksLikeOption =
      order.instrumentType === 'OPTION' || /CE$|PE$/i.test(order.symbol);

    // Equity MARKET may refresh from quote; options keep explicit premium (never underlying spot)
    if (!looksLikeOption && (!(fillPrice > 0) || order.orderType === 'MARKET')) {
      try {
        const quote = await MarketService.getQuote(order.symbol, userId);
        if (quote.price > 0) {
          fillPrice =
            order.orderType === 'LIMIT' && order.price && Number(order.price) > 0
              ? Number(order.price)
              : quote.price;
        }
      } catch {
        /* keep fillPrice from order */
      }
    }

    if (!(fillPrice > 0)) {
      throw new AppError(
        `Invalid fill price for ${order.symbol}; paper fill rejected (provide premium/price)`,
        503
      );
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETE',
        price: fillPrice,
        executedAt: new Date()
      }
    });

    await this.recordPaperTrade(updated, userId, fillPrice);

    if (order.instrumentType === 'OPTION' || /CE$|PE$/i.test(order.symbol)) {
      const details = (order.optionDetails || {}) as {
        instrumentToken?: string;
        strike?: number;
        expiry?: string;
        optionType?: string;
        strategyId?: string;
        strategyTag?: string;
      };
      try {
        await FnoPositionService.applyFill({
          userId,
          tradingSymbol: order.symbol,
          tradeType: order.tradeType as 'BUY' | 'SELL',
          quantity: order.quantity,
          fillPrice,
          isPaper: true,
          instrumentToken: details.instrumentToken,
          exchange: order.exchange,
          segment: order.exchange === 'BFO' || order.exchange === 'BSE' ? 'BFO' : 'NFO',
          optionType: details.optionType,
          strike: details.strike,
          expiry: details.expiry,
          product: order.product || 'NRML',
          strategyId: details.strategyId,
          strategyTag: details.strategyTag
        });
      } catch (err) {
        logger.warn(`Paper F&O position update failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await prisma.executionAttempt.updateMany({
      where: { orderId },
      data: { brokerStatus: 'COMPLETE', responseRedacted: { fillPrice, paper: true }, reconciledAt: new Date() }
    });
    return updated;
  }

  private static async executeLiveViaTarget(
    orderId: string,
    userId: string,
    target: Awaited<ReturnType<typeof ExecutionTargetResolver.resolve>>
  ) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404);

    const details = (order.optionDetails || {}) as {
      instrumentToken?: string;
      exchangeSegment?: string;
      strike?: number;
      expiry?: string;
      optionType?: string;
    };

    let securityId = details.instrumentToken;
    let exchangeSegment =
      details.exchangeSegment ||
      (order.exchange === 'NFO' || order.instrumentType === 'OPTION'
        ? 'NSE_FNO'
        : order.exchange === 'BSE'
          ? 'BSE_EQ'
          : 'NSE_EQ');

    if (!securityId && order.instrumentType === 'OPTION') {
      const inst = await prisma.derivativeInstrument.findFirst({
        where: { tradingSymbol: order.symbol, tradable: true },
        orderBy: { syncedAt: 'desc' }
      });
      if (inst) {
        securityId = inst.instrumentToken;
        exchangeSegment = inst.segment === 'BFO' ? 'BSE_FNO' : 'NSE_FNO';
      }
    }

    if (order.instrumentType === 'OPTION' && !securityId) {
      throw new AppError(
        `Cannot place live F&O order: missing instrumentToken for ${order.symbol}. Sync instrument master.`,
        400,
        {
          reason: 'MISSING_FNO_TOKEN',
          correctiveAction: 'Run POST /api/options/sync and place from master-backed chain'
        }
      );
    }

    if (
      order.instrumentType === 'OPTION' &&
      exchangeSegment !== 'NSE_FNO' &&
      exchangeSegment !== 'BSE_FNO'
    ) {
      throw new AppError(
        `Refusing live F&O submit on equity segment (${exchangeSegment})`,
        400,
        {
          reason: 'EQUITY_SEGMENT_BLOCKED',
          correctiveAction: 'Orders must use NSE_FNO or BSE_FNO'
        }
      );
    }

    const input = {
      symbol: order.symbol,
      tradeType: order.tradeType as 'BUY' | 'SELL',
      quantity: order.quantity,
      orderType: order.orderType,
      product: order.product,
      price: order.price != null ? Number(order.price) : undefined,
      triggerPrice: order.triggerPrice != null ? Number(order.triggerPrice) : undefined,
      correlationId: order.id.slice(0, 30),
      exchangeSegment,
      securityId,
      preflight: true
    };

    logger.info(`Live order via ${target.adapter}/${target.providerType} account=${target.brokerConnectionId}`);

    let result;
    if (target.mcp) {
      result = await target.mcp.placeOrder(input);
    } else if (target.direct) {
      result = await target.direct.placeOrder(input);
    } else {
      throw new AppError('No live execution adapter available for selected account', 400);
    }

    const status = OrderReconcilerService.normalizeStatus(result.status);
    // Acknowledgement only — do not mark COMPLETE until reconciled
    const ackStatus = status === 'COMPLETE' ? 'OPEN' : (status || 'PENDING');

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        brokerOrderId: result.brokerOrderId || null,
        brokerConnectionId: target.brokerConnectionId,
        status: ackStatus,
        rejectionReason: null
      }
    });

    await prisma.executionAttempt.updateMany({
      where: { orderId },
      data: {
        brokerStatus: ackStatus,
        correlationId: result.brokerOrderId || order.id.slice(0, 30),
        responseRedacted: { brokerOrderId: result.brokerOrderId, status: result.status }
      }
    });

    // Best-effort immediate reconcile
    try {
      return await OrderReconcilerService.reconcileOrder(userId, orderId) || updated;
    } catch {
      return updated;
    }
  }

  private static async ensurePaperBrokerConnection(userId: string) {
    const existing = await prisma.brokerConnection.findFirst({
      where: { userId, broker: 'paper', isActive: true }
    });
    if (existing) return existing.id;
    const created = await prisma.brokerConnection.create({
      data: {
        userId,
        broker: 'paper',
        displayName: 'Paper Trading',
        providerType: 'DIRECT',
        status: 'CONNECTED',
        isEnabled: true,
        isActive: true
      }
    });
    return created.id;
  }

  private static async recordPaperTrade(
    order: {
      id: string;
      userId: string;
      symbol: string;
      exchange: string;
      tradeType: string;
      quantity: number;
      orderType: string;
      product: string;
    },
    userId: string,
    fillPrice: number
  ) {
    const brokerConnectionId = await this.ensurePaperBrokerConnection(userId);
    await prisma.trade.create({
      data: {
        userId,
        brokerConnectionId,
        orderId: order.id,
        symbol: order.symbol,
        exchange: order.exchange,
        tradeType: order.tradeType,
        quantity: order.quantity,
        price: fillPrice,
        orderType: order.orderType,
        product: order.product,
        status: 'COMPLETE',
        executedAt: new Date()
      }
    });
    await this.updatePaperHolding(userId, order.symbol, order.exchange, order.tradeType, order.quantity, fillPrice, brokerConnectionId);
  }

  private static async updatePaperHolding(
    userId: string, symbol: string, exchange: string,
    tradeType: string, quantity: number, price: number, brokerId: string
  ) {
    const holdings = await DatabaseService.getHoldings(userId);
    const existing = holdings.find(h => h.symbol === symbol && h.exchange === exchange && h.brokerConnectionId === brokerId);

    if (tradeType === 'BUY') {
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = ((Number(existing.averagePrice) * existing.quantity) + price * quantity) / newQty;
        await prisma.holding.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            averagePrice: newAvg,
            lastPrice: price,
            investedValue: newAvg * newQty,
            currentValue: price * newQty,
            pnl: (price - newAvg) * newQty,
            pnlPercentage: newAvg ? ((price - newAvg) / newAvg) * 100 : 0
          }
        });
      } else {
        await prisma.holding.create({
          data: {
            userId,
            brokerConnectionId: brokerId,
            symbol,
            exchange,
            quantity,
            averagePrice: price,
            lastPrice: price,
            pnl: 0,
            pnlPercentage: 0,
            currentValue: price * quantity,
            investedValue: price * quantity,
            product: 'CNC'
          }
        });
      }
    } else if (existing) {
      const newQty = existing.quantity - quantity;
      if (newQty <= 0) {
        await prisma.holding.delete({ where: { id: existing.id } });
      } else {
        await prisma.holding.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            lastPrice: price,
            currentValue: price * newQty,
            investedValue: Number(existing.averagePrice) * newQty,
            pnl: (price - Number(existing.averagePrice)) * newQty,
            pnlPercentage: Number(existing.averagePrice)
              ? ((price - Number(existing.averagePrice)) / Number(existing.averagePrice)) * 100
              : 0
          }
        });
      }
    }
  }

  static async getOrders(userId: string, filters?: { isPaper?: boolean; status?: string }) {
    return prisma.order.findMany({
      where: {
        userId,
        ...(filters?.isPaper !== undefined && { isPaper: filters.isPaper }),
        ...(filters?.status && { status: filters.status })
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  static async getOrderById(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new AppError('Order not found', 404);
    return order;
  }

  static async cancelOrder(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new AppError('Order not found', 404);
    if (order.isPaper) {
      return prisma.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    }
    if (!order.brokerOrderId || !order.brokerConnectionId) {
      throw new AppError('Order has no broker reference to cancel', 400);
    }
    if (order.instrumentType === 'OPTION' && process.env.FEATURE_LIVE_OPTIONS !== 'true') {
      throw new AppError('Live options cancel gated by FEATURE_LIVE_OPTIONS', 403);
    }
    const target = await ExecutionTargetResolver.resolve(userId, {
      brokerConnectionId: order.brokerConnectionId,
      requireLive: true
    });
    if (target.mcp) await target.mcp.cancelOrder(order.brokerOrderId);
    else if (target.direct) await target.direct.cancelOrder(order.brokerOrderId);
    else throw new AppError('No cancel adapter', 400);
    return OrderReconcilerService.reconcileOrder(userId, orderId);
  }

  static async modifyOrder(
    userId: string,
    orderId: string,
    patch: { quantity?: number; price?: number; triggerPrice?: number; orderType?: string }
  ) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new AppError('Order not found', 404);
    if (order.isPaper) {
      return prisma.order.update({
        where: { id: orderId },
        data: {
          ...(patch.quantity != null && { quantity: patch.quantity }),
          ...(patch.price != null && { price: patch.price }),
          ...(patch.triggerPrice != null && { triggerPrice: patch.triggerPrice }),
          ...(patch.orderType && { orderType: patch.orderType }),
          status: 'PENDING'
        }
      });
    }
    if (order.instrumentType === 'OPTION' && process.env.FEATURE_LIVE_OPTIONS !== 'true') {
      throw new AppError('Live options modify gated by FEATURE_LIVE_OPTIONS', 403);
    }
    if (!order.brokerOrderId || !order.brokerConnectionId) {
      throw new AppError('Order has no broker reference to modify', 400);
    }
    const target = await ExecutionTargetResolver.resolve(userId, {
      brokerConnectionId: order.brokerConnectionId,
      requireLive: true
    });

    if (target.direct) {
      await target.direct.modifyOrder({
        orderId: order.brokerOrderId,
        quantity: patch.quantity ?? order.quantity,
        price: patch.price ?? (order.price != null ? Number(order.price) : undefined),
        triggerPrice: patch.triggerPrice ?? (order.triggerPrice != null ? Number(order.triggerPrice) : undefined),
        orderType: patch.orderType || order.orderType
      });
    } else if (target.mcp) {
      await target.mcp.modifyOrder({
        orderId: order.brokerOrderId,
        quantity: patch.quantity ?? order.quantity,
        price: patch.price ?? (order.price != null ? Number(order.price) : undefined),
        triggerPrice: patch.triggerPrice ?? (order.triggerPrice != null ? Number(order.triggerPrice) : undefined),
        orderType: patch.orderType || order.orderType
      });
    } else {
      throw new AppError('No modify adapter', 400);
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(patch.quantity != null && { quantity: patch.quantity }),
        ...(patch.price != null && { price: patch.price }),
        ...(patch.triggerPrice != null && { triggerPrice: patch.triggerPrice }),
        ...(patch.orderType && { orderType: patch.orderType })
      }
    });

    return OrderReconcilerService.reconcileOrder(userId, orderId);
  }
}
