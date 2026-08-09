import { randomUUID } from 'crypto';
import {
  AccountSummary,
  BrokerAccount,
  BrokerAdapter,
  BrokerError,
  BrokerOrder,
  Contract,
  Execution,
  MarketSnapshot,
  OrderResult,
  PaperOrderRequest,
  Position,
  QualifiedContract,
  ReconciliationResult,
  assertPaperAccountId,
} from './BrokerAdapter';

/** In-memory paper broker for tests and local development. Never touches a live venue. */
export class SimulatedBrokerAdapter implements BrokerAdapter {
  private connected = false;
  private accounts: BrokerAccount[];
  private selected?: string;
  private orders = new Map<string, BrokerOrder>();
  private positions = new Map<string, Position[]>();
  private executions: Execution[] = [];
  private idempotency = new Map<string, OrderResult>();
  private lastMarketAt = Date.now();
  private delayed = false;
  private netLiq: number;
  submitCalls = 0;

  constructor(opts?: {
    accounts?: BrokerAccount[];
    netLiq?: number;
    delayed?: boolean;
    dataAgeMs?: number;
  }) {
    this.accounts = opts?.accounts || [
      { accountId: 'SIM-PAPER-001', isPaper: true, currency: 'USD', displayName: 'Sim Paper' },
      { accountId: 'SIM-PAPER-002', isPaper: true, currency: 'USD', displayName: 'Sim Paper 2' },
    ];
    this.netLiq = opts?.netLiq ?? 2400;
    this.delayed = opts?.delayed ?? false;
    if (opts?.dataAgeMs != null) this.lastMarketAt = Date.now() - opts.dataAgeMs;
  }

  setDelayed(v: boolean) {
    this.delayed = v;
  }

  setDataAgeMs(ms: number) {
    this.lastMarketAt = Date.now() - ms;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getAccounts(): Promise<BrokerAccount[]> {
    return [...this.accounts];
  }

  async getAccountSummary(accountId: string): Promise<AccountSummary> {
    assertPaperAccountId(accountId);
    if (!this.accounts.find((a) => a.accountId === accountId)) {
      throw new BrokerError('Account not in managed list — never auto-select first');
    }
    this.selected = accountId;
    return {
      accountId,
      netLiquidation: this.netLiq,
      cashBalance: this.netLiq,
      buyingPower: this.netLiq * 0.9,
      realizedPnl: 0,
      unrealizedPnl: 0,
      currency: 'USD',
      isPaper: true,
    };
  }

  async getPositions(accountId: string): Promise<Position[]> {
    return [...(this.positions.get(accountId) || [])];
  }

  async getOpenOrders(accountId: string): Promise<BrokerOrder[]> {
    return [...this.orders.values()].filter(
      (o) => o.status !== 'Filled' && o.status !== 'Cancelled' && o.status !== 'Rejected'
    );
  }

  async getExecutions(_accountId: string, since: Date): Promise<Execution[]> {
    return this.executions.filter((e) => e.executedAt >= since);
  }

  async getMarketData(contract: Contract): Promise<MarketSnapshot> {
    const ageSeconds = (Date.now() - this.lastMarketAt) / 1000;
    return {
      symbol: contract.symbol,
      last: 500,
      bid: 499.9,
      ask: 500.1,
      volume: 1_000_000,
      ageSeconds,
      isDelayed: this.delayed,
      isStale: ageSeconds > 30,
      observedAt: new Date(this.lastMarketAt),
    };
  }

  async qualifyContract(contract: Contract): Promise<QualifiedContract> {
    return {
      ...contract,
      conId: 'SIM-' + contract.symbol,
      minTick: 0.01,
      lotSize: 1,
      multiplier: 1,
      timeZoneId: 'America/New_York',
      exchange: contract.exchange || 'SMART',
      currency: contract.currency || 'USD',
      securityType: contract.securityType || 'STK',
    };
  }

  async submitPaperOrder(request: PaperOrderRequest): Promise<OrderResult> {
    if (!this.connected) throw new BrokerError('Not connected');
    assertPaperAccountId(request.accountId);
    if (this.idempotency.has(request.idempotencyKey)) {
      return this.idempotency.get(request.idempotencyKey)!;
    }
    this.submitCalls += 1;
    const parent = randomUUID();
    const stop = randomUUID();
    const target = randomUUID();
    const result: OrderResult = {
      parentOrderId: parent,
      stopOrderId: stop,
      targetOrderId: target,
      status: 'Submitted',
    };
    this.idempotency.set(request.idempotencyKey, result);
    this.orders.set(parent, {
      orderId: parent,
      symbol: request.symbol,
      side: request.side,
      orderType: 'LMT',
      quantity: request.quantity,
      filledQty: request.quantity,
      limitPrice: request.entryLimit,
      status: 'Filled',
      strategyId: request.strategyId,
      role: 'entry',
    });
    this.orders.set(stop, {
      orderId: stop,
      symbol: request.symbol,
      side: 'SELL',
      orderType: 'STP',
      quantity: request.quantity,
      filledQty: 0,
      stopPrice: request.stopPrice,
      status: 'Submitted',
      strategyId: request.strategyId,
      parentId: parent,
      role: 'stop',
    });
    this.orders.set(target, {
      orderId: target,
      symbol: request.symbol,
      side: 'SELL',
      orderType: 'LMT',
      quantity: request.quantity,
      filledQty: 0,
      limitPrice: request.targetPrice,
      status: 'Submitted',
      strategyId: request.strategyId,
      parentId: parent,
      role: 'target',
    });
    const exec: Execution = {
      execId: randomUUID(),
      orderId: parent,
      symbol: request.symbol,
      qty: request.quantity,
      price: request.entryLimit,
      commission: request.quantity * 0.005,
      executedAt: new Date(),
    };
    this.executions.push(exec);
    const pos = this.positions.get(request.accountId) || [];
    pos.push({
      symbol: request.symbol,
      quantity: request.quantity,
      avgPrice: request.entryLimit,
      currentPrice: request.entryLimit,
      unrealizedPnl: 0,
      realizedPnl: 0,
    });
    this.positions.set(request.accountId, pos);
    return result;
  }

  async cancelPaperOrder(orderId: string): Promise<void> {
    const o = this.orders.get(orderId);
    if (o && o.status !== 'Filled') o.status = 'Cancelled';
  }

  async reconcile(accountId: string): Promise<ReconciliationResult> {
    assertPaperAccountId(accountId);
    const open = await this.getOpenOrders(accountId);
    const pos = await this.getPositions(accountId);
    return {
      ok: true,
      openOrders: open.length,
      positions: pos.length,
      executions: this.executions.length,
      detail: 'simulated reconcile ok',
    };
  }
}
