import { MaRole } from '../config';
import { MemoryStore } from '../store';

const RANK: Record<MaRole, number> = { viewer: 1, trader: 2, admin: 3, owner: 4 };

export function mapTenantRole(role: string): MaRole {
  if (role === 'owner') return 'owner';
  if (role === 'admin') return 'admin';
  if (role === 'member' || role === 'trader') return 'trader';
  return 'viewer';
}

export function canTradePaper(role: MaRole): boolean {
  return RANK[role] >= RANK.trader;
}

export function canView(role: MaRole): boolean {
  return RANK[role] >= RANK.viewer;
}

export function resolveRole(store: MemoryStore, userId: string, fallback: MaRole = 'owner'): { tenantId: string; role: MaRole } {
  const m = store.memberships.get(userId);
  if (m) return m;
  // Local guest / demos: bind to demo tenant as owner
  store.memberships.set(userId, { tenantId: 'demo-tenant', role: fallback });
  return { tenantId: 'demo-tenant', role: fallback };
}
