import { DatabaseService } from './database.service';
import { MarketService } from './market.service';
import {
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateTax,
  groupBy
} from '../utils/helpers';

export class AnalyticsService {
  static async getAdvancedMetrics(userId: string) {
    const trades = await DatabaseService.getTrades(userId);
    const holdings = await DatabaseService.getHoldings(userId);

    const multiPeriodStats = this.computeMultiPeriodStats(trades);
    const heatMap = this.computeHeatMap(trades);
    const drawdown = this.computeDrawdown(holdings, trades);
    const taxImpact = this.computeTaxImpact(trades);

    return { multiPeriodStats, heatMap, drawdown, taxImpact };
  }

  static async getPerformanceComparison(userId: string, timeRange: string) {
    const holdings = await DatabaseService.getHoldings(userId);
    const symbols = holdings.length
      ? [...new Set(holdings.map(h => h.symbol))]
      : ['RELIANCE', 'TCS'];

    const smallcapSymbol = symbols[0] || 'RELIANCE';
    const largecapSymbol = symbols[1] || symbols[0] || 'TCS';

    const days = { '1M': 30, '6M': 180, '1Y': 365, '3Y': 1095, 'MAX': 1825 }[timeRange] || 365;

    const [smallcapHist, largecapHist] = await Promise.all([
      MarketService.getHistoricalData(smallcapSymbol, Math.min(days, 365)),
      MarketService.getHistoricalData(largecapSymbol, Math.min(days, 365))
    ]);

    const performanceData = smallcapHist.map((d, i) => {
      const scBase = smallcapHist[0]?.close || 1;
      const lcBase = largecapHist[0]?.close || 1;
      return {
        index: i,
        date: d.date,
        smallcap: Number(((d.close / scBase) * 100).toFixed(2)),
        largecap: Number((((largecapHist[i]?.close || d.close) / lcBase) * 100).toFixed(2))
      };
    });

    const last = performanceData[performanceData.length - 1] || { smallcap: 100, largecap: 100 };

    return {
      timeRange,
      performanceData,
      summary: {
        smallcap: {
          currentValue: last.smallcap,
          returnPercent: (last.smallcap - 100).toFixed(2)
        },
        largecap: {
          currentValue: last.largecap,
          returnPercent: (last.largecap - 100).toFixed(2)
        }
      }
    };
  }

  private static computeMultiPeriodStats(trades: Array<{ tradeType: string; price: unknown; quantity: number; createdAt: Date }>) {
    const periods = { '6M': 180, '9M': 270, '1Y': 365, '2Y': 730 };
    const result: Record<string, object> = {};

    for (const [label, days] of Object.entries(periods)) {
      const cutoff = new Date(Date.now() - days * 86400000);
      const periodTrades = trades.filter(t => t.createdAt >= cutoff);
      const returns = periodTrades.map(t => {
        const sign = t.tradeType === 'SELL' ? 1 : -1;
        return sign * Number(t.price) * t.quantity * 0.01;
      });

      const wins = returns.filter(r => r > 0).length;
      const winRate = returns.length ? (wins / returns.length) * 100 : 0;
      const avgReturn = returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;

      result[label] = {
        winRate: Number(winRate.toFixed(1)),
        avgReturn: Number(avgReturn.toFixed(2)),
        sharpe: returns.length > 1 ? Number(calculateSharpeRatio(returns).toFixed(2)) : 0,
        maxDrawdown: returns.length ? -Number(calculateMaxDrawdown(returns.map((_, i) => 100 + returns.slice(0, i + 1).reduce((a, b) => a + b, 0))).toFixed(1)) : 0,
        trades: periodTrades.length
      };
    }

    return result;
  }

  private static computeHeatMap(trades: Array<{ createdAt: Date; price: unknown; quantity: number; tradeType: string }>) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const grouped = groupBy(
      trades.map(t => ({
        ...t,
        year: t.createdAt.getFullYear().toString(),
        month: months[t.createdAt.getMonth()],
        pnl: (t.tradeType === 'SELL' ? 1 : -1) * Number(t.price) * t.quantity * 0.02
      })),
      'year' as any
    );

    const years = Object.keys(grouped).sort().slice(-2);
    if (!years.length) {
      const currentYear = new Date().getFullYear().toString();
      return [{
        year: currentYear,
        months: months.map(m => ({ month: m, return: '0.00', trades: 0, totalPnL: 0 }))
      }];
    }

    return years.map(year => ({
      year,
      months: months.map(month => {
        const monthTrades = (grouped[year] || []).filter((t: any) => t.month === month);
        const totalPnL = monthTrades.reduce((s: number, t: any) => s + t.pnl, 0);
        return {
          month,
          return: monthTrades.length ? ((totalPnL / 100000) * 100).toFixed(2) : '0.00',
          trades: monthTrades.length,
          totalPnL: Number(totalPnL.toFixed(2))
        };
      })
    }));
  }

  private static computeDrawdown(
    holdings: Array<{ pnlPercentage: unknown }>,
    trades: Array<{ createdAt: Date }>
  ) {
    const avgPnl = holdings.length
      ? holdings.reduce((s, h) => s + Number(h.pnlPercentage), 0) / holdings.length
      : 0;

    return [
      { period: 'Current', value: Number(avgPnl.toFixed(1)), duration: 'Live', recovery: avgPnl < 0 ? 'In progress' : 'N/A' },
      { period: 'Max (1Y)', value: -Math.abs(Number(calculateMaxDrawdown(holdings.map(h => 100 + Number(h.pnlPercentage))).toFixed(1))), duration: '30 days', recovery: '45 days' },
      { period: 'Trade Count', value: trades.length, duration: 'All time', recovery: 'N/A' },
      { period: 'Avg', value: Number((avgPnl / 2).toFixed(1)), duration: '12 days', recovery: '28 days' }
    ];
  }

  private static computeTaxImpact(trades: Array<{ tradeType: string; price: unknown; quantity: number; createdAt: Date }>) {
    let shortTermGains = 0;
    let longTermGains = 0;

    const sells = trades.filter(t => t.tradeType === 'SELL');
    for (const sell of sells) {
      const buyPrice = Number(sell.price) * 0.95;
      const holdingDays = 400;
      const { capitalGain, type } = calculateTax(buyPrice, Number(sell.price), sell.quantity, holdingDays);
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
      effectiveTaxRate: grossReturns > 0 ? Number(((totalTaxLiability / grossReturns) * 100).toFixed(2)) : 0
    };
  }
}
