import type { MoneyFormat, Position, AggregatedPosition, CurrencyConversion, Money } from './types';

/** Indian-style grouping for INR display. */
export function formatInrExact(amount: number, digits = 2): string {
  const n = Number(amount) || 0;
  const neg = n < 0;
  const abs = Math.abs(n);
  const fixed = abs.toFixed(digits);
  const [intPart, dec] = fixed.split('.');
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
    : last3;
  return `${neg ? '-' : ''}₹${grouped}${digits > 0 ? `.${dec}` : ''}`;
}

export function formatInrLakhsCrores(amount: number): string {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} crore`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} lakh`;
  return formatInrExact(n, 0);
}

export function formatCompact(amount: number, currency = 'INR'): string {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const prefix = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;
  if (abs >= 1e7) return `${sign}${prefix}${(abs / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${sign}${prefix}${(abs / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${prefix}${abs.toFixed(0)}`;
}

export function formatMoney(amount: number, format: MoneyFormat, currency = 'INR'): string {
  if (currency !== 'INR' && format === 'exact') {
    return `${currency === 'USD' ? '$' : currency + ' '}${Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (format === 'lakhs') return formatInrLakhsCrores(amount);
  if (format === 'compact') return formatCompact(amount, currency);
  return formatInrExact(amount);
}

export function formatPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '—';
  const v = Number(n);
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

export function formatTs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function convertMoney(
  money: Money,
  toCurrency: string,
  conversions: CurrencyConversion[]
): { amount: number; conversion: CurrencyConversion | null; warning: string | null } {
  if (money.currency === toCurrency) {
    return { amount: money.amount, conversion: null, warning: null };
  }
  const hit = conversions.find((c) => c.from === money.currency && c.to === toCurrency);
  if (!hit) {
    return {
      amount: NaN,
      conversion: null,
      warning: `No FX rate ${money.currency}→${toCurrency}; values not summed without conversion.`,
    };
  }
  return {
    amount: money.amount * hit.rate,
    conversion: hit,
    warning: hit.stale ? `FX rate ${money.currency}→${toCurrency} is stale (${hit.timestamp}).` : null,
  };
}

/** Aggregate only identical contracts (exchange+expiry+strike+option+product+canonical). */
export function aggregatePositions(positions: Position[]): AggregatedPosition[] {
  const map = new Map<string, Position[]>();
  for (const p of positions) {
    const key = [
      p.exchange,
      p.canonicalInstrumentId,
      p.productType,
      p.expiry ?? '',
      p.strike ?? '',
      p.optionType ?? '',
      p.segment,
    ].join('|');
    const list = map.get(key) || [];
    list.push(p);
    map.set(key, list);
  }

  return Array.from(map.entries()).map(([key, children]) => {
    const netQty = children.reduce((s, c) => s + c.netQty, 0);
    const absQtySum = children.reduce((s, c) => s + Math.abs(c.netQty), 0);
    const weightedAvgPrice =
      absQtySum > 0
        ? children.reduce((s, c) => s + c.avgPrice * Math.abs(c.netQty), 0) / absQtySum
        : 0;
    const first = children[0];
    return {
      key,
      symbol: first.symbol,
      exchange: first.exchange,
      segment: first.segment,
      productType: first.productType,
      expiry: first.expiry,
      strike: first.strike,
      optionType: first.optionType,
      canonicalInstrumentId: first.canonicalInstrumentId,
      netQty,
      weightedAvgPrice,
      marketValue: children.reduce((s, c) => s + c.marketValue, 0),
      dayPnl: children.reduce((s, c) => s + c.dayPnl, 0),
      unrealizedPnl: children.reduce((s, c) => s + c.unrealizedPnl, 0),
      realizedPnl: children.reduce((s, c) => s + c.realizedPnl, 0),
      children,
    };
  });
}

export function sumPnl(positions: Position[]) {
  return {
    day: positions.reduce((s, p) => s + p.dayPnl, 0),
    unrealized: positions.reduce((s, p) => s + p.unrealizedPnl, 0),
    realized: positions.reduce((s, p) => s + p.realizedPnl, 0),
    longExposure: positions.filter((p) => p.netQty > 0).reduce((s, p) => s + Math.abs(p.marketValue), 0),
    shortExposure: positions.filter((p) => p.netQty < 0).reduce((s, p) => s + Math.abs(p.marketValue), 0),
  };
}
