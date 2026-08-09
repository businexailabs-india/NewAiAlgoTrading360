import { MaConfig, canSubmitPaperOrders } from '../config';
import { PortfolioState } from '../strategy/orb-risk';

export interface RiskGateResult {
  name: string;
  passed: boolean;
  detail: string;
}

export interface RiskContext {
  portfolio: PortfolioState;
  accountVerifiedPaper: boolean;
  connectionOk: boolean;
  reconcileOk: boolean;
  dataFresh: boolean;
  dataDelayed: boolean;
  inRth: boolean;
  hasPosition: boolean;
  hasActiveEntry: boolean;
  quantity: number;
  stopDistance: number;
  entryPrice: number;
  duplicateSignal: boolean;
  killSwitch: boolean;
  haltNewOrders: boolean;
}

export function evaluateRiskGates(cfg: MaConfig, ctx: RiskContext): RiskGateResult[] {
  const add = (name: string, passed: boolean, detail: string): RiskGateResult => ({ name, passed, detail });
  const dailyLimit = ctx.portfolio.equity * cfg.dailyLossLimitPct;
  const weeklyLimit = ctx.portfolio.equity * cfg.weeklyLossLimitPct;
  const expectedRisk = ctx.quantity > 0 ? ctx.quantity * ctx.stopDistance : 0;
  const maxRisk = ctx.portfolio.equity * cfg.riskPerTradePct;
  const deploy = ctx.quantity * ctx.entryPrice;
  const maxDeploy = ctx.portfolio.equity * cfg.maxCapitalDeploymentPct;

  return [
    add('paper_account', ctx.accountVerifiedPaper, ctx.accountVerifiedPaper ? 'verified paper' : 'not verified'),
    add('connection', ctx.connectionOk, ctx.connectionOk ? 'connected' : 'disconnected'),
    add('reconciliation', ctx.reconcileOk, ctx.reconcileOk ? 'ok' : 'incomplete'),
    add('market_data_fresh', ctx.dataFresh && !ctx.dataDelayed, ctx.dataFresh && !ctx.dataDelayed ? 'fresh' : 'stale/delayed'),
    add('rth', ctx.inRth, ctx.inRth ? 'RTH' : 'outside RTH'),
    add('no_position', !ctx.hasPosition, !ctx.hasPosition ? 'flat' : 'position open'),
    add('no_active_entry', !ctx.hasActiveEntry, !ctx.hasActiveEntry ? 'no entry' : 'entry open'),
    add('max_trades', ctx.portfolio.tradesToday < cfg.maxTradesPerDay, `trades=${ctx.portfolio.tradesToday}`),
    add('daily_loss', ctx.portfolio.dailyPnl > -dailyLimit, `daily=${ctx.portfolio.dailyPnl}`),
    add('weekly_loss', ctx.portfolio.weeklyPnl > -weeklyLimit, `weekly=${ctx.portfolio.weeklyPnl}`),
    add('drawdown_pause', ctx.portfolio.drawdownPct < cfg.drawdownPausePct, `dd=${ctx.portfolio.drawdownPct}`),
    add('quantity', ctx.quantity > 0, `qty=${ctx.quantity}`),
    add('stop_distance', ctx.stopDistance > 0, `stopDist=${ctx.stopDistance}`),
    add('entry_price', ctx.entryPrice > 0, `entry=${ctx.entryPrice}`),
    add('max_risk', expectedRisk <= maxRisk * 1.01 + 1e-9, `risk=${expectedRisk}`),
    add('max_deployment', deploy <= maxDeploy + 1e-9, `deploy=${deploy}`),
    add('duplicate', !ctx.duplicateSignal, ctx.duplicateSignal ? 'duplicate' : 'unique'),
    add('kill_switch', !ctx.killSwitch, ctx.killSwitch ? 'ON' : 'off'),
    add('halt', !ctx.haltNewOrders, ctx.haltNewOrders ? 'halted' : 'ok'),
    add('shorts_disabled', !cfg.allowShorts || true, 'long-only'),
    add('paper_flags', cfg.tradingMode === 'signal' || canSubmitPaperOrders(cfg) || cfg.tradingMode === 'simulated', `mode=${cfg.tradingMode}`),
  ];
}

export function allGatesPassed(gates: RiskGateResult[]): boolean {
  return gates.every((g) => g.passed);
}
