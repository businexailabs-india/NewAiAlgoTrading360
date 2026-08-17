/**
 * US Stocks Manual Trading — UI domain types.
 * Mirrors backend `ibkr-us-stocks` contracts. Environment always comes from
 * the selected IBKR connection profile — never a client-only isPaper toggle.
 */

export type TradingEnvironment = 'PAPER' | 'LIVE';

export type IBKRSessionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'AUTHENTICATING'
  | 'READ_ONLY'
  | 'ESTABLISHING_BROKERAGE_SESSION'
  | 'TRADING_READY'
  | 'COMPETING_SESSION'
  | 'EXPIRED'
  | 'MAINTENANCE'
  | 'ERROR';

export type MarketDataState = 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE' | 'DEMO';

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MKT' | 'LMT' | 'STP' | 'STP_LMT';
export type TimeInForce = 'DAY' | 'GTC' | 'IOC' | 'FOK';

export type OrderPlatformState =
  | 'DRAFT'
  | 'PREVIEWED'
  | 'SUBMITTING'
  | 'BROKER_CONFIRMATION_REQUIRED'
  | 'SUBMITTED'
  | 'ACKNOWLEDGED'
  | 'PARTIAL_FILLED'
  | 'FILLED'
  | 'CANCEL_PENDING'
  | 'CANCELLED'
  | 'REJECTED'
  | 'INACTIVE'
  | 'ERROR';

export type UsMarketSession = 'PRE' | 'RTH' | 'POST' | 'CLOSED';

export interface IBKRConnectionProfile {
  id: string;
  label: string;
  /** Bound at profile creation from broker auth — never set by client request. */
  environment: TradingEnvironment;
  accountIds: string[];
  isDefault?: boolean;
  paperLimitations?: string[];
  description?: string;
}

export interface BrokerAccount {
  accountId: string;
  accountTitle: string;
  accountIdMasked?: string;
  currency: string;
  environment: TradingEnvironment;
  type?: string;
  permissions?: string[];
}

export interface USStockInstrument {
  conId: number;
  symbol: string;
  description: string;
  exchange: string;
  primaryExchange: string;
  currency: string;
  secType: 'STK';
  minTick: number;
  fractionalEligible: boolean;
  tradingClass?: string;
}

export interface MarketQuote {
  conId: number;
  symbol: string;
  bid?: number;
  ask?: number;
  last?: number;
  bidSize?: number;
  askSize?: number;
  volume?: number;
  asOf: string;
  dataState: MarketDataState;
  /** e.g. "DEMO IBKR DATA", "DELAYED", "STALE" */
  label?: string;
}

export interface ManualOrderIntent {
  accountId: string;
  conId: number;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  tif?: TimeInForce;
  outsideRth?: boolean;
  strategyTag?: string;
}

export interface ValidatedOrderIntent extends ManualOrderIntent {
  instrument: USStockInstrument;
  environment: TradingEnvironment;
  estimatedNotional: number;
  tif: TimeInForce;
}

export interface RiskCheck {
  code: string;
  severity: 'INFO' | 'WARN' | 'BLOCK';
  message: string;
  passed: boolean;
}

export interface OrderPreview {
  previewId: string;
  intent: ValidatedOrderIntent;
  estimatedCommission?: number;
  estimatedNotional: number;
  riskChecks: RiskCheck[];
  allowed: boolean;
  warnings: string[];
  quoteSnapshot?: MarketQuote;
  expiresAt?: string;
  accountSnapshot?: {
    netLiquidation?: number;
    buyingPower?: number;
    asOf?: string;
  };
}

export interface BrokerReplyMessage {
  messageId: string;
  orderId?: string;
  message: string[];
  requiresConfirmation: true;
  createdAt: string;
}

export interface Order {
  orderId: string;
  brokerOrderId?: string;
  accountId: string;
  conId: number;
  symbol: string;
  side: OrderSide;
  orderType: OrderType;
  quantity: number;
  filledQuantity: number;
  remainingQuantity: number;
  limitPrice?: number;
  stopPrice?: number;
  avgFillPrice?: number;
  tif: TimeInForce;
  status: OrderPlatformState;
  environment: TradingEnvironment;
  pendingReply?: BrokerReplyMessage;
  createdAt: string;
  updatedAt: string;
  rejectReason?: string;
  strategyTag?: string;
}

export interface OrderEvent {
  id: string;
  orderId: string;
  type: string;
  message: string;
  at: string;
  meta?: Record<string, unknown>;
}

export interface Execution {
  execId: string;
  orderId: string;
  accountId: string;
  conId: number;
  symbol: string;
  side: OrderSide;
  quantity: number;
  price: number;
  commission?: number;
  executedAt: string;
  environment: TradingEnvironment;
}

export interface Position {
  accountId: string;
  conId: number;
  symbol: string;
  quantity: number;
  avgCost: number;
  marketPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
  dayPnl?: number;
  currency: string;
  environment: TradingEnvironment;
}

export interface AccountSummary {
  accountId: string;
  environment: TradingEnvironment;
  currency: string;
  netLiquidation: number;
  availableFunds: number;
  buyingPower: number;
  excessLiquidity: number;
  initMargin?: number;
  maintMargin?: number;
  cushion?: number;
  dayPnl?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
  asOf?: string;
  freshness?: MarketDataState;
  label?: string;
  stale?: boolean;
}

export interface OrderCapability {
  conId: number;
  supportedOrderTypes: OrderType[];
  supportedTif: TimeInForce[];
  allowFractional: boolean;
  allowShort: boolean;
  minQuantity: number;
  quantityIncrement: number;
  outsideRthAllowed: boolean;
}

export interface AuditEvent {
  id: string;
  userId: string;
  action: string;
  at: string;
  environment?: TradingEnvironment;
  accountId?: string;
  orderId?: string;
  details?: Record<string, unknown>;
}

export interface MarketSessionInfo {
  exchange: string;
  isOpen: boolean;
  session: UsMarketSession;
  asOf: string;
  nextOpen?: string;
  nextClose?: string;
}

export interface SessionStatus {
  state: IBKRSessionState;
  environment?: TradingEnvironment;
  selectedProfileId?: string;
  accounts?: BrokerAccount[];
  paperLimitations?: string[];
  competingSession?: boolean;
  readOnly?: boolean;
  message?: string;
  isDemo?: boolean;
  mode?: 'mock' | 'live';
  tradingEnabled?: boolean;
  blockedReason?: string;
  heartbeatAt?: string | null;
  permissions?: string[];
  accountAlias?: string;
  accountIdMasked?: string;
}

export interface ModifyOrderRequest {
  quantity?: number;
  limitPrice?: number;
  stopPrice?: number;
  tif?: TimeInForce;
}

export interface SubmitOrderRequest extends ManualOrderIntent {
  previewId?: string;
  /** Required for LIVE — exact phrase "LIVE" after checkbox acknowledge. */
  liveConfirmPhrase?: string;
}

export class UsStocksApiError extends Error {
  status: number;
  body?: unknown;

  constructor(message: string, status = 0, body?: unknown) {
    super(message);
    this.name = 'UsStocksApiError';
    this.status = status;
    this.body = body;
  }
}
