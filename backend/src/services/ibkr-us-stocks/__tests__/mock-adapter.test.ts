/**
 * Mock IBKR US Stocks adapter + service tests (vitest style).
 * Backend has no vitest — run via: npm run test:ibkr-us-stocks (from backend/)
 * which executes scripts/unit-ibkr-us-stocks.ts (same assertions).
 *
 * If vitest is added to backend later: npx vitest run src/services/ibkr-us-stocks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { clearAudit } from '../audit';
import { MockIBKRTradingAdapter } from '../mock-adapter';
import { UsStocksTradingService, LIVE_CONFIRM_PHRASE } from '../service';
import { AppError } from '../../../middleware/error.middleware';

const USER = 'test-user-ibkr-us';
const PAPER_ACCOUNT = 'DU1234567';
const AAPL = 265598;

describe('MockIBKRTradingAdapter + UsStocksTradingService', () => {
  let mock: MockIBKRTradingAdapter;
  let service: UsStocksTradingService;

  beforeEach(() => {
    mock = new MockIBKRTradingAdapter();
    service = new UsStocksTradingService(mock, 'mock');
    clearAudit(USER);
  });

  it('separates paper and live connection profiles', async () => {
    const profiles = await service.getConnectionProfiles(USER);
    const paper = profiles.find((p) => p.environment === 'PAPER');
    const live = profiles.find((p) => p.environment === 'LIVE');
    expect(paper).toBeTruthy();
    expect(live).toBeTruthy();
    expect(paper!.id).not.toBe(live!.id);
    expect(paper!.accountIds[0]).not.toBe(live!.accountIds[0]);

    await service.selectConnectionProfile(USER, paper!.id);
    let session = await service.getSessionStatus(USER);
    expect(session.environment).toBe('PAPER');
    expect(session.state).toBe('TRADING_READY');

    await service.selectConnectionProfile(USER, live!.id);
    session = await service.getSessionStatus(USER);
    expect(session.environment).toBe('LIVE');
    expect(session.selectedProfileId).toBe(live!.id);
  });

  it('blocks submit when competing session', async () => {
    mock.setScenario(USER, 'competing_session', true);
    const session = await service.getSessionStatus(USER);
    expect(session.state).toBe('COMPETING_SESSION');

    await expect(
      service.submitOrder(USER, {
        accountId: PAPER_ACCOUNT,
        conId: AAPL,
        side: 'BUY',
        orderType: 'MKT',
        quantity: 1
      })
    ).rejects.toMatchObject({ statusCode: 409, reason: 'COMPETING_SESSION' });
  });

  it('preview does not submit', async () => {
    const preview = await service.previewOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'LMT',
      quantity: 10,
      limitPrice: 190
    });
    expect(preview.allowed).toBe(true);
    expect(preview.previewId).toBeTruthy();

    const open = await service.getOpenOrders(USER, PAPER_ACCOUNT);
    expect(open.length).toBe(0);
  });

  it('blocks live submit without LIVE phrase at service', async () => {
    const profiles = await service.getConnectionProfiles(USER);
    const live = profiles.find((p) => p.environment === 'LIVE')!;
    await service.selectConnectionProfile(USER, live.id);
    const accounts = await service.getAccounts(USER);

    await expect(
      service.submitOrder(USER, {
        accountId: accounts[0].accountId,
        conId: AAPL,
        side: 'BUY',
        orderType: 'MKT',
        quantity: 1
      })
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      service.submitOrder(
        USER,
        {
          accountId: accounts[0].accountId,
          conId: AAPL,
          side: 'BUY',
          orderType: 'MKT',
          quantity: 1
        },
        { liveConfirmPhrase: 'wrong' }
      )
    ).rejects.toMatchObject({ reason: 'LIVE_PHRASE_REQUIRED' });
  });

  it('requires broker reply before submitted', async () => {
    mock.setScenario(USER, 'broker_reply_required', true);
    const order = await service.submitOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    expect(order.status).toBe('BROKER_CONFIRMATION_REQUIRED');
    expect(order.pendingReply?.messageId).toBeTruthy();
    expect(order.status).not.toBe('FILLED');

    const confirmed = await service.confirmBrokerReply(USER, order.pendingReply!.messageId);
    expect(['SUBMITTED', 'ACKNOWLEDGED']).toContain(confirmed.status);
    expect(confirmed.status).not.toBe('FILLED');
    expect(confirmed.status).not.toBe('BROKER_CONFIRMATION_REQUIRED');
  });

  it('cancel stays CANCEL_PENDING until confirmed', async () => {
    const order = await service.submitOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    expect(order.status).toBe('ACKNOWLEDGED');

    const cancelled = await service.cancelOrder(USER, order.orderId);
    expect(cancelled.status).toBe('CANCEL_PENDING');

    const status = await service.getOrderStatus(USER, order.orderId);
    expect(status.status).toBe('CANCEL_PENDING');

    const confirmed = mock.confirmCancel(USER, order.orderId);
    expect(confirmed.status).toBe('CANCELLED');
  });

  it('creates audit events for material actions', async () => {
    await service.previewOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    await service.submitOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    const audit = await service.getAuditEvents(USER);
    expect(audit.length).toBeGreaterThan(0);
    const actions = audit.map((a) => a.action);
    expect(actions.some((a) => a.includes('PREVIEW'))).toBe(true);
    expect(actions.some((a) => a.includes('SUBMIT'))).toBe(true);
  });

  it('live first order requires broker reply then phrase allows submit', async () => {
    const profiles = await service.getConnectionProfiles(USER);
    const live = profiles.find((p) => p.environment === 'LIVE')!;
    await service.selectConnectionProfile(USER, live.id);
    const accounts = await service.getAccounts(USER);

    const order = await service.submitOrder(
      USER,
      {
        accountId: accounts[0].accountId,
        conId: AAPL,
        side: 'BUY',
        orderType: 'MKT',
        quantity: 1
      },
      { liveConfirmPhrase: LIVE_CONFIRM_PHRASE }
    );
    expect(order.status).toBe('BROKER_CONFIRMATION_REQUIRED');
    const after = await service.confirmBrokerReply(USER, order.pendingReply!.messageId);
    expect(after.status).toBe('ACKNOWLEDGED');
    expect(after.status).not.toBe('FILLED');
  });
});
