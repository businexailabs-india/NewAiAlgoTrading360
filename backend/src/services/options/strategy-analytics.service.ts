/**
 * Multi-leg strategy analytics: payoff grid, BE, max P&L, margin estimate, liquidity score.
 */

export type StrategyLegInput = {
  side: 'BUY' | 'SELL';
  optionType: 'CE' | 'PE' | 'FUT';
  strike: number;
  premium: number;
  lots: number;
  lotSize: number;
  /** Optional liquidity proxy 0–100 */
  liquidityHint?: number;
};

export type PayoffPoint = { spot: number; pnl: number };

export type StrategyAnalytics = {
  netPremium: number; // credit positive / debit negative (per lot-set, total cash)
  maxProfit: number | null; // null = theoretically unlimited
  maxLoss: number | null;
  breakEvens: number[];
  marginEstimate: number;
  liquidityScore: number; // 0–100
  payoff: PayoffPoint[];
  legsSummary: Array<{
    side: string;
    optionType: string;
    strike: number;
    premium: number;
    quantity: number;
    signedPremium: number;
  }>;
};

function legPnlAtExpiry(
  spot: number,
  leg: StrategyLegInput
): number {
  const qty = leg.lots * leg.lotSize;
  const sign = leg.side === 'BUY' ? 1 : -1;
  let intrinsic = 0;
  if (leg.optionType === 'CE') intrinsic = Math.max(0, spot - leg.strike);
  else if (leg.optionType === 'PE') intrinsic = Math.max(0, leg.strike - spot);
  else intrinsic = spot; // FUT mark-to-spot approx; premium treated as entry
  if (leg.optionType === 'FUT') {
    // Fut P&L ≈ (spot - entry) * qty * side; entry stored as premium
    return (spot - leg.premium) * qty * (leg.side === 'BUY' ? 1 : -1);
  }
  // Options: BUY pays premium, SELL receives
  return sign * (intrinsic - leg.premium) * qty;
}

export function analyzeStrategy(
  legs: StrategyLegInput[],
  spotHint?: number
): StrategyAnalytics {
  if (!legs.length) {
    return {
      netPremium: 0,
      maxProfit: 0,
      maxLoss: 0,
      breakEvens: [],
      marginEstimate: 0,
      liquidityScore: 0,
      payoff: [],
      legsSummary: []
    };
  }

  const legsSummary = legs.map((leg) => {
    const quantity = leg.lots * leg.lotSize;
    const signedPremium =
      (leg.side === 'SELL' ? 1 : -1) * leg.premium * quantity;
    return {
      side: leg.side,
      optionType: leg.optionType,
      strike: leg.strike,
      premium: leg.premium,
      quantity,
      signedPremium
    };
  });

  const netPremium = Number(
    legsSummary.reduce((s, l) => s + l.signedPremium, 0).toFixed(2)
  );

  const strikes = legs.map((l) => l.strike).filter((s) => s > 0);
  const mid =
    spotHint && spotHint > 0
      ? spotHint
      : strikes.length
        ? strikes.reduce((a, b) => a + b, 0) / strikes.length
        : 100;
  const span = Math.max(mid * 0.15, 500);
  const step = Math.max(Math.round(span / 40 / 5) * 5, 5);
  const start = Math.max(0, Math.round((mid - span) / step) * step);
  const end = Math.round((mid + span) / step) * step;

  const payoff: PayoffPoint[] = [];
  for (let spot = start; spot <= end; spot += step) {
    const pnl = Number(
      legs.reduce((s, leg) => s + legPnlAtExpiry(spot, leg), 0).toFixed(2)
    );
    payoff.push({ spot, pnl });
  }

  let maxProfit: number | null = Math.max(...payoff.map((p) => p.pnl));
  let maxLoss: number | null = Math.min(...payoff.map((p) => p.pnl));

  // Unlimited detection: naked short CE/PE or long futures wings
  const hasNakedShortCall = legs.some(
    (l) => l.side === 'SELL' && l.optionType === 'CE' && !legs.some((x) => x.side === 'BUY' && x.optionType === 'CE' && x.strike >= l.strike)
  );
  const hasNakedShortPut = legs.some(
    (l) => l.side === 'SELL' && l.optionType === 'PE' && !legs.some((x) => x.side === 'BUY' && x.optionType === 'PE' && x.strike <= l.strike)
  );
  if (hasNakedShortCall) maxLoss = null; // upside unlimited risk for short call (approx)
  if (hasNakedShortPut && (maxLoss == null || true)) {
    /* short put risk is large but bounded by strike; keep numeric maxLoss from grid */
  }
  const longCallOnly =
    legs.every((l) => l.optionType === 'CE' && l.side === 'BUY') && legs.length >= 1;
  if (longCallOnly || legs.some((l) => l.side === 'BUY' && l.optionType === 'CE' && !legs.some((x) => x.side === 'SELL'))) {
    const onlyLongCalls = legs.filter((l) => l.optionType !== 'FUT').every((l) => l.side === 'BUY' && l.optionType === 'CE');
    if (onlyLongCalls) maxProfit = null;
  }

  // Break-evens: sign change in payoff
  const breakEvens: number[] = [];
  for (let i = 1; i < payoff.length; i++) {
    const a = payoff[i - 1];
    const b = payoff[i];
    if ((a.pnl <= 0 && b.pnl >= 0) || (a.pnl >= 0 && b.pnl <= 0)) {
      const t = Math.abs(b.pnl - a.pnl) < 1e-9 ? 0.5 : Math.abs(a.pnl) / Math.abs(b.pnl - a.pnl);
      breakEvens.push(Number((a.spot + (b.spot - a.spot) * t).toFixed(2)));
    }
  }

  // Rough margin: short premium * qty * 0.2 + span proxy
  const shortNotional = legs
    .filter((l) => l.side === 'SELL')
    .reduce((s, l) => s + l.premium * l.lots * l.lotSize, 0);
  const marginEstimate = Number(
    Math.max(shortNotional * 3, Math.abs(netPremium) * 0.2, mid * 0.05 * legs[0].lotSize * legs[0].lots).toFixed(2)
  );

  const liqScores = legs.map((l) =>
    l.liquidityHint != null
      ? l.liquidityHint
      : Math.max(10, 80 - Math.abs(l.strike - mid) / mid * 100)
  );
  const liquidityScore = Number(
    (liqScores.reduce((a, b) => a + b, 0) / liqScores.length).toFixed(1)
  );

  return {
    netPremium,
    maxProfit: maxProfit == null ? null : Number(maxProfit.toFixed(2)),
    maxLoss: maxLoss == null ? null : Number(maxLoss.toFixed(2)),
    breakEvens,
    marginEstimate,
    liquidityScore,
    payoff,
    legsSummary
  };
}

export const STRATEGY_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  build: (atm: number, step: number, premium: number) => StrategyLegInput[];
}> = [
  {
    id: 'long-straddle',
    name: 'Long Straddle',
    description: 'Buy ATM CE + PE',
    build: (atm, _step, p) => [
      { side: 'BUY', optionType: 'CE', strike: atm, premium: p, lots: 1, lotSize: 25 },
      { side: 'BUY', optionType: 'PE', strike: atm, premium: p, lots: 1, lotSize: 25 }
    ]
  },
  {
    id: 'long-strangle',
    name: 'Long Strangle',
    description: 'Buy OTM CE + PE',
    build: (atm, step, p) => [
      { side: 'BUY', optionType: 'CE', strike: atm + step, premium: p * 0.7, lots: 1, lotSize: 25 },
      { side: 'BUY', optionType: 'PE', strike: atm - step, premium: p * 0.7, lots: 1, lotSize: 25 }
    ]
  },
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread',
    description: 'Buy ATM CE, sell higher CE',
    build: (atm, step, p) => [
      { side: 'BUY', optionType: 'CE', strike: atm, premium: p, lots: 1, lotSize: 25 },
      { side: 'SELL', optionType: 'CE', strike: atm + step * 2, premium: p * 0.45, lots: 1, lotSize: 25 }
    ]
  },
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread',
    description: 'Buy ATM PE, sell lower PE',
    build: (atm, step, p) => [
      { side: 'BUY', optionType: 'PE', strike: atm, premium: p, lots: 1, lotSize: 25 },
      { side: 'SELL', optionType: 'PE', strike: atm - step * 2, premium: p * 0.45, lots: 1, lotSize: 25 }
    ]
  },
  {
    id: 'iron-condor',
    name: 'Iron Condor',
    description: 'Short strangle + wing hedges',
    build: (atm, step, p) => [
      { side: 'SELL', optionType: 'PE', strike: atm - step, premium: p * 0.5, lots: 1, lotSize: 25 },
      { side: 'BUY', optionType: 'PE', strike: atm - step * 3, premium: p * 0.2, lots: 1, lotSize: 25 },
      { side: 'SELL', optionType: 'CE', strike: atm + step, premium: p * 0.5, lots: 1, lotSize: 25 },
      { side: 'BUY', optionType: 'CE', strike: atm + step * 3, premium: p * 0.2, lots: 1, lotSize: 25 }
    ]
  }
];
