export type MaTradingMode = 'signal' | 'simulated' | 'broker_paper';
export type MaDataSource = 'DEMO' | 'SIMULATED' | 'BROKER_PAPER' | 'TV_BACKTEST';
export type MaRole = 'owner' | 'admin' | 'trader' | 'viewer';

export interface MaConfig {
  tradingMode: MaTradingMode;
  enablePaperOrders: boolean;
  paperOrderConfirmation: boolean;
  maxCapitalDeploymentPct: number;
  riskPerTradePct: number;
  maxTradesPerDay: number;
  dailyLossLimitPct: number;
  weeklyLossLimitPct: number;
  drawdownReduceRiskPct: number;
  drawdownPausePct: number;
  rewardRiskRatio: number;
  atrStopMultiplier: number;
  maxDataAgeSeconds: number;
  positionSizeUpdate: 'monthly' | 'daily';
  allowShorts: boolean;
  estimatedCommissionPerShare: number;
  estimatedSlippagePerShare: number;
  maxAlertAgeSeconds: number;
  startingEquity: number;
  useMemoryStore: boolean;
  ibkrHost: string;
  ibkrPaperPort: number;
  ibkrClientId: number;
  ibkrPaperAccountId: string;
}

export function loadMaConfig(env: NodeJS.ProcessEnv = process.env): MaConfig {
  const flag = (v: string | undefined) => String(v || 'NO').trim().toUpperCase() === 'YES';
  const mode = String(env.TRADING_MODE || 'signal').toLowerCase() as MaTradingMode;
  if (!['signal', 'simulated', 'broker_paper'].includes(mode)) {
    throw new Error(`Invalid TRADING_MODE: ${mode}`);
  }
  const port = Number(env.IBKR_PAPER_PORT || 7497);
  if (![7497, 4002].includes(port)) {
    // Documented allowed paper ports; still load but mark unsafe for IBKR submits
  }
  return {
    tradingMode: mode,
    enablePaperOrders: flag(env.ENABLE_PAPER_ORDERS),
    paperOrderConfirmation: flag(env.PAPER_ORDER_CONFIRMATION),
    maxCapitalDeploymentPct: Number(env.MAX_CAPITAL_DEPLOYMENT_PCT || 0.9),
    riskPerTradePct: Number(env.RISK_PER_TRADE_PCT || 0.0025),
    maxTradesPerDay: Number(env.MAX_TRADES_PER_DAY || 2),
    dailyLossLimitPct: Number(env.DAILY_LOSS_LIMIT_PCT || 0.0075),
    weeklyLossLimitPct: Number(env.WEEKLY_LOSS_LIMIT_PCT || 0.02),
    drawdownReduceRiskPct: Number(env.DRAWDOWN_REDUCE_RISK_PCT || 0.05),
    drawdownPausePct: Number(env.DRAWDOWN_PAUSE_PCT || 0.1),
    rewardRiskRatio: Number(env.REWARD_RISK_RATIO || 1.5),
    atrStopMultiplier: Number(env.ATR_STOP_MULTIPLIER || 1.0),
    maxDataAgeSeconds: Number(env.MAX_DATA_AGE_SECONDS || 30),
    positionSizeUpdate: (env.POSITION_SIZE_UPDATE as 'monthly' | 'daily') || 'monthly',
    allowShorts: String(env.ALLOW_SHORTS || 'false').toLowerCase() === 'true',
    estimatedCommissionPerShare: Number(env.ESTIMATED_COMMISSION_PER_SHARE || 0.005),
    estimatedSlippagePerShare: Number(env.ESTIMATED_SLIPPAGE_PER_SHARE || 0.01),
    maxAlertAgeSeconds: Number(env.TRADINGVIEW_MAX_ALERT_AGE_SECONDS || 60),
    startingEquity: Number(env.STARTING_EQUITY || 2400),
    useMemoryStore: String(env.MA_USE_MEMORY_STORE || 'true').toLowerCase() !== 'false',
    ibkrHost: env.IBKR_HOST || '127.0.0.1',
    ibkrPaperPort: port,
    ibkrClientId: Number(env.IBKR_CLIENT_ID || 17),
    ibkrPaperAccountId: (env.IBKR_PAPER_ACCOUNT_ID || '').trim(),
  };
}

export function canSubmitPaperOrders(cfg: MaConfig): boolean {
  return (
    !isSignalOnly(cfg) &&
    cfg.enablePaperOrders &&
    cfg.paperOrderConfirmation &&
    (cfg.tradingMode === 'simulated' || cfg.tradingMode === 'broker_paper')
  );
}

export function isSignalOnly(cfg: MaConfig): boolean {
  return cfg.tradingMode === 'signal' || (!cfg.enablePaperOrders && !cfg.paperOrderConfirmation);
}
