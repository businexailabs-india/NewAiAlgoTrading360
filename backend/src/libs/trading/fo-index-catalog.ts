import { getFoCommodity } from './fo-commodity-catalog';

/**
 * Index F&O underlyings aligned to Dhan scrip-master (OPTIDX / FUTIDX).
 * Lots & strike steps are taken from live Dhan CSV — update when NSE/BSE revises.
 *
 * NIFTYAUTO and other sector indices may have spot quotes but no index options/futures.
 */

export type FoExpiryMode = 'WEEKLY_AND_MONTHLY' | 'MONTHLY_ONLY';

export type FoIndexMeta = {
  symbol: string;
  name: string;
  aliases: string[];
  exchange: 'NSE' | 'BSE';
  /** Dhan IDX_I security id for optionchain / spot */
  dhanScripId: number;
  lot: number;
  step: number;
  /** Has OPTIDX + FUTIDX on Dhan */
  hasDerivatives: boolean;
  /**
   * Dhan OPTIDX pattern (Aug 2026):
   * - NIFTY / SENSEX → weeklies + monthlies
   * - Bank / Fin / Midcap / Next50 / FPI / Bankex / Sensex50 / FOCIT → monthly only
   */
  expiryMode: FoExpiryMode;
};

/** Equity-index F&O available on Dhan (NSE + BSE). */
export const FO_INDEX_CATALOG: FoIndexMeta[] = [
  {
    symbol: 'NIFTY',
    name: 'Nifty 50 Index',
    aliases: ['NIFTY', 'NIFTY50', 'NIFTY 50'],
    exchange: 'NSE',
    dhanScripId: 13,
    lot: 65,
    step: 50,
    hasDerivatives: true,
    expiryMode: 'WEEKLY_AND_MONTHLY'
  },
  {
    symbol: 'BANKNIFTY',
    name: 'Nifty Bank Index',
    aliases: ['BANKNIFTY', 'BANK NIFTY', 'NIFTY BANK'],
    exchange: 'NSE',
    dhanScripId: 25,
    lot: 30,
    step: 100,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  },
  {
    symbol: 'FINNIFTY',
    name: 'Nifty Financial Services Index',
    aliases: ['FINNIFTY', 'FIN NIFTY', 'NIFTY FIN SERVICE'],
    exchange: 'NSE',
    dhanScripId: 27,
    lot: 60,
    step: 50,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  },
  {
    symbol: 'MIDCPNIFTY',
    name: 'Nifty Midcap Select Index',
    aliases: ['MIDCPNIFTY', 'MIDCAP NIFTY', 'NIFTY MID SELECT'],
    exchange: 'NSE',
    dhanScripId: 442,
    lot: 120,
    step: 25,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  },
  {
    symbol: 'NIFTYNXT50',
    name: 'Nifty Next 50 Index',
    aliases: ['NIFTYNXT50', 'NIFTY NEXT 50', 'NIFTYNXT'],
    exchange: 'NSE',
    dhanScripId: 38,
    lot: 25,
    step: 100,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  },
  {
    symbol: 'NIFTYFPI',
    name: 'Nifty India Financials / FPI Index',
    aliases: ['NIFTYFPI', 'NIFTY FPI'],
    exchange: 'NSE',
    dhanScripId: 864,
    lot: 1100,
    step: 5,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  },
  {
    symbol: 'SENSEX',
    name: 'BSE Sensex Index',
    aliases: ['SENSEX'],
    exchange: 'BSE',
    dhanScripId: 51,
    lot: 20,
    step: 100,
    hasDerivatives: true,
    expiryMode: 'WEEKLY_AND_MONTHLY'
  },
  {
    symbol: 'BANKEX',
    name: 'BSE Bankex Index',
    aliases: ['BANKEX'],
    exchange: 'BSE',
    dhanScripId: 12,
    lot: 30,
    step: 100,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  },
  {
    symbol: 'SENSEX50',
    name: 'BSE Sensex 50 Index',
    aliases: ['SENSEX50', 'SENSEX 50'],
    exchange: 'BSE',
    dhanScripId: 0,
    lot: 75,
    step: 50,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  },
  {
    symbol: 'FOCIT',
    name: 'BSE FOCIT Index',
    aliases: ['FOCIT'],
    exchange: 'BSE',
    dhanScripId: 0,
    lot: 45,
    step: 100,
    hasDerivatives: true,
    expiryMode: 'MONTHLY_ONLY'
  }
];

/** Spot-only indices (no OPTIDX/FUTIDX on Dhan). */
export const SPOT_ONLY_INDICES: Array<{
  symbol: string;
  name: string;
  aliases: string[];
  dhanScripId?: number;
}> = [
  { symbol: 'NIFTYAUTO', name: 'Nifty Auto Index', aliases: ['NIFTYAUTO', 'NIFTY AUTO'], dhanScripId: 14 },
  { symbol: 'NIFTYIT', name: 'Nifty IT Index', aliases: ['NIFTYIT', 'NIFTY IT'], dhanScripId: 35 },
  { symbol: 'INDIAVIX', name: 'India VIX', aliases: ['INDIAVIX', 'INDIA VIX'] }
];

const BY_SYMBOL = new Map(FO_INDEX_CATALOG.map((x) => [x.symbol, x]));

export function getFoIndex(symbol: string): FoIndexMeta | undefined {
  const key = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (BY_SYMBOL.has(key)) return BY_SYMBOL.get(key);
  return FO_INDEX_CATALOG.find(
    (x) =>
      x.symbol === key ||
      x.aliases.some((a) => a.replace(/\s+/g, '').toUpperCase() === key)
  );
}

/** True when the index lists weekly OPTIDX on Dhan (Nifty / Sensex only today). */
export function hasWeeklyExpiries(underlying: string): boolean {
  if (getFoCommodity(underlying)) return false;
  const mode = getFoIndex(underlying)?.expiryMode;
  if (!mode) return true;
  return mode === 'WEEKLY_AND_MONTHLY';
}

export function isMonthlyOnlyUnderlying(underlying: string): boolean {
  if (getFoCommodity(underlying)) return true;
  return getFoIndex(underlying)?.expiryMode === 'MONTHLY_ONLY';
}

export function foStrikeStep(underlying: string, spot?: number): number {
  const com = getFoCommodity(underlying);
  if (com) return com.step;
  const meta = getFoIndex(underlying);
  if (meta) return meta.step;
  const s = spot ?? 0;
  if (s >= 5000) return 100;
  if (s >= 1000) return 50;
  if (s >= 100) return 5;
  return 1;
}

export function foLotSize(underlying: string, fallback = 65): number {
  return getFoCommodity(underlying)?.lot ?? getFoIndex(underlying)?.lot ?? fallback;
}

export function foDerivativeUnderlyings(): FoIndexMeta[] {
  return FO_INDEX_CATALOG.filter((x) => x.hasDerivatives);
}

/**
 * Normalize Dhan master underlying from trading / custom symbol.
 * Prefer hyphen prefix of trading symbol (NIFTYNXT50-Aug2026-…).
 */
export function normalizeDhanUnderlying(
  tradingSymbol: string,
  customSymbol?: string,
  smSymbolName?: string
): string {
  const head = (raw?: string) => {
    if (!raw) return '';
    const t = raw.trim();
    if (!t) return '';
    if (t.includes('-')) return t.split('-')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sp = t.toUpperCase().split(/\s+/)[0];
    return sp.replace(/[^A-Z0-9]/g, '');
  };

  let u = head(smSymbolName) || head(tradingSymbol) || head(customSymbol);
  if (/(OPT|FUT)$/.test(u)) {
    const t = head(tradingSymbol);
    if (t && !/(OPT|FUT)$/.test(t)) u = t;
    else u = u.replace(/(OPT|FUT)$/, '');
  }

  const aliases: Record<string, string> = {
    NIFTY50: 'NIFTY',
    NIFTYNXT: 'NIFTYNXT50',
    BSX: 'SENSEX',
    BKX: 'BANKEX',
    SX50: 'SENSEX50'
  };
  return aliases[u] || u;
}

export function isIndexFoUnderlying(symbol: string): boolean {
  return Boolean(getFoIndex(symbol)?.hasDerivatives);
}
