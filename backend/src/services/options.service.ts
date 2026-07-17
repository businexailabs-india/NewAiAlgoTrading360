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
  providerStatus: 'unavailable' | 'ok' | 'heuristic';
  message?: string;
}

function nextWeeklyExpiry(): string {
  const d = new Date();
  // NSE index options typically expire on Thursday (IST approx)
  const day = d.getUTCDay();
  const daysUntilThu = (4 - day + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilThu);
  return d.toISOString().slice(0, 10);
}

function strikeStep(underlying: string, spot: number): number {
  if (underlying === 'NIFTY') return 50;
  if (underlying === 'BANKNIFTY') return 100;
  if (spot >= 5000) return 100;
  if (spot >= 1000) return 50;
  if (spot >= 200) return 10;
  return 5;
}

function roundStrike(spot: number, step: number): number {
  return Math.round(spot / step) * step;
}

function estimatePremium(spot: number, strike: number, optionType: 'CE' | 'PE', ivPct: number): number {
  const intrinsic =
    optionType === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const timeValue = Math.max(spot * (ivPct / 100) * 0.08, spot * 0.002);
  return Number((intrinsic + timeValue).toFixed(2));
}

function buildHeuristicContracts(
  underlying: string,
  spot: number,
  changePercent: number
): OptionContract[] {
  const step = strikeStep(underlying, spot);
  const atm = roundStrike(spot, step);
  const expiry = nextWeeklyExpiry();
  const bullish = changePercent >= 0.35;
  const bearish = changePercent <= -0.35;
  const ivBase = Math.min(45, Math.max(12, 14 + Math.abs(changePercent) * 2.5));

  const specs: Array<{
    strike: number;
    optionType: 'CE' | 'PE';
    strategy: string;
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    reason: string;
    ivAdj: number;
  }> = [
    {
      strike: atm,
      optionType: 'CE',
      strategy: bullish ? 'ATM Call Momentum' : 'ATM Call Hedge Watch',
      signal: bullish ? 'BUY' : bearish ? 'SELL' : 'HOLD',
      confidence: Math.min(88, Math.max(45, 55 + Math.abs(changePercent) * 8)),
      reason: bullish
        ? `${underlying} spot ${spot.toFixed(2)} up ${changePercent.toFixed(2)}% — momentum favors ATM CE (paper heuristic).`
        : `${underlying} spot ${spot.toFixed(2)} (${changePercent.toFixed(2)}%) — no strong CE momentum; paper watch only.`,
      ivAdj: 0
    },
    {
      strike: atm + step,
      optionType: 'CE',
      strategy: 'OTM Call Breakout',
      signal: bullish ? 'BUY' : 'HOLD',
      confidence: Math.min(80, Math.max(40, 48 + Math.abs(changePercent) * 6)),
      reason: `OTM CE ${atm + step} for continuation if ${underlying} holds above ATM ${atm}.`,
      ivAdj: 2
    },
    {
      strike: atm,
      optionType: 'PE',
      strategy: bearish ? 'ATM Put Momentum' : 'ATM Put Hedge',
      signal: bearish ? 'BUY' : bullish ? 'HOLD' : 'BUY',
      confidence: Math.min(86, Math.max(42, 52 + Math.abs(changePercent) * 7)),
      reason: bearish
        ? `${underlying} weak (${changePercent.toFixed(2)}%) — ATM PE momentum (paper heuristic).`
        : `Protective ATM PE near ${atm} while spot is ${spot.toFixed(2)}.`,
      ivAdj: 1
    },
    {
      strike: atm - step,
      optionType: 'PE',
      strategy: 'OTM Put Support',
      signal: bearish ? 'BUY' : 'HOLD',
      confidence: Math.min(78, Math.max(40, 46 + Math.abs(changePercent) * 5)),
      reason: `OTM PE ${atm - step} if ${underlying} loses ATM support at ${atm}.`,
      ivAdj: 3
    }
  ];

  return specs.map((s) => {
    const iv = Number((ivBase + s.ivAdj).toFixed(1));
    const ltp = estimatePremium(spot, s.strike, s.optionType, iv);
    return {
      symbol: `${underlying}${s.strike}${s.optionType}`,
      underlying,
      strike: s.strike,
      expiry,
      optionType: s.optionType,
      ltp,
      change: Number((ltp * (changePercent / 100)).toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      oi: 0,
      iv,
      signal: s.signal,
      strategy: s.strategy,
      confidence: Number(s.confidence.toFixed(0)),
      reason: s.reason
    };
  });
}

export class OptionsService {
  static async getOptionsChain(underlying: string, userId?: string): Promise<OptionsChainResult> {
    let spot = 0;
    let changePercent = 0;
    let spotAvailable = false;

    try {
      const yahooSymbol =
        underlying === 'NIFTY' ? '^NSEI' : underlying === 'BANKNIFTY' ? '^NSEBANK' : underlying;
      const quote =
        underlying === 'NIFTY' || underlying === 'BANKNIFTY'
          ? await MarketService.fetchYahooQuote(yahooSymbol, '')
          : await MarketService.getQuote(underlying, userId);
      if (quote && quote.price > 0) {
        spot = quote.price;
        changePercent = Number(quote.changePercent || 0);
        spotAvailable = true;
      }
    } catch {
      spotAvailable = false;
    }

    if (!spotAvailable || spot <= 0) {
      return {
        underlying,
        spotPrice: 0,
        spotAvailable: false,
        expiry: '',
        contracts: [],
        recommendations: [],
        analyzedAt: new Date().toISOString(),
        available: false,
        providerStatus: 'unavailable',
        message: `Live spot unavailable for ${underlying}. Options scan needs market quotes.`
      };
    }

    const contracts = buildHeuristicContracts(underlying, spot, changePercent);
    const recommendations = contracts
      .filter((c) => c.signal === 'BUY')
      .sort((a, b) => b.confidence - a.confidence);

    return {
      underlying,
      spotPrice: spot,
      spotAvailable: true,
      expiry: nextWeeklyExpiry(),
      contracts,
      recommendations: recommendations.length ? recommendations : contracts.slice(0, 2),
      analyzedAt: new Date().toISOString(),
      available: true,
      providerStatus: 'heuristic',
      message:
        'Paper heuristic options signals from live spot/momentum. Not a live options chain (OI/IV from broker feed pending).'
    };
  }

  static async getOptionsSignals(underlyings: string[], userId?: string) {
    const results = await Promise.all(underlyings.map((u) => this.getOptionsChain(u, userId)));
    const available = results.some((r) => r.available);
    return {
      available,
      providerStatus: available ? ('heuristic' as const) : ('unavailable' as const),
      message: available
        ? 'Paper heuristic options signals from live spot/momentum.'
        : 'Options signals unavailable — could not load underlying spots.',
      signals: results.flatMap((r) => r.recommendations),
      chains: results
    };
  }
}
