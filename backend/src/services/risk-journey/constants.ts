/** ₹1,00,000 Capital Risk Journey — defaults & algo catalogs */

export const ONE_LAKH = 100_000;

export const ONE_LAKH_DEFAULT_POLICY = {
  live_trading_enabled: false,
  paper_trading_enabled: true,
  daily_profit_target_min: 300,
  daily_profit_target_max: 700,
  max_daily_loss: 1000,
  max_risk_per_trade: 300,
  max_trades_per_day: 5,
  stop_after_consecutive_losses: 2,
  options_selling_enabled: false,
  naked_options_blocked: true,
  leverage_limited: true,
  kill_switch_enabled: true
} as const;

export const ALLOWED_ALGOS_1L = [
  'VWAP Intraday',
  'RSI Mean Reversion',
  'Moving Average Crossover',
  'Opening Range Breakout with stop-loss',
  'Long Call / Long Put limited premium',
  'Portfolio Rebalancing',
  'TradingView Alert-to-Paper'
] as const;

export const LOCKED_ALGOS_1L = [
  'Short Straddle',
  'Short Strangle',
  'Naked Options',
  'High-Frequency Scalping',
  'Martingale',
  'Double-after-loss',
  'Heavy leverage'
] as const;

export type CatalogAlgo = {
  id: string;
  name: string;
  type: string;
  complexity: number; // 0-1 higher = harder
  riskLevel: number; // 0-1
  capitalMin: number;
  requiresStopLoss: boolean;
  optionsSelling: boolean;
  naked: boolean;
  leverageHeavy: boolean;
  martingale: boolean;
};

export const ALGO_CATALOG: CatalogAlgo[] = [
  {
    id: 'vwap-intraday',
    name: 'VWAP Intraday',
    type: 'intraday',
    complexity: 0.35,
    riskLevel: 0.4,
    capitalMin: 50000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: false,
    martingale: false
  },
  {
    id: 'rsi-mean-reversion',
    name: 'RSI Mean Reversion',
    type: 'mean_reversion',
    complexity: 0.3,
    riskLevel: 0.35,
    capitalMin: 25000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: false,
    martingale: false
  },
  {
    id: 'ma-crossover',
    name: 'Moving Average Crossover',
    type: 'trend',
    complexity: 0.25,
    riskLevel: 0.3,
    capitalMin: 25000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: false,
    martingale: false
  },
  {
    id: 'orb-sl',
    name: 'Opening Range Breakout with stop-loss',
    type: 'breakout',
    complexity: 0.4,
    riskLevel: 0.45,
    capitalMin: 50000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: false,
    martingale: false
  },
  {
    id: 'long-option-premium',
    name: 'Long Call / Long Put limited premium',
    type: 'options_buy',
    complexity: 0.5,
    riskLevel: 0.55,
    capitalMin: 50000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: false,
    martingale: false
  },
  {
    id: 'portfolio-rebalance',
    name: 'Portfolio Rebalancing',
    type: 'portfolio',
    complexity: 0.2,
    riskLevel: 0.2,
    capitalMin: 100000,
    requiresStopLoss: false,
    optionsSelling: false,
    naked: false,
    leverageHeavy: false,
    martingale: false
  },
  {
    id: 'tv-alert-paper',
    name: 'TradingView Alert-to-Paper',
    type: 'alert',
    complexity: 0.25,
    riskLevel: 0.3,
    capitalMin: 25000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: false,
    martingale: false
  },
  {
    id: 'short-straddle',
    name: 'Short Straddle',
    type: 'options_sell',
    complexity: 0.85,
    riskLevel: 0.95,
    capitalMin: 200000,
    requiresStopLoss: true,
    optionsSelling: true,
    naked: true,
    leverageHeavy: true,
    martingale: false
  },
  {
    id: 'short-strangle',
    name: 'Short Strangle',
    type: 'options_sell',
    complexity: 0.8,
    riskLevel: 0.9,
    capitalMin: 200000,
    requiresStopLoss: true,
    optionsSelling: true,
    naked: true,
    leverageHeavy: true,
    martingale: false
  },
  {
    id: 'naked-options',
    name: 'Naked Options',
    type: 'options_sell',
    complexity: 0.9,
    riskLevel: 1,
    capitalMin: 300000,
    requiresStopLoss: true,
    optionsSelling: true,
    naked: true,
    leverageHeavy: true,
    martingale: false
  },
  {
    id: 'hf-scalping',
    name: 'High-Frequency Scalping',
    type: 'scalping',
    complexity: 0.75,
    riskLevel: 0.8,
    capitalMin: 150000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: true,
    martingale: false
  },
  {
    id: 'martingale',
    name: 'Martingale',
    type: 'martingale',
    complexity: 0.7,
    riskLevel: 1,
    capitalMin: 200000,
    requiresStopLoss: false,
    optionsSelling: false,
    naked: false,
    leverageHeavy: true,
    martingale: true
  },
  {
    id: 'double-after-loss',
    name: 'Double-after-loss',
    type: 'martingale',
    complexity: 0.65,
    riskLevel: 1,
    capitalMin: 150000,
    requiresStopLoss: false,
    optionsSelling: false,
    naked: false,
    leverageHeavy: true,
    martingale: true
  },
  {
    id: 'heavy-leverage',
    name: 'Heavy leverage',
    type: 'leverage',
    complexity: 0.7,
    riskLevel: 0.95,
    capitalMin: 250000,
    requiresStopLoss: true,
    optionsSelling: false,
    naked: false,
    leverageHeavy: true,
    martingale: false
  }
];

export const PAPER_TEST_RULES = {
  minPaperTrades: 5,
  minPaperDays: 3,
  maxDrawdownPctForUnlock: 5 // % of capital
} as const;

export function todayDateOnly(d = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function midDailyTarget(min: number, max: number): number {
  return Math.round((min + max) / 2);
}
