import { DatabaseService } from './database.service';
import { MarketService } from './market.service';
import {
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateTax,
  groupBy
} from '../utils/helpers';

type TradeRow = {
  symbol: string;
  tradeType: string;
  price: unknown;
  quantity: number;
  createdAt: Date;
  executedAt?: Date | null;
  status?: string;
};

type RealizedMatch = {
  symbol: string;
  sellDate: Date;
  buyDate: Date;
  quantity: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number;
  holdingDays: number;
};

export class AnalyticsService {
  static async getAdvancedMetrics(userId: string) {
    const trades = await DatabaseService.getTrades(userId);
    const holdings = await DatabaseService.getHoldings(userId);
    const matches = this.matchFifoRealized(trades);

    const multiPeriodStats = this.computeMultiPeriodStats(matches, trades);
    const heatMap = this.computeHeatMap(matches);
    const drawdown = this.computeDrawdown(matches, holdings, trades);
    const taxImpact = this.computeTaxImpact(matches);

    return { multiPeriodStats, heatMap, drawdown, taxImpact };
  }

  static async getPerformanceComparison(userId: string, timeRange: string) {
    const holdings = await DatabaseService.getHoldings(userId);
    if (!holdings.length) {
      return {
        timeRange,
        performanceData: [] as Array<{
          index: number;
          date: string;
          smallcap: number;
          largecap: number;
        }>,
        summary: {
          smallcap: { currentValue: 0, returnPercent: '0.00', available: false },
          largecap: { currentValue: 0, returnPercent: '0.00', available: false }
        },
        available: false,
        message: 'No holdings to compare'
      };
    }

    const symbols = [...new Set(holdings.map(h => h.symbol))];
    const smallcapSymbol = symbols[0];
    const largecapSymbol = symbols[1] || symbols[0];

    const days = { '1M': 30, '6M': 180, '1Y': 365, '3Y': 1095, 'MAX': 1825 }[timeRange] || 365;

    const [smallcapHist, largecapHist] = await Promise.all([
      MarketService.getHistoricalData(smallcapSymbol, Math.min(days, 365)),
      MarketService.getHistoricalData(largecapSymbol, Math.min(days, 365))
    ]);

    if (!smallcapHist.length) {
      return {
        timeRange,
        performanceData: [],
        summary: {
          smallcap: { currentValue: 0, returnPercent: '0.00', available: false },
          largecap: { currentValue: 0, returnPercent: '0.00', available: false }
        },
        available: false,
        message: 'Historical price data unavailable'
      };
    }

    const performanceData = smallcapHist.map((d, i) => {
      const scBase = smallcapHist[0]?.close || 1;
      const lcBase = largecapHist[0]?.close || 1;
      const lcClose = largecapHist[i]?.close;
      return {
        index: i,
        date: d.date,
        smallcap: Number(((d.close / scBase) * 100).toFixed(2)),
        largecap: lcClose != null
          ? Number(((lcClose / lcBase) * 100).toFixed(2))
          : Number(((d.close / scBase) * 100).toFixed(2))
      };
    });

    const last = performanceData[performanceData.length - 1] || { smallcap: 100, largecap: 100 };

    return {
      timeRange,
      performanceData,
      summary: {
        smallcap: {
          currentValue: last.smallcap,
          returnPercent: (last.smallcap - 100).toFixed(2),
          available: true,
          symbol: smallcapSymbol
        },
        largecap: {
          currentValue: last.largecap,
          returnPercent: (last.largecap - 100).toFixed(2),
          available: largecapHist.length > 0,
          symbol: largecapSymbol
        }
      },
      available: true
    };
  }

  /** Match BUY lots vs SELL trades FIFO per symbol using actual trade dates/prices. */
  private static matchFifoRealized(trades: TradeRow[]): RealizedMatch[] {
    const complete = trades
      .filter(t => !t.status || t.status === 'COMPLETE')
      .map(t => ({
        ...t,
        eventAt: t.executedAt || t.createdAt,
        priceNum: Number(t.price)
      }))
      .filter(t => t.priceNum > 0 && t.quantity > 0)
      .sort((a, b) => a.eventAt.getTime() - b.eventAt.getTime());

    const lotsBySymbol = new Map<string, Array<{ qty: number; price: number; date: Date }>>();
    const matches: RealizedMatch[] = [];

    for (const t of complete) {
      const lots = lotsBySymbol.get(t.symbol) || [];
      if (t.tradeType === 'BUY') {
        lots.push({ qty: t.quantity, price: t.priceNum, date: t.eventAt });
        lotsBySymbol.set(t.symbol, lots);
        continue;
      }
      if (t.tradeType !== 'SELL') continue;

      let remaining = t.quantity;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const matchedQty = Math.min(remaining, lot.qty);
        const holdingDays = Math.max(
          0,
          Math.floor((t.eventAt.getTime() - lot.date.getTime()) / 86400000)
        );
        matches.push({
          symbol: t.symbol,
          sellDate: t.eventAt,
          buyDate: lot.date,
          quantity: matchedQty,
          buyPrice: lot.price,
          sellPrice: t.priceNum,
          pnl: (t.priceNum - lot.price) * matchedQty,
          holdingDays
        });
        lot.qty -= matchedQty;
        remaining -= matchedQty;
        if (lot.qty <= 0) lots.shift();
      }
      lotsBySymbol.set(t.symbol, lots);
      // Unmatched sell qty (short / missing buys) is ignored — no invented cost basis
    }

    return matches;
  }

  private static computeMultiPeriodStats(matches: RealizedMatch[], trades: TradeRow[]) {
    const periods = { '6M': 180, '9M': 270, '1Y': 365, '2Y': 730 };
    const result: Record<string, object> = {};

    for (const [label, days] of Object.entries(periods)) {
      const cutoff = new Date(Date.now() - days * 86400000);
      const periodMatches = matches.filter(m => m.sellDate >= cutoff);
      const periodTrades = trades.filter(t => (t.executedAt || t.createdAt) >= cutoff);
      const returns = periodMatches.map(m => m.pnl);
      const wins = returns.filter(r => r > 0).length;
      const winRate = returns.length ? (wins / returns.length) * 100 : 0;
      const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

      const equity = [100];
      for (const r of returns) {
        equity.push(equity[equity.length - 1] + r);
      }

      result[label] = {
        winRate: Number(winRate.toFixed(1)),
        avgReturn: Number(avgReturn.toFixed(2)),
        sharpe: returns.length > 1 ? Number(calculateSharpeRatio(returns).toFixed(2)) : 0,
        maxDrawdown: returns.length > 1
          ? -Number(calculateMaxDrawdown(equity).toFixed(1))
          : 0,
        trades: periodTrades.length,
        realizedMatches: periodMatches.length,
        available: periodMatches.length > 0 || periodTrades.length === 0
      };
    }

    return result;
  }

  private static computeHeatMap(matches: RealizedMatch[]) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (!matches.length) {
      const currentYear = new Date().getFullYear().toString();
      return [{
        year: currentYear,
        months: months.map(m => ({ month: m, return: '0.00', trades: 0, totalPnL: 0 })),
        available: false,
        source: 'fifo_realized'
      }];
    }

    const enriched = matches.map(m => ({
      year: m.sellDate.getFullYear().toString(),
      month: months[m.sellDate.getMonth()],
      pnl: m.pnl
    }));
    const grouped = groupBy(enriched, 'year' as keyof typeof enriched[0]);
    const years = Object.keys(grouped).sort().slice(-2);

    return years.map(year => {
      const yearMatches = grouped[year] || [];
      const yearTotalInvestedProxy = yearMatches.reduce((s, t) => s + Math.abs(t.pnl), 0) || 1;
      return {
        year,
        months: months.map(month => {
          const monthTrades = yearMatches.filter(t => t.month === month);
          const totalPnL = monthTrades.reduce((s, t) => s + t.pnl, 0);
          return {
            month,
            return: monthTrades.length
              ? ((totalPnL / yearTotalInvestedProxy) * 100).toFixed(2)
              : '0.00',
            trades: monthTrades.length,
            totalPnL: Number(totalPnL.toFixed(2))
          };
        }),
        available: true,
        source: 'fifo_realized'
      };
    });
  }

  private static computeDrawdown(
    matches: RealizedMatch[],
    holdings: Array<{ pnlPercentage: unknown }>,
    trades: TradeRow[]
  ): Array<{
    period: string;
    value: number;
    duration: string | null;
    recovery: string | null;
    available: boolean;
    source?: string;
  }> {
    if (!matches.length && !holdings.length) {
      return [
        { period: 'Current', value: 0, duration: null, recovery: null, available: false },
        { period: 'Max (realized)', value: 0, duration: null, recovery: null, available: false },
        { period: 'Trade Count', value: 0, duration: 'All time', recovery: null, available: false }
      ];
    }

    const sorted = [...matches].sort((a, b) => a.sellDate.getTime() - b.sellDate.getTime());
    const equity = [100];
    for (const m of sorted) {
      equity.push(equity[equity.length - 1] + m.pnl);
    }

    const maxDd = equity.length > 1 ? calculateMaxDrawdown(equity) : 0;
    const avgPnl = holdings.length
      ? holdings.reduce((s, h) => s + Number(h.pnlPercentage), 0) / holdings.length
      : 0;

    // Duration only when measurable from equity path — never invent recovery days
    let maxDdDurationDays: number | null = null;
    if (equity.length > 2 && sorted.length) {
      let peak = equity[0];
      let peakIdx = 0;
      let worst = 0;
      let worstStart = 0;
      let worstEnd = 0;
      for (let i = 1; i < equity.length; i++) {
        if (equity[i] > peak) {
          peak = equity[i];
          peakIdx = i;
        }
        const dd = (peak - equity[i]) / peak;
        if (dd > worst) {
          worst = dd;
          worstStart = peakIdx;
          worstEnd = i;
        }
      }
      if (worstEnd > worstStart) {
        const startDate = sorted[Math.max(0, worstStart - 1)]?.sellDate || sorted[0].sellDate;
        const endDate = sorted[Math.min(worstEnd - 1, sorted.length - 1)].sellDate;
        maxDdDurationDays = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 86400000));
      }
    }

    return [
      {
        period: 'Current',
        value: Number(avgPnl.toFixed(1)),
        duration: null,
        recovery: avgPnl < 0 ? 'In progress' : null,
        available: true,
        source: 'holdings_mark'
      },
      {
        period: 'Max (realized)',
        value: -Number(maxDd.toFixed(1)),
        duration: maxDdDurationDays != null ? `${maxDdDurationDays} days` : null,
        recovery: null,
        available: matches.length > 0,
        source: 'fifo_realized_equity'
      },
      {
        period: 'Trade Count',
        value: trades.length,
        duration: 'All time',
        recovery: null,
        available: true
      }
    ];
  }

  private static computeTaxImpact(matches: RealizedMatch[]) {
    if (!matches.length) {
      return {
        shortTermGains: 0,
        longTermGains: 0,
        shortTermTax: 0,
        longTermTax: 0,
        totalTaxLiability: 0,
        netReturns: 0,
        effectiveTaxRate: 0,
        available: false,
        source: 'fifo_realized',
        message: 'No matched BUY/SELL lots for tax computation'
      };
    }

    let shortTermGains = 0;
    let longTermGains = 0;

    for (const m of matches) {
      const { capitalGain, type } = calculateTax(m.buyPrice, m.sellPrice, m.quantity, m.holdingDays);
      if (type === 'STCG') shortTermGains += capitalGain;
      else longTermGains += capitalGain;
    }

    const shortTermTax = shortTermGains * 0.15;
    const longTermTax = Math.max(0, longTermGains - 100000) * 0.10;
    const totalTaxLiability = shortTermTax + longTermTax;
    const grossReturns = shortTermGains + longTermGains;

    return {
      shortTermGains: Number(shortTermGains.toFixed(2)),
      longTermGains: Number(longTermGains.toFixed(2)),
      shortTermTax: Number(shortTermTax.toFixed(2)),
      longTermTax: Number(longTermTax.toFixed(2)),
      totalTaxLiability: Number(totalTaxLiability.toFixed(2)),
      netReturns: Number((grossReturns - totalTaxLiability).toFixed(2)),
      effectiveTaxRate: grossReturns > 0 ? Number(((totalTaxLiability / grossReturns) * 100).toFixed(2)) : 0,
      available: true,
      source: 'fifo_realized',
      matchedLots: matches.length
    };
  }
}
