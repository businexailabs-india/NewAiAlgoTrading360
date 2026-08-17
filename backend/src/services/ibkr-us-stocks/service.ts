/**
 * UsStocksTradingService — wraps adapter selection, session binding, audit,
 * and trading gates. Paper/Live always from connection profile metadata.
 */

import { AppError } from '../../middleware/error.middleware';
import { appendAudit } from './audit';
import { LiveIBKRWebApiAdapter } from './live-adapter.stub';
import { MockIBKRTradingAdapter, mockIbkrTradingAdapter } from './mock-adapter';
import { RateLimitError, ibkrRateLimiter } from './rate-limiter';
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

export type IbkrUsStocksMode = 'mock' | 'live';

/** Required confirmation phrase for LIVE submits (service-level gate). */
export const LIVE_CONFIRM_PHRASE = 'LIVE';

export class UsStocksTradingService {
  private adapter: IBKRTradingAdapter;
  private mode: IbkrUsStocksMode;
  private mock: MockIBKRTradingAdapter | null;

  constructor(adapter?: IBKRTradingAdapter, mode?: IbkrUsStocksMode) {
    this.mode = mode || (process.env.IBKR_US_STOCKS_MODE === 'live' ? 'live' : 'mock');
    if (adapter) {
      this.adapter = adapter;
      this.mock = adapter instanceof MockIBKRTradingAdapter ? adapter : null;
    } else if (this.mode === 'live') {
      this.adapter = new LiveIBKRWebApiAdapter();
      this.mock = null;
    } else {
      this.adapter = mockIbkrTradingAdapter;
      this.mock = mockIbkrTradingAdapter;
    }
  }

  getMode(): IbkrUsStocksMode {
    return this.mode;
  }

  getMockAdapter(): MockIBKRTradingAdapter | null {
    return this.mock;
  }

  private mapError(err: unknown): never {
    if (err instanceof RateLimitError) {
      throw new AppError(err.message, 429, {
        reason: 'RATE_LIMIT',
        details: { retryAfterMs: err.retryAfterMs }
      });
    }
    if (err instanceof AppError) throw err;
    const e = err as { message?: string; statusCode?: number; reason?: string; details?: Record<string, unknown>; correctiveAction?: string };
    throw new AppError(e.message || 'IBKR US stocks error', e.statusCode || 500, {
      reason: e.reason,
      correctiveAction: e.correctiveAction,
      details: e.details
    });
  }

  private async paced<T>(userId: string, key: string, fn: () => Promise<T>): Promise<T> {
    const release = await ibkrRateLimiter.acquire(userId, key).catch((err) => this.mapError(err));
    try {
      return await fn();
    } catch (err) {
      this.mapError(err);
    } finally {
      release();
    }
  }

  private async assertTradingGate(userId: string, action: string): Promise<SessionStatus> {
    const status = await this.adapter.getSessionStatus(userId);
    if (status.state === 'COMPETING_SESSION') {
      throw new AppError('Trading blocked: competing brokerage session', 409, {
        reason: 'COMPETING_SESSION',
        correctiveAction: 'Resolve competing session then re-establish brokerage session'
      });
    }
    if (status.state === 'READ_ONLY') {
      throw new AppError('Trading blocked: session is read-only', 403, {
        reason: 'READ_ONLY'
      });
    }
    if (status.state !== 'TRADING_READY') {
      throw new AppError(`Trading blocked: session state is ${status.state}`, 403, {
        reason: status.state,
        correctiveAction: 'Call POST /session/establish when ready'
      });
    }
    appendAudit({
      userId,
      action: `GATE_OK_${action}`,
      environment: status.environment,
      details: { state: status.state }
    });
    return status;
  }

  async getSessionStatus(userId: string): Promise<SessionStatus> {
    return this.paced(userId, 'session-status', async () => {
      const status = await this.adapter.getSessionStatus(userId);
      return { ...status, mode: this.mode };
    });
  }

  async establishBrokerageSession(userId: string): Promise<SessionStatus> {
    return this.paced(userId, 'session-establish', async () => {
      const status = await this.adapter.establishBrokerageSession(userId);
      appendAudit({
        userId,
        action: 'SERVICE_ESTABLISH_SESSION',
        environment: status.environment,
        details: { state: status.state }
      });
      return { ...status, mode: this.mode };
    });
  }

  async getConnectionProfiles(userId: string): Promise<IBKRConnectionProfile[]> {
    return this.paced(userId, 'profiles', () => this.adapter.getConnectionProfiles(userId));
  }

  async selectConnectionProfile(userId: string, profileId: string): Promise<SessionStatus> {
    if (!profileId) throw new AppError('profileId required', 400);
    return this.paced(userId, `profile-select-${profileId}`, async () => {
      const status = await this.adapter.selectConnectionProfile(userId, profileId);
      // Environment comes from profile — ignore any client isPaper
      return { ...status, mode: this.mode };
    });
  }

  async getAccounts(userId: string): Promise<BrokerAccount[]> {
    return this.paced(userId, 'accounts', () => this.adapter.getAccounts(userId));
  }

  async getAccountSummary(userId: string, accountId: string): Promise<AccountSummary> {
    return this.paced(userId, `summary-${accountId}`, () =>
      this.adapter.getAccountSummary(userId, accountId)
    );
  }

  async searchInstruments(userId: string, query: string): Promise<USStockInstrument[]> {
    return this.paced(userId, `search-${query}`, () =>
      this.adapter.searchInstruments(userId, query)
    );
  }

  async getContractDetails(userId: string, conId: number): Promise<USStockInstrument> {
    return this.paced(userId, `contract-${conId}`, () =>
      this.adapter.getContractDetails(userId, conId)
    );
  }

  async getOrderCapabilities(userId: string, conId: number): Promise<OrderCapability> {
    return this.paced(userId, `caps-${conId}`, () =>
      this.adapter.getOrderCapabilities(userId, conId)
    );
  }

  async getQuote(userId: string, conId: number): Promise<MarketQuote> {
    return this.paced(userId, `quote-${conId}`, () => this.adapter.getQuote(userId, conId));
  }

  async getPositions(userId: string, accountId: string): Promise<Position[]> {
    return this.paced(userId, `pos-${accountId}`, () =>
      this.adapter.getPositions(userId, accountId)
    );
  }

  async getOpenOrders(userId: string, accountId: string): Promise<Order[]> {
    return this.paced(userId, `orders-${accountId}`, () =>
      this.adapter.getOpenOrders(userId, accountId)
    );
  }

  async getExecutions(userId: string, accountId: string): Promise<Execution[]> {
    return this.paced(userId, `exec-${accountId}`, () =>
      this.adapter.getExecutions(userId, accountId)
    );
  }

  async getRecentTrades(userId: string, accountId: string): Promise<Execution[]> {
    return this.paced(userId, `trades-${accountId}`, () =>
      this.adapter.getRecentTrades(userId, accountId)
    );
  }

  /** Platform-side preview — never submits. */
  async previewOrder(userId: string, intent: ManualOrderIntent): Promise<OrderPreview> {
    this.assertIntentShape(intent);
    return this.paced(userId, `preview-${intent.conId}`, async () => {
      const preview = await this.adapter.previewOrder(userId, intent);
      appendAudit({
        userId,
        action: 'SERVICE_PREVIEW_ORDER',
        environment: preview.intent.environment,
        accountId: intent.accountId,
        details: { previewId: preview.previewId, allowed: preview.allowed }
      });
      return preview;
    });
  }

  /**
   * Submit order. For LIVE environment (from profile), requires liveConfirmPhrase === 'LIVE'.
   * Never trusts client isPaper to flip environment.
   */
  async submitOrder(
    userId: string,
    intent: ManualOrderIntent,
    opts?: { liveConfirmPhrase?: string }
  ): Promise<Order> {
    this.assertIntentShape(intent);
    // Reject client-only environment flips
    if ((intent as { isPaper?: boolean }).isPaper != null) {
      throw new AppError(
        'Client isPaper flag is not accepted. Select a PAPER or LIVE connection profile.',
        400,
        { reason: 'CLIENT_ISPAPER_REJECTED' }
      );
    }

    return this.paced(userId, `submit-${intent.accountId}-${intent.conId}`, async () => {
      const status = await this.assertTradingGate(userId, 'SUBMIT');

      if (status.environment === 'LIVE') {
        if (opts?.liveConfirmPhrase !== LIVE_CONFIRM_PHRASE) {
          throw new AppError(
            `Live submit requires liveConfirmPhrase "${LIVE_CONFIRM_PHRASE}" (environment from connection profile)`,
            400,
            {
              reason: 'LIVE_PHRASE_REQUIRED',
              correctiveAction: `Include body.liveConfirmPhrase: "${LIVE_CONFIRM_PHRASE}"`
            }
          );
        }
      }

      const order = await this.adapter.submitOrder(userId, intent);
      appendAudit({
        userId,
        action: 'SERVICE_SUBMIT_ORDER',
        environment: order.environment,
        accountId: order.accountId,
        orderId: order.orderId,
        details: { status: order.status }
      });
      return order;
    });
  }

  async confirmBrokerReply(userId: string, messageId: string): Promise<Order> {
    if (!messageId) throw new AppError('messageId required', 400);
    return this.paced(userId, `reply-confirm-${messageId}`, async () => {
      await this.assertTradingGate(userId, 'CONFIRM_REPLY');
      const order = await this.adapter.confirmBrokerReply(userId, messageId);
      appendAudit({
        userId,
        action: 'SERVICE_CONFIRM_BROKER_REPLY',
        environment: order.environment,
        orderId: order.orderId,
        details: { messageId, status: order.status }
      });
      return order;
    });
  }

  async rejectBrokerReply(userId: string, messageId: string): Promise<Order> {
    if (!messageId) throw new AppError('messageId required', 400);
    return this.paced(userId, `reply-reject-${messageId}`, async () => {
      const order = await this.adapter.rejectBrokerReply(userId, messageId);
      appendAudit({
        userId,
        action: 'SERVICE_REJECT_BROKER_REPLY',
        environment: order.environment,
        orderId: order.orderId,
        details: { messageId }
      });
      return order;
    });
  }

  async modifyOrder(userId: string, orderId: string, patch: ModifyOrderRequest): Promise<Order> {
    return this.paced(userId, `modify-${orderId}`, async () => {
      await this.assertTradingGate(userId, 'MODIFY');
      return this.adapter.modifyOrder(userId, orderId, patch);
    });
  }

  async cancelOrder(userId: string, orderId: string): Promise<Order> {
    return this.paced(userId, `cancel-${orderId}`, async () => {
      await this.assertTradingGate(userId, 'CANCEL');
      const order = await this.adapter.cancelOrder(userId, orderId);
      appendAudit({
        userId,
        action: 'SERVICE_CANCEL_ORDER',
        environment: order.environment,
        orderId,
        details: { status: order.status }
      });
      return order;
    });
  }

  async getOrderStatus(userId: string, orderId: string): Promise<Order> {
    return this.paced(userId, `status-${orderId}`, () =>
      this.adapter.getOrderStatus(userId, orderId)
    );
  }

  async getOrderEvents(userId: string, orderId: string): Promise<OrderEvent[]> {
    return this.paced(userId, `events-${orderId}`, () =>
      this.adapter.getOrderEvents(userId, orderId)
    );
  }

  async getAuditEvents(userId: string): Promise<AuditEvent[]> {
    return this.adapter.getAuditEvents(userId);
  }

  async getMarketSession(userId: string): Promise<MarketSessionInfo> {
    return this.paced(userId, 'market-session', () => this.adapter.getMarketSession(userId));
  }

  private assertIntentShape(intent: ManualOrderIntent): void {
    if (!intent?.accountId) throw new AppError('accountId required', 400);
    if (intent.conId == null) throw new AppError('conId required', 400);
    if (!intent.side || !['BUY', 'SELL'].includes(intent.side)) {
      throw new AppError('side must be BUY or SELL', 400);
    }
    if (!intent.orderType) throw new AppError('orderType required', 400);
    if (intent.quantity == null) throw new AppError('quantity required', 400);
  }
}

let singleton: UsStocksTradingService | null = null;

export function getUsStocksTradingService(): UsStocksTradingService {
  if (!singleton) singleton = new UsStocksTradingService();
  return singleton;
}

/** Test helper — reset singleton */
export function resetUsStocksTradingService(service?: UsStocksTradingService): void {
  singleton = service ?? null;
}
