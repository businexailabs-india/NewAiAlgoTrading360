export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

function hash(n: number) {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

/** Deterministic 5-minute session candles around a spot (paper / demo feed). */
export function buildSessionCandles(spot: number, bars = 78, seed = 7): Candle[] {
  const out: Candle[] = [];
  let px = spot * 0.992;
  const now = Date.now();
  const start = now - bars * 5 * 60 * 1000;
  for (let i = 0; i < bars; i++) {
    const drift = (hash(seed + i) - 0.48) * spot * 0.0018;
    const vol = spot * 0.0009 * (0.6 + hash(seed * 3 + i));
    const o = px;
    const c = Math.max(10, o + drift);
    const h = Math.max(o, c) + vol;
    const l = Math.min(o, c) - vol;
    const v = 80_000 + Math.floor(hash(seed + i * 9) * 220_000);
    out.push({ t: start + i * 5 * 60 * 1000, o, h, l, c, v });
    px = c;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] || 0;
  for (let i = 0; i < values.length; i++) {
    prev = i === 0 ? values[i] : values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function sma(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function atr(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const p = candles[i - 1];
    const c = candles[i];
    trs.push(Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c)));
  }
  return sma(trs, Math.min(period, trs.length));
}

export function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / loss;
  return 100 - 100 / (1 + rs);
}

export function vwap(candles: Candle[]): number {
  let pv = 0;
  let vol = 0;
  for (const c of candles) {
    const tp = (c.h + c.l + c.c) / 3;
    pv += tp * c.v;
    vol += c.v;
  }
  return vol ? pv / vol : candles[candles.length - 1]?.c || 0;
}

export function adxProxy(candles: Candle[]): number {
  if (candles.length < 16) return 18;
  const closes = candles.map((c) => c.c);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const last = closes.length - 1;
  const sep = Math.abs(e20[last] - e50[last]) / (closes[last] || 1);
  return Math.min(60, Math.max(8, sep * 8000));
}

export function pivots(candles: Candle[]) {
  const d = candles[candles.length - 1];
  const prev = candles[Math.max(0, candles.length - 2)];
  const high = prev.h;
  const low = prev.l;
  const close = prev.c;
  const p = (high + low + close) / 3;
  return {
    pp: p,
    r1: 2 * p - low,
    s1: 2 * p - high,
    r2: p + (high - low),
    s2: p - (high - low),
    pdh: high,
    pdl: low,
    open: candles[0]?.o || d.o
  };
}
