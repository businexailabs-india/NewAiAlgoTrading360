import { MarketService } from './market.service';

export interface OptionContract {
  symbol: string;
  underlying: string;
  strike: number;
  expiry: string;
  optionType: 'CE' | 'PE';
  ltp: number;
  change: number;
  changePercent: number;
  oi: number;
  iv: number;
  signal: 'BUY' | 'SELL' | 'HOLD';
  strategy: string;
  confidence: number;
  reason: string;
}

export interface OptionsChainResult {
  underlying: string;
  spotPrice: number;
  expiry: string;
  contracts: OptionContract[];
  recommendations: OptionContract[];
  analyzedAt: string;
}

export class OptionsService {
  private static generateExpiries(): string[] {
    const expiries: string[] = [];
    const now = new Date();
    for (let w = 0; w < 4; w++) {
      const d = new Date(now);
      d.setDate(d.getDate() + (w * 7) + ((4 - d.getDay()) % 7));
      expiries.push(d.toISOString().split('T')[0]);
    }
    return [...new Set(expiries)].slice(0, 3);
  }

  static async getOptionsChain(underlying: string, userId?: string): Promise<OptionsChainResult> {
    const yahooSymbol = underlying === 'NIFTY' ? '^NSEI' : underlying === 'BANKNIFTY' ? '^NSEBANK' : underlying;
    const quote = underlying === 'NIFTY' || underlying === 'BANKNIFTY'
      ? await MarketService.fetchYahooQuote(yahooSymbol, '')
      : await MarketService.getQuote(underlying, userId);
    const spot = quote?.price || 0;
    const historical = await MarketService.getHistoricalData(
      underlying === 'NIFTY' ? 'RELIANCE' : underlying === 'BANKNIFTY' ? 'HDFCBANK' : underlying,
      30
    );
    const closes = historical.map(h => h.close);
    const volatility = this.calculateVolatility(closes);
    const trend = closes.length > 5
      ? (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5]
      : 0;

    const expiry = this.generateExpiries()[0];
    const strikes = this.generateStrikes(spot);
    const contracts: OptionContract[] = [];

    for (const strike of strikes) {
      for (const optionType of ['CE', 'PE'] as const) {
        const intrinsic = optionType === 'CE'
          ? Math.max(0, spot - strike)
          : Math.max(0, strike - spot);
        const timeValue = spot * volatility * 0.1;
        const ltp = Number((intrinsic + timeValue).toFixed(2));
        const iv = Number((volatility * 100).toFixed(1));
        const oi = Math.floor(Math.random() * 50000 + 10000);

        const { signal, confidence, reason, strategy } = this.analyzeOption(
          optionType, strike, spot, trend, iv, intrinsic, timeValue
        );

        contracts.push({
          symbol: `${underlying}${expiry.replace(/-/g, '')}${strike}${optionType}`,
          underlying,
          strike,
          expiry,
          optionType,
          ltp,
          change: Number((ltp * 0.02 * (Math.random() - 0.5)).toFixed(2)),
          changePercent: Number((Math.random() * 10 - 5).toFixed(2)),
          oi,
          iv,
          signal,
          strategy,
          confidence,
          reason
        });
      }
    }

    const recommendations = contracts
      .filter(c => c.signal !== 'HOLD')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);

    return {
      underlying,
      spotPrice: spot,
      expiry,
      contracts,
      recommendations,
      analyzedAt: new Date().toISOString()
    };
  }

  static async getOptionsSignals(underlyings: string[], userId?: string) {
    const results = await Promise.all(
      underlyings.map(u => this.getOptionsChain(u, userId))
    );
    return {
      signals: results.flatMap(r => r.recommendations),
      chains: results
    };
  }

  private static generateStrikes(spot: number): number[] {
    const step = spot > 1000 ? 50 : spot > 500 ? 20 : 10;
    const atm = Math.round(spot / step) * step;
    return [-2, -1, 0, 1, 2].map(i => atm + i * step);
  }

  private static calculateVolatility(closes: number[]): number {
    if (closes.length < 2) return 0.2;
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance * 252);
  }

  private static analyzeOption(
    optionType: 'CE' | 'PE',
    strike: number,
    spot: number,
    trend: number,
    iv: number,
    intrinsic: number,
    timeValue: number
  ) {
    const moneyness = (spot - strike) / spot;
    const isATM = Math.abs(moneyness) < 0.02;

    if (optionType === 'CE' && trend > 0.03 && (isATM || moneyness > 0)) {
      return {
        signal: 'BUY' as const,
        confidence: Math.min(85, 60 + trend * 300),
        strategy: 'Bullish Call',
        reason: `Uptrend (+${(trend * 100).toFixed(1)}%) — ATM/ITM call has favorable delta`
      };
    }

    if (optionType === 'PE' && trend < -0.03 && (isATM || moneyness < 0)) {
      return {
        signal: 'BUY' as const,
        confidence: Math.min(85, 60 + Math.abs(trend) * 300),
        strategy: 'Bearish Put',
        reason: `Downtrend (${(trend * 100).toFixed(1)}%) — ATM/ITM put for downside protection`
      };
    }

    if (iv > 35 && timeValue > intrinsic * 2) {
      return {
        signal: 'SELL' as const,
        confidence: 70,
        strategy: 'Premium Selling',
        reason: `High IV (${iv.toFixed(0)}%) — consider selling premium via ${optionType}`
      };
    }

    if (isATM && Math.abs(trend) < 0.01) {
      return {
        signal: 'SELL' as const,
        confidence: 65,
        strategy: 'Iron Condor / Straddle Sell',
        reason: 'Low directional bias at ATM — range-bound premium collection'
      };
    }

    return {
      signal: 'HOLD' as const,
      confidence: 40,
      strategy: 'Wait',
      reason: 'No clear edge — wait for better setup'
    };
  }
}
