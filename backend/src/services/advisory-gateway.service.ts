import { createHmac, randomUUID } from 'crypto';
import { AppError } from '../middleware/error.middleware';
import { TenantService } from './tenant.service';
import { DatabaseService } from './database.service';
import { IntegrationService } from './integration.service';
import { logger } from '../utils/logger';

const ADVISORY_URL = process.env.AI_ADVISORY_SERVICE_URL || 'http://localhost:8091';
const PAPER_URL = process.env.PAPER_TEST_SERVICE_URL || 'http://localhost:8092';
const EXTERNAL_URL = process.env.EXTERNAL_ALGO_SERVICE_URL || 'http://localhost:8093';
const MCP_URL = process.env.MCP_CONNECTOR_SERVICE_URL || 'http://localhost:8094';
const HMAC_SECRET = process.env.SERVICE_HMAC_SECRET || 'dev-service-hmac-secret-change-me';

function signHeaders(tenantId: string, userId: string, role: string) {
  const requestId = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${tenantId}:${userId}:${role}:${requestId}:${timestamp}`;
  const signature = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': tenantId,
    'X-User-Id': userId,
    'X-User-Role': role,
    'X-Request-Id': requestId,
    'X-Service-Timestamp': String(timestamp),
    'X-Service-Signature': signature
  };
}

async function proxyJson(
  base: string,
  path: string,
  userId: string,
  role: string,
  init?: RequestInit & { bodyObj?: unknown }
) {
  const tenantId = (await TenantService.getPersonalTenantId(userId)) || userId;
  const headers = signHeaders(tenantId, userId, role);
  const res = await fetch(`${base}${path}`, {
    method: init?.method || 'GET',
    headers,
    body: init?.bodyObj != null ? JSON.stringify(init.bodyObj) : init?.body,
    signal: AbortSignal.timeout(Number(process.env.ADVISORY_PROXY_TIMEOUT_MS || 30000))
  });
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string;
    message?: string;
    data?: unknown;
  };
  if (!res.ok) {
    throw new AppError(data.detail || data.message || `Advisory service error (${res.status})`, res.status);
  }
  return data.data ?? data;
}

type HoldingRow = { symbol: string; quantity: number; averagePrice: unknown; lastPrice: unknown };
type AccountRow = { status?: string };
type ExecutionCtx = { context?: { activeBrokerConnectionId?: string | null } } | null;

export class AdvisoryGatewayService {
  static async buildUserContext(userId: string) {
    const [summary, holdings, accounts, ctx] = await Promise.all([
      DatabaseService.getPortfolioSummary(userId).catch(() => ({
        holdingsCount: 0,
        totalCurrent: 0,
        totalInvested: 0,
        totalPnL: 0
      })),
      DatabaseService.getHoldings(userId).catch((): HoldingRow[] => []),
      IntegrationService.listAccounts(userId).catch((): AccountRow[] => []),
      IntegrationService.getExecutionContext(userId).catch((): ExecutionCtx => null)
    ]);

    const connected = (accounts || []).some((a: AccountRow) => a.status === 'CONNECTED');
    const activeStrategies: unknown[] = [];
    return {
      portfolio: {
        holdings_count: summary.holdingsCount || holdings.length,
        total_current: summary.totalCurrent || 0,
        total_invested: summary.totalInvested || 0,
        total_pnl: summary.totalPnL || 0,
        holdings: (holdings || []).slice(0, 50).map((h: HoldingRow) => ({
          symbol: h.symbol,
          quantity: h.quantity,
          averagePrice: Number(h.averagePrice),
          lastPrice: Number(h.lastPrice)
        }))
      },
      margin: { available: connected ? 50000 : 0, utilized: 0, currency: 'INR' },
      broker_status: connected ? 'connected' : 'disconnected',
      broker: connected ? 'dhan' : 'paper',
      account_id: ctx?.context?.activeBrokerConnectionId || null,
      risk_profile: { level: 'balanced', completed: true },
      risk_profile_completed: true,
      market_status: 'open',
      data_stale: false,
      active_strategies: activeStrategies,
      strategy_performance: 'none',
      market: 'NSE'
    };
  }

  static async generate(userId: string, role: string) {
    const context = await this.buildUserContext(userId);
    return proxyJson(ADVISORY_URL, '/advisory/generate', userId, role, {
      method: 'POST',
      bodyObj: { context }
    });
  }

  static async latest(userId: string, role: string) {
    try {
      return await proxyJson(ADVISORY_URL, '/advisory/latest', userId, role);
    } catch (err) {
      logger.warn('advisory.latest_fallback', { error: err instanceof Error ? err.message : String(err) });
      return {
        advisory_id: null,
        status: 'preparing',
        summary: 'AI advisory is being prepared',
        recommendations: [],
        disclaimer:
          'This is not financial advice and does not guarantee returns. Paper test required before any live deployment.'
      };
    }
  }

  static get(userId: string, role: string, id: string) {
    return proxyJson(ADVISORY_URL, `/advisory/${id}`, userId, role);
  }

  static recommendations(userId: string, role: string, id: string) {
    return proxyJson(ADVISORY_URL, `/advisory/${id}/recommendations`, userId, role);
  }

  static convert(userId: string, role: string, advisoryId: string, recommendationId: string) {
    return proxyJson(
      ADVISORY_URL,
      `/advisory/${advisoryId}/recommendations/${recommendationId}/convert-to-algo`,
      userId,
      role,
      { method: 'POST', bodyObj: {} }
    );
  }

  static dismiss(userId: string, role: string, id: string) {
    return proxyJson(ADVISORY_URL, `/advisory/${id}/dismiss`, userId, role, { method: 'POST', bodyObj: {} });
  }

  static async refresh(userId: string, role: string, id: string) {
    const context = await this.buildUserContext(userId);
    return proxyJson(ADVISORY_URL, `/advisory/${id}/refresh`, userId, role, {
      method: 'POST',
      bodyObj: { context }
    });
  }

  static listOptions(userId: string, role: string) {
    return proxyJson(ADVISORY_URL, '/strategy-options', userId, role);
  }

  static getOption(userId: string, role: string, id: string) {
    return proxyJson(ADVISORY_URL, `/strategy-options/${id}`, userId, role);
  }

  static updateOption(userId: string, role: string, id: string, body: unknown) {
    return proxyJson(ADVISORY_URL, `/strategy-options/${id}`, userId, role, {
      method: 'PUT',
      bodyObj: body
    });
  }

  static async paperTest(userId: string, role: string, id: string) {
    const option = await this.getOption(userId, role, id);
    const result = await proxyJson(PAPER_URL, `/strategy-options/${id}/paper-test`, userId, role, {
      method: 'POST',
      bodyObj: { strategy_option: option }
    });
    return result;
  }

  static saveOption(userId: string, role: string, id: string) {
    return proxyJson(ADVISORY_URL, `/strategy-options/${id}/save`, userId, role, { method: 'POST', bodyObj: {} });
  }

  static deployPaper(userId: string, role: string, id: string) {
    return proxyJson(ADVISORY_URL, `/strategy-options/${id}/deploy-paper`, userId, role, {
      method: 'POST',
      bodyObj: {}
    });
  }

  static requestLive(userId: string, role: string, id: string, body: unknown) {
    return proxyJson(ADVISORY_URL, `/strategy-options/${id}/request-live-approval`, userId, role, {
      method: 'POST',
      bodyObj: body
    });
  }

  static discoverExternal(userId: string, role: string) {
    return proxyJson(EXTERNAL_URL, '/external-algos/discover', userId, role, { method: 'POST', bodyObj: {} });
  }

  static listExternal(userId: string, role: string) {
    return proxyJson(EXTERNAL_URL, '/external-algos/candidates', userId, role);
  }

  static getExternal(userId: string, role: string, id: string) {
    return proxyJson(EXTERNAL_URL, `/external-algos/candidates/${id}`, userId, role);
  }

  static normalizeExternal(userId: string, role: string, id: string) {
    return proxyJson(EXTERNAL_URL, `/external-algos/candidates/${id}/normalize`, userId, role, {
      method: 'POST',
      bodyObj: {}
    });
  }

  static riskScanExternal(userId: string, role: string, id: string) {
    return proxyJson(EXTERNAL_URL, `/external-algos/candidates/${id}/risk-scan`, userId, role, {
      method: 'POST',
      bodyObj: {}
    });
  }

  static listMcp(userId: string, role: string) {
    return proxyJson(MCP_URL, '/mcp/connectors', userId, role);
  }

  static mcpSnapshot(userId: string, role: string, accountId: string) {
    return proxyJson(MCP_URL, `/mcp/accounts/${accountId}/snapshot`, userId, role);
  }
}
