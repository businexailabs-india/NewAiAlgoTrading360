import { randomUUID } from 'crypto';
import { MaDataSource, MaRole } from './config';
import { RiskGateResult } from './risk/gates';

export interface StoredEndpoint {
  id: string;
  tenantId: string;
  userId: string;
  endpointToken: string;
  secretPlain: string; // memory-only; never returned after create in API
  secretHash: string;
  strategyId: string;
  lastReceivedAt?: string;
  lastAcceptedAt?: string;
  lastRejectedAt?: string;
  errorCount: number;
  duplicateCount: number;
  expiredCount: number;
}

export interface StoredSignal {
  id: string;
  tenantId: string;
  signalId: string;
  symbol: string;
  side: string;
  referencePrice: number;
  entryPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  quantity: number;
  expectedRisk: number;
  status: string;
  rejectReason?: string;
  indicators?: Record<string, unknown>;
  gates?: RiskGateResult[];
  barTime?: string;
  dataAgeSeconds?: number;
  brokerAccountId?: string;
  orderId?: string;
  source: MaDataSource;
  createdAt: string;
  rawRedacted?: Record<string, unknown>;
}

export interface StoredOrder {
  id: string;
  appOrderId: string;
  idempotencyKey: string;
  brokerOrderId?: string;
  tenantId: string;
  brokerAccountId: string;
  symbol: string;
  side: string;
  orderType: string;
  quantity: number;
  filledQty: number;
  limitPrice?: number;
  stopPrice?: number;
  targetPrice?: number;
  status: string;
  strategyId: string;
  signalId: string;
  role: string;
  source: MaDataSource;
  submittedAt: string;
}

export interface StoredAccount {
  id: string;
  tenantId: string;
  userId: string;
  connectionName: string;
  brokerType: string;
  paperAccountId: string;
  baseCurrency: string;
  status: string;
  netLiquidation: number;
  cashBalance: number;
  buyingPower: number;
  realizedPnl: number;
  unrealizedPnl: number;
  reconcileOk: boolean;
  lastSyncAt?: string;
  isDemo: boolean;
  connectionHealth: string;
  dataEntitlement: string;
}

export interface StoredAudit {
  id: string;
  tenantId: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  detail?: Record<string, unknown>;
  createdAt: string;
}

export interface MemoryStore {
  endpoints: Map<string, StoredEndpoint>;
  endpointsByToken: Map<string, string>;
  seenSignalIds: Set<string>;
  signals: StoredSignal[];
  orders: StoredOrder[];
  accounts: StoredAccount[];
  audits: StoredAudit[];
  killSwitch: Map<string, { active: boolean; reason?: string }>;
  memberships: Map<string, { tenantId: string; role: MaRole }>;
  strategies: Map<string, { id: string; tenantId: string; strategyKey: string; name: string; enabled: boolean; parameters: Record<string, unknown> }>;
  halt: Map<string, boolean>;
}

export function createMemoryStore(): MemoryStore {
  return {
    endpoints: new Map(),
    endpointsByToken: new Map(),
    seenSignalIds: new Set(),
    signals: [],
    orders: [],
    accounts: [],
    audits: [],
    killSwitch: new Map(),
    memberships: new Map(),
    strategies: new Map(),
    halt: new Map(),
  };
}

/** Singleton process store for MA_USE_MEMORY_STORE */
export const globalMaStore = createMemoryStore();

export function seedDemoTenant(store: MemoryStore, tenantId = 'demo-tenant', userId = 'demo-user'): void {
  store.memberships.set(userId, { tenantId, role: 'owner' });
  const strategyId = 'strat-orb-v1';
  store.strategies.set(strategyId, {
    id: strategyId,
    tenantId,
    strategyKey: 'orb-v1',
    name: 'ORB Regime Long v1',
    enabled: true,
    parameters: { opening_range_minutes: 30, ema_period: 50 },
  });
  const token = 'demo-endpoint-token';
  const secret = 'demo-webhook-secret';
  const ep: StoredEndpoint = {
    id: randomUUID(),
    tenantId,
    userId,
    endpointToken: token,
    secretPlain: secret,
    secretHash: '',
    strategyId,
    errorCount: 0,
    duplicateCount: 0,
    expiredCount: 0,
  };
  store.endpoints.set(ep.id, ep);
  store.endpointsByToken.set(token, ep.id);
  store.accounts.push({
    id: randomUUID(),
    tenantId,
    userId,
    connectionName: 'DEMO Simulated Paper',
    brokerType: 'SIMULATED',
    paperAccountId: 'SIM-PAPER-001',
    baseCurrency: 'USD',
    status: 'connected',
    netLiquidation: 2400,
    cashBalance: 2400,
    buyingPower: 2160,
    realizedPnl: 0,
    unrealizedPnl: 0,
    reconcileOk: true,
    lastSyncAt: new Date().toISOString(),
    isDemo: true,
    connectionHealth: 'healthy',
    dataEntitlement: 'simulated',
  });
  store.killSwitch.set(tenantId, { active: false });
}
