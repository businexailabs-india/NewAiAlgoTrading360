import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { PredictionService } from './prediction.service';
import { OrderExecutionService } from './order-execution.service';
import { ScreenerService } from './screener.service';
import { DatabaseService } from './database.service';
import { MarketService } from './market.service';

import { StrategyService } from './strategy.service';

export interface AgentConfig {
  minConfidence?: number;
  maxPositionValue?: number;
  maxOrdersPerRun?: number;
  defaultQuantity?: number;
  useScreener?: boolean;
  screenerTopN?: number;
  strategyIds?: string[];
  symbols?: string[];
  product?: 'CNC' | 'MIS';
  [key: string]: unknown;
}

export class TradingAgentService {
  static async listAgents(userId: string) {
    return prisma.tradingAgent.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { runs: true, orders: true } } }
    });
  }

  static async getAgent(userId: string, agentId: string) {
    const agent = await prisma.tradingAgent.findFirst({
      where: { id: agentId, userId },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 20 },
        orders: { orderBy: { createdAt: 'desc' }, take: 20 }
      }
    });
    if (!agent) throw new AppError('Trading agent not found', 404);
    return agent;
  }

  static async createAgent(userId: string, data: {
    name: string;
    description?: string;
    mode?: 'paper' | 'live';
    engineId?: string;
    config?: AgentConfig;
  }) {
    return prisma.tradingAgent.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        mode: data.mode || 'paper',
        engineId: data.engineId,
        isActive: false,
        config: (data.config || {
          minConfidence: 65,
          maxPositionValue: 50000,
          maxOrdersPerRun: 5,
          defaultQuantity: 1,
          product: 'CNC'
        }) as object
      }
    });
  }

  static async updateAgent(userId: string, agentId: string, updates: {
    name?: string;
    description?: string;
    mode?: 'paper' | 'live';
    isActive?: boolean;
    config?: AgentConfig;
  }) {
    await this.getAgent(userId, agentId);
    return prisma.tradingAgent.update({
      where: { id: agentId },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.mode && { mode: updates.mode }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        ...(updates.config && { config: updates.config as object })
      }
    });
  }

  static async deleteAgent(userId: string, agentId: string) {
    await this.getAgent(userId, agentId);
    await prisma.tradingAgent.delete({ where: { id: agentId } });
    return { message: 'Agent deleted' };
  }

  static async runAgent(userId: string, agentId: string) {
    const agent = await this.getAgent(userId, agentId);
    const config = agent.config as AgentConfig;
    const isPaper = agent.mode === 'paper';

    const run = await prisma.agentRun.create({
      data: { agentId, status: 'running' }
    });

    try {
      const signals = await this.collectSignals(userId, agent, config);
      const ordersPlaced = [];
      const minConfidence = config.minConfidence || 65;
      const maxOrders = config.maxOrdersPerRun || 5;
      const defaultQty = config.defaultQuantity || 1;

      let brokerConnectionId: string | undefined;
      if (!isPaper) {
        const connections = await DatabaseService.getBrokerConnections(userId);
        if (!connections.length) throw new AppError('Connect a broker for live trading', 400);
        brokerConnectionId = connections[0].id;
      }

      for (const signal of signals.slice(0, maxOrders)) {
        if (signal.direction === 'HOLD' || signal.confidence < minConfidence) continue;

        const quote = await MarketService.getQuote(signal.symbol, userId);
        const maxValue = config.maxPositionValue || 50000;
        const qty = Math.max(1, Math.min(
          defaultQty,
          Math.floor(maxValue / (quote.price || 1))
        ));

        const order = await OrderExecutionService.placeOrder({
          userId,
          symbol: signal.symbol,
          tradeType: signal.direction as 'BUY' | 'SELL',
          quantity: qty,
          orderType: 'MARKET',
          product: config.product || 'CNC',
          isPaper,
          brokerConnectionId,
          agentId
        });

        ordersPlaced.push({
          orderId: order.id,
          symbol: signal.symbol,
          direction: signal.direction,
          quantity: qty,
          confidence: signal.confidence,
          status: order.status
        });
      }

      await prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          signals: signals as object,
          ordersPlaced: ordersPlaced as object,
          summary: {
            signalsCount: signals.length,
            ordersPlaced: ordersPlaced.length,
            mode: agent.mode
          } as object
        }
      });

      await prisma.tradingAgent.update({
        where: { id: agentId },
        data: { lastRunAt: new Date() }
      });

      return { runId: run.id, signals, ordersPlaced };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Agent run failed';
      await prisma.agentRun.update({
        where: { id: run.id },
        data: { status: 'failed', error: message }
      });
      throw new AppError(message, 500);
    }
  }

  private static async collectSignals(
    userId: string,
    agent: { engineId: string | null },
    config: AgentConfig
  ) {
    const signals: Array<{ symbol: string; direction: string; confidence: number; source: string }> = [];

    if (agent.engineId) {
      const predictions = await PredictionService.runPredictions(userId, agent.engineId);
      for (const p of predictions) {
        signals.push({
          symbol: p.symbol,
          direction: p.direction,
          confidence: p.confidence,
          source: 'prediction_engine'
        });
      }
    }

    if (config.useScreener) {
      const screenerResults = await ScreenerService.runScreener(userId, {
        topN: config.screenerTopN || 10
      });
      for (const stock of screenerResults.stocks) {
        if (stock.signal === 'BUY' || stock.signal === 'SELL') {
          signals.push({
            symbol: stock.symbol,
            direction: stock.signal,
            confidence: stock.score,
            source: 'screener'
          });
        }
      }
    }

    if (config.strategyIds?.length) {
      for (const strategyId of config.strategyIds) {
        try {
          const strategySignals = await StrategyService.evaluateForAgent(userId, strategyId);
          for (const s of strategySignals) {
            if (!signals.find(x => x.symbol === s.symbol && x.source.startsWith('strategy'))) {
              signals.push(s);
            }
          }
        } catch {
          // skip missing/inactive strategies
        }
      }
    }

    if (config.symbols?.length) {
      for (const symbol of config.symbols) {
        if (!signals.find(s => s.symbol === symbol)) {
          const historical = await MarketService.getHistoricalData(symbol, 30);
          const quote = await MarketService.getQuote(symbol, userId);
          const closes = historical.map(h => h.close);
          const momentum = closes.length > 5
            ? (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]
            : 0;
          signals.push({
            symbol,
            direction: momentum > 0.02 ? 'BUY' : momentum < -0.02 ? 'SELL' : 'HOLD',
            confidence: Math.min(90, 50 + Math.abs(momentum) * 500),
            source: 'momentum_scan'
          });
        }
      }
    }

    return signals.sort((a, b) => b.confidence - a.confidence);
  }
}
