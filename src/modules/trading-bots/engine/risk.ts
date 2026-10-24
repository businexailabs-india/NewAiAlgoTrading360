import type { BotConfig } from '../types';

export interface RiskSnapshot {
  tradingCapital: number;
  available: number;
  marginUsed: number;
  marginAvailable: number;
  dailyRisk: number;
  openRisk: number;
  maxPotentialLoss: number;
  portfolioDelta: number;
  gamma: number;
  theta: number;
  vega: number;
  halted: boolean;
  haltReason?: string;
}

export function evaluateRisk(cfg: BotConfig, todayPnl: number, openRisk: number, consecutiveLosses: number): RiskSnapshot {
  const dailyCap = cfg.capital * (cfg.dailyLossLimitPct / 100);
  const halted = todayPnl <= -dailyCap || consecutiveLosses >= cfg.maxConsecutiveLosses;
  const marginUsed = Math.min(cfg.capital * 0.22, openRisk * 1.1);
  return {
    tradingCapital: cfg.capital,
    available: cfg.capital + todayPnl - marginUsed,
    marginUsed,
    marginAvailable: cfg.capital * (cfg.maxMarginUsagePct / 100) - marginUsed,
    dailyRisk: Math.abs(Math.min(0, todayPnl)),
    openRisk,
    maxPotentialLoss: openRisk,
    portfolioDelta: 0.12,
    gamma: 0.008,
    theta: 420,
    vega: -180,
    halted,
    haltReason: halted
      ? todayPnl <= -dailyCap
        ? 'Daily loss limit reached — new entries blocked.'
        : 'Maximum consecutive losses — bot HALTED.'
      : undefined
  };
}

export const SAFETY = {
  paperDefault: true,
  liveRequiresExplicit: true,
  noMartingale: true,
  noUnlimitedRisk: true,
  aiCannotBypassRisk: true,
  staleDataBlocks: true
} as const;
