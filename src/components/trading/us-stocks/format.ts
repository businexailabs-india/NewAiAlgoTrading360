import type { CSSProperties } from 'react';
import type { IBKRConnectionProfile, TradingEnvironment } from './types';

/** Tabular numerals for price / qty / money columns. */
export const tabularStyle: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/**
 * Environment identity MUST come from the connection profile.
 * Never derive PAPER/LIVE from a bare boolean (isPaper) alone.
 */
export function environmentFromProfile(
  profile: Pick<IBKRConnectionProfile, 'environment'> | null | undefined
): TradingEnvironment | null {
  if (!profile) return null;
  if (profile.environment === 'PAPER' || profile.environment === 'LIVE') {
    return profile.environment;
  }
  return null;
}

/** Human labels — never ambiguous with a boolean toggle. */
export function envLabel(env: TradingEnvironment | null | undefined): string {
  if (env === 'PAPER') return 'PAPER TRADING';
  if (env === 'LIVE') return 'LIVE TRADING';
  return 'ENVIRONMENT UNKNOWN';
}

export function envShortLabel(env: TradingEnvironment | null | undefined): string {
  if (env === 'PAPER') return 'PAPER';
  if (env === 'LIVE') return 'LIVE';
  return '—';
}

export function documentTitleForEnv(env: TradingEnvironment | null | undefined): string {
  if (env === 'LIVE') return '[LIVE] US Stocks Trading';
  if (env === 'PAPER') return '[PAPER] US Stocks Trading';
  return 'US Stocks Trading';
}

export function formatUsd(amount: number | null | undefined, digits = 2): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${n < 0 ? '-' : ''}$${formatted}`;
}

export function formatUsdSigned(amount: number | null | undefined, digits = 2): string {
  if (amount == null || Number.isNaN(Number(amount))) return '—';
  const n = Number(amount);
  const body = formatUsd(Math.abs(n), digits);
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body.replace(/^-/, '')}`;
  return body;
}

export function formatQty(qty: number | null | undefined, fractional = false): string {
  if (qty == null || Number.isNaN(Number(qty))) return '—';
  const n = Number(qty);
  if (fractional) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatPrice(price: number | null | undefined, digits = 2): string {
  if (price == null || Number.isNaN(Number(price))) return '—';
  return Number(price).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, 4),
  });
}

export function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function liveConfirmButtonLabel(side: 'BUY' | 'SELL', qty: number): string {
  const q = Number.isInteger(qty) ? String(qty) : String(qty);
  return `LIVE ${side} ${q} SHARES`;
}

/** Material change fingerprint for preview invalidation (prices / MD state — not every asOf tick). */
export function quoteFingerprint(q: {
  last?: number;
  bid?: number;
  ask?: number;
  dataState?: string;
} | null | undefined): string {
  if (!q) return '';
  return [q.last ?? '', q.bid ?? '', q.ask ?? '', q.dataState ?? ''].join('|');
}

export function accountFingerprint(a: {
  netLiquidation?: number;
  buyingPower?: number;
  availableFunds?: number;
} | null | undefined): string {
  if (!a) return '';
  return [a.netLiquidation ?? '', a.buyingPower ?? '', a.availableFunds ?? ''].join('|');
}
