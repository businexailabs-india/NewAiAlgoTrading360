import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import { DatabaseService } from './database.service';
import { MarketService } from './market.service';
import { ExecutionTargetResolver } from './execution-target.resolver';
import { RiskGateService } from './risk-gate.service';
import { OrderReconcilerService } from './order-reconciler.service';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

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
  optionDetails?: { strike: number; expiry: string; optionType: 'CE' | 'PE' };
  isPaper?: boolean;
  brokerConnectionId?: string;
  agentId?: string;
  idempotencyKey?: string;
  source?: 'MANUAL' | 'AGENT' | 'STRATEGY' | 'MCP' | 'SCHEDULER';
}

export class OrderExecutionService {
  static async placeOrder(params: PlaceOrderParams) {
    const {
      userId, symbol, exchange = 'NSE', tradeType, quantity,
      orderType = 'MARKET', product = 'CNC', price, triggerPrice,
      instrumentType = 'EQUITY', optionDetails,
      agentId, source = 'MANUAL'
    } = params;

    // Default paper-first; live only when explicitly false
    const isPaper = params.isPaper !== false ? true : false;
    const idempotencyKey = params.idempotencyKey || `ord-${randomUUID()}`;

    if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

    const target = await ExecutionTargetResolver.resolve(userId, {
      brokerConnectionId: params.brokerConnectionId,
      preferPaper: isPaper,
      requireLive: !isPaper
    });

    const quote = await MarketService.getQuote(symbol, userId);
    if (!(quote.price > 0)) {
      throw new AppError(`Market quote unavailable or invalid for ${symbol}`, 503);
    }
    const estPrice = price && price > 0 ? price : quote.price;
    if (!(estPrice > 0)) {
      throw new AppError(`Cannot place order: invalid price for ${symbol}`, 503);
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
        optionDetails: optionDetails as object | undefined,
        tradeType,
        quantity,
        price: estPrice,
        triggerPrice,
        orderType,
        product,
        status: 'PENDING',
        isPaper,
        agentId
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

    const quote = await MarketService.getQuote(order.symbol, userId);
    if (!(quote.price > 0)) {
      throw new AppError(`Quote unavailable for ${order.symbol}; paper fill rejected`, 503);
    }

    const fillPrice = order.orderType === 'LIMIT' && order.price && Number(order.price) > 0
      ? Number(order.price)
      : quote.price;

    if (!(fillPrice > 0)) {
      throw new AppError(`Invalid fill price for ${order.symbol}; paper fill rejected`, 503);
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

    const input = {
      symbol: order.symbol,
      tradeType: order.tradeType as 'BUY' | 'SELL',
      quantity: order.quantity,
      orderType: order.orderType,
      product: order.product,
      price: order.price != null ? Number(order.price) : undefined,
      triggerPrice: order.triggerPrice != null ? Number(order.triggerPrice) : undefined,
      correlationId: order.id.slice(0, 30),
      exchangeSegment: order.exchange === 'BSE' ? 'BSE_EQ' : 'NSE_EQ',
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
    const target = await ExecutionTargetResolver.resolve(userId, {
      brokerConnectionId: order.brokerConnectionId,
      requireLive: true
    });
    if (target.mcp) await target.mcp.cancelOrder(order.brokerOrderId);
    else if (target.direct) await target.direct.cancelOrder(order.brokerOrderId);
    else throw new AppError('No cancel adapter', 400);
    return OrderReconcilerService.reconcileOrder(userId, orderId);
  }
}
