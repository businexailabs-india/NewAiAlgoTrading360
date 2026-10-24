import type { BotAlert, BotConfig, BotOrder, BotPosition, JournalRow, LiveSignal, TradingBot } from './types';

export function defaultConfig(partial: Partial<BotConfig> & Pick<BotConfig, 'name' | 'underlying' | 'strategy'>): BotConfig {
  return {
    version: 1,
    timeframe: '5m',
    srMethods: ['swing', 'pdh_pdl', 'or', 'pivot', 'vwap', 'ema', 'atr'],
    atrPeriod: 14,
    atrBuffer: 0.15,
    vwapFilter: true,
    emaFilter: true,
    rsiFilter: true,
    volumeFilter: true,
    adxFilter: true,
    rsiBull: 55,
    rsiBear: 45,
    volumeMult: 1.2,
    adxMin: 18,
    confirmationScore: 70,
    retestConfirmation: false,
    shortDeltaMin: 0.15,
    shortDeltaMax: 0.25,
    spreadWidth: 100,
    dte: 7,
    riskPct: 0.75,
    profitTargetPct: 60,
    stopLossPct: 120,
    trailEnableAt: 40,
    trailTightenAt: 60,
    entryStart: '09:20',
    lastEntry: '14:45',
    exitTime: '15:15',
    dailyLossLimitPct: 2,
    maxOpenPositions: 2,
    maxMarginUsagePct: 35,
    maxConsecutiveLosses: 3,
    capital: 500000,
    ...partial
  };
}

export const SEED_BOTS: TradingBot[] = [
  {
    id: 'bot-sr-nifty',
    config: defaultConfig({
      name: 'NIFTY Support & Resistance Hedging Bot',
      underlying: 'NIFTY',
      strategy: 'sr_hedging'
    }),
    status: 'RUNNING',
    mode: 'PAPER',
    state: 'NEUTRAL',
    todayPnl: 1840,
    totalPnl: 22650,
    winRate: 62,
    trades: 48,
    currentSignal: 'WATCH',
    riskLevel: 'LOW',
    createdAt: '2026-09-12'
  },
  {
    id: 'bot-hedge-nifty',
    config: defaultConfig({ name: 'NIFTY Hedging Bot', underlying: 'NIFTY', strategy: 'sr_hedging' }),
    status: 'PAUSED',
    mode: 'PAPER',
    state: 'NEUTRAL',
    todayPnl: 0,
    totalPnl: 8120,
    winRate: 58,
    trades: 22,
    currentSignal: 'NONE',
    riskLevel: 'LOW',
    createdAt: '2026-08-02'
  },
  {
    id: 'bot-hedge-bn',
    config: defaultConfig({ name: 'BANKNIFTY Hedging Bot', underlying: 'BANKNIFTY', strategy: 'sr_hedging', spreadWidth: 200, capital: 750000 }),
    status: 'STOPPED',
    mode: 'PAPER',
    state: 'NEUTRAL',
    todayPnl: 0,
    totalPnl: 15400,
    winRate: 55,
    trades: 31,
    currentSignal: 'NONE',
    riskLevel: 'MEDIUM',
    createdAt: '2026-07-18'
  },
  {
    id: 'bot-breakout',
    config: defaultConfig({ name: 'Breakout Bot', underlying: 'NIFTY', strategy: 'breakout' }),
    status: 'STOPPED',
    mode: 'PAPER',
    state: 'NEUTRAL',
    todayPnl: 0,
    totalPnl: 4300,
    winRate: 51,
    trades: 19,
    currentSignal: 'NONE',
    riskLevel: 'MEDIUM',
    createdAt: '2026-06-01'
  },
  {
    id: 'bot-mr',
    config: defaultConfig({ name: 'Mean Reversion Bot', underlying: 'NIFTY', strategy: 'mean_reversion' }),
    status: 'STOPPED',
    mode: 'PAPER',
    state: 'NEUTRAL',
    todayPnl: 0,
    totalPnl: -920,
    winRate: 47,
    trades: 14,
    currentSignal: 'NONE',
    riskLevel: 'MEDIUM',
    createdAt: '2026-05-20'
  },
  {
    id: 'bot-ic',
    config: defaultConfig({ name: 'Iron Condor Bot', underlying: 'NIFTY', strategy: 'iron_condor' }),
    status: 'STOPPED',
    mode: 'PAPER',
    state: 'NEUTRAL',
    todayPnl: 0,
    totalPnl: 9800,
    winRate: 71,
    trades: 26,
    currentSignal: 'NONE',
    riskLevel: 'LOW',
    createdAt: '2026-04-11'
  },
  {
    id: 'bot-trend',
    config: defaultConfig({ name: 'Trend Following Bot', underlying: 'NIFTY', strategy: 'trend' }),
    status: 'STOPPED',
    mode: 'PAPER',
    state: 'NEUTRAL',
    todayPnl: 0,
    totalPnl: 6100,
    winRate: 49,
    trades: 17,
    currentSignal: 'NONE',
    riskLevel: 'HIGH',
    createdAt: '2026-03-09'
  }
];

export const SEED_JOURNAL: JournalRow[] = [
  {
    id: 'J-10041',
    bot: 'NIFTY Support & Resistance Hedging Bot',
    date: '2026-10-06',
    entryTime: '10:15',
    exitTime: '13:40',
    underlying: 'NIFTY',
    signal: 'RESISTANCE_BREAK',
    score: 82,
    regime: 'TRENDING',
    support: 24850,
    resistance: 25200,
    strategy: 'BULL PUT SPREAD',
    expiry: '2026-10-08',
    shortStrike: 25100,
    longStrike: 25000,
    qty: 50,
    credit: 18.4,
    maxRisk: 81.6,
    entryReason: 'Bullish breakout confirmed (82/100)',
    exitReason: 'Profit target 60% of credit',
    grossPnl: 5520,
    fees: 86,
    netPnl: 5434,
    mfe: 6200,
    mae: -1100
  },
  {
    id: 'J-10038',
    bot: 'NIFTY Support & Resistance Hedging Bot',
    date: '2026-10-03',
    entryTime: '11:05',
    exitTime: '14:10',
    underlying: 'NIFTY',
    signal: 'SUPPORT_BREAK',
    score: 76,
    regime: 'VOLATILE',
    support: 24920,
    resistance: 25240,
    strategy: 'BEAR CALL SPREAD',
    expiry: '2026-10-08',
    shortStrike: 25300,
    longStrike: 25400,
    qty: 50,
    credit: 16.1,
    maxRisk: 83.9,
    entryReason: 'Bearish breakdown confirmed (76/100)',
    exitReason: 'Failed breakdown → COOLDOWN, time exit',
    grossPnl: -2100,
    fees: 86,
    netPnl: -2186,
    mfe: 900,
    mae: -2800
  }
];

export const SEED_ALERTS: BotAlert[] = [
  { id: 'a1', time: '09:21', type: 'Market Feed', message: 'Feed healthy — last tick < 2s', severity: 'info' },
  { id: 'a2', time: '10:16', type: 'Trade Eligible', message: 'NIFTY resistance break score 84 — paper only', severity: 'info' },
  { id: 'a3', time: '10:16', type: 'Hedge Safety', message: 'Multi-leg paper basket validated before short put', severity: 'info' }
];

export const SEED_ORDERS: BotOrder[] = [
  {
    id: 'ORD-2201',
    botId: 'bot-sr-nifty',
    time: '10:16:12',
    legs: 'SELL 25100 PE + BUY 25000 PE',
    qty: 50,
    state: 'FILLED',
    mode: 'PAPER',
    note: 'Hedge filled with short. Defined-risk spread.'
  }
];

export const SEED_POSITIONS: BotPosition[] = [];

export const SEED_SIGNALS: LiveSignal[] = [];
