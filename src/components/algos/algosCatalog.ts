/**
 * Unified algo catalog for Algos workspace.
 * Merges advisory recommendations + rule strategies; seeds demo when empty.
 */

import { advisoryMarketplaceService, type AdvisoryRecommendation } from '../../services/advisoryMarketplaceService';
import { tradingService } from '../../services/tradingService';
import { SEED_BOTS } from '../../modules/trading-bots/seed';
import type { StrategyKind } from '../../modules/trading-bots/types';

export type AlgoLane = 'trading' | 'investing';
export type AlgoCategory =
  | 'credit_spread'
  | 'option_buying'
  | 'option_selling'
  | 'hedged_options'
  | 'short_straddle'
  | 'short_strangle'
  | 'equity_swing'
  | 'equity_long_term'
  | 'other';

export interface AlgoCatalogItem {
  id: string;
  name: string;
  subtitle: string;
  lane: AlgoLane;
  category: AlgoCategory;
  underlying: string;
  minCapital: number;
  maxCapital: number;
  tags: string[];
  returns1m: number;
  returns3m: number;
  returns6m: number;
  returns1y: number;
  sparkline: number[];
  deployedCount: number;
  trackedCount: number;
  style: string;
  segment: string;
  tradeType: string;
  worksIn: string;
  builtOn: string;
  cumulativeReturn: number;
  cagr: number;
  avgUpMonth: number;
  avgDownMonth: number;
  successRatio: number;
  avgProfit: number;
  avgLoss: number;
  risk: 'Low' | 'Medium' | 'High';
  volatility: number;
  maxDd: number;
  riskReward: string;
  winDays: number;
  winMonths: number;
  winQuarters: number;
  maxWinStreak: number;
  maxLossStreak: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  alpha: number;
  avgTradesPerWeek: number;
  recoveryDays: number;
  maxRecoveryDays: number;
  source: 'advisory' | 'strategy' | 'option' | 'agent' | 'external' | 'demo' | 'trading_bot';
  botId?: string;
  recommendationId?: string;
  advisoryId?: string;
  optionId?: string;
  agentId?: string;
  externalId?: string;
  strategyId?: string;
  isDemo?: boolean;
  live?: boolean;
  metricsSource?: 'live' | 'estimate';
}

function spark(seed: number, n = 24): number[] {
  const out: number[] = [];
  let v = 100 + (seed % 17);
  for (let i = 0; i < n; i++) {
    v += Math.sin(i * 0.55 + seed) * 2.2 + ((seed * (i + 3)) % 7) * 0.15 - 0.4;
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

function botCategory(kind: StrategyKind): AlgoCategory {
  if (kind === 'sr_hedging' || kind === 'iron_condor') return 'hedged_options';
  if (kind === 'breakout' || kind === 'trend') return 'option_buying';
  return 'other';
}

function botTradeType(kind: StrategyKind): string {
  if (kind === 'sr_hedging') return 'Bull Put / Bear Call';
  if (kind === 'iron_condor') return 'Iron Condor';
  if (kind === 'breakout') return 'Breakout';
  if (kind === 'trend') return 'Trend';
  if (kind === 'mean_reversion') return 'Mean Reversion';
  return 'Custom';
}

/** Built-in TradingBots listed on Trading Algos. */
export function tradingBotsCatalog(): AlgoCatalogItem[] {
  return SEED_BOTS.map((b, i) => {
    const kind = b.config.strategy;
    const r1 = Number((b.todayPnl / Math.max(1, b.config.capital / 100)).toFixed(2));
    const r3 = Number((b.totalPnl / Math.max(1, b.config.capital / 100)).toFixed(2));
    return {
      id: `tb-${b.id}`,
      botId: b.id,
      name: b.config.name,
      subtitle: `${botTradeType(kind)} · ${b.config.underlying} · PAPER`,
      lane: 'trading' as const,
      category: botCategory(kind),
      underlying: b.config.underlying,
      minCapital: b.config.capital,
      maxCapital: b.config.capital * 4,
      tags: ['TradingBots', b.config.underlying, botTradeType(kind), 'Paper'],
      returns1m: r1,
      returns3m: r3,
      returns6m: Number((r3 * 1.4).toFixed(2)),
      returns1y: Number((r3 * 2.1).toFixed(2)),
      sparkline: spark(i * 17 + 9),
      deployedCount: 80 + i * 11,
      trackedCount: 240 + i * 18,
      style: kind === 'sr_hedging' ? 'Hedged Options' : botTradeType(kind),
      segment: 'F&O',
      tradeType: botTradeType(kind),
      worksIn: 'Index F&O · defined-risk',
      builtOn: 'NSE',
      cumulativeReturn: Number((r3 * 1.6).toFixed(2)),
      cagr: Number((r3 * 0.9).toFixed(2)),
      avgUpMonth: 4.2,
      avgDownMonth: -1.8,
      successRatio: b.winRate,
      avgProfit: 5.1,
      avgLoss: -3.4,
      risk: b.riskLevel === 'HIGH' ? 'High' : b.riskLevel === 'MEDIUM' ? 'Medium' : 'Low',
      volatility: 18 + i,
      maxDd: -6.5 - i,
      riskReward: '1:1.4',
      winDays: b.winRate,
      winMonths: Math.min(95, b.winRate + 8),
      winQuarters: Math.min(100, b.winRate + 18),
      maxWinStreak: 6,
      maxLossStreak: 3,
      sharpe: 1.1 + i * 0.05,
      sortino: 1.4 + i * 0.05,
      calmar: 1.6,
      alpha: 0.8,
      avgTradesPerWeek: 4,
      recoveryDays: 8,
      maxRecoveryDays: 28,
      source: 'trading_bot' as const,
      isDemo: false,
      live: false,
      metricsSource: 'estimate'
    } satisfies AlgoCatalogItem;
  });
}

function demoCatalog(): AlgoCatalogItem[] {
  const base: Array<Partial<AlgoCatalogItem> & { name: string; lane: AlgoLane; category: AlgoCategory }> = [
    {
      name: 'Curvature Credit Spread Overnight',
      lane: 'trading',
      category: 'credit_spread',
      underlying: 'Nifty',
      minCapital: 100000,
      returns3m: 42.88,
      style: 'Hedged Options',
      tradeType: 'Credit Spread'
    },
    {
      name: 'SkewHunter TSL',
      lane: 'trading',
      category: 'option_buying',
      underlying: 'Nifty',
      minCapital: 50000,
      returns3m: 28.4,
      style: 'Directional Options',
      tradeType: 'Option Buying'
    },
    {
      name: 'Settle-Down 40% TSL',
      lane: 'trading',
      category: 'option_buying',
      underlying: 'Bank Nifty',
      minCapital: 75000,
      returns3m: 19.2,
      style: 'Directional Options',
      tradeType: 'Option Buying'
    },
    {
      name: 'Vacuum GRID',
      lane: 'trading',
      category: 'option_buying',
      underlying: 'Nifty',
      minCapital: 60000,
      returns1m: 10.62,
      returns3m: 31.5,
      style: 'Option Buying',
      tradeType: 'Option Buying'
    },
    {
      name: 'Zen Credit Spread Overnight',
      lane: 'trading',
      category: 'credit_spread',
      underlying: 'Nifty',
      minCapital: 120000,
      maxCapital: 500000,
      returns3m: 36.1,
      style: 'Hedged',
      tradeType: 'Credit Spread',
      tags: ['Nifty', 'Hedged', 'Directional']
    },
    {
      name: 'Index Sniper',
      lane: 'trading',
      category: 'short_straddle',
      underlying: 'Nifty',
      minCapital: 200000,
      returns3m: -1.87,
      style: 'Option Selling',
      tradeType: 'Short Straddle'
    },
    {
      name: 'Wealth Magnet Automated',
      lane: 'investing',
      category: 'equity_long_term',
      underlying: 'Equity',
      minCapital: 100000,
      returns3m: 12.4,
      returns1y: 28.6,
      style: 'Long Term Investing',
      tradeType: 'Equity',
      tags: ['Equity', 'Long-Term']
    },
    {
      name: 'Swing Pulse Basket',
      lane: 'investing',
      category: 'equity_swing',
      underlying: 'Equity',
      minCapital: 50000,
      returns3m: 8.9,
      style: 'Swing Trading',
      tradeType: 'Equity',
      tags: ['Equity', 'Swing']
    }
  ];

  return base.map((b, i) => {
    const r3 = b.returns3m ?? 10;
    const r1 = b.returns1m ?? r3 / 3;
    const r6 = r3 * 1.45;
    const r1y = b.returns1y ?? r3 * 2.1;
    return {
      id: `demo-${i + 1}`,
      name: b.name,
      subtitle: `${b.style || 'Algo'} · ${b.underlying || 'Nifty'}`,
      lane: b.lane,
      category: b.category,
      underlying: b.underlying || 'Nifty',
      minCapital: b.minCapital || 50000,
      maxCapital: b.maxCapital || (b.minCapital || 50000) * 5,
      tags: b.tags || [b.underlying || 'Nifty', b.tradeType || 'Algo'],
      returns1m: Number(r1.toFixed(2)),
      returns3m: Number(r3.toFixed(2)),
      returns6m: Number(r6.toFixed(2)),
      returns1y: Number(r1y.toFixed(2)),
      sparkline: spark(i * 13 + 5),
      deployedCount: 1200 - i * 90,
      trackedCount: 3400 - i * 110,
      style: b.style || 'Trading',
      segment: b.lane === 'investing' ? 'Equity' : 'F&O',
      tradeType: b.tradeType || 'Algo',
      worksIn: b.lane === 'investing' ? 'All Markets' : 'Directional Markets',
      builtOn: 'NSE',
      cumulativeReturn: Number((r1y * 1.8).toFixed(2)),
      cagr: Number((r1y * 0.95).toFixed(2)),
      avgUpMonth: 12.4,
      avgDownMonth: -2.9,
      successRatio: 57.47,
      avgProfit: 5.43,
      avgLoss: -4.36,
      risk: Math.abs(r3) > 30 ? 'High' : Math.abs(r3) > 15 ? 'Medium' : 'Low',
      volatility: 42 + i * 3,
      maxDd: -(8 + i * 2.2),
      riskReward: '1:1.25',
      winDays: 62.8,
      winMonths: 84.6,
      winQuarters: 100,
      maxWinStreak: 10,
      maxLossStreak: 4,
      sharpe: 1.8 + i * 0.12,
      sortino: 2.4 + i * 0.15,
      calmar: 3 + i * 0.4,
      alpha: 1.2 + i * 0.1,
      avgTradesPerWeek: 3,
      recoveryDays: 9,
      maxRecoveryDays: 60,
      source: 'demo',
      isDemo: true
    } satisfies AlgoCatalogItem;
  });
}

function mapAdvisory(
  advisoryId: string | null,
  recs: AdvisoryRecommendation[]
): AlgoCatalogItem[] {
  return recs.map((r, i) => {
    const capital = Number(r.required_capital || 50000);
    const conf = Number(r.confidence_score || 0.5);
    const r3 = Number((conf * 40 - 5).toFixed(2));
    const lane: AlgoLane = /equity|swing|long/i.test(r.type + r.title) ? 'investing' : 'trading';
    const category: AlgoCategory = /spread/i.test(r.type + r.title)
      ? 'credit_spread'
      : /sell/i.test(r.type)
        ? 'option_selling'
        : /option|f&o|fo/i.test(r.type)
          ? 'option_buying'
          : lane === 'investing'
            ? 'equity_swing'
            : 'other';
    return {
      id: `adv-${r.id}`,
      name: r.title,
      subtitle: `${r.type} · ${(r.symbols || []).slice(0, 2).join(', ') || 'Multi'}`,
      lane,
      category,
      underlying: (r.symbols || [])[0] || 'Nifty',
      minCapital: capital,
      maxCapital: capital * 4,
      tags: [r.type, ...(r.symbols || []).slice(0, 2)],
      returns1m: Number((r3 / 3).toFixed(2)),
      returns3m: r3,
      returns6m: Number((r3 * 1.5).toFixed(2)),
      returns1y: Number((r3 * 2.2).toFixed(2)),
      sparkline: spark(i * 9 + 2),
      deployedCount: Math.round(conf * 800),
      trackedCount: Math.round(conf * 2000),
      style: r.type,
      segment: lane === 'investing' ? 'Equity' : 'F&O',
      tradeType: r.type,
      worksIn: 'Directional Markets',
      builtOn: 'NSE',
      cumulativeReturn: Number((r3 * 3).toFixed(2)),
      cagr: Number((r3 * 1.6).toFixed(2)),
      avgUpMonth: 10,
      avgDownMonth: -3,
      successRatio: conf * 100,
      avgProfit: 4.5,
      avgLoss: -3.8,
      risk: Number(r.risk_score || 0.5) > 0.66 ? 'High' : Number(r.risk_score || 0.5) > 0.33 ? 'Medium' : 'Low',
      volatility: 35,
      maxDd: -12,
      riskReward: '1:1.2',
      winDays: 58,
      winMonths: 70,
      winQuarters: 80,
      maxWinStreak: 6,
      maxLossStreak: 3,
      sharpe: 1.4,
      sortino: 1.9,
      calmar: 2.1,
      alpha: 0.8,
      avgTradesPerWeek: 2,
      recoveryDays: 12,
      maxRecoveryDays: 45,
      source: 'advisory',
      recommendationId: r.id,
      advisoryId: advisoryId || undefined,
      isDemo: false
    } satisfies AlgoCatalogItem;
  });
}

function mapStrategies(rows: Array<Record<string, unknown>>): AlgoCatalogItem[] {
  return rows.map((s, i) => {
    const name = String(s.name || `Strategy ${i + 1}`);
    const cat = String(s.category || 'other').toLowerCase();
    const lane: AlgoLane = /invest|equity|swing|long/i.test(cat + name) ? 'investing' : 'trading';
    const symbols = Array.isArray(s.symbols) ? (s.symbols as string[]) : [];
    return {
      id: `strat-${String(s.id || i)}`,
      name,
      subtitle: `${cat || 'rule'} · ${symbols[0] || 'Multi'}`,
      lane,
      category: lane === 'investing' ? 'equity_swing' : 'other',
      underlying: symbols[0] || 'Nifty',
      minCapital: 50000,
      maxCapital: 250000,
      tags: [cat || 'strategy', ...symbols.slice(0, 2)],
      returns1m: 2.1,
      returns3m: 6.4,
      returns6m: 11.2,
      returns1y: 18.5,
      sparkline: spark(i * 7 + 1),
      deployedCount: 40 + i,
      trackedCount: 120 + i * 3,
      style: cat || 'Rule Strategy',
      segment: lane === 'investing' ? 'Equity' : 'F&O',
      tradeType: cat || 'Rules',
      worksIn: 'All Markets',
      builtOn: 'NSE',
      cumulativeReturn: 22,
      cagr: 18,
      avgUpMonth: 5,
      avgDownMonth: -2,
      successRatio: 55,
      avgProfit: 3.2,
      avgLoss: -2.8,
      risk: 'Medium',
      volatility: 28,
      maxDd: -10,
      riskReward: '1:1.1',
      winDays: 55,
      winMonths: 65,
      winQuarters: 75,
      maxWinStreak: 5,
      maxLossStreak: 3,
      sharpe: 1.1,
      sortino: 1.4,
      calmar: 1.6,
      alpha: 0.5,
      avgTradesPerWeek: 2,
      recoveryDays: 14,
      maxRecoveryDays: 40,
      source: 'strategy',
      strategyId: String(s.id || ''),
      isDemo: false,
      live: true,
      metricsSource: 'estimate'
    } satisfies AlgoCatalogItem;
  });
}

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapOptions(rows: Array<Record<string, unknown>>): AlgoCatalogItem[] {
  return rows.map((o, i) => {
    const name = String(o.name || o.title || `Strategy option ${i + 1}`);
    const type = String(o.type || o.strategy_type || o.category || 'Algo');
    const capital = num(o.required_capital ?? o.minCapital ?? o.capital, 50000);
    const conf = num(o.confidence_score ?? o.confidence, 0.55);
    const metrics = (o.metrics || o.paper_metrics || o.performance || {}) as Record<string, unknown>;
    const hasLiveMetrics = Boolean(
      metrics.return_pct ?? metrics.returns_3m ?? o.return_pct ?? o.returns_3m ?? o.sharpe
    );
    const r3 = hasLiveMetrics
      ? num(metrics.returns_3m ?? metrics.return_pct ?? o.returns_3m ?? o.return_pct, conf * 36 - 4)
      : Number((conf * 36 - 4).toFixed(2));
    const lane: AlgoLane = /invest|equity|swing|long/i.test(type + name) ? 'investing' : 'trading';
    const symbols = Array.isArray(o.symbols) ? (o.symbols as string[]) : [];
    const sharpe = num(metrics.sharpe ?? o.sharpe, hasLiveMetrics ? 1.3 : 1.3);
    const maxDd = num(metrics.max_drawdown ?? metrics.maxDd ?? o.max_drawdown, -11);
    const winRate = num(metrics.win_rate ?? metrics.success_ratio ?? o.win_rate, conf * 100);
    return {
      id: `opt-${String(o.id || i)}`,
      name,
      subtitle: `${type} · ${hasLiveMetrics ? 'paper metrics' : 'live option'}`,
      lane,
      category: lane === 'investing' ? 'equity_swing' : /spread/i.test(type) ? 'credit_spread' : 'other',
      underlying: symbols[0] || String(o.underlying || 'Nifty'),
      minCapital: capital,
      maxCapital: capital * 4,
      tags: [type, hasLiveMetrics ? 'Paper-tested' : 'Live', ...symbols.slice(0, 2)],
      returns1m: num(metrics.returns_1m ?? o.returns_1m, Number((r3 / 3).toFixed(2))),
      returns3m: r3,
      returns6m: num(metrics.returns_6m ?? o.returns_6m, Number((r3 * 1.5).toFixed(2))),
      returns1y: num(metrics.returns_1y ?? o.returns_1y, Number((r3 * 2.1).toFixed(2))),
      sparkline: spark(i * 11 + 3),
      deployedCount: Number(o.deployed || o.deploy_count || 0),
      trackedCount: Number(o.tracked || conf * 500),
      style: type,
      segment: lane === 'investing' ? 'Equity' : 'F&O',
      tradeType: type,
      worksIn: 'Live markets',
      builtOn: 'NSE',
      cumulativeReturn: num(metrics.cumulative_return ?? o.cumulative_return, Number((r3 * 2.4).toFixed(2))),
      cagr: num(metrics.cagr ?? o.cagr, Number((r3 * 1.5).toFixed(2))),
      avgUpMonth: num(metrics.avg_up_month, 9),
      avgDownMonth: num(metrics.avg_down_month, -2.5),
      successRatio: winRate,
      avgProfit: num(metrics.avg_profit, 4.2),
      avgLoss: num(metrics.avg_loss, -3.5),
      risk: conf > 0.7 ? 'Low' : conf > 0.4 ? 'Medium' : 'High',
      volatility: num(metrics.volatility, 30),
      maxDd,
      riskReward: String(metrics.risk_reward || '1:1.2'),
      winDays: num(metrics.win_days, 56),
      winMonths: num(metrics.win_months, 68),
      winQuarters: num(metrics.win_quarters, 75),
      maxWinStreak: num(metrics.max_win_streak, 5),
      maxLossStreak: num(metrics.max_loss_streak, 3),
      sharpe,
      sortino: num(metrics.sortino ?? o.sortino, 1.7),
      calmar: num(metrics.calmar ?? o.calmar, 1.9),
      alpha: num(metrics.alpha, 0.7),
      avgTradesPerWeek: num(metrics.avg_trades_per_week, 2),
      recoveryDays: num(metrics.recovery_days, 10),
      maxRecoveryDays: num(metrics.max_recovery_days, 40),
      source: 'option',
      optionId: String(o.id || ''),
      isDemo: false,
      live: true,
      metricsSource: hasLiveMetrics ? 'live' : 'estimate'
    } satisfies AlgoCatalogItem;
  });
}

function mapAgents(rows: Array<Record<string, unknown>>): AlgoCatalogItem[] {
  return rows.map((a, i) => {
    const name = String(a.name || `Agent ${i + 1}`);
    const mode = String(a.mode || 'paper');
    return {
      id: `agent-${String(a.id || i)}`,
      name,
      subtitle: `Auto agent · ${mode}`,
      lane: 'trading' as const,
      category: 'other' as const,
      underlying: 'Multi',
      minCapital: 50000,
      maxCapital: 250000,
      tags: ['Agent', mode, String(a.status || 'active')],
      returns1m: 1.2,
      returns3m: 4.5,
      returns6m: 8.1,
      returns1y: 14.2,
      sparkline: spark(i * 5 + 8),
      deployedCount: Number((a as { _count?: { runs?: number } })._count?.runs || 1),
      trackedCount: 10,
      style: 'Auto Trading',
      segment: 'F&O',
      tradeType: 'Agent',
      worksIn: mode === 'live' ? 'Live' : 'Paper',
      builtOn: 'NSE',
      cumulativeReturn: 14.2,
      cagr: 12,
      avgUpMonth: 4,
      avgDownMonth: -2,
      successRatio: 52,
      avgProfit: 3,
      avgLoss: -2.5,
      risk: 'Medium',
      volatility: 25,
      maxDd: -8,
      riskReward: '1:1.1',
      winDays: 54,
      winMonths: 60,
      winQuarters: 70,
      maxWinStreak: 4,
      maxLossStreak: 3,
      sharpe: 1.0,
      sortino: 1.2,
      calmar: 1.3,
      alpha: 0.4,
      avgTradesPerWeek: 3,
      recoveryDays: 8,
      maxRecoveryDays: 30,
      source: 'agent',
      agentId: String(a.id || ''),
      isDemo: false,
      live: true
    } satisfies AlgoCatalogItem;
  });
}

function mapExternal(rows: Array<Record<string, unknown>>): AlgoCatalogItem[] {
  return rows.map((e, i) => {
    const name = String(e.name || e.title || `External algo ${i + 1}`);
    return {
      id: `ext-${String(e.id || i)}`,
      name,
      subtitle: String(e.provider || e.source || 'External') + ' · discovered',
      lane: 'trading' as const,
      category: 'other' as const,
      underlying: String(e.underlying || 'Nifty'),
      minCapital: Number(e.min_capital || e.required_capital || 75000),
      maxCapital: Number(e.max_capital || 400000),
      tags: ['External', String(e.status || 'candidate')],
      returns1m: Number(e.returns_1m || 2),
      returns3m: Number(e.returns_3m || 7),
      returns6m: Number(e.returns_6m || 12),
      returns1y: Number(e.returns_1y || 20),
      sparkline: spark(i * 17 + 4),
      deployedCount: Number(e.deployed || 0),
      trackedCount: Number(e.tracked || 50),
      style: String(e.style || 'External'),
      segment: 'F&O',
      tradeType: String(e.type || 'External'),
      worksIn: 'Discovered',
      builtOn: 'NSE',
      cumulativeReturn: 20,
      cagr: 16,
      avgUpMonth: 6,
      avgDownMonth: -2.2,
      successRatio: 50,
      avgProfit: 3.5,
      avgLoss: -3,
      risk: 'Medium',
      volatility: 32,
      maxDd: -14,
      riskReward: '1:1.15',
      winDays: 52,
      winMonths: 62,
      winQuarters: 70,
      maxWinStreak: 4,
      maxLossStreak: 3,
      sharpe: 1.1,
      sortino: 1.3,
      calmar: 1.4,
      alpha: 0.5,
      avgTradesPerWeek: 2,
      recoveryDays: 12,
      maxRecoveryDays: 45,
      source: 'external',
      externalId: String(e.id || ''),
      isDemo: false,
      live: true,
      metricsSource: Number(e.returns_3m) ? 'live' : 'estimate'
    } satisfies AlgoCatalogItem;
  });
}

/**
 * Live catalog: advisory (+ generate if empty), strategy options, rule strategies,
 * agents, external candidates. Demo only when every live source is empty.
 */
export async function loadAlgosCatalog(opts?: {
  generateIfEmpty?: boolean;
}): Promise<{ items: AlgoCatalogItem[]; usedDemo: boolean; liveCount: number }> {
  const generateIfEmpty = opts?.generateIfEmpty !== false;
  let advisoryItems: AlgoCatalogItem[] = [];
  let optionItems: AlgoCatalogItem[] = [];
  let strategyItems: AlgoCatalogItem[] = [];
  let agentItems: AlgoCatalogItem[] = [];
  let externalItems: AlgoCatalogItem[] = [];

  try {
    let latest = await advisoryMarketplaceService.latest().catch(() => null);
    if ((!latest?.recommendations?.length) && generateIfEmpty) {
      latest = await advisoryMarketplaceService.generate().catch(() => latest);
    }
    if (latest?.recommendations?.length) {
      advisoryItems = mapAdvisory(latest.advisory_id, latest.recommendations).map((x) => ({
        ...x,
        live: true
      }));
    }
  } catch {
    /* ignore */
  }

  try {
    const options = await advisoryMarketplaceService.listStrategyOptions().catch(() => []);
    if (options.length) optionItems = mapOptions(options);
  } catch {
    /* ignore */
  }

  try {
    const strategies = await tradingService.listStrategies().catch(() => []);
    if (Array.isArray(strategies) && strategies.length) {
      strategyItems = mapStrategies(strategies as Array<Record<string, unknown>>).map((x) => ({
        ...x,
        live: true
      }));
    }
  } catch {
    /* ignore */
  }

  try {
    const agents = await tradingService.listAgents().catch(() => []);
    if (Array.isArray(agents) && agents.length) {
      agentItems = mapAgents(agents as Array<Record<string, unknown>>);
    }
  } catch {
    /* ignore */
  }

  try {
    const external = await advisoryMarketplaceService.listExternal().catch(() => null);
    const rows = Array.isArray(external)
      ? external
      : external && typeof external === 'object' && Array.isArray((external as { candidates?: unknown[] }).candidates)
        ? ((external as { candidates: Array<Record<string, unknown>> }).candidates)
        : [];
    if (rows.length) externalItems = mapExternal(rows as Array<Record<string, unknown>>);
  } catch {
    /* ignore */
  }

  const bots = tradingBotsCatalog();
  const merged = [...bots, ...optionItems, ...advisoryItems, ...strategyItems, ...agentItems, ...externalItems];
  // Dedupe by name+source preference (options > advisory > strategy)
  const seen = new Set<string>();
  const unique = merged.filter((item) => {
    const key = item.name.toLowerCase();
    if (seen.has(key) && item.source !== 'option') return false;
    seen.add(key);
    return true;
  });

  if (unique.length === bots.length) {
    return { items: [...bots, ...demoCatalog()], usedDemo: true, liveCount: 0 };
  }
  return { items: unique, usedDemo: false, liveCount: unique.length };
}

export function categoryLabel(c: AlgoCategory): string {
  const map: Record<AlgoCategory, string> = {
    credit_spread: 'Credit Spread',
    option_buying: 'Option Buying',
    option_selling: 'Option Selling',
    hedged_options: 'Hedged Options',
    short_straddle: 'Short Straddle',
    short_strangle: 'Short Strangle',
    equity_swing: 'Equity Swing',
    equity_long_term: 'Equity Long Term',
    other: 'All Algos'
  };
  return map[c];
}

export function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function pctColor(n: number): string {
  if (n > 0) return '#34d399';
  if (n < 0) return '#f87171';
  return '#94a3b8';
}
