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
  estimate: true;
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
  const T = Math.max(input.timeYears, 1 / 365);
  const r = input.rate ?? 0.06;
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

export function daysToExpiry(expiry: Date, now = new Date()): number {
  return Math.max(0, (expiry.getTime() - now.getTime()) / 86400000);
}
