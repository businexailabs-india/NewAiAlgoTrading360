export interface Contract {
  symbol: string;
  exchange?: string;
  currency?: string;
  securityType?: string;
  primaryExchange?: string;
}

export interface QualifiedContract extends Contract {
  conId: string;
  minTick: number;
  lotSize: number;
  multiplier: number;
  timeZoneId: string;
}

export interface BrokerAccount {
  accountId: string;
  isPaper: boolean;
  currency: string;
  displayName?: string;
}

export interface AccountSummary {
  accountId: string;
  netLiquidation: number;
  cashBalance: number;
  buyingPower: number;
  realizedPnl: number;
  unrealizedPnl: number;
  currency: string;
  isPaper: boolean;
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  realizedPnl?: number;
}

export interface BrokerOrder {
  orderId: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  filledQty: number;
  limitPrice?: number;
  stopPrice?: number;
  status: string;
  strategyId?: string;
  parentId?: string;
  role?: string;
}

export interface Execution {
  execId: string;
  orderId: string;
  symbol: string;
  qty: number;
  price: number;
  commission: number;
  executedAt: Date;
}

export interface MarketSnapshot {
  symbol: string;
  last: number;
  bid?: number;
  ask?: number;
  volume?: number;
  ageSeconds: number;
  isDelayed: boolean;
  isStale: boolean;
  observedAt: Date;
}

export interface PaperOrderRequest {
  accountId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryLimit: number;
  stopPrice: number;
  targetPrice: number;
  strategyId: string;
  signalId: string;
  appOrderId: string;
  idempotencyKey: string;
}

export interface OrderResult {
  parentOrderId: string;
  stopOrderId: string;
  targetOrderId: string;
  status: string;
}

export interface ReconciliationResult {
  ok: boolean;
  openOrders: number;
  positions: number;
  executions: number;
  detail: string;
}

export interface BrokerAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getAccounts(): Promise<BrokerAccount[]>;
  getAccountSummary(accountId: string): Promise<AccountSummary>;
  getPositions(accountId: string): Promise<Position[]>;
  getOpenOrders(accountId: string): Promise<BrokerOrder[]>;
  getExecutions(accountId: string, since: Date): Promise<Execution[]>;
  getMarketData(contract: Contract): Promise<MarketSnapshot>;
  qualifyContract(contract: Contract): Promise<QualifiedContract>;
  submitPaperOrder(request: PaperOrderRequest): Promise<OrderResult>;
  cancelPaperOrder(orderId: string): Promise<void>;
  reconcile(accountId: string): Promise<ReconciliationResult>;
}

export class BrokerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrokerError';
  }
}

export function assertPaperAccountId(accountId: string): void {
  const id = (accountId || '').trim().toUpperCase();
  if (!id) throw new BrokerError('Empty account ID');
  if (id.startsWith('U') && !id.startsWith('DU')) {
    throw new BrokerError('Live account rejected — Market Analytics is paper-only');
  }
  // SIM-* accounts are simulated paper; DU* are IBKR paper
  if (!(id.startsWith('DU') || id.startsWith('SIM-'))) {
    throw new BrokerError('Non-paper account rejected');
  }
}
