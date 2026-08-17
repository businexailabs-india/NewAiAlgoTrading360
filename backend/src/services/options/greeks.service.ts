/** Black-Scholes greeks — model estimates; label as such in API responses. */

function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

function normPdf(x: number): number {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
}

export type GreeksResult = {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  model: 'black-scholes';
  estimate: boolean;
  broker?: boolean;
};

export function blackScholesGreeks(input: {
  spot: number;
  strike: number;
  timeYears: number;
  rate?: number;
  ivPct: number;
  optionType: 'CE' | 'PE';
}): GreeksResult {
  const S = input.spot;
  const K = input.strike;
  const T = Math.max(input.timeYears, 1 / (365 * 24));
  const r = input.rate ?? 0.065;
  const sigma = Math.max(input.ivPct, 1) / 100;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const delta =
    input.optionType === 'CE' ? normCdf(d1) : normCdf(d1) - 1;
  const gamma = normPdf(d1) / (S * sigma * sqrtT);
  const vega = (S * normPdf(d1) * sqrtT) / 100;
  const theta =
    input.optionType === 'CE'
      ? (-(S * normPdf(d1) * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCdf(d2)) / 365
      : (-(S * normPdf(d1) * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCdf(-d2)) / 365;

  return {
    delta: Number(delta.toFixed(4)),
    gamma: Number(gamma.toFixed(6)),
    theta: Number(theta.toFixed(4)),
    vega: Number(vega.toFixed(4)),
    iv: input.ivPct,
    model: 'black-scholes',
    estimate: true
  };
}

/** Black-Scholes theoretical option premium (INR). */
export function blackScholesPrice(input: {
  spot: number;
  strike: number;
  timeYears: number;
  rate?: number;
  ivPct: number;
  optionType: 'CE' | 'PE';
}): number {
  const S = input.spot;
  const K = input.strike;
  const T = Math.max(input.timeYears, 1 / (365 * 24));
  const r = input.rate ?? 0.065;
  const sigma = Math.max(input.ivPct, 1) / 100;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const disc = Math.exp(-r * T);
  const price =
    input.optionType === 'CE'
      ? S * normCdf(d1) - K * disc * normCdf(d2)
      : K * disc * normCdf(-d2) - S * normCdf(-d1);
  const intrinsic =
    input.optionType === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
  return Number(Math.max(price, intrinsic * 0.99, 0.05).toFixed(2));
}

/**
 * India index option IV proxy with mild skew.
 * Near-expiry weeklies use lower effective IV so OTM premiums stay realistic.
 */
export function estimateIndexOptionIv(
  spot: number,
  strike: number,
  daysToExpiry: number,
  optionType: 'CE' | 'PE'
): number {
  const dte = Math.max(daysToExpiry, 0.25);
  const m = (strike - spot) / Math.max(spot, 1);
  let iv = 12 + Math.min(10, Math.sqrt(dte) * 1.8);
  // Skew: OTM puts richer, OTM calls cheaper
  if (optionType === 'PE' && m < 0) iv += Math.min(8, Math.abs(m) * 80);
  if (optionType === 'CE' && m > 0) iv += Math.min(6, Math.abs(m) * 40);
  if (optionType === 'CE' && m < -0.005) iv -= Math.min(3, Math.abs(m) * 30);
  if (dte <= 2) iv = Math.max(9, iv - 2);
  return Number(Math.min(45, Math.max(8, iv)).toFixed(1));
}

export function daysToExpiry(expiry: Date, now = new Date()): number {
  return Math.max(0, (expiry.getTime() - now.getTime()) / 86400000);
}

/** Fraction of year to expiry; uses trading-day bias for short-dated weeklies. */
export function yearsToExpiry(expiryYmd: string | Date, now = new Date()): number {
  const exp =
    typeof expiryYmd === 'string' ? new Date(`${expiryYmd}T15:30:00+05:30`) : expiryYmd;
  const ms = exp.getTime() - now.getTime();
  // Floor at ~2 trading hours so same-day still has some premium
  const days = Math.max(ms / 86400000, 2 / 24);
  return days / 365;
}
