/**
 * IBKR US Stocks unit tests (ts-node — backend has no vitest).
 * Run: npm run test:ibkr-us-stocks
 * Mirrors __tests__/mock-adapter.test.ts assertions.
 */
import { clearAudit } from '../src/services/ibkr-us-stocks/audit';
import { MockIBKRTradingAdapter } from '../src/services/ibkr-us-stocks/mock-adapter';
import {
  UsStocksTradingService,
  LIVE_CONFIRM_PHRASE
} from '../src/services/ibkr-us-stocks/service';
import { AppError } from '../src/middleware/error.middleware';

const USER = 'test-user-ibkr-us';
const PAPER_ACCOUNT = 'DU1234567';
const AAPL = 265598;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function expectReject(
  fn: () => Promise<unknown>,
  match?: { statusCode?: number; reason?: string; instanceOf?: typeof AppError }
): Promise<void> {
  try {
    await fn();
    throw new Error('expected rejection');
  } catch (err: any) {
    if (err?.message === 'expected rejection') throw err;
    if (match?.instanceOf && !(err instanceof match.instanceOf)) {
      throw new Error(`expected AppError, got ${err?.constructor?.name}`);
    }
    if (match?.statusCode != null) {
      assert(err.statusCode === match.statusCode, `statusCode ${err.statusCode} != ${match.statusCode}`);
    }
    if (match?.reason != null) {
      assert(err.reason === match.reason, `reason ${err.reason} != ${match.reason}`);
    }
  }
}

async function main() {
  const mock = new MockIBKRTradingAdapter();
  const service = new UsStocksTradingService(mock, 'mock');
  clearAudit(USER);

  // paper/live profile separation
  {
    const profiles = await service.getConnectionProfiles(USER);
    const paper = profiles.find((p) => p.environment === 'PAPER')!;
    const live = profiles.find((p) => p.environment === 'LIVE')!;
    assert(!!paper && !!live, 'paper and live profiles');
    assert(paper.id !== live.id, 'distinct profile ids');
    assert(paper.accountIds[0] !== live.accountIds[0], 'distinct accounts');
    await service.selectConnectionProfile(USER, paper.id);
    let session = await service.getSessionStatus(USER);
    assert(session.environment === 'PAPER', 'paper env');
    await service.selectConnectionProfile(USER, live.id);
    session = await service.getSessionStatus(USER);
    assert(session.environment === 'LIVE', 'live env');
    await service.selectConnectionProfile(USER, paper.id);
    console.log('OK paper/live profile separation');
  }

  // competing session blocks submit
  {
    mock.setScenario(USER, 'competing_session', true);
    await expectReject(
      () =>
        service.submitOrder(USER, {
          accountId: PAPER_ACCOUNT,
          conId: AAPL,
          side: 'BUY',
          orderType: 'MKT',
          quantity: 1
        }),
      { statusCode: 409, reason: 'COMPETING_SESSION' }
    );
    mock.clearScenarios(USER);
    await service.establishBrokerageSession(USER);
    console.log('OK competing session blocks submit');
  }

  // preview does not submit
  {
    const preview = await service.previewOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'LMT',
      quantity: 10,
      limitPrice: 190
    });
    assert(preview.allowed === true, 'preview allowed');
    const open = await service.getOpenOrders(USER, PAPER_ACCOUNT);
    assert(open.length === 0, 'preview must not create open orders');
    console.log('OK preview does not submit');
  }

  // live submit without LIVE phrase blocked
  {
    const profiles = await service.getConnectionProfiles(USER);
    const live = profiles.find((p) => p.environment === 'LIVE')!;
    await service.selectConnectionProfile(USER, live.id);
    const accounts = await service.getAccounts(USER);
    await expectReject(
      () =>
        service.submitOrder(USER, {
          accountId: accounts[0].accountId,
          conId: AAPL,
          side: 'BUY',
          orderType: 'MKT',
          quantity: 1
        }),
      { instanceOf: AppError, reason: 'LIVE_PHRASE_REQUIRED' }
    );
    await service.selectConnectionProfile(USER, profiles.find((p) => p.environment === 'PAPER')!.id);
    console.log('OK live phrase gate');
  }

  // broker reply required before submitted
  {
    mock.setScenario(USER, 'broker_reply_required', true);
    const order = await service.submitOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    assert(order.status === 'BROKER_CONFIRMATION_REQUIRED', 'needs reply');
    assert(!!order.pendingReply?.messageId, 'messageId');
    const confirmed = await service.confirmBrokerReply(USER, order.pendingReply!.messageId);
    assert(confirmed.status === 'ACKNOWLEDGED', 'ack after confirm');
    assert(confirmed.status !== 'FILLED', 'never filled on confirm');
    console.log('OK broker reply flow');
  }

  // cancel stays CANCEL_PENDING until confirmed
  {
    const order = await service.submitOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    const pending = await service.cancelOrder(USER, order.orderId);
    assert(pending.status === 'CANCEL_PENDING', 'cancel pending');
    const status = await service.getOrderStatus(USER, order.orderId);
    assert(status.status === 'CANCEL_PENDING', 'still pending on status poll');
    const done = mock.confirmCancel(USER, order.orderId);
    assert(done.status === 'CANCELLED', 'cancelled after broker confirm');
    console.log('OK cancel pending until confirmed');
  }

  // audit events
  {
    clearAudit(USER);
    mock.resetUser(USER);
    const service2 = new UsStocksTradingService(mock, 'mock');
    await service2.previewOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    await service2.submitOrder(USER, {
      accountId: PAPER_ACCOUNT,
      conId: AAPL,
      side: 'BUY',
      orderType: 'MKT',
      quantity: 1
    });
    const audit = await service2.getAuditEvents(USER);
    assert(audit.length > 0, 'audit nonempty');
    assert(
      audit.some((a) => a.action.includes('PREVIEW')),
      'preview audited'
    );
    assert(
      audit.some((a) => a.action.includes('SUBMIT')),
      'submit audited'
    );
    console.log('OK audit events');
  }

  // live first order + phrase
  {
    mock.resetUser(USER);
    const service3 = new UsStocksTradingService(mock, 'mock');
    const profiles = await service3.getConnectionProfiles(USER);
    const live = profiles.find((p) => p.environment === 'LIVE')!;
    await service3.selectConnectionProfile(USER, live.id);
    const accounts = await service3.getAccounts(USER);
    const order = await service3.submitOrder(
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
    assert(order.status === 'BROKER_CONFIRMATION_REQUIRED', 'live first needs reply');
    const after = await service3.confirmBrokerReply(USER, order.pendingReply!.messageId);
    assert(after.status === 'ACKNOWLEDGED', 'ack');
    assert(after.status !== 'FILLED', 'not filled');
    console.log('OK live first order reply');
  }

  console.log('\nAll IBKR US Stocks unit tests passed.');
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
