export type InstrumentType =
  | 'STOCK'
  | 'INDEX'
  | 'INDEX_FUTURE'
  | 'INDEX_OPTION'
  | 'STOCK_FUTURE'
  | 'STOCK_OPTION'
  | 'ETF';

export interface CatalogInstrument {
  instrument_id: string;
  symbol: string;
  display_name: string;
  exchange: string;
  segment: string;
  asset_class: string;
  instrument_type: InstrumentType;
  tradable: boolean;
  direct_trading_allowed: boolean;
  lot_size: number;
  tick_size: number;
  expiry?: string | null;
  strike?: number | null;
  option_type?: string | null;
  underlying_symbol?: string | null;
  broker_symbol?: string | null;
  provider_id?: string | null;
  trading_status: string;
}

/** Seed catalog — synced into DB on first search/ensure */
export const SEED_INSTRUMENTS: Omit<CatalogInstrument, 'instrument_id'>[] = [
  {
    symbol: 'RELIANCE',
    display_name: 'Reliance Industries',
    exchange: 'NSE',
    segment: 'EQ',
    asset_class: 'EQUITY',
    instrument_type: 'STOCK',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'TCS',
    display_name: 'Tata Consultancy Services',
    exchange: 'NSE',
    segment: 'EQ',
    asset_class: 'EQUITY',
    instrument_type: 'STOCK',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'INFY',
    display_name: 'Infosys',
    exchange: 'NSE',
    segment: 'EQ',
    asset_class: 'EQUITY',
    instrument_type: 'STOCK',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'HDFCBANK',
    display_name: 'HDFC Bank',
    exchange: 'NSE',
    segment: 'EQ',
    asset_class: 'EQUITY',
    instrument_type: 'STOCK',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'SBIN',
    display_name: 'State Bank of India',
    exchange: 'NSE',
    segment: 'EQ',
    asset_class: 'EQUITY',
    instrument_type: 'STOCK',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'NIFTY',
    display_name: 'Nifty 50 Index',
    exchange: 'NSE',
    segment: 'IDX',
    asset_class: 'INDEX',
    instrument_type: 'INDEX',
    tradable: false,
    direct_trading_allowed: false,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'BANKNIFTY',
    display_name: 'Bank Nifty Index',
    exchange: 'NSE',
    segment: 'IDX',
    asset_class: 'INDEX',
    instrument_type: 'INDEX',
    tradable: false,
    direct_trading_allowed: false,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'SENSEX',
    display_name: 'BSE Sensex Index',
    exchange: 'BSE',
    segment: 'IDX',
    asset_class: 'INDEX',
    instrument_type: 'INDEX',
    tradable: false,
    direct_trading_allowed: false,
    lot_size: 1,
    tick_size: 0.05,
    trading_status: 'OPEN'
  },
  {
    symbol: 'NIFTY',
    display_name: 'Nifty 50 Current Month Future',
    exchange: 'NSE',
    segment: 'NFO',
    asset_class: 'DERIVATIVE',
    instrument_type: 'INDEX_FUTURE',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 65,
    tick_size: 0.05,
    expiry: 'CURRENT',
    underlying_symbol: 'NIFTY',
    broker_symbol: 'NIFTY-FUT',
    trading_status: 'OPEN'
  },
  {
    symbol: 'BANKNIFTY',
    display_name: 'Bank Nifty Current Month Future',
    exchange: 'NSE',
    segment: 'NFO',
    asset_class: 'DERIVATIVE',
    instrument_type: 'INDEX_FUTURE',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 15,
    tick_size: 0.05,
    expiry: 'CURRENT',
    underlying_symbol: 'BANKNIFTY',
    broker_symbol: 'BANKNIFTY-FUT',
    trading_status: 'OPEN'
  },
  {
    symbol: 'NIFTY',
    display_name: 'Nifty ATM Call',
    exchange: 'NSE',
    segment: 'NFO',
    asset_class: 'DERIVATIVE',
    instrument_type: 'INDEX_OPTION',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 65,
    tick_size: 0.05,
    expiry: 'NEAR',
    strike: 0,
    option_type: 'CE',
    underlying_symbol: 'NIFTY',
    broker_symbol: 'NIFTY-ATM-CE',
    trading_status: 'OPEN'
  },
  {
    symbol: 'NIFTY',
    display_name: 'Nifty ATM Put',
    exchange: 'NSE',
    segment: 'NFO',
    asset_class: 'DERIVATIVE',
    instrument_type: 'INDEX_OPTION',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 65,
    tick_size: 0.05,
    expiry: 'NEAR',
    strike: 0,
    option_type: 'PE',
    underlying_symbol: 'NIFTY',
    broker_symbol: 'NIFTY-ATM-PE',
    trading_status: 'OPEN'
  },
  {
    symbol: 'NIFTYBEES',
    display_name: 'Nippon India ETF Nifty BeES',
    exchange: 'NSE',
    segment: 'EQ',
    asset_class: 'ETF',
    instrument_type: 'ETF',
    tradable: true,
    direct_trading_allowed: true,
    lot_size: 1,
    tick_size: 0.01,
    trading_status: 'OPEN'
  }
];

export function mapDbInstrument(row: {
  id: string;
  symbol: string;
  displayName: string;
  exchange: string;
  segment: string;
  assetClass: string;
  instrumentType: string;
  tradable: boolean;
  directTradingAllowed: boolean;
  lotSize: number;
  tickSize: number;
  expiry: string | null;
  strike: number | null;
  optionType: string | null;
  underlyingSymbol: string | null;
  brokerSymbol: string | null;
  providerId: string | null;
  tradingStatus: string;
}): CatalogInstrument {
  return {
    instrument_id: row.id,
    symbol: row.symbol,
    display_name: row.displayName,
    exchange: row.exchange,
    segment: row.segment,
    asset_class: row.assetClass,
    instrument_type: row.instrumentType as InstrumentType,
    tradable: row.tradable,
    direct_trading_allowed: row.directTradingAllowed,
    lot_size: row.lotSize,
    tick_size: row.tickSize,
    expiry: row.expiry,
    strike: row.strike,
    option_type: row.optionType,
    underlying_symbol: row.underlyingSymbol,
    broker_symbol: row.brokerSymbol,
    provider_id: row.providerId,
    trading_status: row.tradingStatus
  };
}

export function validateLotSize(quantity: number, lotSize: number): string | null {
  if (quantity <= 0) return 'Quantity must be positive';
  if (lotSize > 1 && quantity % lotSize !== 0) {
    return `Quantity must be a multiple of lot size ${lotSize}`;
  }
  return null;
}

export function productForInstrument(instrumentType: InstrumentType, product?: string): string {
  if (product) return product;
  if (instrumentType === 'STOCK' || instrumentType === 'ETF') return 'CNC';
  return 'NRML';
}

const FO_UNDERLYINGS = [
  { symbol: 'BANKNIFTY', lot: 15, step: 100 },
  { symbol: 'MIDCPNIFTY', lot: 50, step: 25 },
  { symbol: 'FINNIFTY', lot: 25, step: 50 },
  { symbol: 'BANKEX', lot: 15, step: 100 },
  { symbol: 'SENSEX', lot: 20, step: 100 },
  { symbol: 'NIFTY', lot: 65, step: 50 }
] as const;

/** Parse compact F&O symbols: NIFTY24400CE, BANKNIFTY52000PE, NIFTYFUT */
export function parseFoContractSymbol(symbol: string): {
  underlying: string;
  strike: number | null;
  optionType: 'CE' | 'PE' | null;
  isFuture: boolean;
  lotSize: number;
  step: number;
} | null {
  const raw = (symbol || '').toUpperCase().replace(/\s+/g, '').trim();
  if (!raw) return null;
  const u = FO_UNDERLYINGS.find((x) => raw === x.symbol || raw.startsWith(x.symbol));
  if (!u) return null;
  const rest = raw.slice(u.symbol.length);
  if (!rest) {
    return {
      underlying: u.symbol,
      strike: null,
      optionType: null,
      isFuture: false,
      lotSize: u.lot,
      step: u.step
    };
  }
  if (rest === 'FUT') {
    return {
      underlying: u.symbol,
      strike: null,
      optionType: null,
      isFuture: true,
      lotSize: u.lot,
      step: u.step
    };
  }
  const m = rest.match(/^(\d{3,6})(CE|PE)?$/);
  if (!m) return null;
  return {
    underlying: u.symbol,
    strike: Number(m[1]),
    optionType: (m[2] as 'CE' | 'PE' | undefined) || null,
    isFuture: false,
    lotSize: u.lot,
    step: u.step
  };
}

/** Estimate option premium via Black-Scholes (requires DTE for realistic weeklies). */
export function estimateOptionPremium(
  spot: number,
  strike: number,
  optionType: 'CE' | 'PE',
  ivPct = 14,
  opts?: { expiry?: string | null; daysToExpiry?: number }
): { premium: number; intrinsic: number; timeValue: number; iv: number } {
  const intrinsic =
    optionType === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);

  let days =
    opts?.daysToExpiry != null
      ? opts.daysToExpiry
      : opts?.expiry
        ? Math.max(
            0,
            (new Date(`${opts.expiry}T15:30:00+05:30`).getTime() - Date.now()) / 86400000
          )
        : 7;

  // Default weekly window if expiry unknown — still far better than flat 8% of spot
  if (!Number.isFinite(days) || days < 0) days = 7;
  days = Math.max(days, 2 / 24);

  // Lazy import avoided — inline BS to keep catalog free of circular deps
  const T = days / 365;
  const r = 0.065;
  const sigma = Math.max(ivPct, 1) / 100;
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(spot / strike) + (r + (sigma * sigma) / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const normCdf = (x: number) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p =
      d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  };
  const disc = Math.exp(-r * T);
  const raw =
    optionType === 'CE'
      ? spot * normCdf(d1) - strike * disc * normCdf(d2)
      : strike * disc * normCdf(-d2) - spot * normCdf(-d1);
  const premium = Number(Math.max(raw, intrinsic * 0.99, 0.05).toFixed(2));
  const timeValue = Number(Math.max(0, premium - intrinsic).toFixed(2));
  return { premium, intrinsic: Number(intrinsic.toFixed(2)), timeValue, iv: ivPct };
}
