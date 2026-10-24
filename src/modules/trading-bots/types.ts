export type BotStatus = 'RUNNING' | 'PAUSED' | 'STOPPED' | 'HALTED' | 'COOLDOWN';
export type DeskMode = 'PAPER' | 'LIVE';
export type BotState = 'NEUTRAL' | 'BULLISH' | 'BEARISH' | 'COOLDOWN' | 'HALTED';
export type StrategyKind =
  | 'sr_hedging'
  | 'breakout'
  | 'trend'
  | 'mean_reversion'
  | 'iron_condor'
  | 'custom';
export type SignalKind = 'RESISTANCE_BREAK' | 'SUPPORT_BREAK' | 'NONE';
export type SignalStatus =
  | 'WAITING'
  | 'WATCH'
  | 'CONFIRMED'
  | 'TRADE_ELIGIBLE'
  | 'REJECTED'
  | 'EXPIRED';
export type OrderState =
  | 'CREATED'
  | 'VALIDATING'
  | 'SUBMITTED'
  | 'PARTIAL'
  | 'FILLED'
  | 'REJECTED'
  | 'CANCELLED';
export type MarketRegime = 'TRENDING' | 'RANGE' | 'VOLATILE' | 'QUIET';

export interface Level {
  price: number;
  kind: 'support' | 'resistance';
  rank: 'primary' | 'secondary';
  method: string;
  confidence: number;
}

export interface BotConfig {
  version: number;
  name: string;
  underlying: string;
  timeframe: string;
  strategy: StrategyKind;
  srMethods: string[];
  atrPeriod: number;
  atrBuffer: number;
  vwapFilter: boolean;
  emaFilter: boolean;
  rsiFilter: boolean;
  volumeFilter: boolean;
  adxFilter: boolean;
  rsiBull: number;
  rsiBear: number;
  volumeMult: number;
  adxMin: number;
  confirmationScore: number;
  retestConfirmation: boolean;
  shortDeltaMin: number;
  shortDeltaMax: number;
  spreadWidth: number;
  dte: number;
  riskPct: number;
  profitTargetPct: number;
  stopLossPct: number;
  trailEnableAt: number;
  trailTightenAt: number;
  entryStart: string;
  lastEntry: string;
  exitTime: string;
  dailyLossLimitPct: number;
  maxOpenPositions: number;
  maxMarginUsagePct: number;
  maxConsecutiveLosses: number;
  capital: number;
}

export interface TradingBot {
  id: string;
  config: BotConfig;
  status: BotStatus;
  mode: DeskMode;
  state: BotState;
  todayPnl: number;
  totalPnl: number;
  winRate: number;
  trades: number;
  currentSignal: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
}

export interface ScoreBreakdown {
  label: string;
  points: number;
}

export interface LiveSignal {
  id: string;
  time: string;
  botId: string;
  underlying: string;
  spot: number;
  support: number;
  resistance: number;
  kind: SignalKind;
  score: number;
  strategy: string;
  expiry: string;
  shortStrike: number;
  hedgeStrike: number;
  risk: number;
  status: SignalStatus;
  breakdown: ScoreBreakdown[];
  rejectReason?: string;
  explanation: string;
}

export interface SpreadProposal {
  type: 'BULL_PUT' | 'BEAR_CALL';
  shortStrike: number;
  longStrike: number;
  expiry: string;
  netCredit: number;
  maxProfit: number;
  maxLoss: number;
  breakeven: number;
  riskReward: number;
  delta: number;
  theta: number;
  margin: number;
  probability: number;
  explanation: string;
}

export interface BotPosition {
  id: string;
  botId: string;
  underlying: string;
  strategy: string;
  expiry: string;
  shortStrike: number;
  longStrike: number;
  qty: number;
  entryCredit: number;
  currentSpread: number;
  pnl: number;
  pnlPct: number;
  delta: number;
  theta: number;
  maxRisk: number;
  status: string;
  mode: DeskMode;
}

export interface BotOrder {
  id: string;
  botId: string;
  time: string;
  legs: string;
  qty: number;
  state: OrderState;
  mode: DeskMode;
  note: string;
}

export interface JournalRow {
  id: string;
  bot: string;
  date: string;
  entryTime: string;
  exitTime: string;
  underlying: string;
  signal: string;
  score: number;
  regime: MarketRegime;
  support: number;
  resistance: number;
  strategy: string;
  expiry: string;
  shortStrike: number;
  longStrike: number;
  qty: number;
  credit: number;
  maxRisk: number;
  entryReason: string;
  exitReason: string;
  grossPnl: number;
  fees: number;
  netPnl: number;
  mfe: number;
  mae: number;
}

export interface BotAlert {
  id: string;
  time: string;
  type: string;
  message: string;
  severity: 'info' | 'warn' | 'crit';
}

export interface AuditEvent {
  id: string;
  time: string;
  action: string;
  detail: string;
}

export type TradingBotsPage =
  | 'dashboard'
  | 'my-bots'
  | 'create'
  | 'marketplace'
  | 'signals'
  | 'option-chain'
  | 'positions'
  | 'orders'
  | 'risk'
  | 'journal'
  | 'backtest'
  | 'analytics'
  | 'alerts'
  | 'brokers'
  | 'config'
  | 'bot-detail';
