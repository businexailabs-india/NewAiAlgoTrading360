import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

export class DatabaseService {
  // ==================== HOLDINGS ====================

  static async getHoldings(userId: string) {
    return prisma.holding.findMany({
      where: { userId },
      orderBy: { symbol: 'asc' },
      include: { brokerConnection: { select: { broker: true } } }
    });
  }

  static async createHolding(data: {
    userId: string;
    brokerConnectionId: string;
    symbol: string;
    exchange: string;
    quantity: number;
    averagePrice: number;
    lastPrice: number;
    pnl: number;
    pnlPercentage: number;
    currentValue: number;
    investedValue: number;
    product: string;
    isin?: string;
  }) {
    const existing = await prisma.holding.findFirst({
      where: {
        userId: data.userId,
        symbol: data.symbol,
        exchange: data.exchange,
        brokerConnectionId: data.brokerConnectionId
      }
    });

    if (existing) {
      return prisma.holding.update({
        where: { id: existing.id },
        data: {
          quantity: data.quantity,
          averagePrice: data.averagePrice,
          lastPrice: data.lastPrice,
          pnl: data.pnl,
          pnlPercentage: data.pnlPercentage,
          currentValue: data.currentValue,
          investedValue: data.investedValue
        }
      });
    }

    return prisma.holding.create({
      data: {
        userId: data.userId,
        brokerConnectionId: data.brokerConnectionId,
        symbol: data.symbol,
        exchange: data.exchange,
        quantity: data.quantity,
        averagePrice: data.averagePrice,
        lastPrice: data.lastPrice,
        pnl: data.pnl,
        pnlPercentage: data.pnlPercentage,
        currentValue: data.currentValue,
        investedValue: data.investedValue,
        product: data.product,
        isin: data.isin
      }
    });
  }

  static async updateHolding(id: string, updates: Prisma.HoldingUpdateInput, userId?: string) {
    if (userId) {
      const existing = await prisma.holding.findFirst({ where: { id, userId } });
      if (!existing) throw new AppError('Holding not found', 404);
    }
    try {
      return await prisma.holding.update({ where: { id }, data: updates });
    } catch {
      throw new AppError('Holding not found', 404);
    }
  }

  static async deleteHolding(id: string, userId?: string) {
    if (userId) {
      const existing = await prisma.holding.findFirst({ where: { id, userId } });
      if (!existing) throw new AppError('Holding not found', 404);
    }
    await prisma.holding.delete({ where: { id } });
    return { message: 'Holding deleted successfully' };
  }

  // ==================== TRADES ====================

  static async getTrades(userId: string, filters?: { startDate?: string; endDate?: string }) {
    const where: Prisma.TradeWhereInput = { userId };
    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }
    return prisma.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createTrade(data: Prisma.TradeCreateInput) {
    return prisma.trade.create({ data });
  }

  // ==================== PORTFOLIOS ====================

  static async getPortfolios(userId: string) {
    return prisma.portfolio.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async getPortfolioById(portfolioId: string, userId?: string) {
    const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
    if (!portfolio) throw new AppError('Portfolio not found', 404);
    if (userId && portfolio.userId !== userId) throw new AppError('Portfolio not found', 404);
    return portfolio;
  }

  static async createPortfolio(data: {
    userId: string;
    name: string;
    description?: string;
  }) {
    return prisma.portfolio.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        totalValue: 0,
        investedValue: 0,
        currentValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        dayPnL: 0
      }
    });
  }

  static async updatePortfolio(id: string, updates: Prisma.PortfolioUpdateInput, userId?: string) {
    if (userId) {
      const existing = await prisma.portfolio.findFirst({ where: { id, userId } });
      if (!existing) throw new AppError('Portfolio not found', 404);
    }
    return prisma.portfolio.update({ where: { id }, data: updates });
  }

  // ==================== BROKER CONNECTIONS ====================

  static async getBrokerConnections(userId: string) {
    return prisma.brokerConnection.findMany({
      where: { userId, isActive: true }
    });
  }

  static async getBrokerConnectionById(id: string) {
    const conn = await prisma.brokerConnection.findUnique({ where: { id } });
    if (!conn) throw new AppError('Broker connection not found', 404);
    return conn;
  }

  static async createBrokerConnection(data: {
    userId: string;
    broker: string;
    accessTokenEncrypted: string;
    refreshTokenEncrypted?: string | null;
    expiresAt?: Date;
  }) {
    const existing = await prisma.brokerConnection.findFirst({
      where: { userId: data.userId, broker: data.broker, isActive: true }
    });

    if (existing) {
      return prisma.brokerConnection.update({
        where: { id: existing.id },
        data: {
          accessTokenEncrypted: data.accessTokenEncrypted,
          refreshTokenEncrypted: data.refreshTokenEncrypted,
          expiresAt: data.expiresAt
        }
      });
    }

    return prisma.brokerConnection.create({
      data: {
        userId: data.userId,
        broker: data.broker,
        accessTokenEncrypted: data.accessTokenEncrypted,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        expiresAt: data.expiresAt
      }
    });
  }

  static async updateBrokerConnection(id: string, updates: Prisma.BrokerConnectionUpdateInput) {
    return prisma.brokerConnection.update({ where: { id }, data: updates });
  }

  // ==================== USER SETTINGS ====================

  static async getUserSettings(userId: string) {
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    return settings || { settings: {} };
  }

  static async upsertUserSettings(userId: string, settings: Record<string, unknown>) {
    return prisma.userSettings.upsert({
      where: { userId },
      create: { userId, settings: settings as object },
      update: { settings: settings as object }
    });
  }

  /** Paper / algo desk available cash stored in user settings. */
  static async getFunds(userId: string) {
    const row = await this.getUserSettings(userId);
    const settings = (row.settings || {}) as Record<string, unknown>;
    const funds = (settings.funds || {}) as Record<string, unknown>;
    const availableCash = Number(funds.availableCash ?? 0);
    const ledger = Array.isArray(funds.ledger) ? funds.ledger : [];
    return {
      availableCash: Number.isFinite(availableCash) ? availableCash : 0,
      currency: 'INR',
      ledger: ledger.slice(0, 50)
    };
  }

  static async transferFunds(
    userId: string,
    type: 'add' | 'withdraw',
    amount: number,
    note?: string
  ) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError('Enter a valid amount greater than zero', 400);
    }
    if (amount > 50_000_000) {
      throw new AppError('Amount exceeds maximum allowed (₹5 crore)', 400);
    }

    const row = await this.getUserSettings(userId);
    const settings = { ...((row.settings || {}) as Record<string, unknown>) };
    const funds = { ...((settings.funds || {}) as Record<string, unknown>) };
    const current = Number(funds.availableCash ?? 0) || 0;

    if (type === 'withdraw' && amount > current) {
      throw new AppError(`Insufficient funds. Available: ₹${current.toLocaleString('en-IN')}`, 400);
    }

    const next = type === 'add' ? current + amount : current - amount;
    const entry = {
      id: `fund-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      amount,
      note: note?.trim() || (type === 'add' ? 'Add fund' : 'Withdraw fund'),
      createdAt: new Date().toISOString(),
      balanceAfter: next
    };
    const ledger = [entry, ...(Array.isArray(funds.ledger) ? funds.ledger : [])].slice(0, 100);

    settings.funds = { availableCash: next, ledger };
    await this.upsertUserSettings(userId, settings);

    // Keep primary portfolio book values in sync for Capital Allocated displays
    const portfolio = await prisma.portfolio.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
    if (portfolio) {
      const invested = Math.max(0, Number(portfolio.investedValue) + (type === 'add' ? amount : -amount));
      const currentVal = Math.max(0, Number(portfolio.currentValue) + (type === 'add' ? amount : -amount));
      await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: {
          investedValue: invested,
          currentValue: currentVal,
          totalValue: currentVal,
          totalPnL: currentVal - invested,
          totalPnLPercent: invested > 0 ? ((currentVal - invested) / invested) * 100 : 0
        }
      });
    }

    return {
      availableCash: next,
      currency: 'INR',
      entry,
      ledger: ledger.slice(0, 50)
    };
  }

  // ==================== ANALYTICS ====================

  static async getPortfolioSummary(userId: string) {
    const holdings = await this.getHoldings(userId);
    const totalInvested = holdings.reduce((s, h) => s + Number(h.investedValue), 0);
    const totalCurrent = holdings.reduce((s, h) => s + Number(h.currentValue), 0);
    const totalPnL = totalCurrent - totalInvested;
    const totalPnLPercent = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

    const connections = await this.getBrokerConnections(userId);

    return {
      totalInvested,
      totalCurrent,
      totalPnL,
      totalPnLPercent,
      holdingsCount: holdings.length,
      activeBrokers: connections.length,
      liveStrategies: await prisma.predictionEngine.count({
        where: { userId, status: 'deployed' }
      })
    };
  }

  // ==================== ADMIN ====================

  static async getUsers(page = 1, limit = 10) {
    const [data, total] = await Promise.all([
      prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, name: true, role: true,
          isActive: true, createdAt: true
        }
      }),
      prisma.user.count()
    ]);
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async getAdminStats() {
    const [totalUsers, activeUsers, totalTrades, deployedEngines] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.trade.count(),
      prisma.predictionEngine.count({ where: { status: 'deployed' } })
    ]);

    return {
      totalUsers,
      activeUsers,
      totalTrades,
      deployedEngines,
      systemUptime: process.uptime()
    };
  }

  // ==================== MARKET DATA CACHE ====================

  static async cacheMarketData(entries: Array<{
    symbol: string;
    exchange: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    timestamp: Date;
  }>) {
    for (const entry of entries) {
      await prisma.marketData.upsert({
        where: {
          symbol_exchange_timestamp: {
            symbol: entry.symbol,
            exchange: entry.exchange,
            timestamp: entry.timestamp
          }
        },
        create: entry,
        update: { close: entry.close, high: entry.high, low: entry.low, volume: entry.volume }
      }).catch((err) => logger.warn('Market data cache write failed:', err));
    }
  }

  static async getCachedMarketData(symbol: string, exchange: string, limit = 90) {
    return prisma.marketData.findMany({
      where: { symbol, exchange },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }
}
