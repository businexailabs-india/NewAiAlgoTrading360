/**
 * Domain models for SENSEX & Multi-Account Portfolio.
 * Separate from broker wire formats — map at the adapter boundary.
 */

export type BrokerId = 'dhan' | 'zerodha' | 'upstox' | 'paper' | 'other';
export type ExchangeId = 'BSE' | 'NSE' | 'GLOBAL' | 'UNMAPPED';
export type SegmentId = 'EQ' | 'FO' | 'CD' | 'COM' | 'OTHER';
export type ProductType = 'CNC' | 'MIS' | 'NRML' | 'MTF' | 'OTHER';
export type OptionType = 'CE' | 'PE' | null;
export type ConnectionState = 'CONNECTED' | 'DEGRADED' | 'STALE' | 'DISCONNECTED' | 'DISABLED';
export type DataFreshness = 'LIVE' | 'DELAYED' | 'DEMO' | 'STALE' | 'DISCONNECTED';
export type RiskLevel = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'TRADING_BLOCKED';
export type ReconciliationStatus =
  | 'MATCHED'
  | 'PENDING'
  | 'DIFFERENCE_FOUND'
  | 'BROKER_UNAVAILABLE'
  | 'STALE';
export type OrderStatus =
  | 'CREATED'
  | 'RISK_APPROVED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PENDING'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'MODIFY_PENDING'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'UNKNOWN';
export type TradingModeLabel = 'PAPER' | 'LIVE';
export type MoneyFormat = 'exact' | 'lakhs' | 'compact';
export type HistoryPeriod = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'CUSTOM';
export type BenchmarkId = 'SENSEX' | 'NIFTY50' | 'CUSTOM';
export type AssetClass =
  | 'CASH_EQUITY'
  | 'INDEX_FUTURES'
  | 'INDEX_OPTIONS'
  | 'STOCK_FUTURES'
  | 'STOCK_OPTIONS'
  | 'ETF'
  | 'CASH'
  | 'OTHER';

export interface Money {
  amount: number;
  currency: string;
}

export interface CurrencyConversion {
  from: string;
  to: string;
  rate: number;
  timestamp: string;
  source: string;
  stale: boolean;
}

export interface BrokerAccount {
  id: string;
  broker: BrokerId;
  alias: string;
  accountIdMasked: string;
  markets: ExchangeId[];
  baseCurrency: string;
  connectionState: ConnectionState;
  lastSyncAt: string;
  tradingEnabled: boolean;
  riskProfile: string;
  heartbeatAt: string | null;
}

export interface AccountGroup {
  id: string;
  name: string;
  type: 'AGGREGATED';
  accountIds: string[];
  description?: string;
}

export interface MarketQuote {
  symbol: string;
  exchange: ExchangeId;
  label: string;
  last: number | null;
  change: number | null;
  changePct: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  timestamp: string | null;
  freshness: DataFreshness;
  source: string;
}

export interface ExchangeStatus {
  exchange: ExchangeId;
  session: 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'UNKNOWN';
  message: string;
  asOf: string;
  freshness: DataFreshness;
}

export interface Instrument {
  canonicalId: string;
  brokerInstrumentId: string | null;
  symbol: string;
  name: string;
  exchange: ExchangeId;
  segment: SegmentId;
  assetClass: AssetClass;
  underlying: string | null;
  tradable: boolean;
  /** Spot indices are not tradable — trading targets futures/options/ETFs/baskets. */
  isSpotIndexBenchmark: boolean;
}

export interface DerivativeContract {
  canonicalId: string;
  brokerInstrumentId: string | null;
  tradingSymbol: string;
  exchange: ExchangeId;
  segment: SegmentId;
  underlying: string;
  instrumentType: 'FUT' | 'CE' | 'PE';
  expiry: string | null;
  strike: number | null;
  optionType: OptionType;
  lotSize: number | null;
  tickSize: number | null;
  freezeQty: number | null;
  productHints: ProductType[];
  metadataSource: 'INSTRUMENT_MASTER' | 'BROKER' | 'UNAVAILABLE';
}

export interface Position {
  id: string;
  brokerPositionId: string | null;
  accountId: string;
  broker: BrokerId;
  exchange: ExchangeId;
  segment: SegmentId;
  canonicalInstrumentId: string;
  brokerInstrumentId: string | null;
  symbol: string;
  productType: ProductType;
  expiry: string | null;
  strike: number | null;
  optionType: OptionType;
  strategyId: string | null;
  strategyName: string | null;
  buyQty: number;
  sellQty: number;
  netQty: number;
  avgPrice: number;
  ltp: number | null;
  dayPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  marketValue: number;
  marginUsed: number;
  delta: number | null;
  currency: string;
  updatedAt: string;
  lastSyncAt: string;
  reconciliationStatus: ReconciliationStatus;
  correlationId: string;
  assetClass: AssetClass;
  dataFreshness: DataFreshness;
}

export interface AggregatedPosition {
  key: string;
  symbol: string;
  exchange: ExchangeId;
  segment: SegmentId;
  productType: ProductType;
  expiry: string | null;
  strike: number | null;
  optionType: OptionType;
  canonicalInstrumentId: string;
  netQty: number;
  weightedAvgPrice: number;
  marketValue: number;
  dayPnl: number;
  unrealizedPnl: number;
  realizedPnl: number;
  children: Position[];
}

export interface Order {
  id: string;
  brokerOrderId: string | null;
  clientReference: string;
  accountId: string;
  broker: BrokerId;
  exchange: ExchangeId;
  segment: SegmentId;
  canonicalInstrumentId: string;
  brokerInstrumentId: string | null;
  symbol: string;
  strategyId: string | null;
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  quantity: number;
  filledQty: number;
  remainingQty: number;
  price: number | null;
  triggerPrice: number | null;
  avgFillPrice: number | null;
  status: OrderStatus;
  productType: ProductType;
  tradingMode: TradingModeLabel;
  submittedAt: string;
  updatedAt: string;
  correlationId: string;
  rejectionReason?: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  status: OrderStatus;
  message: string;
  timestamp: string;
  source: 'PLATFORM' | 'BROKER' | 'RISK' | 'OPERATOR';
}

export interface OrderIntent {
  accountId: string;
  exchange: ExchangeId;
  underlying: string;
  instrumentType: 'FUT' | 'CE' | 'PE' | 'ETF' | 'EQUITY';
  canonicalInstrumentId: string | null;
  expiry: string | null;
  strike: number | null;
  optionType: OptionType;
  side: 'BUY' | 'SELL';
  quantity: number;
  lots: number | null;
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  limitPrice: number | null;
  triggerPrice: number | null;
  timeInForce: 'DAY' | 'IOC' | 'GTC';
  productType: ProductType;
  strategyTag: string | null;
  clientReference: string;
  tradingMode: TradingModeLabel;
}

export interface OrderPreview {
  previewId: string;
  intent: OrderIntent;
  broker: BrokerId;
  accountAlias: string;
  instrumentLabel: string;
  lotSize: number | null;
  tickSize: number | null;
  freezeQty: number | null;
  estimatedValue: Money;
  estimatedMargin: Money;
  estimatedCharges: Money;
  availableMargin: Money;
  currentPositionQty: number;
  resultingPositionQty: number;
  maxLossEstimate: Money | null;
  riskWarnings: string[];
  validationErrors: string[];
  marketSessionOk: boolean;
  expiresAt: string;
}

export interface PortfolioSummary {
  reportingCurrency: string;
  netLiquidation: number;
  investedValue: number;
  availableCash: number;
  dayPnl: number;
  totalPnl: number;
  realizedPnl: number;
  unrealizedPnl: number;
  marginUtilized: number;
  buyingPower: number;
  riskStatus: RiskLevel;
  fxConversions: CurrencyConversion[];
  fxWarning: string | null;
  asOf: string;
  freshness: DataFreshness;
}

export interface PortfolioSnapshotPoint {
  timestamp: string;
  portfolioValue: number;
  periodPnl: number;
  returnPct: number;
  drawdownPct: number;
  bseExposure: number;
  nseExposure: number;
  selectedAccountValue: number | null;
  benchmarkValue: number | null;
  benchmarkReturnPct: number | null;
  netExposure: number;
}

export interface StrategyAllocation {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ERROR';
  accountIds: string[];
  capitalAllocated: number;
  capitalUsed: number;
  dayPnl: number;
  totalPnl: number;
  drawdownPct: number;
  openPositions: number;
  lastSignalAt: string | null;
  riskState: RiskLevel;
}

export interface RiskLimit {
  id: string;
  label: string;
  current: number;
  limit: number;
  unit: 'INR' | 'USD' | 'PCT' | 'COUNT' | 'OPS';
  level: RiskLevel;
}

export interface RiskSnapshot {
  grossExposure: number;
  netExposure: number;
  longExposure: number;
  shortExposure: number;
  marginUtilizationPct: number;
  concentrationPct: number;
  accountDrawdownPct: number;
  dailyLoss: number;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  expiryConcentrationPct: number;
  unhedgedOptionExposure: number;
  stalePriceCount: number;
  reconciliationExceptions: number;
  overall: RiskLevel;
  limits: RiskLimit[];
  asOf: string;
}

export interface ReconciliationResult {
  accountId: string;
  accountAlias: string;
  platformPositionValue: number;
  brokerPositionValue: number;
  positionDiff: number;
  platformCash: number;
  brokerCash: number;
  cashDiff: number;
  lastReconciledAt: string | null;
  source: string;
  status: ReconciliationStatus;
}

export interface ActivityEvent {
  id: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  timestamp: string;
  accountId: string | null;
  broker: BrokerId | null;
  strategyId: string | null;
  instrument: string | null;
  description: string;
  correlationId: string;
  kind:
    | 'SIGNAL'
    | 'RISK_REJECT'
    | 'BROKER_ACK'
    | 'PARTIAL_FILL'
    | 'FILL'
    | 'ORDER_REJECT'
    | 'CONNECTIVITY'
    | 'RECONCILIATION'
    | 'OPERATOR'
    | 'KILL_SWITCH';
}

export interface AllocationSlice {
  name: string;
  value: number;
  pct: number;
}

export interface ExposureBreakdown {
  byAccount: AllocationSlice[];
  byAssetClass: AllocationSlice[];
  byExchange: AllocationSlice[];
  longExposure: number;
  shortExposure: number;
  netExposure: number;
  deltaAdjustedExposure: number | null;
}

export interface KillSwitchRequest {
  scope: 'GLOBAL' | 'ACCOUNT' | 'STRATEGY';
  targetIds: string[];
  confirmationPhrase: string;
  reason: string;
}

export interface PortfolioService {
  getAccounts(): Promise<BrokerAccount[]>;
  getAccountGroups(): Promise<AccountGroup[]>;
  getPortfolioSummary(accountIds: string[]): Promise<PortfolioSummary>;
  getPortfolioHistory(
    accountIds: string[],
    period: HistoryPeriod,
    benchmark: BenchmarkId
  ): Promise<PortfolioSnapshotPoint[]>;
  getPositions(accountIds: string[]): Promise<Position[]>;
  getOrders(accountIds: string[]): Promise<Order[]>;
  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  getStrategyAllocations(accountIds: string[]): Promise<StrategyAllocation[]>;
  getRiskSnapshot(accountIds: string[]): Promise<RiskSnapshot>;
  getReconciliationStatus(accountIds: string[]): Promise<ReconciliationResult[]>;
  getMarketContext(): Promise<{ quotes: MarketQuote[]; status: ExchangeStatus[]; demo: boolean }>;
  getDerivativeContracts(exchange: ExchangeId, underlying: string): Promise<DerivativeContract[]>;
  getExposure(accountIds: string[]): Promise<ExposureBreakdown>;
  getActivity(accountIds: string[]): Promise<ActivityEvent[]>;
  previewOrder(intent: OrderIntent): Promise<OrderPreview>;
  submitOrder(approvedPreviewId: string, liveConfirmPhrase?: string): Promise<Order>;
  modifyOrder(orderId: string, changes: Partial<OrderIntent>): Promise<Order>;
  cancelOrder(orderId: string): Promise<{ accepted: boolean; message: string }>;
  pauseStrategy(strategyId: string): Promise<void>;
  triggerKillSwitch(req: KillSwitchRequest): Promise<{ accepted: boolean; auditId: string; message: string }>;
}
