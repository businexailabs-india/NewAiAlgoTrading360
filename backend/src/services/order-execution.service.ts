import axios from 'axios';
import { prisma } from '../config/database';
import { DatabaseService } from './database.service';
import { EncryptionService } from './encryption.service';
import { MarketService } from './market.service';
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
}

export class OrderExecutionService {
  static async placeOrder(params: PlaceOrderParams) {
    const {
      userId, symbol, exchange = 'NSE', tradeType, quantity,
      orderType = 'MARKET', product = 'CNC', price, triggerPrice,
      instrumentType = 'EQUITY', optionDetails,
      isPaper = true, brokerConnectionId, agentId
    } = params;

    if (quantity <= 0) throw new AppError('Quantity must be positive', 400);

    const order = await prisma.order.create({
      data: {
        userId,
        brokerConnectionId: isPaper ? null : brokerConnectionId,
        symbol,
        exchange,
        instrumentType,
        optionDetails: optionDetails as object | undefined,
        tradeType,
        quantity,
        price,
        triggerPrice,
        orderType,
        product,
        status: 'PENDING',
        isPaper,
        agentId
      }
    });

    try {
      if (isPaper) {
        return await this.executePaperOrder(order.id, userId);
      }
      return await this.executeLiveOrder(order.id, userId, brokerConnectionId!);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Order failed';
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'REJECTED', rejectionReason: message }
      });
      throw new AppError(message, 400);
    }
  }

  private static async executePaperOrder(orderId: string, userId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404);

    const quote = await MarketService.getQuote(order.symbol, userId);
    const fillPrice = order.orderType === 'LIMIT' && order.price
      ? Number(order.price)
      : quote.price;

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETE',
        price: fillPrice,
        executedAt: new Date()
      }
    });

    await this.recordPaperTrade(updated, userId, fillPrice);
    return updated;
  }

  private static async executeLiveOrder(orderId: string, userId: string, brokerConnectionId: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('Order not found', 404);

    const connection = await DatabaseService.getBrokerConnectionById(brokerConnectionId);
    if (connection.userId !== userId) throw new AppError('Unauthorized', 403);

    const accessToken = EncryptionService.decrypt(connection.accessTokenEncrypted!);
    const brokerOrderId = await this.sendToBroker(connection.broker, accessToken, order);

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        brokerOrderId,
        status: 'COMPLETE',
        executedAt: new Date()
      }
    });

    await prisma.trade.create({
      data: {
        userId,
        brokerConnectionId,
        orderId: brokerOrderId,
        symbol: order.symbol,
        exchange: order.exchange,
        tradeType: order.tradeType,
        quantity: order.quantity,
        price: order.price || 0,
        orderType: order.orderType,
        product: order.product,
        status: 'COMPLETE',
        executedAt: new Date()
      }
    });

    return updated;
  }

  private static async sendToBroker(
    broker: string,
    accessToken: string,
    order: { symbol: string; exchange: string; tradeType: string; quantity: number; orderType: string; product: string; price: unknown; triggerPrice: unknown; instrumentType: string; optionDetails: unknown }
  ): Promise<string> {
    const transactionType = order.tradeType;
    const payload: Record<string, unknown> = {
      exchange: order.exchange,
      tradingsymbol: order.symbol,
      transaction_type: transactionType,
      quantity: order.quantity,
      order_type: order.orderType,
      product: order.product,
      validity: 'DAY'
    };

    if (order.orderType === 'LIMIT' && order.price) payload.price = Number(order.price);
    if (['SL', 'SL-M'].includes(order.orderType) && order.triggerPrice) {
      payload.trigger_price = Number(order.triggerPrice);
      if (order.orderType === 'SL' && order.price) payload.price = Number(order.price);
    }

    if (order.instrumentType === 'OPTION' && order.optionDetails) {
      const od = order.optionDetails as { strike: number; expiry: string; optionType: string };
      payload.tradingsymbol = `${order.symbol}${new Date(od.expiry).toISOString().slice(2, 10).replace(/-/g, '')}${od.strike}${od.optionType}`;
      payload.product = 'NRML';
    }

    switch (broker.toLowerCase()) {
      case 'zerodha': {
        const response = await axios.post(
          'https://api.kite.trade/orders/regular',
          new URLSearchParams(payload as Record<string, string>),
          {
            headers: {
              Authorization: `token ${process.env.ZERODHA_API_KEY}:${accessToken}`,
              'X-Kite-Version': '3',
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        );
        return String(response.data.data.order_id);
      }
      case 'upstox': {
        const upstoxPayload = {
          quantity: order.quantity,
          product: order.product,
          validity: 'DAY',
          price: order.price ? Number(order.price) : 0,
          tag: 'smarttrade',
          instrument_token: `NSE_EQ|${order.symbol}`,
          order_type: order.orderType,
          transaction_type: transactionType,
          disclosed_quantity: 0,
          trigger_price: order.triggerPrice ? Number(order.triggerPrice) : 0,
          is_amo: false
        };
        const response = await axios.post(
          'https://api.upstox.com/v2/order/place',
          upstoxPayload,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        return String(response.data.data.order_id);
      }
      default:
        throw new AppError('Broker not supported for order placement', 400);
    }
  }

  private static async recordPaperTrade(
    order: { id: string; symbol: string; exchange: string; tradeType: string; quantity: number; orderType: string; product: string; brokerConnectionId: string | null },
    userId: string,
    fillPrice: number
  ) {
    const connections = await DatabaseService.getBrokerConnections(userId);
    const brokerConnectionId = connections[0]?.id;

    if (brokerConnectionId) {
      await prisma.trade.create({
        data: {
          userId,
          brokerConnectionId,
          orderId: `PAPER-${order.id}`,
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
      await this.updatePaperHolding(userId, order.symbol, order.exchange, order.tradeType, order.quantity, fillPrice);
    }
  }

  private static async updatePaperHolding(
    userId: string, symbol: string, exchange: string,
    tradeType: string, quantity: number, price: number
  ) {
    const connections = await DatabaseService.getBrokerConnections(userId);
    const brokerId = connections[0]?.id;
    if (!brokerId) return;

    const holdings = await DatabaseService.getHoldings(userId);
    const existing = holdings.find(h => h.symbol === symbol && h.exchange === exchange);

    if (tradeType === 'BUY') {
      const newQty = (existing?.quantity || 0) + quantity;
      const newAvg = existing
        ? (Number(existing.averagePrice) * existing.quantity + price * quantity) / newQty
        : price;
      await DatabaseService.createHolding({
        userId,
        brokerConnectionId: brokerId,
        symbol,
        exchange,
        quantity: newQty,
        averagePrice: newAvg,
        lastPrice: price,
        pnl: 0,
        pnlPercentage: 0,
        currentValue: newQty * price,
        investedValue: newQty * newAvg,
        product: 'CNC'
      });
    } else if (existing && tradeType === 'SELL') {
      const newQty = Math.max(0, existing.quantity - quantity);
      if (newQty === 0) {
        await DatabaseService.deleteHolding(existing.id);
      } else {
        await DatabaseService.updateHolding(existing.id, {
          quantity: newQty,
          lastPrice: price,
          currentValue: newQty * price,
          pnl: (price - Number(existing.averagePrice)) * newQty,
          pnlPercentage: ((price - Number(existing.averagePrice)) / Number(existing.averagePrice)) * 100
        });
      }
    }
  }

  static async cancelOrder(userId: string, orderId: string) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new AppError('Order not found', 404);
    if (order.status !== 'PENDING') throw new AppError('Only pending orders can be cancelled', 400);

    if (!order.isPaper && order.brokerOrderId && order.brokerConnectionId) {
      const connection = await DatabaseService.getBrokerConnectionById(order.brokerConnectionId);
      const accessToken = EncryptionService.decrypt(connection.accessTokenEncrypted!);
      await this.cancelBrokerOrder(connection.broker, accessToken, order.brokerOrderId);
    }

    return prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' }
    });
  }

  private static async cancelBrokerOrder(broker: string, accessToken: string, brokerOrderId: string) {
    if (broker === 'zerodha') {
      await axios.delete(`https://api.kite.trade/orders/regular/${brokerOrderId}`, {
        headers: {
          Authorization: `token ${process.env.ZERODHA_API_KEY}:${accessToken}`,
          'X-Kite-Version': '3'
        }
      });
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
}
