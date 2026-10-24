import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { tradingApi, type Instrument, type MarketQuote, type ContractQuote, type FoExpiryEntry } from '@/api/trading';
import { ChartTradePanel } from '@/components/trading/ChartTradePanel';
import { StockChartModal } from '@/components/StockChartModal';
import type { WatchlistItem } from '@/api/watchlist';
import { useBasketOrders, useInstrumentSearch } from '@/hooks/trading/useTradingTerminal';
import { useMarketData } from '@/contexts/MarketDataContext';
import { useTheme } from '@/contexts/ThemeContext';
import { TerminalWatchlists } from './TerminalWatchlists';
import {
  addPaperBasketLeg,
  addPaperBasketLegs,
  createPaperBasket,
  paperLegMargin,
  patchPaperBasketLeg,
  removePaperBasketLeg,
  duplicatePaperBasket,
  executePaperBasket,
  exitPaperBasket,
  getPaperBasket,
  isLocalPaperBasketId,
  previewPaperBasket,
  setPaperBasketExit,
  updatePaperBasket,
  type PaperBasket
} from './paperBaskets';

const FO_STRIKE_STEP: Record<string, number> = {
  NIFTY: 50,
  BANKNIFTY: 100,
  FINNIFTY: 50,
  MIDCPNIFTY: 25,
  NIFTYNXT50: 100,
  NIFTYFPI: 5,
  SENSEX: 100,
  BANKEX: 100,
  SENSEX50: 50,
  FOCIT: 100,
  GOLD: 100,
  GOLDM: 100,
  GOLDGUINEA: 100,
  GOLDPETAL: 50,
  SILVER: 250,
  SILVERM: 250,
  SILVERMIC: 250,
  CRUDEOIL: 50,
  CRUDEOILM: 50,
  NATURALGAS: 5,
  NATGASMINI: 5,
  COPPER: 5,
  ZINC: 5,
  ALUMINIUM: 1,
  LEAD: 1,
  NICKEL: 10,
  COTTON: 100,
  MENTHAOIL: 10,
  CPO: 10
};

/** Most-traded index desks — one click opens monthly option chain. */
const QUICK_INDICES: Array<{
  symbol: string;
  label: string;
  lot: number;
  step: number;
  exchange: string;
}> = [
  { symbol: 'NIFTY', label: 'NIFTY', lot: 65, step: 50, exchange: 'NSE' },
  { symbol: 'BANKNIFTY', label: 'BANK NIFTY', lot: 30, step: 100, exchange: 'NSE' },
  { symbol: 'FINNIFTY', label: 'FIN NIFTY', lot: 60, step: 50, exchange: 'NSE' },
  { symbol: 'MIDCPNIFTY', label: 'MIDCAP NIFTY', lot: 120, step: 25, exchange: 'NSE' },
  { symbol: 'SENSEX', label: 'SENSEX', lot: 20, step: 100, exchange: 'BSE' }
];

const INDEX_SYMBOLS = new Set(QUICK_INDICES.map((i) => i.symbol));

const QUICK_COMMODITIES: Array<{
  symbol: string;
  label: string;
  lot: number;
  step: number;
  exchange: string;
}> = [
  { symbol: 'GOLD', label: 'GOLD', lot: 1, step: 100, exchange: 'MCX' },
  { symbol: 'SILVER', label: 'SILVER', lot: 1, step: 250, exchange: 'MCX' },
  { symbol: 'CRUDEOIL', label: 'CRUDE OIL', lot: 1, step: 50, exchange: 'MCX' },
  { symbol: 'NATURALGAS', label: 'NAT GAS', lot: 1, step: 5, exchange: 'MCX' },
  { symbol: 'COPPER', label: 'COPPER', lot: 1, step: 5, exchange: 'MCX' },
  { symbol: 'ZINC', label: 'ZINC', lot: 1, step: 5, exchange: 'MCX' }
];

const COMMODITY_SCRIPTS: Array<{
  symbol: string;
  label: string;
  lot: number;
  step: number;
  exchange: string;
}> = [
  ...QUICK_COMMODITIES,
  { symbol: 'GOLDM', label: 'GOLD MINI', lot: 1, step: 100, exchange: 'MCX' },
  { symbol: 'GOLDGUINEA', label: 'GOLD GUINEA', lot: 1, step: 100, exchange: 'MCX' },
  { symbol: 'GOLDPETAL', label: 'GOLD PETAL', lot: 1, step: 50, exchange: 'MCX' },
  { symbol: 'SILVERM', label: 'SILVER MINI', lot: 1, step: 250, exchange: 'MCX' },
  { symbol: 'SILVERMIC', label: 'SILVER MICRO', lot: 1, step: 250, exchange: 'MCX' },
  { symbol: 'CRUDEOILM', label: 'CRUDE MINI', lot: 1, step: 50, exchange: 'MCX' },
  { symbol: 'NATGASMINI', label: 'NG MINI', lot: 1, step: 5, exchange: 'MCX' },
  { symbol: 'ALUMINIUM', label: 'ALUMINIUM', lot: 1, step: 1, exchange: 'MCX' },
  { symbol: 'LEAD', label: 'LEAD', lot: 1, step: 1, exchange: 'MCX' },
  { symbol: 'NICKEL', label: 'NICKEL', lot: 1, step: 10, exchange: 'MCX' },
  { symbol: 'COTTON', label: 'COTTON', lot: 1, step: 100, exchange: 'MCX' },
  { symbol: 'MENTHAOIL', label: 'MENTHA OIL', lot: 1, step: 10, exchange: 'MCX' },
  { symbol: 'CPO', label: 'CPO', lot: 1, step: 10, exchange: 'MCX' }
];

const COMMODITY_SYMBOLS = new Set(COMMODITY_SCRIPTS.map((i) => i.symbol));

const STOCK_FO_LOT: Record<string, number> = {
  RELIANCE: 250,
  TCS: 175,
  INFY: 400,
  HDFCBANK: 550,
  ICICIBANK: 700,
  SBIN: 750,
  ITC: 1600,
  BHARTIARTL: 475,
  AXISBANK: 625,
  KOTAKBANK: 400,
  LT: 150,
  MARUTI: 50,
  TATAMOTORS: 550,
  WIPRO: 1500
};

function isIndexSymbol(symbol: string) {
  const s = symbol.toUpperCase();
  return INDEX_SYMBOLS.has(s) || s === 'BANKEX' || s === 'NIFTYNXT50';
}

function isCommoditySymbol(symbol: string) {
  return COMMODITY_SYMBOLS.has(symbol.toUpperCase());
}

function underlyingOf(inst: Instrument) {
  const raw = String(inst.underlying_symbol || inst.symbol || '')
    .toUpperCase()
    .replace(/FUT$/i, '')
    .replace(/\d{2,6}(CE|PE)$/i, '');
  return raw || inst.symbol.toUpperCase();
}

function deskTargetFor(symbol: string, name?: string, exchange?: string): (typeof QUICK_INDICES)[number] {
  const s = symbol.toUpperCase();
  const qc = [...COMMODITY_SCRIPTS].sort((a, b) => b.symbol.length - a.symbol.length).find((i) => i.symbol === s);
  if (qc) return qc;
  const qi = QUICK_INDICES.find((i) => i.symbol === s);
  if (qi) return qi;
  return {
    symbol: s,
    label: (name || s).toUpperCase(),
    lot: STOCK_FO_LOT[s] || (isCommoditySymbol(s) ? 1 : 250),
    step: FO_STRIKE_STEP[s] || 10,
    exchange: exchange === 'MCX' ? 'MCX' : exchange === 'BSE' ? 'BSE' : 'NSE'
  };
}

function uniqueSearchHits(rows: Instrument[], q = ''): Instrument[] {
  const seen = new Set<string>();
  const out: Instrument[] = [];
  const needle = q.trim().toUpperCase().replace(/[\s/_-]+/g, '');
  if (needle) {
    const wantAll = ['MCX', 'COMMODITY', 'COMMODITIES'].includes(needle);
    for (const c of COMMODITY_SCRIPTS) {
      if (
        !wantAll &&
        !c.symbol.includes(needle) &&
        !c.label.replace(/\s+/g, '').includes(needle) &&
        !needle.includes(c.symbol)
      ) {
        continue;
      }
      if (seen.has(c.symbol)) continue;
      seen.add(c.symbol);
      out.push({
        instrument_id: `mcx-${c.symbol}`,
        symbol: c.symbol,
        display_name: c.label,
        exchange: 'MCX',
        segment: 'MCX',
        asset_class: 'COMMODITY',
        instrument_type: 'COMMODITY',
        tradable: false,
        direct_trading_allowed: false,
        lot_size: 1,
        tick_size: 0.05,
        trading_status: 'OPEN'
      });
    }
  }
  for (const r of rows || []) {
    const und = underlyingOf(r);
    if (!und || seen.has(und)) continue;
    seen.add(und);
    const index = isIndexSymbol(und);
    const mcx = isCommoditySymbol(und) || r.exchange === 'MCX' || r.instrument_type === 'COMMODITY';
    out.push({
      ...r,
      symbol: und,
      display_name: r.display_name || und,
      exchange: mcx ? 'MCX' : r.exchange,
      instrument_type: mcx ? 'COMMODITY' : index ? 'INDEX' : 'STOCK',
      segment: mcx ? 'MCX' : index ? 'IDX' : 'EQ',
      asset_class: mcx ? 'COMMODITY' : index ? 'INDEX' : 'EQUITY',
      lot_size: 1,
      tradable: !index && !mcx,
      direct_trading_allowed: !index && !mcx
    });
    if (out.length >= 16) break;
  }
  return out;
}

const FALLBACK_SPOT: Record<string, number> = {
  NIFTY: 22650,
  BANKNIFTY: 55000,
  FINNIFTY: 24900,
  MIDCPNIFTY: 13800,
  SENSEX: 72800,
  GOLD: 125000,
  GOLDM: 125000,
  GOLDGUINEA: 125000,
  GOLDPETAL: 12500,
  SILVER: 155000,
  SILVERM: 155000,
  SILVERMIC: 155000,
  CRUDEOIL: 5800,
  CRUDEOILM: 5800,
  NATURALGAS: 320,
  NATGASMINI: 320,
  COPPER: 850,
  ZINC: 280,
  ALUMINIUM: 245,
  LEAD: 185,
  NICKEL: 1550,
  COTTON: 54000,
  MENTHAOIL: 920,
  CPO: 900
};

function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number) {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const diff = (last.getUTCDay() - weekday + 7) % 7;
  last.setUTCDate(last.getUTCDate() - diff);
  return last;
}

function paperMonthlyExpiry(symbol: string) {
  return paperMonthlyExpiries(symbol, 1)[0] || { date: '', label: 'FUT' };
}

function paperMonthlyExpiries(symbol: string, count = 3) {
  const weekday = /SENSEX|BANKEX/i.test(symbol) ? 4 : 2;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const out: Array<{ date: string; label: string }> = [];
  const now = new Date();
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  for (let i = 0; i < 14 && out.length < count; i++) {
    const d = lastWeekdayOfMonth(y, m, weekday);
    if (d.getTime() >= Date.now() - 36 * 3600 * 1000) {
      out.push({ date: d.toISOString().slice(0, 10), label: `${months[d.getUTCMonth()]} ${d.getUTCDate()}` });
    }
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

function paperOptionInstrument(args: {
  underlying: string;
  strike: number;
  optionType: 'CE' | 'PE';
  expiry?: string;
  lot: number;
  exchange: string;
}): Instrument {
  const { underlying, strike, optionType, expiry, lot, exchange } = args;
  const symbol = `${underlying}${strike}${optionType}`;
  return {
    instrument_id: `paper-opt-${underlying}-${expiry || 'm'}-${strike}-${optionType}`,
    symbol,
    display_name: `${underlying} ${strike} ${optionType}`,
    exchange,
    segment: exchange === 'MCX' ? 'MCX' : exchange === 'BSE' ? 'BFO' : 'NFO',
    asset_class: 'DERIVATIVE',
    instrument_type: exchange === 'MCX' ? 'COMMODITY_OPTION' : 'INDEX_OPTION',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: Math.max(1, lot),
    tick_size: 0.05,
    expiry: expiry || null,
    strike,
    option_type: optionType,
    underlying_symbol: underlying,
    trading_status: 'OPEN'
  };
}

function paperFutureInstrument(args: {
  underlying: string;
  expiry?: string;
  expiryLabel?: string;
  lot: number;
  exchange: string;
  isIndex?: boolean;
}): Instrument {
  const { underlying, expiry, expiryLabel, lot, exchange, isIndex } = args;
  const tag = String(expiryLabel || 'FUT').replace(/\s+/g, '');
  return {
    instrument_id: `paper-fut-${underlying}-${expiry || 'm'}`,
    symbol: `${underlying}${tag}FUT`,
    display_name: `${underlying} ${expiryLabel || 'FUTURE'}`,
    exchange,
    segment: exchange === 'MCX' ? 'MCX' : exchange === 'BSE' ? 'BFO' : 'NFO',
    asset_class: 'DERIVATIVE',
    instrument_type:
      exchange === 'MCX' ? 'COMMODITY_FUTURE' : isIndex ? 'INDEX_FUTURE' : 'STOCK_FUTURE',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: Math.max(1, lot),
    tick_size: 0.05,
    expiry: expiry || null,
    underlying_symbol: underlying,
    trading_status: 'OPEN'
  };
}

function cashInstrument(inst: Instrument): Instrument {
  const und = underlyingOf(inst);
  const index = isIndexSymbol(und);
  const mcx = isCommoditySymbol(und) || inst.exchange === 'MCX';
  return {
    ...inst,
    instrument_id: `cash-${und}`,
    symbol: und,
    display_name: inst.display_name || und,
    exchange: mcx ? 'MCX' : inst.exchange || 'NSE',
    segment: mcx ? 'MCX' : index ? 'IDX' : 'EQ',
    asset_class: mcx ? 'COMMODITY' : index ? 'INDEX' : 'EQUITY',
    instrument_type: mcx ? 'COMMODITY' : index ? 'INDEX' : 'STOCK',
    tradable: !index && !mcx,
    direct_trading_allowed: !index && !mcx,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  };
}

function paperIndexChain(idx: { symbol: string; step: number; lot: number }, spot: number) {
  const { date, label } = paperMonthlyExpiry(idx.symbol);
  const atm = Math.round(spot / idx.step) * idx.step;
  const rows: IndexDeskState['rows'] = [];
  for (let i = -8; i <= 8; i++) {
    const strike = atm + i * idx.step;
    const ceDist = Math.max(0, strike - spot);
    const peDist = Math.max(0, spot - strike);
    const ce = Math.max(2, spot * 0.004 + Math.max(0, spot - strike) * 0.35 - ceDist * 0.12);
    const pe = Math.max(2, spot * 0.004 + Math.max(0, strike - spot) * 0.35 - peDist * 0.12);
    rows.push({
      strike,
      ce: { ltp: Math.round(ce * 20) / 20, tradingSymbol: `${idx.symbol}${strike}CE` },
      pe: { ltp: Math.round(pe * 20) / 20, tradingSymbol: `${idx.symbol}${strike}PE` }
    });
  }
  return { expiry: date, expiryLabel: label, spot, atm, rows };
}

function withBasketTimeout<T>(p: Promise<T>, ms = 2500): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Basket API timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function parseBasketContract(symbol: string): { kind: 'CE' | 'PE' | 'FUT' | 'OTHER'; strike: number } {
  const u = String(symbol || '').toUpperCase();
  const m = u.match(/(\d+)(CE|PE)$/);
  if (m) return { kind: m[2] as 'CE' | 'PE', strike: Number(m[1]) };
  if (/FUT/.test(u)) return { kind: 'FUT', strike: 0 };
  return { kind: 'OTHER', strike: 0 };
}

function rupeeLabel(n: number) {
  const v = Math.round(Math.abs(n));
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${v.toLocaleString('en-IN')}`;
}

function basketExpiryPayoff(
  legs: Record<string, unknown>[],
  spot: number,
  entrySpot: number,
  premiumOf: (symbol: string) => number
) {
  let pnl = 0;
  for (const leg of legs) {
    const qty = Number(leg.quantity || 0);
    if (!qty) continue;
    const sign = String(leg.side) === 'SELL' ? -1 : 1;
    const sym = String(leg.symbol || '');
    const { kind, strike } = parseBasketContract(sym);
    const prem = premiumOf(sym);
    if (kind === 'CE') pnl += sign * (Math.max(spot - strike, 0) - prem) * qty;
    else if (kind === 'PE') pnl += sign * (Math.max(strike - spot, 0) - prem) * qty;
    else if (kind === 'FUT') pnl += sign * (spot - entrySpot) * qty;
  }
  return pnl;
}

function basketMaxProfitLoss(
  legs: Record<string, unknown>[],
  entrySpot: number,
  premiumOf: (symbol: string) => number
) {
  if (!legs.length) return { maxProfit: 0, maxLoss: 0, unlimitedProfit: false, unlimitedLoss: false };
  const strikes = legs
    .map((l) => parseBasketContract(String(l.symbol || '')).strike)
    .filter((s) => s > 0);
  const spots = new Set<number>([
    1,
    entrySpot * 0.05,
    entrySpot * 0.5,
    entrySpot,
    entrySpot * 1.5,
    entrySpot * 2.5,
    entrySpot * 4,
    ...strikes,
    ...strikes.map((s) => s + 0.5),
    ...strikes.map((s) => Math.max(1, s - 0.5))
  ]);
  const values = [...spots].map((s) => basketExpiryPayoff(legs, s, entrySpot, premiumOf));
  const highA = basketExpiryPayoff(legs, entrySpot * 3, entrySpot, premiumOf);
  const highB = basketExpiryPayoff(legs, entrySpot * 6, entrySpot, premiumOf);
  const lowA = basketExpiryPayoff(legs, entrySpot * 0.08, entrySpot, premiumOf);
  const lowB = basketExpiryPayoff(legs, 1, entrySpot, premiumOf);
  const unlimitedProfit = highB - highA > 25000 || lowB - lowA > 25000;
  const unlimitedLoss = highA - highB > 25000 || lowA - lowB > 25000;
  return {
    maxProfit: Math.max(0, ...values),
    maxLoss: Math.abs(Math.min(0, ...values)),
    unlimitedProfit,
    unlimitedLoss
  };
}

function basketPayoffSeries(
  legs: Record<string, unknown>[],
  entrySpot: number,
  premiumOf: (symbol: string) => number
) {
  const strikes = legs
    .map((l) => parseBasketContract(String(l.symbol || '')).strike)
    .filter((s) => s > 0);
  const pad = Math.max(400, entrySpot * 0.08);
  const lo = Math.max(1, Math.min(entrySpot - pad, ...(strikes.length ? strikes.map((s) => s - pad / 2) : [entrySpot])));
  const hi = Math.max(entrySpot + pad, ...(strikes.length ? strikes.map((s) => s + pad / 2) : [entrySpot]));
  const n = 56;
  const pts: Array<{ spot: number; pnl: number }> = [];
  for (let i = 0; i <= n; i++) {
    const spot = lo + ((hi - lo) * i) / n;
    pts.push({ spot, pnl: basketExpiryPayoff(legs, spot, entrySpot, premiumOf) });
  }
  return { pts, lo, hi };
}

function BasketPayoffChart({
  pts,
  spot,
  height,
}: {
  pts: Array<{ spot: number; pnl: number }>;
  spot: number;
  height: number;
}) {
  if (!pts.length) return null;
  const w = 520;
  const pad = { l: 44, r: 10, t: 10, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const lo = pts[0].spot;
  const hi = pts[pts.length - 1].spot;
  const pnls = pts.map((p) => p.pnl);
  const pMin = Math.min(0, ...pnls);
  const pMax = Math.max(0, ...pnls);
  const span = pMax - pMin || 1;
  const xOf = (s: number) => pad.l + ((s - lo) / (hi - lo || 1)) * innerW;
  const yOf = (v: number) => pad.t + ((pMax - v) / span) * innerH;
  const zeroY = yOf(0);
  const d = pts
    .map((p, i) => `${i ? 'L' : 'M'}${xOf(p.spot).toFixed(1)},${yOf(p.pnl).toFixed(1)}`)
    .join(' ');
  const areaPos = `${d} L${xOf(hi).toFixed(1)},${zeroY.toFixed(1)} L${xOf(lo).toFixed(1)},${zeroY.toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      <line x1={pad.l} x2={w - pad.r} y1={zeroY} y2={zeroY} stroke="#94a3b8" strokeDasharray="3 3" />
      <path d={areaPos} fill={pMax > 0 ? 'rgba(16,185,129,0.16)' : 'rgba(248,113,113,0.12)'} />
      <path d={d} fill="none" stroke="#0369a1" strokeWidth={1.8} />
      <line
        x1={xOf(spot)}
        x2={xOf(spot)}
        y1={pad.t}
        y2={height - pad.b}
        stroke="#f59e0b"
        strokeWidth={1.2}
      />
      <text x={xOf(spot) + 4} y={pad.t + 11} fill="#b45309" fontSize="10">
        Spot {Math.round(spot)}
      </text>
      <text x={pad.l} y={height - 6} fill="#64748b" fontSize="10">
        {Math.round(lo)}
      </text>
      <text x={w - pad.r} y={height - 6} fill="#64748b" fontSize="10" textAnchor="end">
        {Math.round(hi)}
      </text>
      <text x={4} y={yOf(pMax) + 8} fill="#047857" fontSize="9">
        {rupeeLabel(pMax)}
      </text>
      <text x={4} y={yOf(pMin)} fill="#b91c1c" fontSize="9">
        {rupeeLabel(pMin)}
      </text>
    </svg>
  );
}

function asBasketRecord(b: PaperBasket): Record<string, unknown> {
  return { ...b, basket_name: b.basket_name, basketName: b.basketName, legs: b.legs, legs_count: b.legs_count };
}

function underlyingFromBasketLabel(name: string) {
  const u = String(name || '').toUpperCase();
  const hit = [...QUICK_INDICES, ...COMMODITY_SCRIPTS]
    .sort((a, b) => b.symbol.length - a.symbol.length)
    .find((i) => u.includes(i.symbol) || u.includes(i.label.replace(/\s+/g, '')));
  if (hit) return hit.symbol;
  const token = u.trim().split(/[\s/_-]+/)[0]?.replace(/[^A-Z0-9]/g, '') || '';
  if (INDEX_SYMBOLS.has(token) || COMMODITY_SYMBOLS.has(token) || STOCK_FO_LOT[token]) return token;
  if (/^[A-Z]{2,15}$/.test(token) && !['TERMINAL', 'BASKET', 'PAPER', 'DRAFT'].includes(token)) return token;
  return 'NIFTY';
}

type ChainLeg = {
  ltp?: number;
  iv?: number;
  oi?: number;
  tradingSymbol?: string;
  id?: string;
};

type ChainQuoteMeta = {
  quoteSource?: string;
  brokerQuoteCount?: number;
  message?: string;
  quoteFreshness?: 'live' | 'delayed';
};

type IndexDeskState = {
  underlying: string;
  label: string;
  lot: number;
  step: number;
  exchange: string;
  expiry: string;
  expiryLabel: string;
  spot: number;
  atm: number;
  rows: Array<{ strike: number; ce?: ChainLeg; pe?: ChainLeg }>;
  loading: boolean;
  quoteMeta?: ChainQuoteMeta;
};

function isLiveBrokerQuotes(meta?: ChainQuoteMeta | null): boolean {
  const src = (meta?.quoteSource || '').toLowerCase();
  return (meta?.brokerQuoteCount || 0) > 0 && !src.includes('model') && src !== 'unavailable';
}

function ChainPremiumBanner({ meta }: { meta?: ChainQuoteMeta | null }) {
  if (!meta?.quoteSource && meta?.brokerQuoteCount == null) return null;
  const live = isLiveBrokerQuotes(meta);
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: 1.35,
        padding: '6px 8px',
        borderRadius: 6,
        border: live ? '1px solid #86efac' : '1px solid #fbbf24',
        background: live ? '#ecfdf5' : '#fffbeb',
        color: live ? '#166534' : '#92400e'
      }}
    >
      {live ? (
        <>
          LIVE BROKER PREMIUMS ({meta?.quoteSource}
          {meta?.brokerQuoteCount != null ? ` · ${meta.brokerQuoteCount} LEGS` : ''})
        </>
      ) : (
        <>
          MODEL PREMIUMS (NOT EXCHANGE LTP) — CONNECT DHAN OR SET DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN
          FOR PRICES THAT MATCH ZERODHA/DHAN.
          {meta?.message ? ` ${String(meta.message).toUpperCase()}` : ''}
        </>
      )}
    </div>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      }
    );
  });
}

function foStrikeStep(underlying: string): number {
  return FO_STRIKE_STEP[(underlying || '').toUpperCase()] ?? 50;
}

function terminalChrome(light: boolean) {
  return {
    light,
    fg: light ? '#0f172a' : '#e2e8f0',
    muted: light ? '#64748b' : '#94a3b8',
    accent: light ? '#0369a1' : '#7dd3fc',
    accentOn: light ? '#0c4a6e' : '#e0f2fe',
    surface: light ? '#ffffff' : 'rgba(2,6,23,0.92)',
    surfaceHi: light ? '#e0f2fe' : 'rgba(14,165,233,0.22)',
    surfaceSoft: light ? '#f0f9ff' : 'rgba(14,116,144,0.2)',
    cardBg: light ? '#f8fafc' : 'rgba(15,23,42,0.88)',
    cardBd: light ? '#bae6fd' : 'rgba(56,189,248,0.28)',
    rowBd: light ? '#f1f5f9' : 'rgba(148,163,184,0.18)',
    atmBg: light ? '#dcfce7' : 'rgba(16,185,129,0.22)',
    strikeFg: light ? '#0f172a' : '#e2e8f0',
    atmFg: light ? '#14532d' : '#86efac',
    dropShadow: light
      ? '0 12px 28px rgba(15,23,42,0.12)'
      : '0 16px 40px rgba(0,0,0,0.55)',
    comOn: light ? '#ffedd5' : 'rgba(194,65,12,0.38)',
    comOff: light ? '#fff7ed' : 'rgba(154,52,18,0.22)',
    comFg: light ? '#9a3412' : '#fdba74',
    comBdOn: light ? '#c2410c' : '#fb923c',
    comBdOff: light ? '#fdba74' : 'rgba(251,146,60,0.45)',
    idxOnBd: light ? '#0284c7' : '#38bdf8',
    idxOffBd: light ? '#38bdf8' : 'rgba(56,189,248,0.45)',
    panel: {
      borderRadius: 12,
      border: light ? '1px solid #cbd5e1' : '1px solid rgba(56,189,248,0.35)',
      background: light ? '#ffffff' : 'rgba(2,6,23,0.72)',
      padding: 16,
      color: light ? '#0f172a' : '#e2e8f0',
      textTransform: 'uppercase'
    } as CSSProperties,
    btn: {
      padding: '8px 12px',
      borderRadius: 8,
      border: light ? '1px solid #38bdf8' : '1px solid rgba(56,189,248,0.5)',
      background: light ? '#f0f9ff' : 'rgba(14,116,144,0.2)',
      color: light ? '#0369a1' : '#7dd3fc',
      cursor: 'pointer',
      fontSize: 12
    } as CSSProperties,
    input: {
      padding: 8,
      borderRadius: 8,
      border: light ? '1px solid #cbd5e1' : '1px solid rgba(148,163,184,0.35)',
      background: light ? '#ffffff' : 'rgba(15,23,42,0.85)',
      color: light ? '#0f172a' : '#e2e8f0',
      width: '100%'
    } as CSSProperties
  };
}

function formatPrice(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n >= 1000 ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : n.toFixed(2);
}

const CE_LTP = '#047857';
const PE_LTP = '#b91c1c';
const NUM = { fontWeight: 800, fontSize: 13, fontVariantNumeric: 'tabular-nums' as const };

type Tab = 'ticket' | 'basket' | 'chart';

export function TradingTerminalPanel({ initialTab = 'ticket' }: { initialTab?: Tab }) {
  const { theme } = useTheme();
  const t = terminalChrome(theme === 'light');
  const { panel, btn, input } = t;
  const [tab, setTab] = useState<Tab>(initialTab);
  const { indices } = useMarketData();
  const { query, setQuery, results, search, loading, error } = useInstrumentSearch('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [tradability, setTradability] = useState<Record<string, unknown> | null>(null);
  const [derivatives, setDerivatives] = useState<Instrument[]>([]);
  const [qty, setQty] = useState(1);
  /** Order size mode: absolute units vs number of lots (FO lot × lots). */
  const [qtyMode, setQtyMode] = useState<'QUANTITY' | 'LOTS'>('LOTS');
  const [lots, setLots] = useState(1);
  const [orderType, setOrderType] = useState('MARKET');
  const [product, setProduct] = useState('CNC');
  const [price, setPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [contractQuote, setContractQuote] = useState<ContractQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [expiryKind, setExpiryKind] = useState<'WEEKLY' | 'MONTHLY' | 'ALL'>('ALL');
  const [monthlyOnly, setMonthlyOnly] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [expiryOptions, setExpiryOptions] = useState<FoExpiryEntry[]>([]);
  const [chainRows, setChainRows] = useState<
    Array<{ strike: number; ce?: { ltp: number }; pe?: { ltp: number } }>
  >([]);
  const [chainQuoteMeta, setChainQuoteMeta] = useState<ChainQuoteMeta | null>(null);
  const [liveAtm, setLiveAtm] = useState<number | null>(null);
  const { baskets, reload: reloadBaskets } = useBasketOrders();
  const [activeBasketId, setActiveBasketId] = useState<string | null>(null);
  const [basketDetail, setBasketDetail] = useState<Record<string, unknown> | null>(null);
  const [basketNameDraft, setBasketNameDraft] = useState('Terminal Basket');
  const [newBasketName, setNewBasketName] = useState('');
  const [legSymbol, setLegSymbol] = useState('RELIANCE');
  const [legSide, setLegSide] = useState<'BUY' | 'SELL'>('BUY');
  const [legQty, setLegQty] = useState(1);
  const [basketPick, setBasketPick] = useState<'FUTURE' | 'OPTIONS'>('OPTIONS');
  const [payoffExpanded, setPayoffExpanded] = useState(false);
  const [exitPerUnitDraft, setExitPerUnitDraft] = useState('2');
  const [exitTotalDraft, setExitTotalDraft] = useState('2000');
  const [basketChainExpiry, setBasketChainExpiry] = useState('');
  const [indexDesk, setIndexDesk] = useState<IndexDeskState | null>(null);
  const [deskBusy, setDeskBusy] = useState(false);
  const [chartStock, setChartStock] = useState<WatchlistItem | null>(null);
  const [chartTradeInstrument, setChartTradeInstrument] = useState<Instrument | null>(null);
  const indexDeskRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (tab === 'basket') {
      void reloadBaskets().catch(() => undefined);
    }
  }, [tab, reloadBaskets]);

  useEffect(() => {
    if (!selected) return;
    void tradingApi
      .getInstrumentTradability(selected.instrument_id)
      .then(setTradability)
      .catch(() =>
        setTradability({
          buy_sell_enabled: selected.direct_trading_allowed !== false && selected.instrument_type !== 'INDEX',
          index_spot_blocked: selected.instrument_type === 'INDEX',
          mode: 'paper'
        })
      );
    if (selected.instrument_type === 'INDEX') {
      void tradingApi.getDerivativeContracts(selected.instrument_id).then((d) => {
        setDerivatives(d.contracts || []);
      });
    } else {
      setDerivatives([]);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected?.symbol) {
      setQuote(null);
      setContractQuote(null);
      setQuoteErr(null);
      setExpiryOptions([]);
      setChainRows([]);
      setChainQuoteMeta(null);
      setLiveAtm(null);
      return;
    }
    let cancelled = false;
    let first = true;
    const isOption =
      selected.instrument_type.includes('OPTION') ||
      /CE$|PE$/i.test(selected.symbol);

    const applyContractQuote = (cq: ContractQuote) => {
      setContractQuote(cq);
      setQuote(
        cq.spot
          ? {
              symbol: cq.underlying || selected.symbol,
              price: cq.spot,
              change: cq.spot_change,
              changePercent: cq.spot_change_percent,
              source: cq.spot_source || undefined
            }
          : null
      );
      const orderPx = cq.order_price ?? cq.premium;
      if (orderPx && orderPx > 0) {
        setPrice((prev) => (prev <= 0 ? Math.round(orderPx * 100) / 100 : prev));
      }
      if (cq.lot_size > 1) {
        setQty((prev) => (prev === 1 ? cq.lot_size : prev));
        setLots((prev) => (prev < 1 ? 1 : prev));
      }
    };

    const loadQuote = async () => {
      if (first) setQuoteLoading(true);
      setQuoteErr(null);
      try {
        if (isOption) {
          const cq = await tradingApi.getContractQuote(selected.instrument_id, {
            expiry: selectedExpiry || undefined,
            kind: expiryKind
          });
          if (cancelled) return;
          applyContractQuote(cq);

          const cal = cq.expiry_calendar?.calendar || [];
          const onlyMonthly =
            Boolean((cq.expiry_calendar as { monthly_only?: boolean } | undefined)?.monthly_only) ||
            (cal.length > 0 && cal.every((e) => e.kind === 'MONTHLY'));
          setMonthlyOnly(onlyMonthly);
          const kindFilter = onlyMonthly ? 'MONTHLY' : expiryKind;
          if (onlyMonthly && expiryKind !== 'MONTHLY') setExpiryKind('MONTHLY');
          const filtered =
            kindFilter === 'ALL' ? cal : cal.filter((e) => e.kind === kindFilter);
          setExpiryOptions(filtered.length ? filtered : cal);

          // Keep dropdown + quote on the same settlement date (avoid stale instrument.expiry)
          const exp =
            selectedExpiry && filtered.some((e) => e.date === selectedExpiry)
              ? selectedExpiry
              : filtered[0]?.date || cq.expiry || '';
          if (exp && exp !== selectedExpiry) {
            setSelectedExpiry(exp);
          }

          const und = cq.underlying || selected.underlying_symbol;
          if (und && exp) {
            const chain = await tradingApi.getOptionsChain({
              underlying: und,
              expiry: exp,
              kind: kindFilter
            });
            if (cancelled) return;
            setChainRows(chain.rows || []);
            setChainQuoteMeta({
              quoteSource: chain.quoteSource,
              brokerQuoteCount: chain.brokerQuoteCount,
              message: chain.message,
              quoteFreshness: chain.quoteFreshness
            });
            if (chain.atm != null && chain.atm > 0) setLiveAtm(chain.atm);
            else if (cq.spot && cq.spot > 0) {
              const step = foStrikeStep(und);
              setLiveAtm(Math.round(cq.spot / step) * step);
            }
          }
        } else {
          setContractQuote(null);
          setChainRows([]);
          setChainQuoteMeta(null);
          setLiveAtm(null);
          const q = await tradingApi.getQuote(selected.symbol);
          if (cancelled) return;
          setQuote(q);
          if (q.price > 0) {
            setPrice((prev) => (prev <= 0 ? Math.round(q.price * 100) / 100 : prev));
          }
        }
      } catch (e) {
        if (cancelled) return;
        setQuote(null);
        setContractQuote(null);
        setQuoteErr(e instanceof Error ? e.message : 'Quote unavailable');
      } finally {
        if (!cancelled && first) {
          setQuoteLoading(false);
          first = false;
        }
      }
    };

    void loadQuote();
    const timer = window.setInterval(() => {
      void loadQuote();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selected?.symbol, selected?.instrument_id, selectedExpiry, expiryKind]);

  const pick = (inst: Instrument) => {
    setSelected(inst);
    setPreview(null);
    setMsg('');
    setQuote(null);
    setContractQuote(null);
    setQuoteErr(null);
    setPrice(0);
    setSelectedExpiry('');
    setExpiryKind('ALL');
    setChainRows([]);
    setChainQuoteMeta(null);
    setLiveAtm(null);
    if (inst.instrument_type.includes('FUTURE') || inst.instrument_type.includes('OPTION')) {
      setProduct('NRML');
      const lot = Math.max(1, inst.lot_size || 1);
      setQtyMode(lot > 1 ? 'LOTS' : 'QUANTITY');
      setLots(1);
      setQty(lot);
    } else {
      setProduct('CNC');
      setQtyMode('QUANTITY');
      setLots(1);
      setQty(1);
    }
  };

  const lotSize = Math.max(
    1,
    Number(contractQuote?.lot_size || selected?.lot_size || 1) || 1
  );
  const isFoLot =
    Boolean(selected) &&
    (selected!.instrument_type.includes('FUTURE') ||
      selected!.instrument_type.includes('OPTION') ||
      selected!.instrument_type.includes('COMMODITY') ||
      /CE$|PE$|FUT$/i.test(selected!.symbol)) &&
    (lotSize > 1 || selected!.exchange === 'MCX' || selected!.instrument_type.includes('COMMODITY'));

  /** Units sent to the broker / paper engine. */
  const orderQuantity = () => {
    if (qtyMode === 'LOTS' && isFoLot) return Math.max(1, Math.floor(lots)) * lotSize;
    return Math.max(1, Math.floor(qty));
  };

  const resolveOptionInstrument = async (
    underlying: string,
    strike: number,
    side: 'CE' | 'PE',
    expiry?: string
  ): Promise<Instrument> => {
    const fallback = paperOptionInstrument({
      underlying,
      strike,
      optionType: side,
      expiry,
      lot: indexDesk?.lot || 1,
      exchange:
        indexDesk?.exchange ||
        (isCommoditySymbol(underlying) ? 'MCX' : underlying === 'SENSEX' ? 'BSE' : 'NSE')
    });
    try {
      const q = `${underlying} ${strike}`;
      const rows = await withTimeout(tradingApi.searchInstruments(q), 2000, 'Instrument search');
      const sym = `${underlying}${strike}${side}`;
      const hit =
        rows.find((x) => x.symbol === sym) ||
        rows.find(
          (x) =>
            Number(x.strike) === strike &&
            (x.option_type || '').toUpperCase() === side &&
            (x.underlying_symbol || '').toUpperCase() === underlying
        ) ||
        rows.find(
          (x) => Number(x.strike) === strike && (x.option_type || '').toUpperCase() === side
        );
      if (hit) return expiry ? { ...hit, expiry } : hit;
    } catch {
      /* paper contract is enough to trade/chart */
    }
    return fallback;
  };

  const openIndexDesk = async (
    idx: (typeof QUICK_INDICES)[number],
    opts?: { seedAtm?: boolean }
  ) => {
    const seedAtm = opts?.seedAtm !== false;
    setTab('ticket');
    setIndexDesk({
      underlying: idx.symbol,
      label: idx.label,
      lot: idx.lot,
      step: idx.step,
      exchange: idx.exchange,
      expiry: '',
      expiryLabel: '',
      spot: 0,
      atm: 0,
      rows: [],
      loading: true
    });
    setExpiryKind('MONTHLY');
    if (idx.exchange === 'MCX' || isCommoditySymbol(idx.symbol)) setMonthlyOnly(true);
    else setMonthlyOnly(false);
    setQtyMode('LOTS');
    setQty(Math.max(1, Math.floor(lots) || 1) * idx.lot);
    setProduct('NRML');

    const tickerSpot =
      indices.find((i) => {
        const n = i.name.toUpperCase();
        if (idx.symbol === 'NIFTY') return n.includes('NIFTY') && !n.includes('BANK') && !n.includes('MID') && !n.includes('FIN');
        if (idx.symbol === 'BANKNIFTY') return n.includes('BANK');
        if (idx.symbol === 'FINNIFTY') return n.includes('FIN');
        if (idx.symbol === 'MIDCPNIFTY') return n.includes('MID');
        if (idx.symbol === 'SENSEX') return n.includes('SENSEX');
        return false;
      })?.value || FALLBACK_SPOT[idx.symbol] || 0;

    const applyDesk = async (payload: {
      expiry: string;
      expiryLabel: string;
      spot: number;
      atm: number;
      rows: IndexDeskState['rows'];
      quoteMeta?: ChainQuoteMeta;
    }) => {
      setSelectedExpiry(payload.expiry);
      setExpiryOptions([
        {
          date: payload.expiry,
          kind: 'MONTHLY',
          label: payload.expiryLabel,
          weekday: /SENSEX|BANKEX/i.test(idx.symbol) ? 'Thu' : 'Tue'
        }
      ]);
      setLiveAtm(payload.atm || null);
      setChainRows(payload.rows || []);
      setChainQuoteMeta(payload.quoteMeta || null);
      setIndexDesk({
        underlying: idx.symbol,
        label: idx.label,
        lot: idx.lot,
        step: idx.step,
        exchange: idx.exchange,
        expiry: payload.expiry,
        expiryLabel: payload.expiryLabel,
        spot: payload.spot,
        atm: payload.atm,
        rows: payload.rows || [],
        loading: false,
        quoteMeta: payload.quoteMeta
      });
                  if (payload.atm > 0 && seedAtm) {
        void resolveOptionInstrument(idx.symbol, payload.atm, 'CE', payload.expiry)
          .then((seed) => {
            if (seed) {
              pick(seed);
              setSelectedExpiry(payload.expiry);
              const row = payload.rows.find((r) => r.strike === payload.atm);
              if (row?.ce?.ltp && row.ce.ltp > 0) setPrice(Math.round(row.ce.ltp * 100) / 100);
            } else {
              setQuery(`${idx.symbol} ${payload.atm}`);
            }
          })
          .catch(() => setQuery(`${idx.symbol} ${payload.atm}`));
      }
    };

    const paper = paperIndexChain(idx, tickerSpot || FALLBACK_SPOT[idx.symbol] || 22650);
    await applyDesk({
      ...paper,
      quoteMeta: {
        quoteSource: 'model',
        brokerQuoteCount: 0,
        message: 'Paper monthly chain — live premiums load if the data API responds.',
        quoteFreshness: 'delayed'
      }
    });
    window.requestAnimationFrame(() => {
      indexDeskRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    toast.message(`${idx.label} monthly option chain`);

    try {
      const cal = await withTimeout(tradingApi.getOptionExpiries(idx.symbol), 4000, 'Expiries');
      const monthly = (cal.monthly?.length ? cal.monthly : cal.calendar.filter((e) => e.kind === 'MONTHLY')) || [];
      const exp = monthly[0]?.date || cal.expiries[0] || paper.expiry;
      const expLabel = monthly[0]?.label || cal.calendar.find((e) => e.date === exp)?.label || paper.expiryLabel;
      if (!exp) return;
      const chain = await withTimeout(
        tradingApi.getOptionsChain({
          underlying: idx.symbol,
          expiry: exp,
          kind: 'MONTHLY'
        }),
        5000,
        'Option chain'
      );
      const rows = chain.rows || [];
      if (!rows.length) return;
      const spot = Number(chain.spotPrice || tickerSpot || paper.spot || 0);
      const atm =
        chain.atm && chain.atm > 0
          ? chain.atm
          : spot > 0
            ? Math.round(spot / idx.step) * idx.step
            : paper.atm;
      await applyDesk({
        expiry: exp,
        expiryLabel: chain.expiry_label || expLabel,
        spot,
        atm,
        rows,
        quoteMeta: {
          quoteSource: chain.quoteSource,
          brokerQuoteCount: chain.brokerQuoteCount,
          message: chain.message,
          quoteFreshness: chain.quoteFreshness
        }
      });
      toast.success(`${idx.label} monthly chain · ${expLabel}`);
    } catch {
      /* paper desk already visible */
    }
  };

  const pickCash = (r: Instrument) => {
    const cash = cashInstrument(r);
    pick(cash);
    setIndexDesk(null);
    setQuery(cash.symbol);
    setSearchOpen(false);
  };

  const pickFutures = (r: Instrument) => {
    const und = underlyingOf(r);
    const desk = deskTargetFor(und, r.display_name, r.exchange);
    const { date, label } = paperMonthlyExpiry(und);
    pick(
      paperFutureInstrument({
        underlying: und,
        expiry: date,
        expiryLabel: label,
        lot: desk.lot,
        exchange: desk.exchange,
        isIndex: isIndexSymbol(und)
      })
    );
    setIndexDesk(null);
    setQuery(`${und} FUT`);
    setSearchOpen(false);
  };

  const pickOptionChain = (r: Instrument) => {
    const und = underlyingOf(r);
    const cash = cashInstrument(r);
    pick(cash);
    setQuery(und);
    setSearchOpen(false);
    void openIndexDesk(deskTargetFor(und, r.display_name, r.exchange), { seedAtm: false });
  };

  const tradeChainLeg = async (
    underlying: string,
    strike: number,
    optionType: 'CE' | 'PE',
    side: 'BUY' | 'SELL',
    ltp?: number,
    expiry?: string
  ) => {
    const inst = paperOptionInstrument({
      underlying,
      strike,
      optionType,
      expiry: expiry || selectedExpiry || indexDesk?.expiry,
      lot: indexDesk?.lot || 1,
      exchange:
        indexDesk?.exchange ||
        (isCommoditySymbol(underlying) ? 'MCX' : underlying === 'SENSEX' ? 'BSE' : 'NSE')
    });
    pick(inst);
    if (expiry || selectedExpiry || indexDesk?.expiry) {
      setSelectedExpiry(expiry || selectedExpiry || indexDesk?.expiry || '');
    }
    if (ltp && ltp > 0) setPrice(Math.round(ltp * 100) / 100);
    const lot = Math.max(1, inst.lot_size);
    const nLots = Math.max(1, Math.min(100, Math.floor(lots) || 1));
    setQtyMode('LOTS');
    setLots(nLots);
    setQty(lot * nLots);
    const quantity = lot * nLots;
    const px = ltp && ltp > 0 ? ltp : undefined;
    setDeskBusy(true);
    try {
      const live = await resolveOptionInstrument(underlying, strike, optionType, expiry || selectedExpiry);
      if (live.instrument_id && !live.instrument_id.startsWith('paper-opt-')) {
        pick(live);
      }
      const p = await withTimeout(
        tradingApi.previewOrder({
          instrument_id: live.instrument_id.startsWith('paper-opt-') ? undefined : live.instrument_id,
          symbol: live.symbol,
          exchange: live.exchange,
          side,
          quantity,
          order_type: orderType,
          product_type: 'NRML',
          price: px,
          mode: 'PAPER',
          source: 'ORDER_TICKET'
        }),
        4000,
        'Preview'
      );
      if (!p.allowed || !p.preview_id) {
        toast.success(`${side} ${nLots} LOT ${inst.symbol}${px ? ` @ ${px}` : ''} (PAPER TICKET)`);
        setMsg(`${side} ${inst.symbol} LOADED ON TICKET · ${nLots} LOT`);
        return;
      }
      await withTimeout(tradingApi.submitOrder(String(p.preview_id)), 4000, 'Submit');
      toast.success(`${side} ${inst.symbol} · ${nLots} LOT (${quantity} QTY)`);
      setMsg(`${side} SUBMITTED ${inst.symbol} · ${nLots} LOT`);
    } catch {
      toast.success(`${side} ${nLots} LOT ${inst.symbol}${px ? ` @ ${px}` : ''} (PAPER)`);
      setMsg(`${side} PAPER FILL ${inst.symbol} · ${nLots} LOT · QTY ${quantity}`);
    } finally {
      setDeskBusy(false);
    }
  };

  const openChartForLeg = (
    underlying: string,
    strike: number,
    optionType: 'CE' | 'PE',
    ltp?: number,
    expiry?: string
  ) => {
    const inst = paperOptionInstrument({
      underlying,
      strike,
      optionType,
      expiry: expiry || selectedExpiry || indexDesk?.expiry,
      lot: indexDesk?.lot || 1,
      exchange:
        indexDesk?.exchange ||
        (isCommoditySymbol(underlying) ? 'MCX' : underlying === 'SENSEX' ? 'BSE' : 'NSE')
    });
    pick(inst);
    if (expiry || selectedExpiry || indexDesk?.expiry) {
      setSelectedExpiry(expiry || selectedExpiry || indexDesk?.expiry || '');
    }
    if (ltp && ltp > 0) setPrice(Math.round(ltp * 100) / 100);
    setQtyMode('LOTS');
    setQty(Math.max(1, inst.lot_size) * Math.max(1, Math.floor(lots) || 1));
    setChartTradeInstrument(inst);
    setChartStock({
      id: `chart-${underlying}-${strike}-${optionType}`,
      symbol: underlying,
      exchange:
        indexDesk?.exchange ||
        (isCommoditySymbol(underlying) ? 'MCX' : underlying === 'SENSEX' ? 'BSE' : 'NSE'),
      sortOrder: 0,
      name: `${underlying} · ${strike} ${optionType}`
    });
    setTab('chart');
    toast.message(`Chart · ${inst.display_name}`);
    void resolveOptionInstrument(underlying, strike, optionType, expiry || selectedExpiry).then((live) => {
      if (live && !live.instrument_id.startsWith('paper-opt-')) {
        pick(live);
        setChartTradeInstrument(live);
      }
    });
  };

  const orderPrice = () => {
    if (price > 0) return price;
    if (contractQuote?.premium && contractQuote.premium > 0) return contractQuote.premium;
    if (quote?.price && quote.price > 0) return quote.price;
    return undefined;
  };

  const doPreview = async (side: 'BUY' | 'SELL') => {
    if (!selected) return;
    setBusy(true);
    try {
      const p = await tradingApi.previewOrder({
        instrument_id: selected.instrument_id,
        symbol: selected.symbol,
        exchange: selected.exchange,
        side,
        quantity: orderQuantity(),
        order_type: orderType,
        product_type: product,
        price: orderPrice(),
        stop_loss: stopLoss || undefined,
        mode: 'PAPER',
        source: 'ORDER_TICKET'
      });
      setPreview(p);
      setMsg(p.allowed ? `Preview OK — ${p.next_action}` : `Blocked: ${JSON.stringify(p.warnings)}`);
      return p;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** Paper Buy/Sell: preview then submit in one click (live remains locked). */
  const doBuySell = async (side: 'BUY' | 'SELL') => {
    if (!selected) return;
    setBusy(true);
    try {
      const p = await tradingApi.previewOrder({
        instrument_id: selected.instrument_id,
        symbol: selected.symbol,
        exchange: selected.exchange,
        side,
        quantity: orderQuantity(),
        order_type: orderType,
        product_type: product,
        price: orderPrice(),
        stop_loss: stopLoss || undefined,
        mode: 'PAPER',
        source: 'ORDER_TICKET'
      });
      setPreview(p);
      if (!p.allowed || !p.preview_id) {
        setMsg(`Blocked: ${JSON.stringify(p.warnings)}`);
        toast.error('Order blocked — check preview warnings');
        return;
      }
      const res = await tradingApi.submitOrder(String(p.preview_id));
      toast.success(`${side} paper order submitted`);
      setMsg(`Submitted ${side} order ${(res.order as { id?: string })?.id || 'ok'}`);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${side} failed`);
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = async () => {
    if (!preview?.preview_id) return;
    setBusy(true);
    try {
      const res = await tradingApi.submitOrder(String(preview.preview_id));
      toast.success('Paper order submitted via OMS');
      setMsg(`Submitted order ${(res.order as { id?: string })?.id || 'ok'}`);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const loadBasketDetail = async (id: string): Promise<Record<string, unknown>> => {
    const local = getPaperBasket(id);
    if (local) return asBasketRecord(local);
    if (isLocalPaperBasketId(id)) throw new Error('Basket not found');
    try {
      return await withBasketTimeout(tradingApi.getBasket(id), 1500);
    } catch {
      throw new Error('Basket not found');
    }
  };

  const persistLegLocal = (
    id: string,
    leg: { symbol: string; side: 'BUY' | 'SELL'; quantity: number; instrumentType?: string; lotSize?: number }
  ) => asBasketRecord(addPaperBasketLeg(id, leg));

  const createBasket = async (name?: string) => {
    setBusy(true);
    try {
      const basket_name = (name || newBasketName || basketNameDraft || 'Terminal Basket').trim();
      const b = createPaperBasket(basket_name);
      const id = b.id;
      const detail = asBasketRecord(b);
      setActiveBasketId(id);
      setBasketNameDraft(basket_name);
      setNewBasketName('');
      setBasketDetail(detail);
      await reloadBaskets();
      toast.success(`Saved basket “${basket_name}”`);
      setTab('basket');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create basket failed');
    } finally {
      setBusy(false);
    }
  };

  const saveBasketName = async () => {
    if (!activeBasketId) return;
    const name = basketNameDraft.trim();
    if (!name) {
      toast.error('Enter a basket name');
      return;
    }
    setBusy(true);
    try {
      if (isLocalPaperBasketId(activeBasketId)) {
        const updated = updatePaperBasket(activeBasketId, name);
        setBasketDetail(asBasketRecord(updated));
      } else {
        try {
          const updated = await tradingApi.updateBasket(activeBasketId, { basket_name: name });
          setBasketDetail(updated);
        } catch {
          const updated = updatePaperBasket(activeBasketId, name);
          setBasketDetail(asBasketRecord(updated));
        }
      }
      setBasketNameDraft(name);
      await reloadBaskets();
      toast.success(`Basket saved as “${name}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save basket failed');
    } finally {
      setBusy(false);
    }
  };

  const selectBasket = async (id: string) => {
    setActiveBasketId(id);
    const local = getPaperBasket(id);
    const fromList = baskets.find((b) => String(b.id || '') === id);
    const detail = local ? asBasketRecord(local) : fromList;
    if (!detail) {
      toast.error('Basket not found');
      return;
    }
    setBasketDetail(detail);
    setBasketNameDraft(String(detail.basket_name || detail.basketName || 'Basket'));
    const pct = Number(detail.exitPercent || detail.exitPerUnit || 0);
    const tot = Number(detail.exitTotal || 0);
    setExitPerUnitDraft(pct > 0 ? String(pct) : '2');
    setExitTotalDraft(tot > 0 ? String(tot) : '2000');
  };

  const addLeg = async () => {
    if (!activeBasketId) return;
    const und = underlyingFromBasketLabel(legSymbol);
    if (isIndexSymbol(und) || INDEX_SYMBOLS.has(und)) {
      await addDerivativesToBasket('ALL');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        symbol: String(legSymbol || '').toUpperCase(),
        side: legSide,
        quantity: Math.max(1, legQty),
        instrumentType: 'STOCK',
        lotSize: 1
      };
      const detail = persistLegLocal(activeBasketId, payload);
      setBasketDetail(detail);
      await reloadBaskets();
      toast.success(`Leg added · ${payload.symbol}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add leg failed');
    } finally {
      setBusy(false);
    }
  };

  const basketUnderlying = () => {
    if (selected) return underlyingOf(selected);
    if (indexDesk?.underlying) return indexDesk.underlying;
    return underlyingFromBasketLabel(newBasketName || basketNameDraft || 'NIFTY');
  };

  const basketDesk = deskTargetFor(basketUnderlying());
  const basketExpiries = paperMonthlyExpiries(basketDesk.symbol, 3);
  const basketSpot =
    (indices || []).find((i) => {
      const n = String(i.name || '').toUpperCase();
      if (basketDesk.symbol === 'NIFTY') return n.includes('NIFTY') && !n.includes('BANK') && !n.includes('MID') && !n.includes('FIN');
      if (basketDesk.symbol === 'BANKNIFTY') return n.includes('BANK');
      if (basketDesk.symbol === 'FINNIFTY') return n.includes('FIN');
      if (basketDesk.symbol === 'MIDCPNIFTY') return n.includes('MID');
      if (basketDesk.symbol === 'SENSEX') return n.includes('SENSEX');
      return false;
    })?.value || FALLBACK_SPOT[basketDesk.symbol] || 22650;
  const basketChain = paperIndexChain(basketDesk, basketSpot);
  const activeChainExpiry = basketChainExpiry || basketExpiries[0]?.date || basketChain.expiry;

  const ensureBasketId = () => {
    if (activeBasketId) return activeBasketId;
    const basket_name = (newBasketName || basketNameDraft || basketDesk.symbol || 'NIFTY').trim();
    const b = createPaperBasket(basket_name);
    setActiveBasketId(b.id);
    setBasketNameDraft(basket_name);
    setNewBasketName('');
    setBasketDetail(asBasketRecord(b));
    void reloadBaskets();
    return b.id;
  };

  const premiumForSymbol = (symbol: string) => {
    const m = String(symbol).toUpperCase().match(/(\d+)(CE|PE)$/);
    if (!m) return 0;
    const row = basketChain.rows.find((r) => r.strike === Number(m[1]));
    if (!row) return 0;
    return m[2] === 'PE' ? Number(row.pe?.ltp || 0) : Number(row.ce?.ltp || 0);
  };

  const marginFor = (leg: { symbol?: string; side: 'BUY' | 'SELL'; quantity: number; instrumentType?: string }) =>
    paperLegMargin({
      instrumentType: leg.instrumentType,
      side: leg.side,
      quantity: leg.quantity,
      spot: basketSpot,
      premium: premiumForSymbol(String(leg.symbol || ''))
    });

  const commitBasketLegs = (
    id: string,
    legs: Array<{
      symbol: string;
      side: 'BUY' | 'SELL';
      quantity: number;
      instrumentType: string;
      lotSize: number;
      estimatedMargin?: number;
    }>
  ) => {
    const last = asBasketRecord(addPaperBasketLegs(id, legs));
    setActiveBasketId(id);
    setBasketDetail(last);
    void reloadBaskets();
    return last.legs_count as number;
  };

  const visibleLegs: Record<string, unknown>[] = (() => {
    const local = activeBasketId ? getPaperBasket(activeBasketId) : null;
    const rows = (local?.legs || (basketDetail?.legs as Record<string, unknown>[]) || []) as Record<string, unknown>[];
    return Array.isArray(rows) ? rows : [];
  })();
  const selectedSymbols = new Set(visibleLegs.map((l) => String(l.symbol || '').toUpperCase()));
  const liveMarginOf = (leg: Record<string, unknown>) =>
    marginFor({
      symbol: String(leg.symbol || ''),
      side: String(leg.side) === 'SELL' ? 'SELL' : 'BUY',
      quantity: Number(leg.quantity || 1),
      instrumentType: String(leg.instrumentType || leg.instrument_type || '')
    });
  const basketMarginTotal = visibleLegs.reduce((s, l) => s + liveMarginOf(l), 0);
  const optionNetPremium = visibleLegs.reduce((s, l) => {
    const t = String(l.instrumentType || l.instrument_type || '').toUpperCase();
    const sym = String(l.symbol || '').toUpperCase();
    if (!t.includes('OPT') && !/CE$|PE$/.test(sym)) return s;
    const prem = premiumForSymbol(String(l.symbol || '')) * Number(l.quantity || 0);
    return s + (String(l.side) === 'SELL' ? -prem : prem);
  }, 0);
  const investedPremium = Math.abs(optionNetPremium);
  const savedExitPercent = Number(basketDetail?.exitPercent || basketDetail?.exitPerUnit || 0);
  const savedExitTotal = Number(basketDetail?.exitTotal || 0);
  const impliedExitFromPct =
    savedExitPercent > 0 && investedPremium > 0 ? (investedPremium * savedExitPercent) / 100 : 0;
  const tradePl = basketMaxProfitLoss(visibleLegs, basketSpot, premiumForSymbol);
  const payoffSeries = visibleLegs.length
    ? basketPayoffSeries(visibleLegs, basketSpot, premiumForSymbol)
    : { pts: [] as Array<{ spot: number; pnl: number }>, lo: 0, hi: 0 };

  const openBasketPick = (mode: 'FUTURE' | 'OPTIONS') => {
    ensureBasketId();
    setBasketPick(mode);
    setTab('basket');
  };

  const addPickedFuture = (exp: { date: string; label: string }) => {
    const id = ensureBasketId();
    const fut = paperFutureInstrument({
      underlying: basketDesk.symbol,
      expiry: exp.date,
      expiryLabel: exp.label,
      lot: basketDesk.lot,
      exchange: basketDesk.exchange,
      isIndex: isIndexSymbol(basketDesk.symbol)
    });
    const qty = (Math.max(1, lots) || 1) * (fut.lot_size || basketDesk.lot);
    commitBasketLegs(id, [
      {
        symbol: fut.symbol,
        side: legSide,
        quantity: qty,
        instrumentType: fut.instrument_type,
        lotSize: fut.lot_size || basketDesk.lot,
        estimatedMargin: marginFor({
          symbol: fut.symbol,
          side: legSide,
          quantity: qty,
          instrumentType: fut.instrument_type
        })
      }
    ]);
    toast.success(`Added ${fut.display_name || fut.symbol}`);
  };

  const addPickedOption = (strike: number, optionType: 'CE' | 'PE', side: 'BUY' | 'SELL' = legSide) => {
    const inst = paperOptionInstrument({
      underlying: basketDesk.symbol,
      strike,
      optionType,
      expiry: activeChainExpiry,
      lot: basketDesk.lot,
      exchange: basketDesk.exchange
    });
    const existing = visibleLegs.find((l) => String(l.symbol || '').toUpperCase() === inst.symbol.toUpperCase());
    if (existing) {
      if (String(existing.side) === side) {
        dropBasketLeg(String(existing.id));
        return;
      }
      setLegBuySell(String(existing.id), side);
      return;
    }
    const id = ensureBasketId();
    const qty = (Math.max(1, lots) || 1) * basketDesk.lot;
    commitBasketLegs(id, [
      {
        symbol: inst.symbol,
        side,
        quantity: qty,
        instrumentType: inst.instrument_type,
        lotSize: basketDesk.lot,
        estimatedMargin: marginFor({
          symbol: inst.symbol,
          side,
          quantity: qty,
          instrumentType: inst.instrument_type
        })
      }
    ]);
    toast.success(`Added ${side} ${inst.symbol}`);
  };

  const dropBasketLeg = (legId: string) => {
    if (!activeBasketId) return;
    const updated = removePaperBasketLeg(activeBasketId, legId);
    setBasketDetail(asBasketRecord(updated));
    void reloadBaskets();
  };

  const setLegBuySell = (legId: string, side: 'BUY' | 'SELL') => {
    if (!activeBasketId) return;
    const current = visibleLegs.find((l) => String(l.id) === legId);
    const qty = Number(current?.quantity || 1);
    const type = String(current?.instrumentType || current?.instrument_type || '');
    const updated = patchPaperBasketLeg(activeBasketId, legId, {
      side,
      estimatedMargin: marginFor({
        symbol: String(current?.symbol || ''),
        side,
        quantity: qty,
        instrumentType: type
      })
    });
    setBasketDetail(asBasketRecord(updated));
    void reloadBaskets();
  };

  const setLegExitPercent = (legId: string, value: string) => {
    if (!activeBasketId) return;
    const n = Number(value);
    const updated = patchPaperBasketLeg(activeBasketId, legId, {
      exitPercent: Number.isFinite(n) && n > 0 ? n : 0
    });
    setBasketDetail(asBasketRecord(updated));
  };

  const saveBasketExit = () => {
    const id = ensureBasketId();
    const pct = Number(exitPerUnitDraft);
    const tot = Number(exitTotalDraft);
    const updated = setPaperBasketExit(id, {
      exitPercent: Number.isFinite(pct) && pct > 0 ? pct : 0,
      exitTotal: Number.isFinite(tot) && tot > 0 ? tot : 0
    });
    setBasketDetail(asBasketRecord(updated));
    void reloadBaskets();
    const bits: string[] = [];
    if (updated.exitPercent) bits.push(`+${updated.exitPercent}% on invested option`);
    if (updated.exitTotal) bits.push(`+₹${updated.exitTotal.toLocaleString('en-IN')} book`);
    toast.success(bits.length ? `Exit set · ${bits.join(' or ')}` : 'Exit targets cleared');
  };

  const squareOffBasket = () => {
    if (!activeBasketId) return;
    if (!window.confirm('Exit this paper basket now (square off all scripts)?')) return;
    const updated = exitPaperBasket(activeBasketId);
    setBasketDetail(asBasketRecord(updated));
    void reloadBaskets();
    toast.success('Basket exited');
  };

  const addDerivativesToBasket = async (
    mode: 'FUTURE' | 'OPTIONS' | 'ALL',
    opts?: { createNew?: boolean }
  ) => {
    setBusy(true);
    try {
    let basketId = opts?.createNew ? null : activeBasketId;
    let detail = opts?.createNew ? null : basketDetail;
    if (!basketId) {
      const basket_name = (newBasketName || basketNameDraft || 'NIFTY').trim();
      const b = createPaperBasket(basket_name);
      basketId = b.id;
      detail = asBasketRecord(b);
      setActiveBasketId(basketId);
      setBasketNameDraft(basket_name);
      setNewBasketName('');
      setBasketDetail(detail);
    }
    if (!basketId) throw new Error('Create or select a basket first');
    const und = underlyingFromBasketLabel(
      (opts?.createNew ? newBasketName : '') ||
        String(detail?.basket_name || detail?.basketName || '') ||
        newBasketName ||
        basketNameDraft ||
        (selected ? underlyingOf(selected) : '') ||
        indexDesk?.underlying ||
        'NIFTY'
    );
    const desk = deskTargetFor(und, und);
    const tickerSpot =
      (indices || []).find((i) => {
        const n = String(i.name || '').toUpperCase();
        if (desk.symbol === 'NIFTY') return n.includes('NIFTY') && !n.includes('BANK') && !n.includes('MID') && !n.includes('FIN');
        if (desk.symbol === 'BANKNIFTY') return n.includes('BANK');
        if (desk.symbol === 'FINNIFTY') return n.includes('FIN');
        if (desk.symbol === 'MIDCPNIFTY') return n.includes('MID');
        if (desk.symbol === 'SENSEX') return n.includes('SENSEX');
        return false;
      })?.value || FALLBACK_SPOT[desk.symbol] || 22650;
    const chain = paperIndexChain(desk, tickerSpot);
    const { date, label } = paperMonthlyExpiry(desk.symbol);
    const fut = paperFutureInstrument({
      underlying: desk.symbol,
      expiry: date,
      expiryLabel: label,
      lot: desk.lot,
      exchange: desk.exchange,
      isIndex: isIndexSymbol(desk.symbol)
    });
    const existing = new Set(
      ((detail?.legs as Record<string, unknown>[]) || []).map((l) => String(l.symbol || '').toUpperCase())
    );
    const toAdd: Array<{ symbol: string; side: 'BUY' | 'SELL'; quantity: number; instrumentType: string; lotSize: number }> = [];
    if (mode === 'FUTURE' || mode === 'ALL') {
      if (!existing.has(fut.symbol.toUpperCase())) {
        toAdd.push({
          symbol: fut.symbol,
          side: 'BUY',
          quantity: fut.lot_size || desk.lot,
          instrumentType: fut.instrument_type,
          lotSize: fut.lot_size || desk.lot
        });
      }
    }
    if (mode === 'OPTIONS' || mode === 'ALL') {
      const atm = chain.atm;
      const near = chain.rows.filter((r) => Math.abs(r.strike - atm) <= desk.step * 5);
      for (const row of near) {
        for (const opt of ['CE', 'PE'] as const) {
          const inst = paperOptionInstrument({
            underlying: desk.symbol,
            strike: row.strike,
            optionType: opt,
            expiry: chain.expiry,
            lot: desk.lot,
            exchange: desk.exchange
          });
          if (existing.has(inst.symbol.toUpperCase())) continue;
          toAdd.push({
            symbol: inst.symbol,
            side: 'BUY',
            quantity: desk.lot,
            instrumentType: inst.instrument_type,
            lotSize: desk.lot
          });
        }
      }
    }
    if (!toAdd.length) {
      const local = getPaperBasket(basketId);
      if (local) setBasketDetail(asBasketRecord(local));
      toast.success(`${desk.symbol} derivatives are already in this basket`);
      return;
    }
      const last = asBasketRecord(addPaperBasketLegs(basketId, toAdd));
      setBasketDetail(last);
      setActiveBasketId(basketId);
      await reloadBaskets();
      const labelMode = mode === 'ALL' ? 'future + option chain' : mode === 'FUTURE' ? 'future' : 'option chain';
      toast.success(`Added ${toAdd.length} ${desk.symbol} ${labelMode} leg(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add derivatives');
    } finally {
      setBusy(false);
    }
  };

  const previewBasket = async () => {
    if (!activeBasketId) return;
    setBusy(true);
    try {
      const p = isLocalPaperBasketId(activeBasketId)
        ? previewPaperBasket(activeBasketId)
        : await tradingApi.previewBasket(activeBasketId).catch(() => previewPaperBasket(activeBasketId));
      setMsg(
        `Basket margin ₹${p.total_estimated_margin} · risk ₹${p.total_risk} · allowed=${p.allowed}`
      );
      setBasketDetail(await loadBasketDetail(activeBasketId));
      toast.success(p.allowed ? 'Risk preview OK' : 'Risk preview blocked — check warnings');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview basket failed');
    } finally {
      setBusy(false);
    }
  };

  const submitBasket = async () => {
    if (!activeBasketId) return;
    const legs = (basketDetail?.legs as unknown[]) || [];
    if (!legs.length) {
      toast.error('Add at least one leg before executing');
      return;
    }
    const name = String(basketDetail?.basket_name || basketDetail?.basketName || basketNameDraft);
    const exitBits: string[] = [];
    const pct = Number(basketDetail?.exitPercent || basketDetail?.exitPerUnit || 0);
    const tot = Number(basketDetail?.exitTotal || 0);
    if (pct > 0) exitBits.push(`+${pct}% profit on invested option`);
    if (tot > 0) exitBits.push(`+₹${tot.toLocaleString('en-IN')} book profit`);
    const exitLine = exitBits.length ? `\nExit when ${exitBits.join(' or ')}.` : '\nNo exit target set.';
    if (
      !window.confirm(
        `Execute paper basket “${name}” with ${legs.length} leg(s) now?\nThis places paper orders immediately.${exitLine}`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      if (basketNameDraft.trim() && basketNameDraft.trim() !== name) {
        if (isLocalPaperBasketId(activeBasketId)) updatePaperBasket(activeBasketId, basketNameDraft.trim());
        else {
          try {
            await tradingApi.updateBasket(activeBasketId, { basket_name: basketNameDraft.trim() });
          } catch {
            updatePaperBasket(activeBasketId, basketNameDraft.trim());
          }
        }
      }
      const snap = { premiumOf: premiumForSymbol, spot: basketSpot };
      if (isLocalPaperBasketId(activeBasketId)) {
        const filled = executePaperBasket(activeBasketId, snap);
        setBasketDetail(asBasketRecord(filled));
        toast.success(`Executed “${name}” · ${filled.status} · filled ${filled.legs.length}`);
      } else {
        try {
          const res = await tradingApi.submitBasket(activeBasketId);
          const status = String((res.basket as { status?: string })?.status || 'EXECUTED');
          toast.success(`Executed “${name}” · ${status} · filled ${res.filled}`);
          setBasketDetail(await tradingApi.getBasket(activeBasketId));
        } catch {
          const filled = executePaperBasket(activeBasketId, snap);
          setBasketDetail(asBasketRecord(filled));
          toast.success(`Executed “${name}” locally · ${filled.status} · filled ${filled.legs.length}`);
        }
      }
      await reloadBaskets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Execute basket failed');
    } finally {
      setBusy(false);
    }
  };

  const duplicateBasket = async () => {
    if (!activeBasketId) return;
    setBusy(true);
    try {
      let id = '';
      let copyName = '';
      if (isLocalPaperBasketId(activeBasketId)) {
        const copy = duplicatePaperBasket(activeBasketId);
        id = copy.id;
        copyName = copy.basket_name;
      } else {
        try {
          const copy = await tradingApi.duplicateBasket(activeBasketId);
          id = String(copy.id || '');
          copyName = String(copy.basket_name || copy.basketName);
        } catch {
          const copy = duplicatePaperBasket(activeBasketId);
          id = copy.id;
          copyName = copy.basket_name;
        }
      }
      await reloadBaskets();
      if (id) await selectBasket(id);
      toast.success(`Duplicated as “${copyName}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  };

  const buySellEnabled = Boolean(tradability?.buy_sell_enabled);
  const indexBlocked = Boolean(tradability?.index_spot_blocked);

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>TRADING TERMINAL</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            STOCKS · INDEX · MCX COMMODITIES · BASKET · PAPER DEFAULT · LIVE LOCKED
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['ticket', 'basket', 'chart'] as Tab[]).map((t) => (
            <button key={t} type="button" style={{ ...btn, opacity: tab === t ? 1 : 0.65 }} onClick={() => setTab(t)}>
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {msg ? <div style={{ marginTop: 10, color: '#fde68a', fontSize: 13 }}>{msg}</div> : null}

      {(tab === 'ticket' || tab === 'chart') && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: t.muted }}>INDEX DESK</span>
            {QUICK_INDICES.map((idx) => (
              <button
                key={idx.symbol}
                type="button"
                style={{
                  ...btn,
                  fontWeight: 700,
                  borderColor: indexDesk?.underlying === idx.symbol ? t.idxOnBd : t.idxOffBd,
                  background: indexDesk?.underlying === idx.symbol ? t.surfaceHi : t.surfaceSoft
                }}
                onClick={() => void openIndexDesk(idx)}
              >
                {idx.label}
                <span style={{ opacity: 0.75, fontWeight: 500 }}> · LOT {idx.lot}</span>
              </button>
            ))}
            <span style={{ fontSize: 11, color: t.muted }}>OPENS MONTHLY OPTION CHAIN + BUY/SELL</span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: t.muted }}>COMMODITY DESK</span>
            {QUICK_COMMODITIES.map((idx) => (
              <button
                key={idx.symbol}
                type="button"
                style={{
                  ...btn,
                  fontWeight: 700,
                  borderColor: indexDesk?.underlying === idx.symbol ? t.comBdOn : t.comBdOff,
                  background: indexDesk?.underlying === idx.symbol ? t.comOn : t.comOff,
                  color: t.comFg
                }}
                onClick={() => void openIndexDesk(idx)}
              >
                {idx.label}
                <span style={{ opacity: 0.75, fontWeight: 500 }}> · MCX</span>
              </button>
            ))}
            <span style={{ fontSize: 11, color: t.muted }}>GOLD / SILVER / CRUDE / GAS — OPTION CHAIN + FUTURE</span>
          </div>
          <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <input
              style={{ ...input, textTransform: 'none' }}
              value={query}
              placeholder="Type RELIANCE, NIFTY, GOLD, CRUDEOIL…"
              autoComplete="off"
              onFocus={() => {
                setSearchOpen(true);
                if (!results.length) void search(query);
              }}
              onChange={(e) => {
                setSearchOpen(true);
                setQuery(e.target.value);
              }}
              onBlur={() => {
                window.setTimeout(() => setSearchOpen(false), 180);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const hit = uniqueSearchHits(results || [], query)[0];
                  if (hit) {
                    if (isCommoditySymbol(hit.symbol) || isIndexSymbol(hit.symbol)) pickOptionChain(hit);
                    else pickCash(hit);
                  }
                  else void search(query);
                }
                if (e.key === 'Escape') setSearchOpen(false);
              }}
            />
            <button
              type="button"
              style={btn}
              onClick={() => {
                setSearchOpen(true);
                void search(query);
              }}
            >
              {loading ? 'SEARCHING' : 'SEARCH'}
            </button>
            {searchOpen && (query.trim().length > 0 || results.length > 0) ? (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 88,
                  zIndex: 40,
                  marginTop: 4,
                  maxHeight: 380,
                  overflowY: 'auto',
                  background: t.surface,
                  border: t.light ? '1px solid #cbd5e1' : '1px solid rgba(56,189,248,0.28)',
                  borderRadius: 10,
                  boxShadow: t.dropShadow,
                  textTransform: 'none'
                }}
              >
                {uniqueSearchHits(results || [], query).length === 0 ? (
                  <div style={{ padding: 12, fontSize: 13, color: t.muted }}>
                    {loading ? 'Searching…' : error || 'No matching scripts. Try RELIANCE, NIFTY, GOLD, CRUDEOIL.'}
                  </div>
                ) : (
                  uniqueSearchHits(results || [], query).map((r) => (
                    <button
                      key={`${r.instrument_id}-${r.symbol}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (isCommoditySymbol(r.symbol) || r.exchange === 'MCX' || isIndexSymbol(r.symbol)) {
                          pickOptionChain(r);
                        } else pickCash(r);
                      }}
                      style={{
                        display: 'flex',
                        width: '100%',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        border: 'none',
                        borderBottom: `1px solid ${t.rowBd}`,
                        background: selected?.symbol === r.symbol ? t.surfaceHi : t.surface,
                        color: t.fg,
                        cursor: 'pointer',
                        textAlign: 'left'
                      }}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontWeight: 800, letterSpacing: 0.3 }}>{r.symbol}</span>
                        <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                          {r.display_name}
                        </span>
                      </span>
                      <span style={{ fontSize: 11, color: '#0369a1', fontWeight: 700 }}>
                        {isCommoditySymbol(r.symbol) || r.exchange === 'MCX'
                          ? 'MCX'
                          : isIndexSymbol(r.symbol)
                            ? 'INDEX'
                            : 'CASH'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
          {error && !searchOpen ? (
            <div style={{ color: '#b91c1c', fontSize: 12, textTransform: 'none' }}>{error}</div>
          ) : null}

          <TerminalWatchlists
            selectedSymbol={selected ? underlyingOf(selected) : query}
            selectedName={selected?.display_name}
            light={t.light}
            btn={btn}
            onPickSymbol={(symbol, name) => {
              const s = symbol.toUpperCase();
              if (isCommoditySymbol(s) || isIndexSymbol(s)) {
                pickOptionChain({
                  instrument_id: `wl-${s}`,
                  symbol: s,
                  display_name: name || s,
                  exchange: isCommoditySymbol(s) ? 'MCX' : 'NSE',
                  segment: isCommoditySymbol(s) ? 'MCX' : 'IDX',
                  asset_class: isCommoditySymbol(s) ? 'COMMODITY' : 'INDEX',
                  instrument_type: isCommoditySymbol(s) ? 'COMMODITY' : 'INDEX',
                  tradable: false,
                  direct_trading_allowed: false,
                  lot_size: 1,
                  tick_size: 0.05,
                  trading_status: 'OPEN'
                });
                return;
              }
              pick({
                instrument_id: `wl-${symbol}`,
                symbol,
                display_name: name || symbol,
                exchange: 'NSE',
                segment: 'EQ',
                asset_class: 'EQUITY',
                instrument_type: 'STOCK',
                tradable: true,
                direct_trading_allowed: true,
                lot_size: 1,
                tick_size: 0.05,
                trading_status: 'OPEN'
              });
              setQuery(symbol);
              setSearchOpen(false);
            }}
          />

          {(tab === 'ticket' || tab === 'chart') && indexDesk ? (
            <div
              ref={indexDeskRef}
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${t.cardBd}`,
                background: t.cardBg,
                display: 'grid',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: t.fg, fontSize: 15 }}>
                  {indexDesk.label} · {indexDesk.exchange === 'MCX' ? 'MCX ' : ''}MONTHLY CHAIN
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.fg }}>
                  {(indexDesk.expiryLabel || indexDesk.expiry).toUpperCase()}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.fg }}>
                  SPOT ₹{formatPrice(indexDesk.spot)}
                  {indexDesk.atm ? ` · ATM ${indexDesk.atm}` : ''}
                  {` · LOT ${indexDesk.lot}`}
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
                    borderRadius: 8,
                    border: '1px solid #38bdf8',
                    background: t.surface
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: t.accent }}>LOTS</span>
                  <button
                    type="button"
                    style={{ ...btn, padding: '2px 8px', fontWeight: 800 }}
                    disabled={deskBusy || busy}
                    onClick={() => setLots((n) => Math.max(1, n - 1))}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={lots}
                    onChange={(e) => setLots(Math.max(1, Math.min(100, Math.floor(Number(e.target.value) || 1))))}
                    style={{
                      ...input,
                      width: 56,
                      textAlign: 'center',
                      fontWeight: 800,
                      padding: '4px 6px'
                    }}
                  />
                  <button
                    type="button"
                    style={{ ...btn, padding: '2px 8px', fontWeight: 800 }}
                    disabled={deskBusy || busy}
                    onClick={() => setLots((n) => Math.min(100, n + 1))}
                  >
                    +
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#0f172a' }}>
                    {lots} × {indexDesk.lot} = {(lots * indexDesk.lot).toLocaleString('en-IN')} UNITS
                  </span>
                </div>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  style={{ ...btn, padding: '4px 10px' }}
                  disabled={busy || indexDesk.loading}
                  onClick={() => {
                    const idx = QUICK_INDICES.find((x) => x.symbol === indexDesk.underlying);
                    if (idx) void openIndexDesk(idx);
                  }}
                >
                  REFRESH
                </button>
                <button
                  type="button"
                  style={{ ...btn, padding: '4px 10px' }}
                  onClick={() => {
                    setChartTradeInstrument(selected);
                    setChartStock({
                      id: `chart-${indexDesk.underlying}`,
                      symbol: indexDesk.underlying,
                      exchange: indexDesk.exchange,
                      sortOrder: 0,
                      name: indexDesk.label
                    });
                  }}
                >
                  OPEN CHART
                </button>
                <button type="button" style={{ ...btn, padding: '4px 10px' }} onClick={() => setIndexDesk(null)}>
                  CLOSE DESK
                </button>
              </div>
              {indexDesk.loading ? (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>LOADING MONTHLY OPTION CHAIN…</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <ChainPremiumBanner meta={indexDesk.quoteMeta} />
                <div style={{ overflowX: 'auto', maxHeight: 360, borderRadius: 8, border: '1px solid #94a3b8' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: '#0f172a', fontWeight: 700, position: 'sticky', top: 0, background: '#e2e8f0' }}>
                        <th style={{ padding: 6, textAlign: 'left' }}>CE LTP</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>CE</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>STRIKE</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>PE</th>
                        <th style={{ padding: 6, textAlign: 'right' }}>PE LTP</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>CHART</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(indexDesk.rows.length
                        ? indexDesk.rows.filter((r) => {
                            if (!indexDesk.atm) return true;
                            return Math.abs(r.strike - indexDesk.atm) <= indexDesk.step * 8;
                          })
                        : []
                      )
                        .sort((a, b) => a.strike - b.strike)
                        .map((r) => {
                          const isAtm = indexDesk.atm > 0 && r.strike === indexDesk.atm;
                          const mini = (label: string, onClick: () => void, color: string) => (
                            <button
                              key={label}
                              type="button"
                              style={{
                                ...btn,
                                padding: '2px 7px',
                                fontSize: 11,
                                fontWeight: 800,
                                color,
                                borderColor: color,
                                background: t.surface
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                              }}
                            >
                              {label}
                            </button>
                          );
                          return (
                            <tr
                              key={r.strike}
                              style={{
                                background: isAtm ? t.atmBg : 'transparent',
                                borderTop: `1px solid ${t.cardBd}`
                              }}
                            >
                              <td style={{ padding: 6, color: CE_LTP, ...NUM }}>
                                {r.ce?.ltp != null ? formatPrice(r.ce.ltp) : '—'}
                              </td>
                              <td style={{ padding: 4, textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: 4 }}>
                                  {mini('B', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'CE',
                                      'BUY',
                                      r.ce?.ltp,
                                      indexDesk.expiry
                                    ), CE_LTP)}
                                  {mini('S', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'CE',
                                      'SELL',
                                      r.ce?.ltp,
                                      indexDesk.expiry
                                    ), PE_LTP)}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: 6,
                                  textAlign: 'center',
                                  fontWeight: 800,
                                  fontSize: 13,
                                  color: isAtm ? t.atmFg : t.strikeFg
                                }}
                              >
                                {r.strike}
                                {isAtm ? ' ATM' : ''}
                              </td>
                              <td style={{ padding: 4, textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: 4 }}>
                                  {mini('B', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'PE',
                                      'BUY',
                                      r.pe?.ltp,
                                      indexDesk.expiry
                                    ), CE_LTP)}
                                  {mini('S', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'PE',
                                      'SELL',
                                      r.pe?.ltp,
                                      indexDesk.expiry
                                    ), PE_LTP)}
                                </div>
                              </td>
                              <td style={{ padding: 6, textAlign: 'right', color: PE_LTP, ...NUM }}>
                                {r.pe?.ltp != null ? formatPrice(r.pe.ltp) : '—'}
                              </td>
                              <td style={{ padding: 4, textAlign: 'center' }}>
                                <button
                                  type="button"
                                  style={{ ...btn, padding: '2px 8px', fontSize: 10 }}
                                  onClick={() =>
                                    openChartForLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'CE',
                                      r.ce?.ltp,
                                      indexDesk.expiry
                                    )
                                  }
                                >
                                  CHART
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#64748b' }}>
                B/S = BUY/SELL THE QTY ABOVE ON THAT CE/PE. USE − / + OR TYPE LOTS (MAX 100). CHART OPENS
                UNDERLYING CANDLES WITH OPTION TICKET ON THE RIGHT.
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tab === 'ticket' && selected && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {selected.display_name} ({selected.symbol})
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {selected.instrument_type} · lot{' '}
                  {contractQuote?.lot_size || selected.lot_size} ·{' '}
                  {selected.direct_trading_allowed ? 'direct OK' : 'no direct trade'}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {(() => {
                    const mcx =
                      selected.exchange === 'MCX' ||
                      selected.instrument_type.includes('COMMODITY') ||
                      isCommoditySymbol(underlyingOf(selected));
                    const cashOn =
                      !mcx &&
                      (selected.instrument_type === 'STOCK' ||
                        selected.instrument_type === 'ETF' ||
                        selected.instrument_type === 'INDEX');
                    const optOn =
                      selected.instrument_type.includes('OPTION') || Boolean(indexDesk);
                    const futOn =
                      selected.instrument_type.includes('FUTURE') || /FUT$/i.test(selected.symbol);
                    const seg = (id: 'CASH' | 'OPTIONS' | 'FUTURES', on: boolean, go: () => void) => (
                      <button
                        key={id}
                        type="button"
                        onClick={go}
                        style={{
                          ...btn,
                          padding: '6px 10px',
                          fontWeight: 800,
                          fontSize: 11,
                          borderColor: on ? t.idxOnBd : t.cardBd,
                          background: on ? t.surfaceHi : t.surface,
                          color: on ? t.accentOn : t.accent
                        }}
                      >
                        {id}
                      </button>
                    );
                    const base = cashInstrument(selected);
                    return (
                      <>
                        {!mcx ? seg('CASH', cashOn && !indexDesk, () => pickCash(base)) : null}
                        {seg('OPTIONS', Boolean(indexDesk) || optOn, () => pickOptionChain(base))}
                        {seg('FUTURES', futOn, () => pickFutures(base))}
                      </>
                    );
                  })()}
                </div>
                {(selected.instrument_type.includes('FUTURE') || /FUT$/i.test(selected.symbol)) && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#0f172a', fontWeight: 700 }}>
                    FUTURES EXPIRY {(selected.expiry || '').toUpperCase() || 'CURRENT MONTH'}
                    {` · LOT ${selected.lot_size || 1}`}
                  </div>
                )}
                {(selected.instrument_type === 'STOCK' ||
                  selected.instrument_type === 'ETF' ||
                  selected.instrument_type === 'INDEX') &&
                  !indexDesk && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                    CASH SEGMENT · NO EXPIRY
                  </div>
                )}
                {selected.instrument_type === 'COMMODITY' && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#9a3412', fontWeight: 700 }}>
                    MCX COMMODITY · OPTIONS + FUTURES · NO CASH EQUITY
                  </div>
                )}
                {selected.instrument_type !== 'STOCK' &&
                selected.instrument_type !== 'ETF' &&
                selected.instrument_type !== 'INDEX' &&
                (contractQuote?.strike != null || selected.strike != null) ? (
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      fontSize: 12
                    }}
                  >
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(14,165,233,0.15)',
                        border: '1px solid rgba(56,189,248,0.35)',
                        color: '#7dd3fc'
                      }}
                    >
                      Strike{' '}
                      <b style={{ color: '#0f172a' }}>
                        {formatPrice(Number(contractQuote?.strike ?? selected.strike))}
                      </b>
                    </span>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(51,65,85,0.5)',
                        border: '1px solid #475569',
                        color: '#e2e8f0'
                      }}
                    >
                      {(contractQuote?.option_type || selected.option_type || '—') as string}
                    </span>
                    <span style={{ color: '#94a3b8', alignSelf: 'center' }}>
                      Underlying {contractQuote?.underlying || selected.underlying_symbol || '—'}
                    </span>
                  </div>
                ) : null}
                {(selected.instrument_type.includes('OPTION') || /CE$|PE$/i.test(selected.symbol)) &&
                  selected.instrument_type !== 'STOCK' && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {((monthlyOnly ? ['MONTHLY'] : ['ALL', 'WEEKLY', 'MONTHLY']) as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          style={{
                            ...btn,
                            padding: '4px 10px',
                            opacity: expiryKind === k ? 1 : 0.65,
                            borderColor:
                              expiryKind === k ? '#22d3ee' : 'rgba(56,189,248,0.4)',
                            background:
                              expiryKind === k ? 'rgba(34,211,238,0.2)' : 'rgba(14,165,233,0.15)'
                          }}
                          onClick={() => {
                            setExpiryKind(k);
                            setSelectedExpiry('');
                            setPrice(0);
                          }}
                        >
                          {k === 'ALL' ? 'All expiries' : k === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                        </button>
                      ))}
                    </div>
                    <label style={{ fontSize: 12, color: '#94a3b8' }}>
                      Expiry
                      <select
                        style={input}
                        value={selectedExpiry}
                        onChange={(e) => {
                          setSelectedExpiry(e.target.value);
                          setPrice(0);
                        }}
                      >
                        {!expiryOptions.length ? <option value="">Loading…</option> : null}
                        {expiryOptions.map((ex) => (
                          <option key={ex.date} value={ex.date}>
                            {ex.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(() => {
                      const expMeta =
                        expiryOptions.find((e) => e.date === selectedExpiry) ||
                        expiryOptions.find((e) => e.date === contractQuote?.expiry);
                      return expMeta || selectedExpiry ? (
                        <div style={{ fontSize: 12, color: '#7dd3fc' }}>
                          Selected: {expMeta?.label || selectedExpiry}
                          {expMeta?.kind ? ` · ${expMeta.kind}` : ''}
                        </div>
                      ) : null;
                    })()}
                    {liveAtm != null || contractQuote?.spot ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          alignItems: 'center',
                          fontSize: 12
                        }}
                      >
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: isLiveBrokerQuotes(chainQuoteMeta)
                              ? 'rgba(34,197,94,0.15)'
                              : 'rgba(245,158,11,0.12)',
                            border: isLiveBrokerQuotes(chainQuoteMeta)
                              ? '1px solid rgba(74,222,128,0.4)'
                              : '1px solid rgba(251,191,36,0.45)',
                            color: isLiveBrokerQuotes(chainQuoteMeta) ? '#86efac' : '#fcd34d'
                          }}
                        >
                          {isLiveBrokerQuotes(chainQuoteMeta) ? 'Live ATM' : 'ATM'}{' '}
                          <b style={{ color: '#0f172a' }}>
                            {liveAtm != null
                              ? liveAtm
                              : Math.round(Number(contractQuote?.spot || 0) / 50) * 50}
                          </b>
                          {contractQuote?.spot
                            ? ` · spot ₹${formatPrice(contractQuote.spot)}`
                            : ''}
                        </span>
                        <button
                          type="button"
                          style={{ ...btn, padding: '4px 10px', fontSize: 11 }}
                          onClick={() => {
                            const und =
                              contractQuote?.underlying ||
                              selected.underlying_symbol ||
                              'NIFTY';
                            const side = (contractQuote?.option_type ||
                              selected.option_type ||
                              'CE') as 'CE' | 'PE';
                            const step = foStrikeStep(und);
                            const atm =
                              liveAtm ??
                              Math.round(Number(contractQuote?.spot || 0) / step) * step;
                            if (!atm) return;
                            const keepExpiry = selectedExpiry;
                            const q = `${und} ${atm}`;
                            setQuery(q);
                            void tradingApi.searchInstruments(q).then((rows) => {
                              const sym = `${und}${atm}${side}`;
                              const hit =
                                rows.find((x) => x.symbol === sym) ||
                                rows.find(
                                  (x) =>
                                    Number(x.strike) === atm &&
                                    (x.option_type || '').toUpperCase() === side
                                );
                              if (hit) {
                                pick(hit);
                                if (keepExpiry) setSelectedExpiry(keepExpiry);
                                toast.success(`Live ATM ${sym}`);
                              } else {
                                void search(q);
                                toast.message(`Search results for live ATM ${atm}`);
                              }
                            });
                          }}
                        >
                          Select live ATM
                        </button>
                      </div>
                    ) : null}
                    {chainRows.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <ChainPremiumBanner meta={chainQuoteMeta} />
                      <div style={{ overflowX: 'auto', maxHeight: 220, borderRadius: 8, border: '1px solid #94a3b8' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ color: '#0f172a', fontWeight: 700, background: '#e2e8f0' }}>
                              <th style={{ padding: 6, textAlign: 'left' }}>CE</th>
                              <th style={{ padding: 6, textAlign: 'center' }}>STRIKE</th>
                              <th style={{ padding: 6, textAlign: 'right' }}>PE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const selectedStrike = Number(
                                contractQuote?.strike ?? selected.strike ?? 0
                              );
                              const atm =
                                liveAtm ??
                                (contractQuote?.spot
                                  ? Math.round(Number(contractQuote.spot) / 50) * 50
                                  : 0);
                              // Center on live ATM so spot-nearest strikes are visible
                              const center = atm > 0 ? atm : selectedStrike;
                              const band = chainRows
                                .filter((r) => {
                                  if (!center) return true;
                                  return Math.abs(r.strike - center) <= 400;
                                })
                                .sort((a, b) => a.strike - b.strike);
                              // Keep selected strike in view even if far OTM
                              const withSelected =
                                selectedStrike &&
                                !band.some((r) => r.strike === selectedStrike)
                                  ? [
                                      ...band,
                                      ...chainRows.filter((r) => r.strike === selectedStrike)
                                    ].sort((a, b) => a.strike - b.strike)
                                  : band;
                              return withSelected.map((r) => {
                                const isAtm = atm > 0 && r.strike === atm;
                                const isSelected = selectedStrike > 0 && r.strike === selectedStrike;
                                return (
                                  <tr
                                    key={r.strike}
                                    style={{
                                      background: isAtm
                                        ? t.atmBg
                                        : isSelected
                                          ? t.surfaceHi
                                          : 'transparent',
                                      borderTop: `1px solid ${t.cardBd}`,
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                      const und =
                                        contractQuote?.underlying ||
                                        selected.underlying_symbol ||
                                        'NIFTY';
                                      const side = (contractQuote?.option_type ||
                                        selected.option_type ||
                                        'CE') as 'CE' | 'PE';
                                      const keepExpiry = selectedExpiry;
                                      const q = `${und} ${r.strike}`;
                                      setQuery(q);
                                      void tradingApi.searchInstruments(q).then((rows) => {
                                        const sym = `${und}${r.strike}${side}`;
                                        const hit =
                                          rows.find((x) => x.symbol === sym) ||
                                          rows.find(
                                            (x) =>
                                              Number(x.strike) === r.strike &&
                                              (x.option_type || '').toUpperCase() === side
                                          );
                                        if (hit) {
                                          pick(hit);
                                          if (keepExpiry) setSelectedExpiry(keepExpiry);
                                        } else {
                                          void search(q);
                                          toast.message(`Search ${sym} to trade this strike`);
                                        }
                                      });
                                    }}
                                  >
                                    <td style={{ padding: 6, color: CE_LTP, ...NUM }}>
                                      {r.ce?.ltp != null ? formatPrice(r.ce.ltp) : '—'}
                                    </td>
                                    <td
                                      style={{
                                        padding: 6,
                                        textAlign: 'center',
                                        fontWeight: 800,
                                        fontSize: 13,
                                        color: isAtm ? t.atmFg : isSelected ? t.accent : t.strikeFg
                                      }}
                                    >
                                      {r.strike}
                                      {isAtm ? ' ATM' : ''}
                                    </td>
                                    <td style={{ padding: 6, textAlign: 'right', color: PE_LTP, ...NUM }}>
                                      {r.pe?.ltp != null ? formatPrice(r.pe.ltp) : '—'}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', minWidth: 160 }}>
                {quoteLoading && !quote && !contractQuote ? (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Fetching quote…</div>
                ) : contractQuote?.premium != null ? (
                  <>
                    <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.3 }}>
                      Option premium
                      {contractQuote.premium_source === 'broker'
                        ? ' · live'
                        : contractQuote.premium_source
                          ? ` · ${contractQuote.premium_source}`
                          : ''}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                      ₹{formatPrice(contractQuote.premium)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Spot ₹{formatPrice(Number(contractQuote.spot || 0))}
                      {contractQuote.spot_change_percent
                        ? ` (${contractQuote.spot_change_percent >= 0 ? '+' : ''}${contractQuote.spot_change_percent.toFixed(2)}%)`
                        : ''}
                    </div>
                    {contractQuote.intrinsic != null ? (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Intrinsic ₹{formatPrice(contractQuote.intrinsic)}
                        {contractQuote.time_value != null
                          ? ` · TV ₹${formatPrice(contractQuote.time_value)}`
                          : ''}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      style={{ ...btn, marginTop: 6, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => {
                        if (contractQuote.premium && contractQuote.premium > 0) {
                          setPrice(Math.round(contractQuote.premium * 100) / 100);
                        }
                      }}
                    >
                      Use premium as price
                    </button>
                  </>
                ) : quote ? (
                  <>
                    <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.3 }}>LTP</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
                      ₹{formatPrice(quote.price)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: quote.change >= 0 ? CE_LTP : PE_LTP,
                        fontWeight: 700,
                        marginTop: 2
                      }}
                    >
                      {quote.change >= 0 ? '+' : ''}
                      {formatPrice(quote.change)} ({quote.changePercent >= 0 ? '+' : ''}
                      {quote.changePercent.toFixed(2)}%)
                      {quote.stale ? ' · stale' : ''}
                      {quote.source ? ` · ${quote.source}` : ''}
                    </div>
                    <button
                      type="button"
                      style={{ ...btn, marginTop: 6, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => {
                        if (quote.price > 0) setPrice(Math.round(quote.price * 100) / 100);
                      }}
                    >
                      Use as order price
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#fca5a5' }}>
                    {quoteErr || 'Quote unavailable'}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Mode: <b style={{ color: CE_LTP }}>Paper</b> ·{' '}
              <span style={{ color: PE_LTP, fontWeight: 700 }}>Live locked</span>
            </div>
            {contractQuote?.message ? (
              <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{contractQuote.message}</div>
            ) : null}
          </div>

          {indexBlocked ? (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(127,29,29,0.35)', color: '#fecaca' }}>
              Index spot cannot be directly traded. Select futures/options contract.
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {derivatives.map((d) => (
                  <button key={d.instrument_id} type="button" style={btn} onClick={() => pick(d)}>
                    {d.display_name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 8 }}>
                {isFoLot ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Size by</span>
                    {(['LOTS', 'QUANTITY'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        style={{
                          ...btn,
                          padding: '4px 10px',
                          opacity: qtyMode === m ? 1 : 0.65,
                          borderColor: qtyMode === m ? '#22d3ee' : 'rgba(56,189,248,0.4)',
                          background:
                            qtyMode === m ? 'rgba(34,211,238,0.2)' : 'rgba(14,165,233,0.15)'
                        }}
                        onClick={() => {
                          if (m === 'LOTS') {
                            setLots(Math.max(1, Math.round(qty / lotSize) || 1));
                          } else {
                            setQty(Math.max(lotSize, Math.floor(lots) * lotSize));
                          }
                          setQtyMode(m);
                        }}
                      >
                        {m === 'LOTS' ? 'Lots' : 'Quantity'}
                      </button>
                    ))}
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      1 lot = {lotSize} units
                      {selected?.underlying_symbol || /NIFTY|SENSEX/i.test(selected?.symbol || '')
                        ? ` · ${selected?.underlying_symbol || selected?.symbol}`
                        : ''}
                    </span>
                  </div>
                ) : null}
                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}
                >
                  {qtyMode === 'LOTS' && isFoLot ? (
                    <label style={{ fontSize: 12 }}>
                      Lots
                      <input
                        style={input}
                        type="number"
                        min={1}
                        step={1}
                        value={lots}
                        onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))}
                      />
                      <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#7dd3fc' }}>
                        Order qty = {orderQuantity().toLocaleString('en-IN')} ({lots} × {lotSize})
                      </span>
                    </label>
                  ) : (
                    <label style={{ fontSize: 12 }}>
                      Quantity
                      <input
                        style={input}
                        type="number"
                        min={1}
                        step={isFoLot ? lotSize : 1}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                      />
                      {isFoLot ? (
                        <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
                          Multiple of {lotSize}
                          {qty % lotSize !== 0 ? (
                            <span style={{ color: '#fca5a5' }}> · not a full lot</span>
                          ) : (
                            <span style={{ color: '#86efac' }}>
                              {' '}
                              · {Math.floor(qty / lotSize)} lot
                              {Math.floor(qty / lotSize) === 1 ? '' : 's'}
                            </span>
                          )}
                        </span>
                      ) : null}
                    </label>
                  )}
                <label style={{ fontSize: 12 }}>
                  Price
                  <input
                    style={input}
                    type="number"
                    value={price || ''}
                    placeholder={quote?.price ? String(quote.price) : 'LTP'}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Stop loss
                  <input
                    style={input}
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(Number(e.target.value))}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Order type
                  <select style={input} value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                    {['MARKET', 'LIMIT', 'SL', 'SL-M'].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12 }}>
                  Product
                  <select style={input} value={product} onChange={(e) => setProduct(e.target.value)}>
                    {['CNC', 'MIS', 'NRML'].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                </div>
              </div>
              {!buySellEnabled ? (
                <div style={{ color: '#fca5a5', fontSize: 12 }}>
                  Buy/Sell disabled for this instrument (check lot size / tradability / role).
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ ...btn, background: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doBuySell('BUY')}
                >
                  Buy
                  {isFoLot && qtyMode === 'LOTS' ? ` ${lots} lot${lots === 1 ? '' : 's'}` : ''}
                </button>
                <button
                  type="button"
                  style={{ ...btn, background: 'rgba(248,113,113,0.25)', color: '#fca5a5' }}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doBuySell('SELL')}
                >
                  Sell
                  {isFoLot && qtyMode === 'LOTS' ? ` ${lots} lot${lots === 1 ? '' : 's'}` : ''}
                </button>
                <button
                  type="button"
                  style={btn}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doPreview('BUY')}
                >
                  Preview only
                </button>
                {preview?.allowed ? (
                  <button type="button" style={btn} disabled={busy} onClick={() => void doSubmit()}>
                    Confirm paper submit
                  </button>
                ) : null}
                <button type="button" style={btn} onClick={() => void createBasket()}>
                  Create basket
                </button>
              </div>
            </>
          )}

          {preview ? (
            <div style={{ padding: 12, borderRadius: 8, background: t.cardBg, fontSize: 12, border: `1px solid ${t.cardBd}` }}>
              <div>Est. margin: ₹{String(preview.estimated_margin)}</div>
              <div>Est. charges: ₹{String(preview.estimated_charges)}</div>
              <div>Est. max loss: ₹{String(preview.estimated_max_loss)}</div>
              <div>Next: {String(preview.next_action)}</div>
              {!stopLoss ? (
                <div style={{ color: '#fbbf24', marginTop: 6 }}>Stop-loss recommended (required for live)</div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {tab === 'basket' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              style={{ ...input, flex: 1, minWidth: 140 }}
              value={newBasketName || basketNameDraft}
              placeholder="NIFTY"
              onChange={(e) => {
                setNewBasketName(e.target.value);
                setBasketNameDraft(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  ensureBasketId();
                  setBasketPick('OPTIONS');
                }
              }}
            />
            <button type="button" style={btn} onClick={() => openBasketPick('OPTIONS')}>
              Open
            </button>
            {baskets.map((b) => {
              const id = String(b.id || '');
              const name = String(b.basketName || b.basket_name || 'Basket');
              const n = Number(b.legs_count ?? 0);
              return (
                <button
                  key={id}
                  type="button"
                  style={{ ...btn, borderColor: activeBasketId === id ? '#38bdf8' : undefined }}
                  onClick={() => void selectBasket(id)}
                >
                  {name}
                  {n ? ` · ${n}` : ''}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              style={{ ...btn, opacity: basketPick === 'FUTURE' ? 1 : 0.6 }}
              onClick={() => openBasketPick('FUTURE')}
            >
              Future
            </button>
            <button
              type="button"
              style={{ ...btn, opacity: basketPick === 'OPTIONS' ? 1 : 0.6 }}
              onClick={() => openBasketPick('OPTIONS')}
            >
              Options
            </button>
            <select
              style={{ ...input, width: 140 }}
              value={activeChainExpiry}
              onChange={(e) => setBasketChainExpiry(e.target.value)}
            >
              {basketExpiries.map((e) => (
                <option key={e.date} value={e.date}>
                  {e.label}
                </option>
              ))}
            </select>
            <select style={{ ...input, width: 90 }} value={legSide} onChange={(e) => setLegSide(e.target.value as 'BUY' | 'SELL')}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {basketDesk.symbol} · {formatPrice(basketSpot)}
            </span>
          </div>

          <div
            style={{
              border: `1px solid ${t.cardBd}`,
              borderRadius: 8,
              background: t.surfaceSoft,
              overflow: 'auto'
            }}
          >
            <div
              style={{
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 700,
                color: '#0369a1',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <span>Selected scripts · {visibleLegs.length}</span>
              <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontWeight: 700 }}>
                <span style={{ color: '#047857' }}>
                  Max profit{' '}
                  {tradePl.unlimitedProfit ? 'Unlimited' : rupeeLabel(tradePl.maxProfit)}
                </span>
                <span style={{ color: '#b91c1c' }}>
                  Max loss{' '}
                  {tradePl.unlimitedLoss ? 'Unlimited' : rupeeLabel(tradePl.maxLoss)}
                </span>
                <span>Margin ₹{Math.round(basketMarginTotal).toLocaleString('en-IN')}</span>
                {visibleLegs.length ? (
                  <button
                    type="button"
                    style={{ ...btn, padding: '2px 8px', fontSize: 11 }}
                    onClick={() => setPayoffExpanded((v) => !v)}
                  >
                    {payoffExpanded ? 'Collapse graph' : 'Expand graph'}
                  </button>
                ) : null}
              </span>
            </div>
            {payoffSeries.pts.length ? (
              <div style={{ background: t.surface, borderTop: `1px solid ${t.cardBd}`, padding: '4px 8px 6px' }}>
                <div style={{ fontSize: 11, color: t.muted, marginBottom: 2 }}>Expiry payoff</div>
                <BasketPayoffChart
                  pts={payoffSeries.pts}
                  spot={basketSpot}
                  height={payoffExpanded ? 260 : 112}
                />
              </div>
            ) : null}
            {visibleLegs.length ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderTop: `1px solid ${t.cardBd}`,
                  background: t.cardBg,
                  fontSize: 12
                }}
              >
                <span style={{ fontWeight: 800, color: t.fg }}>Exit</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: t.muted }}>
                  % profit
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={exitPerUnitDraft}
                    onChange={(e) => setExitPerUnitDraft(e.target.value)}
                    style={{ ...input, width: 64, padding: '4px 6px' }}
                    title="Exit at this % profit on the invested option, e.g. 2"
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#475569' }}>
                  Book ₹
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={exitTotalDraft}
                    onChange={(e) => setExitTotalDraft(e.target.value)}
                    style={{ ...input, width: 88, padding: '4px 6px' }}
                    title="Exit when total profit on invested amount hits this, e.g. 2000"
                  />
                </label>
                <button type="button" style={{ ...btn, padding: '4px 10px', fontWeight: 700 }} onClick={saveBasketExit}>
                  Set exit
                </button>
                {String(basketDetail?.status || '') === 'EXECUTED' ? (
                  <button
                    type="button"
                    style={{ ...btn, padding: '4px 10px', fontWeight: 700, color: '#b91c1c', borderColor: '#fca5a5' }}
                    onClick={squareOffBasket}
                  >
                    Exit now
                  </button>
                ) : null}
                <span style={{ color: '#64748b', flex: '1 1 220px' }}>
                  {savedExitPercent > 0 || savedExitTotal > 0 ? (
                    <>
                      Square off when
                      {savedExitPercent > 0
                        ? ` +${savedExitPercent}%${impliedExitFromPct ? ` (≈ ₹${Math.round(impliedExitFromPct).toLocaleString('en-IN')})` : ''}`
                        : ''}
                      {savedExitPercent > 0 && savedExitTotal > 0 ? ' or' : ''}
                      {savedExitTotal > 0 ? ` +₹${savedExitTotal.toLocaleString('en-IN')} book` : ''}
                      {investedPremium > 0 ? ` · invested ~₹${Math.round(investedPremium).toLocaleString('en-IN')}` : ''}
                    </>
                  ) : (
                    'e.g. 2% profit on invested option, or ₹2000 on invested amount'
                  )}
                </span>
              </div>
            ) : null}
            {visibleLegs.map((leg) => {
              const side = String(leg.side) === 'SELL' ? 'SELL' : 'BUY';
              const margin = liveMarginOf(leg);
              return (
                <div
                  key={String(leg.id)}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderTop: `1px solid ${t.cardBd}`,
                    fontSize: 13,
                    background: t.surface,
                    flexWrap: 'wrap'
                  }}
                >
                  <span style={{ flex: 1, minWidth: 140, fontWeight: 700, color: t.fg }}>{String(leg.symbol)}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      style={{
                        ...btn,
                        padding: '4px 10px',
                        background: side === 'BUY' ? 'rgba(16,185,129,0.22)' : undefined,
                        color: side === 'BUY' ? CE_LTP : '#64748b',
                        borderColor: side === 'BUY' ? '#059669' : undefined
                      }}
                      onClick={() => setLegBuySell(String(leg.id), 'BUY')}
                    >
                      BUY
                    </button>
                    <button
                      type="button"
                      style={{
                        ...btn,
                        padding: '4px 10px',
                        background: side === 'SELL' ? 'rgba(248,113,113,0.22)' : undefined,
                        color: side === 'SELL' ? PE_LTP : '#64748b',
                        borderColor: side === 'SELL' ? '#dc2626' : undefined
                      }}
                      onClick={() => setLegBuySell(String(leg.id), 'SELL')}
                    >
                      SELL
                    </button>
                  </div>
                  <span style={{ color: '#64748b' }}>qty {String(leg.quantity)}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#64748b', fontSize: 12 }}>
                    Exit %
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={Number(leg.exitPercent || 0) || ''}
                      placeholder={savedExitPercent > 0 ? String(savedExitPercent) : '2'}
                      onChange={(e) => setLegExitPercent(String(leg.id), e.target.value)}
                      style={{ ...input, width: 56, padding: '3px 6px' }}
                      title="Exit this option at this % profit on its invested premium"
                    />
                  </label>
                  <span style={{ fontWeight: 700, color: t.fg, minWidth: 110, textAlign: 'right' }}>
                    ₹{Math.round(margin).toLocaleString('en-IN')}
                  </span>
                  <button type="button" style={{ ...btn, padding: '2px 8px' }} onClick={() => dropBasketLeg(String(leg.id))}>
                    ×
                  </button>
                </div>
              );
            })}
            {!visibleLegs.length ? (
              <div style={{ padding: '10px 12px', fontSize: 13, color: t.muted, background: t.surface }}>
                No scripts yet — click a CE, PE, or Future below.
              </div>
            ) : null}
          </div>

          {basketPick === 'FUTURE' ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {basketExpiries.map((exp) => {
                const fut = paperFutureInstrument({
                  underlying: basketDesk.symbol,
                  expiry: exp.date,
                  expiryLabel: exp.label,
                  lot: basketDesk.lot,
                  exchange: basketDesk.exchange,
                  isIndex: isIndexSymbol(basketDesk.symbol)
                });
                const on = selectedSymbols.has(fut.symbol.toUpperCase());
                return (
                  <button
                    key={exp.date}
                    type="button"
                    style={{
                      ...btn,
                      background: on ? 'rgba(14,165,233,0.2)' : undefined,
                      borderColor: on ? '#0284c7' : undefined
                    }}
                    onClick={() => addPickedFuture(exp)}
                  >
                    {on ? '✓ ' : ''}
                    {basketDesk.symbol} {exp.label} FUT
                  </button>
                );
              })}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: `1px solid ${t.cardBd}`, borderRadius: 8, width: 'fit-content', maxWidth: '100%' }}>
              <table style={{ width: 'max-content', fontSize: 12, borderCollapse: 'collapse', background: t.surface }}>
                <thead>
                  <tr style={{ color: t.muted }}>
                    <th style={{ padding: '6px 8px', textAlign: 'right' }}>Call</th>
                    <th style={{ padding: '6px 4px', textAlign: 'center' }}>B / S</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Strike</th>
                    <th style={{ padding: '6px 4px', textAlign: 'center' }}>B / S</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>Put</th>
                  </tr>
                </thead>
                <tbody>
                  {basketChain.rows
                    .filter((r) => Math.abs(r.strike - basketChain.atm) <= basketDesk.step * 4)
                    .map((row) => {
                      const atm = row.strike === basketChain.atm;
                      const ceSym = `${basketDesk.symbol}${row.strike}CE`;
                      const peSym = `${basketDesk.symbol}${row.strike}PE`;
                      const ceLeg = visibleLegs.find((l) => String(l.symbol || '').toUpperCase() === ceSym);
                      const peLeg = visibleLegs.find((l) => String(l.symbol || '').toUpperCase() === peSym);
                      const ceSide = ceLeg ? (String(ceLeg.side) === 'SELL' ? 'SELL' : 'BUY') : null;
                      const peSide = peLeg ? (String(peLeg.side) === 'SELL' ? 'SELL' : 'BUY') : null;
                      const bs = (
                        kind: 'CE' | 'PE',
                        side: 'BUY' | 'SELL',
                        on: boolean,
                        color: string
                      ) => (
                        <button
                          type="button"
                          style={{
                            ...btn,
                            padding: '2px 7px',
                            fontSize: 11,
                            fontWeight: 800,
                            minWidth: 28,
                            color,
                            borderColor: on ? color : t.cardBd,
                            background: on ? (side === 'BUY' ? 'rgba(16,185,129,0.22)' : 'rgba(248,113,113,0.22)') : t.surface
                          }}
                          onClick={() => addPickedOption(row.strike, kind, side)}
                        >
                          {side === 'BUY' ? 'B' : 'S'}
                        </button>
                      );
                      return (
                        <tr key={row.strike} style={{ borderTop: `1px solid ${t.rowBd}`, background: atm ? t.atmBg : undefined }}>
                          <td style={{ padding: '4px 8px', textAlign: 'right', color: CE_LTP, ...NUM, whiteSpace: 'nowrap' }}>
                            {formatPrice(row.ce?.ltp || 0)} CE
                          </td>
                          <td style={{ padding: '4px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 3 }}>
                              {bs('CE', 'BUY', ceSide === 'BUY', CE_LTP)}
                              {bs('CE', 'SELL', ceSide === 'SELL', PE_LTP)}
                            </div>
                          </td>
                          <td style={{ ...NUM, padding: '4px 10px', textAlign: 'center', color: atm ? t.atmFg : t.strikeFg, whiteSpace: 'nowrap' }}>
                            {row.strike}
                          </td>
                          <td style={{ padding: '4px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', gap: 3 }}>
                              {bs('PE', 'BUY', peSide === 'BUY', CE_LTP)}
                              {bs('PE', 'SELL', peSide === 'SELL', PE_LTP)}
                            </div>
                          </td>
                          <td style={{ padding: '4px 8px', textAlign: 'left', color: PE_LTP, ...NUM, whiteSpace: 'nowrap' }}>
                            PE {formatPrice(row.pe?.ltp || 0)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              style={{
                ...btn,
                fontWeight: 700,
                justifySelf: 'start',
                background: 'rgba(16,185,129,0.2)',
                color: '#047857'
              }}
              disabled={busy || !visibleLegs.length || String(basketDetail?.status || '') === 'EXITED'}
              onClick={() => void submitBasket()}
            >
              Execute paper · {visibleLegs.length} script{visibleLegs.length === 1 ? '' : 's'}
            </button>
            {String(basketDetail?.status || '') === 'EXECUTED' ? (
              <button
                type="button"
                style={{ ...btn, fontWeight: 700, color: '#b91c1c' }}
                disabled={busy}
                onClick={squareOffBasket}
              >
                Exit now
              </button>
            ) : null}
            {savedExitPercent > 0 || savedExitTotal > 0 ? (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Exit {savedExitPercent > 0 ? `+${savedExitPercent}%` : ''}
                {savedExitPercent > 0 && savedExitTotal > 0 ? ' or ' : ''}
                {savedExitTotal > 0 ? `+₹${savedExitTotal.toLocaleString('en-IN')} book` : ''}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {tab === 'chart' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          {!selected ? (
            <div style={{ color: '#94a3b8' }}>
              Select Nifty / Bank Nifty / Fin Nifty / Midcap Nifty / Sensex above, pick a strike, then open Chart — or search any symbol.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 650, color: '#e2e8f0' }}>
                  {selected.display_name || selected.symbol}
                </div>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  Paper Buy/Sell on chart · lot {selected.lot_size || 1}
                </span>
                <button
                  type="button"
                  style={btn}
                  onClick={() => {
                    const und =
                      selected.underlying_symbol ||
                      indexDesk?.underlying ||
                      (/^(NIFTY|BANKNIFTY|SENSEX)/i.test(selected.symbol)
                        ? selected.symbol.replace(/\d+.*$/, '')
                        : selected.symbol);
                    setChartTradeInstrument(selected);
                    setChartStock({
                      id: `chart-${und}`,
                      symbol: und,
                      exchange: indexDesk?.exchange || selected.exchange || 'NSE',
                      sortOrder: 0,
                      name: selected.display_name || selected.symbol
                    });
                  }}
                >
                  Open full chart + ticket
                </button>
              </div>
              <ChartTradePanel
                symbol={selected.symbol}
                instrument={selected}
                price={price}
                qty={lots}
                onQtyChange={(n) => {
                  setLots(Math.max(1, n));
                  setQty(Math.max(1, n) * Math.max(1, lotSize));
                  setQtyMode('LOTS');
                }}
              />
            </>
          )}
        </div>
      )}

      {chartStock ? (
        <StockChartModal
          stock={chartStock}
          tradeInstrument={chartTradeInstrument}
          onClose={() => {
            setChartStock(null);
            setChartTradeInstrument(null);
          }}
        />
      ) : null}

    </div>
  );
}
