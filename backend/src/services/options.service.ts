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
  spotAvailable: boolean;
  expiry: string;
  contracts: OptionContract[];
  recommendations: OptionContract[];
  analyzedAt: string;
  available: boolean;
  providerStatus: 'unavailable' | 'ok';
  message?: string;
}

export class OptionsService {
  static async getOptionsChain(underlying: string, userId?: string): Promise<OptionsChainResult> {
    let spot = 0;
    let spotAvailable = false;

    try {
      const yahooSymbol = underlying === 'NIFTY' ? '^NSEI' : underlying === 'BANKNIFTY' ? '^NSEBANK' : underlying;
      const quote = underlying === 'NIFTY' || underlying === 'BANKNIFTY'
        ? await MarketService.fetchYahooQuote(yahooSymbol, '')
        : await MarketService.getQuote(underlying, userId);
      if (quote && quote.price > 0) {
        spot = quote.price;
        spotAvailable = true;
      }
    } catch {
      spotAvailable = false;
    }

    return {
      underlying,
      spotPrice: spot,
      spotAvailable,
      expiry: '',
      contracts: [],
      recommendations: [],
      analyzedAt: new Date().toISOString(),
      available: false,
      providerStatus: 'unavailable',
      message: 'Options chain requires a dedicated options data provider; no synthetic contracts are returned'
    };
  }

  static async getOptionsSignals(underlyings: string[], userId?: string) {
    const results = await Promise.all(
      underlyings.map(u => this.getOptionsChain(u, userId))
    );
    return {
      available: false,
      providerStatus: 'unavailable' as const,
      signals: results.flatMap(r => r.recommendations),
      chains: results
    };
  }
}
