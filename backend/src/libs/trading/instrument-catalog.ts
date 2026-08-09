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
    lot_size: 25,
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
    lot_size: 25,
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
    lot_size: 25,
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
