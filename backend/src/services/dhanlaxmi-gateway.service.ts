import { createHmac, randomUUID } from 'crypto';
import { AppError } from '../middleware/error.middleware';
import { TenantService } from './tenant.service';
import { AdvisoryGatewayService } from './advisory-gateway.service';
import { MarketService } from './market.service';
import { isMarketOpen } from '../utils/helpers';
import { logger } from '../utils/logger';

const DHANLAXMI_URL = process.env.DHANLAXMI_SERVICE_URL || 'http://localhost:8095';
const VOICE_URL = process.env.VOICE_GATEWAY_SERVICE_URL || 'http://localhost:8096';
const INTENT_URL = process.env.LANGUAGE_INTENT_SERVICE_URL || 'http://localhost:8097';
const APPROVAL_URL = process.env.TRADE_APPROVAL_SERVICE_URL || 'http://localhost:8098';
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
    signal: AbortSignal.timeout(Number(process.env.DHANLAXMI_PROXY_TIMEOUT_MS || 30000))
  });
  const data = (await res.json().catch(() => ({}))) as {
    detail?: string;
    message?: string;
    data?: unknown;
  };
  if (!res.ok) {
    throw new AppError(data.detail || data.message || `DhanLaxmi service error (${res.status})`, res.status);
  }
  return data.data ?? data;
}

function formatIndicesLine(
  indices: Array<{ name: string; value: number; change: number; changePercent: number }>,
  marketStatus: string
) {
  const parts = indices.slice(0, 6).map((row) => {
    const pct =
      typeof row.changePercent === 'number' ? ` (${row.changePercent >= 0 ? '+' : ''}${row.changePercent.toFixed(2)}%)` : '';
    return `${row.name}: ${Number(row.value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${pct}`;
  });
  const head = `Market status: ${marketStatus}.`;
  if (!parts.length) {
    return `${head} Live index levels were unavailable — open Market Overview for quotes.`;
  }
  return `${head} Indices — ${parts.join('; ')}.`;
}

type MarketIndexRow = { name: string; value: number; change: number; changePercent: number };

export class DhanLaxmiGatewayService {
  static async loadMarketContext(): Promise<{
    market_status: string;
    indices: MarketIndexRow[];
    market_summary_line: string;
  }> {
    const indices = await MarketService.getIndices().catch((): MarketIndexRow[] => []);
    const indexRows: MarketIndexRow[] = Array.isArray(indices) ? (indices as MarketIndexRow[]) : [];
    const marketStatus = isMarketOpen() ? 'open' : 'closed';
    const market_summary_line = formatIndicesLine(indexRows, marketStatus);
    return {
      market_status: marketStatus,
      indices: indexRows,
      market_summary_line
    };
  }

  static async withContext(userId: string, body: Record<string, unknown> = {}) {
    const [context, market] = await Promise.all([
      AdvisoryGatewayService.buildUserContext(userId).catch(() => ({
        broker_status: 'disconnected',
        risk_profile_completed: true,
        data_stale: false,
        kill_switch: false
      })),
      this.loadMarketContext().catch((): {
        market_status: string;
        indices: MarketIndexRow[];
        market_summary_line: string;
      } => ({
        market_status: 'unknown',
        indices: [],
        market_summary_line: 'Live market data unavailable right now.'
      }))
    ]);
    return {
      ...body,
      context: { ...(body.context as object || {}), ...context, ...market }
    };
  }

  static async chat(userId: string, role: string, body: Record<string, unknown>) {
    const payload = await this.withContext(userId, body);
    try {
      return await proxyJson(DHANLAXMI_URL, '/dhanlaxmi/chat', userId, role, {
        method: 'POST',
        bodyObj: payload
      });
    } catch (err) {
      logger.warn('dhanlaxmi.chat_fallback', {
        error: err instanceof Error ? err.message : String(err)
      });
      const market = (payload.context || {}) as {
        market_summary_line?: string;
        indices?: unknown[];
        market_status?: string;
      };
      const line =
        market.market_summary_line ||
        'Live market data unavailable. Trading involves risk and profit is not guaranteed.';
      return {
        conversation_id: null,
        language: body.language_hint || 'en',
        intent: 'market_query',
        response_text:
          `DhanLaxmi assistant service is temporarily unavailable, but here is today's market snapshot. ${line} Paper trading remains default. Trading involves risk and profit is not guaranteed.`,
        disclaimer: 'Not financial advice. No guaranteed returns.',
        cards: [
          {
            type: 'market_snapshot',
            data: {
              market_status: market.market_status || 'unknown',
              indices: market.indices || []
            }
          }
        ],
        paper_first: true,
        never_auto_executes: true,
        status: 'degraded'
      };
    }
  }

  static intent(userId: string, role: string, body: unknown) {
    return proxyJson(INTENT_URL, '/command/parse', userId, role, { method: 'POST', bodyObj: body });
  }

  static strategyDraft(userId: string, role: string, body: Record<string, unknown>) {
    return this.chat(userId, role, { ...body, mode: 'strategy_builder' });
  }

  static advisory(userId: string, role: string, body: Record<string, unknown>) {
    return this.chat(userId, role, { ...body, mode: 'advisory_popup' });
  }

  static paperTest(userId: string, role: string, body: unknown) {
    return proxyJson(DHANLAXMI_URL, '/dhanlaxmi/paper-test', userId, role, {
      method: 'POST',
      bodyObj: body
    });
  }

  static createTradeApproval(userId: string, role: string, body: unknown) {
    return proxyJson(APPROVAL_URL, '/approvals/trade', userId, role, {
      method: 'POST',
      bodyObj: body
    });
  }

  static getConversation(userId: string, role: string, id: string) {
    return proxyJson(DHANLAXMI_URL, `/dhanlaxmi/conversation/${id}`, userId, role);
  }

  static getApproval(userId: string, role: string, id: string) {
    return proxyJson(APPROVAL_URL, `/approvals/${id}`, userId, role);
  }

  static approve(
    userId: string,
    role: string,
    id: string,
    body: Record<string, unknown>
  ) {
    const enriched = {
      ...body,
      live_env_enabled: process.env.LIVE_TRADING_ENABLED === 'true' && Boolean(body.live_env_enabled),
      // Gateway never silently sets rms_approved for non-admins
      rms_approved: role === 'admin' ? Boolean(body.rms_approved) : false
    };
    return proxyJson(APPROVAL_URL, `/approvals/${id}/approve`, userId, role, {
      method: 'POST',
      bodyObj: enriched
    });
  }

  static reject(userId: string, role: string, id: string) {
    return proxyJson(APPROVAL_URL, `/approvals/${id}/reject`, userId, role, {
      method: 'POST',
      bodyObj: {}
    });
  }

  static modify(userId: string, role: string, id: string, body: unknown) {
    return proxyJson(APPROVAL_URL, `/approvals/${id}/modify`, userId, role, {
      method: 'POST',
      bodyObj: body
    });
  }

  static transcribe(userId: string, role: string, body: unknown) {
    return proxyJson(VOICE_URL, '/voice/transcribe', userId, role, { method: 'POST', bodyObj: body });
  }

  static voiceRespond(userId: string, role: string, body: unknown) {
    return proxyJson(VOICE_URL, '/voice/respond', userId, role, { method: 'POST', bodyObj: body });
  }

  static async voiceCommand(userId: string, role: string, body: Record<string, unknown>) {
    const payload = await this.withContext(userId, body);
    return proxyJson(VOICE_URL, '/voice/command', userId, role, { method: 'POST', bodyObj: payload });
  }
}
