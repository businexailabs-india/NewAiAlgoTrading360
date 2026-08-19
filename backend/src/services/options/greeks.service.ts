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
  /** Dividend / yield. Index options default to q=r (futures-style forward = spot). */
  dividendYield?: number;
  ivPct: number;
  optionType: 'CE' | 'PE';
}): GreeksResult {
  const S = input.spot;
  const K = input.strike;
  const T = Math.max(input.timeYears, 1 / (365 * 24));
  const r = input.rate ?? 0.065;
  const q = input.dividendYield ?? r;
  const sigma = Math.max(input.ivPct, 1) / 100;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const dfQ = Math.exp(-q * T);
  const dfR = Math.exp(-r * T);

  const delta =
    input.optionType === 'CE' ? dfQ * normCdf(d1) : dfQ * (normCdf(d1) - 1);
  const gamma = (dfQ * normPdf(d1)) / (S * sigma * sqrtT);
  const vega = (S * dfQ * normPdf(d1) * sqrtT) / 100;
  const theta =
    input.optionType === 'CE'
      ? (-(S * dfQ * normPdf(d1) * sigma) / (2 * sqrtT) +
          q * S * dfQ * normCdf(d1) -
          r * K * dfR * normCdf(d2)) /
        365
      : (-(S * dfQ * normPdf(d1) * sigma) / (2 * sqrtT) -
          q * S * dfQ * normCdf(-d1) +
          r * K * dfR * normCdf(-d2)) /
        365;

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

/** Black-Scholes theoretical option premium (INR). Index defaults: q=r (futures-style). */
export function blackScholesPrice(input: {
  spot: number;
  strike: number;
  timeYears: number;
  rate?: number;
  dividendYield?: number;
  ivPct: number;
  optionType: 'CE' | 'PE';
}): number {
  const S = input.spot;
  const K = input.strike;
  const T = Math.max(input.timeYears, 1 / (365 * 24));
  const r = input.rate ?? 0.065;
  const q = input.dividendYield ?? r;
  const sigma = Math.max(input.ivPct, 1) / 100;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const dfQ = Math.exp(-q * T);
  const dfR = Math.exp(-r * T);
  const price =
    input.optionType === 'CE'
      ? S * dfQ * normCdf(d1) - K * dfR * normCdf(d2)
      : K * dfR * normCdf(-d2) - S * dfQ * normCdf(-d1);
  const intrinsic =
    input.optionType === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
  return Number(Math.max(price, intrinsic * 0.99, 0.05).toFixed(2));
}

/**
 * India index option IV proxy with mild skew.
 * Short-dated ATM often prints ~6–8% in calm tape (≈0.55–0.7× India VIX), not raw VIX.
 * Combined with futures-style BS (q=r), this tracks NSE weeklies (~₹80–90 ATM) instead of ~₹150+.
 */
export function estimateIndexOptionIv(
  spot: number,
  strike: number,
  daysToExpiry: number,
  optionType: 'CE' | 'PE',
  opts?: { indiaVix?: number | null }
): number {
  const dte = Math.max(daysToExpiry, 0.25);
  const m = (strike - spot) / Math.max(spot, 1);

  const vix =
    opts?.indiaVix != null && Number.isFinite(opts.indiaVix) && opts.indiaVix > 0
      ? Number(opts.indiaVix)
      : null;

  // Calm near-dated ATM ≈ 0.5–0.6× VIX; without VIX use ~6.0% base → ~₹80–90 ATM weeklies
  let iv = vix != null ? Math.max(5.2, vix * 0.52) : 6.0;
  // Mild term structure (farther expiries a bit richer)
  iv += Math.min(2.2, Math.sqrt(dte) * 0.3);

  // Skew: OTM puts richer, far OTM calls a bit richer; ITM calls slightly cheaper IV
  if (optionType === 'PE' && m < 0) iv += Math.min(5, Math.abs(m) * 65);
  if (optionType === 'CE' && m > 0.004) iv += Math.min(3.5, Math.abs(m) * 30);
  if (optionType === 'CE' && m < -0.004) iv -= Math.min(2, Math.abs(m) * 20);

  if (dte <= 3) iv = Math.max(5.5, iv - 0.8);
  if (dte <= 1) iv = Math.max(5, iv - 0.8);

  return Number(Math.min(38, Math.max(5, iv)).toFixed(1));
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
