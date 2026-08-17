import { MarketService } from './market.service';
import { generateWeeklyExpiries } from '../libs/trading/fo-expiry-calendar';
import {
  blackScholesPrice,
  estimateIndexOptionIv,
  yearsToExpiry,
  daysToExpiry
} from './options/greeks.service';

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

function nextWeeklyExpiry(underlying = 'NIFTY'): string {
  return generateWeeklyExpiries(underlying, 1)[0]?.date || new Date().toISOString().slice(0, 10);
}

function strikeStep(underlying: string, spot: number): number {
  if (underlying === 'NIFTY') return 50;
  if (underlying === 'BANKNIFTY') return 100;
  if (underlying === 'FINNIFTY') return 50;
  if (underlying === 'MIDCPNIFTY') return 25;
  if (underlying === 'SENSEX' || underlying === 'BANKEX') return 100;
  if (spot >= 5000) return 100;
  if (spot >= 1000) return 50;
  if (spot >= 200) return 10;
  return 5;
}

function roundStrike(spot: number, step: number): number {
  return Math.round(spot / step) * step;
}

function estimatePremium(
  spot: number,
  strike: number,
  optionType: 'CE' | 'PE',
  expiry: string
): { ltp: number; iv: number } {
  const dte = daysToExpiry(new Date(`${expiry}T15:30:00+05:30`));
  const iv = estimateIndexOptionIv(spot, strike, dte, optionType);
  const ltp = blackScholesPrice({
    spot,
    strike,
    timeYears: yearsToExpiry(expiry),
    ivPct: iv,
    optionType
  });
  return { ltp, iv };
}

function buildHeuristicContracts(
  underlying: string,
  spot: number,
  changePercent: number,
  opts?: { expiry?: string; strikeCount?: number }
): OptionContract[] {
  const step = strikeStep(underlying, spot);
  const atm = roundStrike(spot, step);
  const expiry = opts?.expiry || nextWeeklyExpiry(underlying);
  const half = Math.max(4, Math.floor(((opts?.strikeCount || 41) - 1) / 2));
  const bullish = changePercent >= 0.35;
  const bearish = changePercent <= -0.35;

  const strikes: number[] = [];
  for (let i = -half; i <= half; i++) {
    const s = atm + i * step;
    if (s > 0) strikes.push(s);
  }

  const contracts: OptionContract[] = [];
  for (const strike of strikes) {
    for (const optionType of ['CE', 'PE'] as const) {
      const { ltp, iv } = estimatePremium(spot, strike, optionType, expiry);
      const isAtm = strike === atm;
      let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
      let strategy = `${optionType} ${strike}`;
      let confidence = 45;
      let reason = `${underlying} ${optionType} ${strike} exp ${expiry} (BS model).`;

      if (isAtm && optionType === 'CE') {
        strategy = bullish ? 'ATM Call Momentum' : 'ATM Call Hedge Watch';
        signal = bullish ? 'BUY' : bearish ? 'SELL' : 'HOLD';
        confidence = Math.min(88, Math.max(45, 55 + Math.abs(changePercent) * 8));
        reason = `${underlying} spot ${spot.toFixed(2)} (${changePercent.toFixed(2)}%) — ATM CE paper watch.`;
      } else if (isAtm && optionType === 'PE') {
        strategy = bearish ? 'ATM Put Momentum' : 'ATM Put Hedge';
        signal = bearish ? 'BUY' : bullish ? 'HOLD' : 'BUY';
        confidence = Math.min(86, Math.max(42, 52 + Math.abs(changePercent) * 7));
        reason = `${underlying} spot ${spot.toFixed(2)} — ATM PE paper watch.`;
      }

      contracts.push({
        symbol: `${underlying}${strike}${optionType}`,
        underlying,
        strike,
        expiry,
        optionType,
        ltp,
        change: Number((ltp * (changePercent / 100)).toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        oi: 0,
        iv,
        signal,
        strategy,
        confidence: Number(confidence.toFixed(0)),
        reason
      });
    }
  }
  return contracts;
}

export class OptionsService {
  static async getOptionsChain(
    underlying: string,
    userId?: string,
    opts?: { expiry?: string; strikeCount?: number }
  ): Promise<OptionsChainResult> {
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
        expiry: opts?.expiry || '',
        contracts: [],
        recommendations: [],
        analyzedAt: new Date().toISOString(),
        available: false,
        providerStatus: 'unavailable',
        message: `Live spot unavailable for ${underlying}. Options scan needs market quotes.`
      };
    }

    const expiry = opts?.expiry || nextWeeklyExpiry(underlying);
    const contracts = buildHeuristicContracts(underlying, spot, changePercent, {
      expiry,
      strikeCount: opts?.strikeCount || 41
    });
    const recommendations = contracts
      .filter((c) => c.signal === 'BUY')
      .sort((a, b) => b.confidence - a.confidence);

    return {
      underlying,
      spotPrice: spot,
      spotAvailable: true,
      expiry,
      contracts,
      recommendations: recommendations.length ? recommendations : contracts.slice(0, 2),
      analyzedAt: new Date().toISOString(),
      available: true,
      providerStatus: 'heuristic',
      message:
        'Paper heuristic options chain from live spot. Sync instrument master for broker expiries/LTP.'
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
