import { MarketService } from './market.service';
import { prisma } from '../config/database';

const NIFTY50_UNIVERSE = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'ITC', 'SBIN',
  'BHARTIARTL', 'KOTAKBANK', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'SUNPHARMA',
  'TITAN', 'BAJFINANCE', 'WIPRO', 'ULTRACEMCO', 'NESTLEIND', 'POWERGRID', 'NTPC',
  'TATAMOTORS', 'M&M', 'HCLTECH', 'ADANIENT', 'JSWSTEEL', 'TATASTEEL', 'INDUSINDBK',
  'BAJAJFINSV', 'TECHM', 'ONGC', 'COALINDIA', 'GRASIM', 'CIPLA', 'DRREDDY', 'EICHERMOT',
  'APOLLOHOSP', 'BRITANNIA', 'DIVISLAB', 'HEROMOTOCO', 'HINDALCO', 'SBILIFE', 'TATACONSUM',
  'UPL', 'BPCL', 'ADANIPORTS', 'LTIM', 'HDFCLIFE', 'BAJAJ-AUTO'
];

export interface ScreenerCriteria {
  minMomentum?: number;
  maxMomentum?: number;
  minVolume?: number;
  topN?: number;
  universe?: string[];
}

export interface ScreenerStock {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  momentum: number;
  volume: number;
  score: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  rank: number;
}

export class ScreenerService {
  static async runScreener(userId: string, criteria: ScreenerCriteria = {}) {
    const universe = criteria.universe || NIFTY50_UNIVERSE;
    const topN = criteria.topN || 10;
    const results: ScreenerStock[] = [];

    const batchSize = 10;
    for (let i = 0; i < universe.length; i += batchSize) {
      const batch = universe.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(symbol => this.analyzeStock(symbol, userId, criteria))
      );
      results.push(...batchResults.filter(Boolean) as ScreenerStock[]);
    }

    const ranked = results
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    await prisma.screenerResult.create({
      data: {
        userId,
        criteria: criteria as object,
        results: ranked as object
      }
    });

    return {
      scannedAt: new Date().toISOString(),
      totalScanned: universe.length,
      stocks: ranked,
      topBuys: ranked.filter(s => s.signal === 'BUY').slice(0, 5),
      topSells: ranked.filter(s => s.signal === 'SELL').slice(0, 5)
    };
  }

  private static async analyzeStock(
    symbol: string,
    userId: string,
    criteria: ScreenerCriteria
  ): Promise<ScreenerStock | null> {
    try {
      const [quote, historical] = await Promise.all([
        MarketService.getQuote(symbol, userId),
        MarketService.getHistoricalData(symbol, 30)
      ]);

      if (!quote.price || historical.length < 10) return null;

      const closes = historical.map(h => h.close);
      const momentum5d = (closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6];
      const momentum20d = (closes[closes.length - 1] - closes[0]) / closes[0];
      const avgVolume = historical.reduce((s, h) => s + h.volume, 0) / historical.length;
      const momentum = momentum5d * 0.6 + momentum20d * 0.4;

      if (criteria.minMomentum !== undefined && momentum < criteria.minMomentum) return null;
      if (criteria.maxMomentum !== undefined && momentum > criteria.maxMomentum) return null;
      if (criteria.minVolume !== undefined && avgVolume < criteria.minVolume) return null;

      const rsi = this.calculateRSI(closes);
      let score = 50;
      if (momentum > 0) score += momentum * 200;
      if (rsi < 30) score += 15;
      if (rsi > 70) score -= 15;
      score += quote.changePercent * 2;
      score = Math.max(0, Math.min(100, score));

      const signal: 'BUY' | 'SELL' | 'HOLD' =
        score >= 65 && momentum > 0 ? 'BUY' :
        score <= 35 && momentum < 0 ? 'SELL' : 'HOLD';

      return {
        symbol,
        name: symbol,
        price: quote.price,
        changePercent: quote.changePercent,
        momentum: Number((momentum * 100).toFixed(2)),
        volume: avgVolume,
        score: Number(score.toFixed(1)),
        signal,
        rank: 0
      };
    } catch {
      return null;
    }
  }

  private static calculateRSI(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    return 100 - 100 / (1 + rs);
  }

  static async getHistory(userId: string, limit = 10) {
    return prisma.screenerResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }
}
