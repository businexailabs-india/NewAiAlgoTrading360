import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

export function generateWebhookSecret(): string {
  return `tv_${randomBytes(24).toString('hex')}`;
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function secretHint(secret: string): string {
  return secret.slice(-4);
}

export function validateSecret(provided: string | undefined, expectedHash: string): boolean {
  if (!provided) return false;
  const got = hashSecret(provided);
  try {
    return timingSafeEqual(Buffer.from(got), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

export function validateHmacHeader(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const got = signatureHeader.replace(/^sha256=/i, '').trim();
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  } catch {
    return false;
  }
}

/** Reject alerts older than maxAgeMs (default 5 minutes) or more than 1 min in the future */
export function isFreshTimestamp(ts: Date, maxAgeMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const t = ts.getTime();
  if (Number.isNaN(t)) return false;
  if (t - now > 60_000) return false;
  if (now - t > maxAgeMs) return false;
  return true;
}

export const NSE_SYMBOL_ALIASES: Record<string, string> = {
  RELIANCE: 'RELIANCE',
  'RELIANCE INDUSTRIES': 'RELIANCE',
  TCS: 'TCS',
  INFY: 'INFY',
  INFOSYS: 'INFY',
  HDFCBANK: 'HDFCBANK',
  'HDFC BANK': 'HDFCBANK',
  NIFTY: 'NIFTY',
  BANKNIFTY: 'BANKNIFTY'
};

export function mapSymbol(symbol: string): string {
  const key = symbol.toUpperCase().replace(/\.NS$/i, '').trim();
  return NSE_SYMBOL_ALIASES[key] || key.replace(/\s+/g, '');
}
