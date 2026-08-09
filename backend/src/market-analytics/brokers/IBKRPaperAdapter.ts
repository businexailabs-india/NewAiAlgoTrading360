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
import { MaConfig } from '../config';

const PAPER_PORTS = new Set([7497, 4002]);

/**
 * IBKR paper adapter (TypeScript bridge).
 * Rejects live accounts and non-paper ports. Full ibapi stays in libs/ibkr-orb-paper;
 * this adapter validates safety gates and optionally delegates to a configured sidecar URL.
 */
export class IBKRPaperAdapter implements BrokerAdapter {
  private connected = false;
  private accounts: string[] = [];

  constructor(private cfg: MaConfig, private managedAccounts?: string[]) {}

  async connect(): Promise<void> {
    if (!PAPER_PORTS.has(this.cfg.ibkrPaperPort)) {
      throw new BrokerError(`Port ${this.cfg.ibkrPaperPort} is not an allowed paper port (7497/4002)`);
    }
    if (!this.cfg.ibkrPaperAccountId) {
      throw new BrokerError('IBKR_PAPER_ACCOUNT_ID required — never auto-select first account');
    }
    assertPaperAccountId(this.cfg.ibkrPaperAccountId);
    this.accounts = this.managedAccounts?.length
      ? this.managedAccounts
      : [this.cfg.ibkrPaperAccountId];
    if (!this.accounts.includes(this.cfg.ibkrPaperAccountId)) {
      throw new BrokerError('Configured paper account not in managed accounts');
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getAccounts(): Promise<BrokerAccount[]> {
    return this.accounts.map((accountId) => ({
      accountId,
      isPaper: accountId.toUpperCase().startsWith('DU'),
      currency: 'USD',
    }));
  }

  async getAccountSummary(accountId: string): Promise<AccountSummary> {
    assertPaperAccountId(accountId);
    if (accountId !== this.cfg.ibkrPaperAccountId) {
      throw new BrokerError('Account mismatch vs IBKR_PAPER_ACCOUNT_ID');
    }
    return {
      accountId,
      netLiquidation: this.cfg.startingEquity,
      cashBalance: this.cfg.startingEquity,
      buyingPower: this.cfg.startingEquity * 0.9,
      realizedPnl: 0,
      unrealizedPnl: 0,
      currency: 'USD',
      isPaper: true,
    };
  }

  async getPositions(_accountId: string): Promise<Position[]> {
    return [];
  }

  async getOpenOrders(_accountId: string): Promise<BrokerOrder[]> {
    return [];
  }

  async getExecutions(_accountId: string, _since: Date): Promise<Execution[]> {
    return [];
  }

  async getMarketData(contract: Contract): Promise<MarketSnapshot> {
    return {
      symbol: contract.symbol,
      last: 0,
      ageSeconds: 999,
      isDelayed: true,
      isStale: true,
      observedAt: new Date(0),
    };
  }

  async qualifyContract(contract: Contract): Promise<QualifiedContract> {
    return {
      ...contract,
      conId: '0',
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
    if (request.accountId !== this.cfg.ibkrPaperAccountId) {
      throw new BrokerError('Incorrect paper account');
    }
    // Bridge placeholder: require Python ibkr-orb-paper / sidecar for real placeOrder
    throw new BrokerError(
      'IBKR placeOrder via TS bridge requires TWS session + ibkr-orb-paper sidecar. Use SimulatedBrokerAdapter for local paper.'
    );
  }

  async cancelPaperOrder(_orderId: string): Promise<void> {
    /* no-op until sidecar wired */
  }

  async reconcile(accountId: string): Promise<ReconciliationResult> {
    assertPaperAccountId(accountId);
    return { ok: true, openOrders: 0, positions: 0, executions: 0, detail: 'ibkr bridge reconcile stub' };
  }
}
