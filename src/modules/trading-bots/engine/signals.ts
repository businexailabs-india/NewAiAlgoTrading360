import type { BotConfig, ScoreBreakdown, SignalKind } from '../types';
import { adxProxy, atr, ema, rsi, type Candle, vwap } from './market';
import type { SrBundle } from './sr';

export interface BreakoutEval {
  kind: SignalKind;
  score: number;
  breakdown: ScoreBreakdown[];
  eligible: boolean;
  explanation: string;
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function evaluateBreakout(candles: Candle[], sr: SrBundle, cfg: BotConfig): BreakoutEval {
  const last = candles[candles.length - 1];
  const closes = candles.map((c) => c.c);
  const volumes = candles.map((c) => c.v);
  const a = atr(candles, cfg.atrPeriod);
  const buffer = cfg.atrBuffer * a;
  const vw = vwap(candles);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const r = rsi(closes, 14);
  const adx = adxProxy(candles);
  const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / Math.max(1, Math.min(20, volumes.length));
  const body = Math.abs(last.c - last.o);
  const range = Math.max(last.h - last.l, 1e-6);
  const strength = body / range;
  const e20n = e20.at(-1) || last.c;
  const e50n = e50.at(-1) || last.c;

  const bullClose = last.c > sr.primaryResistance.price + buffer;
  const bearClose = last.c < sr.primarySupport.price - buffer;

  const bull: ScoreBreakdown[] = [
    { label: 'Resistance break close + ATR buffer', points: bullClose ? 25 : 0 },
    { label: 'Price > VWAP', points: cfg.vwapFilter && last.c > vw ? 15 : cfg.vwapFilter ? 0 : 8 },
    { label: 'EMA20 > EMA50', points: cfg.emaFilter && e20n > e50n ? 10 : cfg.emaFilter ? 0 : 5 },
    { label: `RSI > ${cfg.rsiBull}`, points: cfg.rsiFilter && r > cfg.rsiBull ? 8 : cfg.rsiFilter ? 0 : 4 },
    { label: `Volume > ${cfg.volumeMult}× avg`, points: cfg.volumeFilter && last.v > avgVol * cfg.volumeMult ? 12 : cfg.volumeFilter ? 0 : 6 },
    { label: `ADX > ${cfg.adxMin}`, points: cfg.adxFilter && adx > cfg.adxMin ? 10 : cfg.adxFilter ? 0 : 5 },
    { label: 'Breakout candle strength', points: strength > 0.55 ? 10 : strength > 0.35 ? 5 : 0 },
    { label: 'Optional retest', points: cfg.retestConfirmation ? 0 : 10 }
  ];

  const bear: ScoreBreakdown[] = [
    { label: 'Support breakdown close − ATR buffer', points: bearClose ? 25 : 0 },
    { label: 'Price < VWAP', points: cfg.vwapFilter && last.c < vw ? 15 : cfg.vwapFilter ? 0 : 8 },
    { label: 'EMA20 < EMA50', points: cfg.emaFilter && e20n < e50n ? 10 : cfg.emaFilter ? 0 : 5 },
    { label: `RSI < ${cfg.rsiBear}`, points: cfg.rsiFilter && r < cfg.rsiBear ? 8 : cfg.rsiFilter ? 0 : 4 },
    { label: `Volume > ${cfg.volumeMult}× avg`, points: cfg.volumeFilter && last.v > avgVol * cfg.volumeMult ? 12 : cfg.volumeFilter ? 0 : 6 },
    { label: `ADX > ${cfg.adxMin}`, points: cfg.adxFilter && adx > cfg.adxMin ? 10 : cfg.adxFilter ? 0 : 5 },
    { label: 'Breakdown candle strength', points: strength > 0.55 ? 10 : strength > 0.35 ? 5 : 0 },
    { label: 'Optional retest rejection', points: cfg.retestConfirmation ? 0 : 10 }
  ];

  const bullScore = clamp(bull.reduce((s, x) => s + x.points, 0));
  const bearScore = clamp(bear.reduce((s, x) => s + x.points, 0));

  if (bullScore >= bearScore && bullScore >= 40) {
    const eligible = bullScore >= cfg.confirmationScore && bullClose;
    return {
      kind: 'RESISTANCE_BREAK',
      score: bullScore,
      breakdown: bull,
      eligible,
      explanation: eligible
        ? `BULLISH BREAKOUT CONFIRMED (${bullScore}/100). Prepare Bull Put Spread.`
        : `WATCH / REJECTED — score ${bullScore} vs threshold ${cfg.confirmationScore}, close-above-buffer=${bullClose}.`
    };
  }
  if (bearScore >= 40) {
    const eligible = bearScore >= cfg.confirmationScore && bearClose;
    return {
      kind: 'SUPPORT_BREAK',
      score: bearScore,
      breakdown: bear,
      eligible,
      explanation: eligible
        ? `BEARISH BREAKDOWN CONFIRMED (${bearScore}/100). Prepare Bear Call Spread.`
        : `WATCH / REJECTED — score ${bearScore} vs threshold ${cfg.confirmationScore}, close-below-buffer=${bearClose}.`
    };
  }
  return {
    kind: 'NONE',
    score: Math.max(bullScore, bearScore),
    breakdown: bullScore >= bearScore ? bull : bear,
    eligible: false,
    explanation: 'NO TRADE — no confirmed breakout or breakdown.'
  };
}
