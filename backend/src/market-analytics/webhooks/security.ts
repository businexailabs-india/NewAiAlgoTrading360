import crypto from 'crypto';

export interface OrbAlertPayload {
  schema_version: string;
  secret: string;
  strategy_id: string;
  signal_id: string;
  event: string;
  symbol: string;
  exchange?: string;
  timeframe?: string;
  bar_time?: string;
  side: string;
  reference_price: number;
  opening_range_high?: number;
  opening_range_low?: number;
  vwap?: number;
  ema?: number;
  atr?: number;
  stop_price?: number;
  target_price?: number;
  timestamp?: string | number;
}

export function redactSecret<T extends Record<string, unknown>>(payload: T): T {
  const copy = { ...payload };
  if ('secret' in copy) (copy as Record<string, unknown>).secret = '[REDACTED]';
  return copy;
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // compare equal-length dummy to keep timing relatively flat
    const dummy = Buffer.alloc(ba.length);
    crypto.timingSafeEqual(ba, dummy);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function verifySecret(provided: string, expectedPlainOrHash: string, isHash = false): boolean {
  if (!provided || !expectedPlainOrHash) return false;
  if (isHash) return timingSafeEqualStr(hashSecret(provided), expectedPlainOrHash);
  return timingSafeEqualStr(provided, expectedPlainOrHash);
}

export function parseOrbPayload(body: unknown): { ok: true; data: OrbAlertPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'invalid JSON' };
  const b = body as Record<string, unknown>;
  const required = ['schema_version', 'secret', 'strategy_id', 'signal_id', 'event', 'symbol', 'side', 'reference_price'];
  for (const k of required) {
    if (b[k] === undefined || b[k] === null || b[k] === '') return { ok: false, error: `missing ${k}` };
  }
  if (String(b.schema_version) !== '1.0') return { ok: false, error: 'unsupported schema_version' };
  const side = String(b.side).toLowerCase();
  if (side !== 'buy' && side !== 'long') return { ok: false, error: 'only long/buy supported' };
  const ref = Number(b.reference_price);
  if (!Number.isFinite(ref) || ref <= 0) return { ok: false, error: 'invalid reference_price' };
  return {
    ok: true,
    data: {
      schema_version: '1.0',
      secret: String(b.secret),
      strategy_id: String(b.strategy_id),
      signal_id: String(b.signal_id),
      event: String(b.event),
      symbol: String(b.symbol).toUpperCase(),
      exchange: b.exchange ? String(b.exchange) : undefined,
      timeframe: b.timeframe ? String(b.timeframe) : undefined,
      bar_time: b.bar_time ? String(b.bar_time) : undefined,
      side: 'buy',
      reference_price: ref,
      opening_range_high: b.opening_range_high != null ? Number(b.opening_range_high) : undefined,
      opening_range_low: b.opening_range_low != null ? Number(b.opening_range_low) : undefined,
      vwap: b.vwap != null ? Number(b.vwap) : undefined,
      ema: b.ema != null ? Number(b.ema) : undefined,
      atr: b.atr != null ? Number(b.atr) : undefined,
      stop_price: b.stop_price != null ? Number(b.stop_price) : undefined,
      target_price: b.target_price != null ? Number(b.target_price) : undefined,
      timestamp: b.timestamp as string | number | undefined,
    },
  };
}

export function isAlertExpired(
  payload: OrbAlertPayload,
  maxAgeSeconds: number,
  now = Date.now()
): boolean {
  const raw = payload.timestamp ?? payload.bar_time;
  if (raw == null) return false; // if missing, rely on replay store only
  let ts: number;
  if (typeof raw === 'number') ts = raw < 1e12 ? raw * 1000 : raw;
  else {
    const parsed = Date.parse(String(raw));
    if (Number.isNaN(parsed)) return true;
    ts = parsed;
  }
  return Math.abs(now - ts) > maxAgeSeconds * 1000;
}
