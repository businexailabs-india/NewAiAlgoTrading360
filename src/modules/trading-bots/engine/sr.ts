import type { Level } from '../types';
import { atr, ema, pivots, type Candle, vwap } from './market';

export interface SrBundle {
  primarySupport: Level;
  secondarySupport: Level;
  primaryResistance: Level;
  secondaryResistance: Level;
  all: Level[];
}

function lvl(
  price: number,
  kind: Level['kind'],
  rank: Level['rank'],
  method: string,
  confidence: number
): Level {
  return { price: Math.round(price * 20) / 20, kind, rank, method, confidence: Math.max(0, Math.min(100, Math.round(confidence))) };
}

export function computeSupportResistance(candles: Candle[], methods: string[]): SrBundle {
  const last = candles[candles.length - 1];
  const closes = candles.map((c) => c.c);
  const pv = pivots(candles);
  const vw = vwap(candles);
  const e20 = ema(closes, 20).at(-1) || last.c;
  const e50 = ema(closes, 50).at(-1) || last.c;
  const a = atr(candles, 14);

  const swingHigh = Math.max(...candles.slice(-24).map((c) => c.h));
  const swingLow = Math.min(...candles.slice(-24).map((c) => c.l));
  const orHigh = Math.max(...candles.slice(0, 6).map((c) => c.h));
  const orLow = Math.min(...candles.slice(0, 6).map((c) => c.l));

  const enabled = new Set(methods.length ? methods : ['swing', 'pdh_pdl', 'or', 'pivot', 'vwap', 'ema', 'atr']);

  const resistances: Level[] = [];
  const supports: Level[] = [];

  if (enabled.has('swing')) {
    resistances.push(lvl(swingHigh, 'resistance', 'primary', 'Swing High', 86));
    supports.push(lvl(swingLow, 'support', 'primary', 'Swing Low', 84));
  }
  if (enabled.has('pdh_pdl')) {
    resistances.push(lvl(pv.pdh, 'resistance', 'secondary', 'Previous Day High', 78));
    supports.push(lvl(pv.pdl, 'support', 'secondary', 'Previous Day Low', 76));
  }
  if (enabled.has('or')) {
    resistances.push(lvl(orHigh, 'resistance', 'secondary', 'Opening Range High', 72));
    supports.push(lvl(orLow, 'support', 'secondary', 'Opening Range Low', 70));
  }
  if (enabled.has('pivot')) {
    resistances.push(lvl(pv.r1, 'resistance', 'secondary', 'Pivot R1', 68));
    supports.push(lvl(pv.s1, 'support', 'secondary', 'Pivot S1', 67));
  }
  if (enabled.has('vwap')) {
    if (vw >= last.c) resistances.push(lvl(vw, 'resistance', 'secondary', 'VWAP', 74));
    else supports.push(lvl(vw, 'support', 'secondary', 'VWAP', 74));
  }
  if (enabled.has('ema')) {
    const band = Math.max(e20, e50);
    const floor = Math.min(e20, e50);
    if (band > last.c) resistances.push(lvl(band, 'resistance', 'secondary', 'EMA band', 62));
    if (floor < last.c) supports.push(lvl(floor, 'support', 'secondary', 'EMA band', 62));
  }
  if (enabled.has('atr')) {
    resistances.push(lvl(last.c + a * 1.5, 'resistance', 'secondary', 'ATR envelope', 55));
    supports.push(lvl(last.c - a * 1.5, 'support', 'secondary', 'ATR envelope', 55));
  }

  resistances.sort((a, b) => b.confidence - a.confidence);
  supports.sort((a, b) => b.confidence - a.confidence);

  const primaryResistance = resistances[0] || lvl(last.c + a, 'resistance', 'primary', 'Fallback', 50);
  const secondaryResistance = resistances[1] || lvl(last.c + a * 1.8, 'resistance', 'secondary', 'Fallback', 40);
  const primarySupport = supports[0] || lvl(last.c - a, 'support', 'primary', 'Fallback', 50);
  const secondarySupport = supports[1] || lvl(last.c - a * 1.8, 'support', 'secondary', 'Fallback', 40);

  return {
    primarySupport,
    secondarySupport,
    primaryResistance,
    secondaryResistance,
    all: [...resistances, ...supports]
  };
}
