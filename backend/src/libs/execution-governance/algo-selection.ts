export const BEGINNER_BLOCKED_ALGOS = [
  'short_straddle',
  'short_strangle',
  'naked_options',
  'heavy_leverage',
  'hft_scalping',
  'martingale',
  'double_after_loss'
] as const;

export const BEGINNER_ALLOWED_ALGOS = [
  { id: 'tradingview_alert_to_paper', name: 'TradingView Alert → Paper', scoreBase: 88 },
  { id: 'vwap_intraday', name: 'VWAP Intraday', scoreBase: 80 },
  { id: 'rsi_mean_reversion', name: 'RSI Mean Reversion', scoreBase: 82 },
  { id: 'moving_average_crossover', name: 'Moving Average Crossover', scoreBase: 78 },
  { id: 'supertrend', name: 'Supertrend', scoreBase: 76 },
  { id: 'opening_range_breakout', name: 'Opening Range Breakout', scoreBase: 74 },
  { id: 'long_call_limited_premium', name: 'Long Call (Limited Premium)', scoreBase: 70 },
  { id: 'long_put_limited_premium', name: 'Long Put (Limited Premium)', scoreBase: 70 },
  { id: 'portfolio_rebalancing', name: 'Portfolio Rebalancing', scoreBase: 85 }
] as const;

export interface SuitabilityInput {
  algoId: string;
  algoName: string;
  scoreBase: number;
  riskProfile?: string; // beginner | moderate | aggressive
  capitalAmount?: number;
  marketCondition?: string; // sideways | trending | volatile
  instrumentType?: string;
  paperTradesCount?: number;
  paperDays?: number;
  hasStopLoss?: boolean;
}

export function scoreAlgo(input: SuitabilityInput) {
  const profile = (input.riskProfile || 'moderate').toLowerCase();
  let userRiskFit = profile === 'beginner' ? 70 : profile === 'aggressive' ? 60 : 80;
  let capitalFit = (input.capitalAmount || 100000) >= 50000 ? 85 : 65;
  let marketFit =
    input.marketCondition === 'volatile' ? 55 : input.marketCondition === 'trending' ? 80 : 75;
  let assetFit = input.instrumentType === 'INDEX' ? 40 : 85;
  let brokerFit = 80;
  let paperTestScore = Math.min(
    100,
    ((input.paperTradesCount || 0) >= 5 ? 50 : (input.paperTradesCount || 0) * 8) +
      ((input.paperDays || 0) >= 3 ? 50 : (input.paperDays || 0) * 12)
  );
  let liquidityFit = 80;
  let volatilityPenalty = input.marketCondition === 'volatile' ? 12 : 4;
  let drawdownPenalty = profile === 'beginner' ? 8 : 5;
  let complexityPenalty = input.algoId.includes('option') ? 10 : 3;

  if (BEGINNER_BLOCKED_ALGOS.includes(input.algoId as (typeof BEGINNER_BLOCKED_ALGOS)[number])) {
    return {
      algo_id: input.algoId,
      name: input.algoName,
      total_score: 0,
      recommendation_status: 'BLOCKED' as const,
      allowed_mode: 'PAPER_ONLY' as const,
      explanation: 'Algo blocked for beginner/moderate risk policy (no martingale/naked options/HFT).',
      user_risk_fit: 0,
      capital_fit: capitalFit,
      market_condition_fit: marketFit,
      asset_fit: assetFit,
      broker_capability_fit: brokerFit,
      paper_test_score: paperTestScore,
      liquidity_fit: liquidityFit,
      volatility_penalty: volatilityPenalty,
      drawdown_penalty: drawdownPenalty,
      complexity_penalty: complexityPenalty
    };
  }

  const total = Math.max(
    0,
    Math.min(
      100,
      input.scoreBase * 0.35 +
        userRiskFit * 0.15 +
        capitalFit * 0.1 +
        marketFit * 0.1 +
        assetFit * 0.05 +
        brokerFit * 0.05 +
        paperTestScore * 0.1 +
        liquidityFit * 0.05 -
        volatilityPenalty -
        drawdownPenalty -
        complexityPenalty
    )
  );

  const paperRequired = paperTestScore < 80 || !input.hasStopLoss;
  let status: 'RECOMMENDED' | 'WATCHLIST' | 'LOCKED' | 'BLOCKED' = 'RECOMMENDED';
  if (total < 50) status = 'LOCKED';
  else if (total < 65) status = 'WATCHLIST';

  return {
    algo_id: input.algoId,
    name: input.algoName,
    total_score: Math.round(total * 10) / 10,
    recommendation_status: status,
    allowed_mode: paperRequired || profile === 'beginner' ? ('PAPER_ONLY' as const) : ('PAPER_OR_APPROVED_LIVE' as const),
    explanation: `User risk profile is ${profile}, market is ${input.marketCondition || 'sideways'}, and strategy has acceptable drawdown.`,
    user_risk_fit: userRiskFit,
    capital_fit: capitalFit,
    market_condition_fit: marketFit,
    asset_fit: assetFit,
    broker_capability_fit: brokerFit,
    paper_test_score: paperTestScore,
    liquidity_fit: liquidityFit,
    volatility_penalty: volatilityPenalty,
    drawdown_penalty: drawdownPenalty,
    complexity_penalty: complexityPenalty,
    paper_test_required: paperRequired,
    approval_required: true
  };
}

export function recommendAlgos(opts: {
  riskProfile?: string;
  capitalAmount?: number;
  marketCondition?: string;
  instrumentType?: string;
  paperTradesCount?: number;
  paperDays?: number;
  hasStopLoss?: boolean;
  preferredAlgoId?: string;
}) {
  const scored = BEGINNER_ALLOWED_ALGOS.map((a) =>
    scoreAlgo({
      algoId: a.id,
      algoName: a.name,
      scoreBase: a.scoreBase,
      ...opts
    })
  ).sort((a, b) => b.total_score - a.total_score);

  const blocked = BEGINNER_BLOCKED_ALGOS.map((id) =>
    scoreAlgo({
      algoId: id,
      algoName: id,
      scoreBase: 0,
      ...opts
    })
  );

  const top = opts.preferredAlgoId
    ? scored.find((s) => s.algo_id === opts.preferredAlgoId) || scored[0]
    : scored[0];

  return {
    recommended: scored.filter((s) => s.recommendation_status === 'RECOMMENDED'),
    watchlist: scored.filter((s) => s.recommendation_status === 'WATCHLIST'),
    locked: scored.filter((s) => s.recommendation_status === 'LOCKED'),
    blocked,
    top,
    decision: 'RECOMMENDED' as const,
    algo: top?.name,
    score: top?.total_score,
    allowed_mode: top?.allowed_mode,
    approval_required: true,
    paper_test_required: top?.paper_test_required ?? true,
    reason: top?.explanation
  };
}
