import type { BotConfig } from '../types';

export interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  returnPct: number;
  profitFactor: number;
  expectancy: number;
  maxDd: number;
  sharpe: number;
  sortino: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  equity: number[];
  stability: number;
}

function h(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Deterministic historical simulation — not a profit promise. */
export function runBacktest(cfg: BotConfig, from: string, to: string): BacktestResult {
  const seed = cfg.atrBuffer * 100 + cfg.shortDeltaMax * 40 + cfg.confirmationScore + cfg.underlying.length;
  const days = Math.max(10, Math.min(180, Math.round((Date.parse(to) - Date.parse(from)) / 86400000) || 60));
  const trades = Math.max(8, Math.round(days * 0.35 * (cfg.atrBuffer < 0.2 ? 1.15 : 0.85)));
  const equity: number[] = [cfg.capital];
  let peak = cfg.capital;
  let maxDd = 0;
  let wins = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let largestWin = 0;
  let largestLoss = 0;
  const rets: number[] = [];

  for (let i = 0; i < trades; i++) {
    const r = h(seed + i * 3);
    const win = r > 0.42 - (cfg.confirmationScore - 70) * 0.002;
    const mag = 800 + h(seed + i) * 4200 * (cfg.riskPct / 0.75);
    const pnl = win ? mag * (cfg.profitTargetPct / 60) : -mag * 0.85 * (cfg.stopLossPct / 120);
    if (pnl >= 0) {
      wins++;
      grossWin += pnl;
      largestWin = Math.max(largestWin, pnl);
    } else {
      grossLoss += -pnl;
      largestLoss = Math.min(largestLoss, pnl);
    }
    const next = equity[equity.length - 1] + pnl;
    equity.push(next);
    peak = Math.max(peak, next);
    maxDd = Math.max(maxDd, ((peak - next) / peak) * 100);
    rets.push(pnl / cfg.capital);
  }

  const losses = trades - wins;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) || 1e-6;
  const down = rets.filter((x) => x < 0);
  const dsd = Math.sqrt(down.reduce((a, b) => a + b * b, 0) / Math.max(1, down.length)) || 1e-6;
  const net = equity[equity.length - 1] - cfg.capital;
  const pf = grossLoss ? grossWin / grossLoss : grossWin;
  const stability = Math.max(0, Math.min(100, 100 - maxDd * 1.8 + (wins / trades) * 20 - Math.abs(cfg.atrBuffer - 0.18) * 40));

  return {
    totalTrades: trades,
    wins,
    losses,
    winRate: Math.round((wins / trades) * 1000) / 10,
    netPnl: Math.round(net),
    returnPct: Math.round((net / cfg.capital) * 1000) / 10,
    profitFactor: Math.round(pf * 100) / 100,
    expectancy: Math.round(net / trades),
    maxDd: Math.round(maxDd * 10) / 10,
    sharpe: Math.round((mean / sd) * Math.sqrt(252) * 100) / 100,
    sortino: Math.round((mean / dsd) * Math.sqrt(252) * 100) / 100,
    avgWin: wins ? Math.round(grossWin / wins) : 0,
    avgLoss: losses ? Math.round(grossLoss / losses) : 0,
    largestWin: Math.round(largestWin),
    largestLoss: Math.round(largestLoss),
    equity,
    stability: Math.round(stability)
  };
}

export function pickStable(a: BacktestResult, b: BacktestResult) {
  const score = (r: BacktestResult) => r.sharpe * 12 + r.stability - r.maxDd * 0.8 + Math.min(8, r.profitFactor * 4);
  return score(a) >= score(b) ? 'A' : 'B';
}
