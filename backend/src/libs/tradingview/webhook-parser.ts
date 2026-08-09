export type RawAlertPayload = Record<string, unknown>;

export type NormalizedSignalDraft = {
  strategyId?: string;
  symbol: string;
  exchange: string;
  assetClass: string;
  side: 'BUY' | 'SELL' | 'EXIT';
  signalType: string;
  timeframe?: string;
  price?: number;
  quantity: number;
  stopLoss?: number;
  target?: number;
  confidenceScore: number;
  timestamp: Date;
  rawPayloadRedacted: Record<string, unknown>;
  message?: string;
};

function redact(payload: RawAlertPayload): Record<string, unknown> {
  const out = { ...payload };
  if ('secret' in out) out.secret = '[REDACTED]';
  if ('token' in out) out.token = '[REDACTED]';
  return out;
}

function parseSide(v: unknown): 'BUY' | 'SELL' | 'EXIT' | null {
  const s = String(v || '').toUpperCase().trim();
  if (s === 'BUY' || s === 'LONG' || s === 'B') return 'BUY';
  if (s === 'SELL' || s === 'SHORT' || s === 'S') return 'SELL';
  if (s === 'EXIT' || s === 'CLOSE' || s === 'FLAT') return 'EXIT';
  return null;
}

function parseNaturalMessage(message: string): Partial<NormalizedSignalDraft> | null {
  const m = message.trim();
  const sideMatch = m.match(/\b(BUY|SELL|EXIT|LONG|SHORT|CLOSE)\b/i);
  const symbolMatch = m.match(/\b([A-Z]{2,15})\b/);
  if (!sideMatch) return null;
  const side = parseSide(sideMatch[1]);
  if (!side) return null;
  // Prefer ticker after side word
  const after = m.slice(m.toLowerCase().indexOf(sideMatch[0].toLowerCase()) + sideMatch[0].length);
  const sym = after.match(/\b([A-Z]{2,15})\b/) || symbolMatch;
  const tf = m.match(/\b(\d+\s*[mhd]|daily|weekly)\b/i);
  const typeMatch = m.match(/\b(VWAP|RSI|ORB|BREAKOUT|MEAN\s*REVERSION|SUPERTREND)[_\s-]*([A-Z]+)?/i);
  return {
    side,
    symbol: (sym?.[1] || 'UNKNOWN').toUpperCase(),
    signalType: typeMatch ? typeMatch[0].replace(/\s+/g, '_').toUpperCase() : 'TV_ALERT',
    timeframe: tf?.[1]?.replace(/\s+/g, '') || undefined,
    message: m
  };
}

export function normalizeTradingViewPayload(payload: RawAlertPayload): NormalizedSignalDraft {
  const redacted = redact(payload);

  // Natural message form
  if (typeof payload.message === 'string' && payload.message.trim() && !payload.side) {
    const nat = parseNaturalMessage(payload.message);
    if (nat?.side && nat.symbol) {
      return {
        strategyId: payload.strategy_id ? String(payload.strategy_id) : undefined,
        symbol: nat.symbol,
        exchange: String(payload.exchange || 'NSE').toUpperCase(),
        assetClass: String(payload.asset_class || 'EQUITY').toUpperCase(),
        side: nat.side,
        signalType: nat.signalType || 'TV_NATURAL',
        timeframe: nat.timeframe || (payload.timeframe ? String(payload.timeframe) : undefined),
        price: payload.price != null ? Number(payload.price) : undefined,
        quantity: payload.quantity != null ? Number(payload.quantity) : 1,
        stopLoss: payload.stop_loss != null ? Number(payload.stop_loss) : undefined,
        target: payload.target != null ? Number(payload.target) : undefined,
        confidenceScore: 0.65,
        timestamp: payload.timestamp ? new Date(String(payload.timestamp)) : new Date(),
        rawPayloadRedacted: redacted,
        message: nat.message
      };
    }
  }

  const side = parseSide(payload.side || payload.action || payload.order);
  if (!side) {
    throw new Error('Invalid or missing side');
  }
  const symbol = String(payload.symbol || payload.ticker || '')
    .toUpperCase()
    .replace(/\.NS$/i, '')
    .trim();
  if (!symbol) throw new Error('Invalid or missing symbol');

  const tsRaw = payload.timestamp || payload.time || payload.timenow;
  let timestamp = new Date();
  if (tsRaw != null && String(tsRaw).trim()) {
    const n = Number(tsRaw);
    timestamp = Number.isFinite(n) && n > 1e11 ? new Date(n) : new Date(String(tsRaw));
    if (Number.isNaN(timestamp.getTime())) timestamp = new Date();
  }

  return {
    strategyId: payload.strategy_id ? String(payload.strategy_id) : undefined,
    symbol,
    exchange: String(payload.exchange || 'NSE').toUpperCase(),
    assetClass: String(payload.asset_class || 'EQUITY').toUpperCase(),
    side,
    signalType: String(payload.signal_type || payload.strategy || 'TV_ALERT').toUpperCase(),
    timeframe: payload.timeframe ? String(payload.timeframe) : undefined,
    price: payload.price != null && payload.price !== '' ? Number(payload.price) : undefined,
    quantity: payload.quantity != null && payload.quantity !== '' ? Number(payload.quantity) : 1,
    stopLoss:
      payload.stop_loss != null && payload.stop_loss !== '' && Number(payload.stop_loss) !== 0
        ? Number(payload.stop_loss)
        : undefined,
    target:
      payload.target != null && payload.target !== '' && Number(payload.target) !== 0
        ? Number(payload.target)
        : undefined,
    confidenceScore: payload.confidence != null ? Number(payload.confidence) : 0.75,
    timestamp,
    rawPayloadRedacted: redacted
  };
}

export function buildIdempotencyKey(
  connectionId: string,
  draft: NormalizedSignalDraft,
  raw: RawAlertPayload
): string {
  if (raw.idempotency_key) return String(raw.idempotency_key);
  const bucket = Math.floor(draft.timestamp.getTime() / 60_000); // 1-min dedupe window
  return `${connectionId}:${draft.symbol}:${draft.side}:${draft.signalType}:${bucket}:${draft.price ?? 'na'}`;
}
