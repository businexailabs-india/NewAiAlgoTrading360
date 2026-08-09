import { MaConfig } from '../config';

export interface PortfolioState {
  equity: number;
  equityPeak: number;
  dailyPnl: number;
  weeklyPnl: number;
  drawdownPct: number;
  tradesToday: number;
  monthlySizingEquity: number;
  openQuantity: number;
  hasActiveEntry: boolean;
}

export interface SizeResult {
  quantity: number;
  riskAmount: number;
  riskQuantity: number;
  capitalQuantity: number;
  effectiveRiskPct: number;
  rejection?: string;
}

export function effectiveRiskPct(cfg: MaConfig, drawdownPct: number): number {
  if (drawdownPct >= cfg.drawdownPausePct) return 0;
  if (drawdownPct >= cfg.drawdownReduceRiskPct) return cfg.riskPerTradePct * 0.5;
  return cfg.riskPerTradePct;
}

export function sizePosition(
  cfg: MaConfig,
  opts: { entryPrice: number; stopDistance: number; portfolio: PortfolioState; minTick: number }
): SizeResult {
  const { entryPrice, stopDistance, portfolio } = opts;
  if (entryPrice <= 0 || stopDistance <= 0) {
    return { quantity: 0, riskAmount: 0, riskQuantity: 0, capitalQuantity: 0, effectiveRiskPct: 0, rejection: 'invalid entry/stop' };
  }
  const sizingEquity =
    cfg.positionSizeUpdate === 'monthly' ? portfolio.monthlySizingEquity : portfolio.equity;
  const eff = effectiveRiskPct(cfg, portfolio.drawdownPct);
  if (eff <= 0) {
    return { quantity: 0, riskAmount: 0, riskQuantity: 0, capitalQuantity: 0, effectiveRiskPct: eff, rejection: 'risk paused by drawdown' };
  }
  const cost = cfg.estimatedCommissionPerShare + cfg.estimatedSlippagePerShare * 2; // entry+exit slippage
  const perShareRisk = stopDistance + cost;
  const riskAmount = sizingEquity * eff;
  const riskQuantity = Math.floor(riskAmount / perShareRisk);
  const capitalQuantity = Math.floor((sizingEquity * cfg.maxCapitalDeploymentPct) / entryPrice);
  const quantity = Math.min(riskQuantity, capitalQuantity);
  if (quantity <= 0) {
    return { quantity: 0, riskAmount, riskQuantity, capitalQuantity, effectiveRiskPct: eff, rejection: 'zero quantity' };
  }
  return { quantity, riskAmount, riskQuantity, capitalQuantity, effectiveRiskPct: eff };
}

export function roundToTick(price: number, minTick: number, mode: 'up' | 'down' | 'nearest' = 'nearest'): number {
  if (minTick <= 0) return price;
  const steps = price / minTick;
  if (mode === 'down') return Math.floor(steps) * minTick;
  if (mode === 'up') return Math.ceil(steps) * minTick;
  return Math.round(steps) * minTick;
}

export function computeOrbPrices(
  cfg: MaConfig,
  opts: { referencePrice: number; atr: number; candleLow: number; minTick: number; useStructuralStop?: boolean }
): { entry: number; stop: number; target: number; stopDistance: number } {
  const tick = opts.minTick || 0.01;
  const atrStop = opts.referencePrice - cfg.atrStopMultiplier * opts.atr;
  const structural = opts.useStructuralStop !== false ? opts.candleLow : atrStop;
  let stop = Math.max(atrStop, structural);
  const minDist = opts.referencePrice * 0.001;
  let stopDistance = opts.referencePrice - stop;
  if (stopDistance < minDist) {
    stop = opts.referencePrice - minDist;
    stopDistance = minDist;
  }
  const entry = roundToTick(opts.referencePrice + tick, tick, 'up');
  stop = roundToTick(stop, tick, 'down');
  stopDistance = entry - stop;
  const target = roundToTick(entry + cfg.rewardRiskRatio * stopDistance, tick, 'nearest');
  return { entry, stop, target, stopDistance };
}
