/**
 * Stub Live IBKR Client Portal Web API adapter.
 *
 * NEVER calls browser-reachable credentials. Credentials stay server-side only
 * (env / secret store). This stub throws until properly configured.
 *
 * Intended Web API paths (comments only — do not invent undocumented endpoints):
 * - POST {base}/iserver/auth/status
 * - POST {base}/iserver/account                    (establish brokerage session)
 * - GET  {base}/iserver/accounts
 * - GET  {base}/portfolio/accounts
 * - GET  {base}/portfolio/{accountId}/summary
 * - GET  {base}/iserver/secdef/search?symbol=
 * - GET  {base}/iserver/contract/{conid}/info
 * - GET  {base}/iserver/marketdata/snapshot?conids=
 * - GET  {base}/portfolio/{accountId}/positions/{pageId}
 * - GET  {base}/iserver/account/orders
 * - GET  {base}/iserver/account/trades
 * - POST {base}/iserver/account/{accountId}/orders
 * - POST {base}/iserver/reply/{messageId}
 * - POST {base}/iserver/account/{accountId}/order/{orderId}
 * - DELETE {base}/iserver/account/{accountId}/order/{orderId}
 *
 * Required server env (never expose to Vite/client):
 * - IBKR_WEBAPI_BASE           e.g. https://localhost:5000/v1/api (Client Portal Gateway)
 * - IBKR_CP_GATEWAY_HOST       Client Portal Gateway host
 * - IBKR_CP_GATEWAY_PORT       typically 5000
 * - IBKR_OAUTH_CONSUMER_KEY    (if using OAuth)
 * - IBKR_OAUTH_ACCESS_TOKEN    (server secret)
 * - IBKR_OAUTH_ACCESS_SECRET   (server secret)
 * - IBKR_ACCOUNT_ID_PAPER / IBKR_ACCOUNT_ID_LIVE (optional account pins)
 */

import {
  AccountSummary,
  AuditEvent,
  BrokerAccount,
  Execution,
  IBKRConnectionProfile,
  IBKRTradingAdapter,
  ManualOrderIntent,
  MarketQuote,
  MarketSessionInfo,
  ModifyOrderRequest,
  Order,
  OrderCapability,
  OrderEvent,
  OrderPreview,
  Position,
  SessionStatus,
  USStockInstrument
} from './types';

const NOT_CONFIGURED = [
  'LiveIBKRWebApiAdapter is not configured.',
  'Set server-only env: IBKR_WEBAPI_BASE, IBKR_CP_GATEWAY_HOST, IBKR_CP_GATEWAY_PORT,',
  'and OAuth secrets (IBKR_OAUTH_CONSUMER_KEY, IBKR_OAUTH_ACCESS_TOKEN, IBKR_OAUTH_ACCESS_SECRET)',
  'or run Client Portal Gateway with authenticated session cookies server-side.',
  'Credentials must never be sent to the browser.'
].join(' ');

function notConfigured(): never {
  throw Object.assign(new Error(NOT_CONFIGURED), {
    statusCode: 503,
    reason: 'IBKR_LIVE_NOT_CONFIGURED',
    correctiveAction:
      'Configure IBKR Client Portal Gateway + server env, or set IBKR_US_STOCKS_MODE=mock'
  });
}

function isLiveConfigured(): boolean {
  return Boolean(
    process.env.IBKR_WEBAPI_BASE &&
      process.env.IBKR_CP_GATEWAY_HOST &&
      (process.env.IBKR_OAUTH_ACCESS_TOKEN || process.env.IBKR_CP_SESSION_COOKIE)
  );
}

function ensureConfigured(): never {
  if (!isLiveConfigured()) notConfigured();
  // Even when env is present, this stub does not implement live HTTP calls yet.
  throw Object.assign(
    new Error(
      'LiveIBKRWebApiAdapter stub: env detected but live HTTP client is not implemented. Keep IBKR_US_STOCKS_MODE=mock until the gateway client is wired.'
    ),
    {
      statusCode: 501,
      reason: 'IBKR_LIVE_STUB',
      correctiveAction: 'Use mock mode or implement server-side Web API client'
    }
  );
}

export class LiveIBKRWebApiAdapter implements IBKRTradingAdapter {
  constructor() {
    // Intentionally does not load or log secrets.
  }

  async getSessionStatus(_userId: string): Promise<SessionStatus> {
    return ensureConfigured();
  }

  async establishBrokerageSession(_userId: string): Promise<SessionStatus> {
    // Intended: POST /iserver/account
    return ensureConfigured();
  }

  async getConnectionProfiles(_userId: string): Promise<IBKRConnectionProfile[]> {
    return ensureConfigured();
  }

  async selectConnectionProfile(_userId: string, _profileId: string): Promise<SessionStatus> {
    return ensureConfigured();
  }

  async getAccounts(_userId: string): Promise<BrokerAccount[]> {
    // Intended: GET /iserver/accounts
    return ensureConfigured();
  }

  async getAccountSummary(_userId: string, _accountId: string): Promise<AccountSummary> {
    // Intended: GET /portfolio/{accountId}/summary
    return ensureConfigured();
  }

  async searchInstruments(_userId: string, _query: string): Promise<USStockInstrument[]> {
    // Intended: GET /iserver/secdef/search?symbol=
    return ensureConfigured();
  }

  async getContractDetails(_userId: string, _conId: number): Promise<USStockInstrument> {
    // Intended: GET /iserver/contract/{conid}/info
    return ensureConfigured();
  }

  async getOrderCapabilities(_userId: string, _conId: number): Promise<OrderCapability> {
    return ensureConfigured();
  }

  async getQuote(_userId: string, _conId: number): Promise<MarketQuote> {
    // Intended: GET /iserver/marketdata/snapshot?conids=
    return ensureConfigured();
  }

  async getPositions(_userId: string, _accountId: string): Promise<Position[]> {
    // Intended: GET /portfolio/{accountId}/positions/{pageId}
    return ensureConfigured();
  }

  async getOpenOrders(_userId: string, _accountId: string): Promise<Order[]> {
    // Intended: GET /iserver/account/orders
    return ensureConfigured();
  }

  async getRecentTrades(_userId: string, _accountId: string): Promise<Execution[]> {
    // Intended: GET /iserver/account/trades
    return ensureConfigured();
  }

  async getExecutions(_userId: string, _accountId: string): Promise<Execution[]> {
    return ensureConfigured();
  }

  async previewOrder(_userId: string, _intent: ManualOrderIntent): Promise<OrderPreview> {
    // Platform-side preview only; live may also use whatif endpoints when implemented
    return ensureConfigured();
  }

  async submitOrder(_userId: string, _intent: ManualOrderIntent): Promise<Order> {
    // Intended: POST /iserver/account/{accountId}/orders
    return ensureConfigured();
  }

  async confirmBrokerReply(_userId: string, _messageId: string): Promise<Order> {
    // Intended: POST /iserver/reply/{messageId} with confirmed:true
    return ensureConfigured();
  }

  async rejectBrokerReply(_userId: string, _messageId: string): Promise<Order> {
    // Intended: POST /iserver/reply/{messageId} with confirmed:false
    return ensureConfigured();
  }

  async modifyOrder(
    _userId: string,
    _orderId: string,
    _patch: ModifyOrderRequest
  ): Promise<Order> {
    // Intended: POST /iserver/account/{accountId}/order/{orderId}
    return ensureConfigured();
  }

  async cancelOrder(_userId: string, _orderId: string): Promise<Order> {
    // Intended: DELETE /iserver/account/{accountId}/order/{orderId}
    return ensureConfigured();
  }

  async getOrderStatus(_userId: string, _orderId: string): Promise<Order> {
    return ensureConfigured();
  }

  async getOrderEvents(_userId: string, _orderId: string): Promise<OrderEvent[]> {
    return ensureConfigured();
  }

  async getAuditEvents(_userId: string): Promise<AuditEvent[]> {
    return ensureConfigured();
  }

  async getMarketSession(_userId: string): Promise<MarketSessionInfo> {
    return ensureConfigured();
  }
}

export const liveIbkrWebApiAdapter = new LiveIBKRWebApiAdapter();
