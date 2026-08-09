export interface PreapprovalRuleLike {
  enabled: boolean;
  revokedAt?: Date | null;
  validFrom: Date;
  validUntil: Date;
  mode: string;
  allowedSymbols: unknown;
  allowedExchanges: unknown;
  allowedInstrumentTypes: unknown;
  allowedSides: unknown;
  maxQuantityPerOrder: number;
  maxOrderValue?: number | null;
  maxRiskPerTrade?: number | null;
  requiresStopLoss: boolean;
  allowedTimeWindowStart?: string | null;
  allowedTimeWindowEnd?: string | null;
  strategyId?: string | null;
  algoId?: string | null;
  accountId?: string | null;
}

export interface IntentLike {
  symbol: string;
  exchange?: string;
  instrumentType?: string;
  side: string;
  quantity: number;
  price?: number | null;
  stopLoss?: number | null;
  mode: string;
  strategyId?: string | null;
  selectedAlgoId?: string | null;
  accountId?: string | null;
}

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  return [];
}

function inTimeWindow(start?: string | null, end?: string | null, now = new Date()): boolean {
  if (!start || !end) return true;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  const s = sh * 60 + (sm || 0);
  const e = eh * 60 + (em || 0);
  if (s <= e) return mins >= s && mins <= e;
  return mins >= s || mins <= e;
}

export function validatePreapprovalRule(
  rule: PreapprovalRuleLike,
  intent: IntentLike,
  opts?: { estimatedMaxLoss?: number; now?: Date }
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const now = opts?.now || new Date();

  if (!rule.enabled) reasons.push('Rule disabled');
  if (rule.revokedAt) reasons.push('Rule revoked');
  if (now < rule.validFrom) reasons.push('Rule not yet valid');
  if (now > rule.validUntil) reasons.push('PREAPPROVAL_EXPIRED');
  if (rule.mode !== intent.mode && !(rule.mode === 'PAPER' && intent.mode === 'PAPER')) {
    if (intent.mode === 'LIVE' && rule.mode !== 'LIVE') reasons.push('Rule mode is not LIVE');
  }

  const symbols = asStringArray(rule.allowedSymbols).map((s) => s.toUpperCase());
  if (symbols.length && !symbols.includes(intent.symbol.toUpperCase())) {
    reasons.push('Symbol not in preapproval rule');
  }
  const exchanges = asStringArray(rule.allowedExchanges);
  if (exchanges.length && intent.exchange && !exchanges.includes(intent.exchange)) {
    reasons.push('Exchange not allowed');
  }
  const types = asStringArray(rule.allowedInstrumentTypes);
  if (types.length && intent.instrumentType && !types.includes(intent.instrumentType)) {
    reasons.push('Instrument type not allowed');
  }
  const sides = asStringArray(rule.allowedSides);
  if (sides.length && !sides.includes(intent.side)) reasons.push('Side not allowed');
  if (intent.quantity > rule.maxQuantityPerOrder) reasons.push('Quantity above preapproval limit');
  const notional = (intent.price || 0) * intent.quantity;
  if (rule.maxOrderValue != null && notional > rule.maxOrderValue) {
    reasons.push('Order value above preapproval limit');
  }
  if (rule.requiresStopLoss && (intent.stopLoss == null || intent.stopLoss <= 0)) {
    reasons.push('Stop-loss required by preapproval rule');
  }
  if (!inTimeWindow(rule.allowedTimeWindowStart, rule.allowedTimeWindowEnd, now)) {
    reasons.push('Outside allowed time window');
  }
  if (rule.strategyId && intent.strategyId && rule.strategyId !== intent.strategyId) {
    reasons.push('Strategy mismatch');
  }
  if (rule.algoId && intent.selectedAlgoId && rule.algoId !== intent.selectedAlgoId) {
    reasons.push('Algo mismatch');
  }
  if (rule.accountId && intent.accountId && rule.accountId !== intent.accountId) {
    reasons.push('Account mismatch');
  }
  if (
    rule.maxRiskPerTrade != null &&
    opts?.estimatedMaxLoss != null &&
    opts.estimatedMaxLoss > rule.maxRiskPerTrade
  ) {
    reasons.push('Risk per trade exceeds preapproval');
  }

  return { ok: reasons.length === 0, reasons };
}
