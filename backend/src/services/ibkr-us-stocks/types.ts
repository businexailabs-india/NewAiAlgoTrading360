/**
 * IBKR US Stocks Manual Trading — domain types.
 *
 * TradingEnvironment (PAPER | LIVE) MUST come from the authenticated IBKR
 * connection profile / account metadata. Never trust a client-only isPaper flag.
 *
 * Intended IBKR Client Portal Web API paths (documented only — not invented as live calls):
 * - POST /iserver/auth/status
 * - POST /iserver/account
 * - GET  /iserver/accounts
 * - GET  /portfolio/accounts
 * - GET  /portfolio/{accountId}/summary
 * - GET  /iserver/secdef/search?symbol=
 * - GET  /iserver/contract/{conid}/info
 * - GET  /iserver/marketdata/snapshot?conids=
 * - GET  /portfolio/{accountId}/positions
 * - GET  /iserver/account/orders
 * - GET  /iserver/account/trades
 * - POST /iserver/account/{accountId}/orders
 * - POST /iserver/reply/{messageId}
 * - POST /iserver/account/{accountId}/order/{orderId}
 * - DELETE /iserver/account/{accountId}/order/{orderId}
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
  currency: string;
  environment: TradingEnvironment;
  type?: string;
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

export type MarketDataState = 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE' | 'DEMO';

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

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MKT' | 'LMT' | 'STP' | 'STP_LMT';
export type TimeInForce = 'DAY' | 'GTC' | 'IOC' | 'FOK';

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
}

export interface BrokerReplyMessage {
  messageId: string;
  orderId?: string;
  message: string[];
  requiresConfirmation: true;
  createdAt: string;
}

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
  cushion?: number;
  label?: string;
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
  session: 'PRE' | 'RTH' | 'POST' | 'CLOSED';
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
}

export interface ModifyOrderRequest {
  quantity?: number;
  limitPrice?: number;
  stopPrice?: number;
  tif?: TimeInForce;
}

/**
 * Broker adapter contract. Implementations must never expose credentials to the browser.
 * Live Web API calls belong only in a server-side live adapter (see live-adapter.stub.ts).
 */
export interface IBKRTradingAdapter {
  getSessionStatus(userId: string): Promise<SessionStatus>;
  establishBrokerageSession(userId: string): Promise<SessionStatus>;
  getConnectionProfiles(userId: string): Promise<IBKRConnectionProfile[]>;
  selectConnectionProfile(userId: string, profileId: string): Promise<SessionStatus>;
  getAccounts(userId: string): Promise<BrokerAccount[]>;
  getAccountSummary(userId: string, accountId: string): Promise<AccountSummary>;
  searchInstruments(userId: string, query: string): Promise<USStockInstrument[]>;
  getContractDetails(userId: string, conId: number): Promise<USStockInstrument>;
  getOrderCapabilities(userId: string, conId: number): Promise<OrderCapability>;
  getQuote(userId: string, conId: number): Promise<MarketQuote>;
  getPositions(userId: string, accountId: string): Promise<Position[]>;
  getOpenOrders(userId: string, accountId: string): Promise<Order[]>;
  getRecentTrades(userId: string, accountId: string): Promise<Execution[]>;
  getExecutions(userId: string, accountId: string): Promise<Execution[]>;
  /** Platform-side preview only — must not submit to broker. */
  previewOrder(userId: string, intent: ManualOrderIntent): Promise<OrderPreview>;
  submitOrder(userId: string, intent: ManualOrderIntent): Promise<Order>;
  confirmBrokerReply(userId: string, messageId: string): Promise<Order>;
  rejectBrokerReply(userId: string, messageId: string): Promise<Order>;
  modifyOrder(userId: string, orderId: string, patch: ModifyOrderRequest): Promise<Order>;
  cancelOrder(userId: string, orderId: string): Promise<Order>;
  getOrderStatus(userId: string, orderId: string): Promise<Order>;
  getOrderEvents(userId: string, orderId: string): Promise<OrderEvent[]>;
  getAuditEvents(userId: string): Promise<AuditEvent[]>;
  getMarketSession(userId: string): Promise<MarketSessionInfo>;
}
