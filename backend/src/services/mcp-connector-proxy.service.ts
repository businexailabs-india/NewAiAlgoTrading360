/**
 * BFF proxy to mcp-connector-service.
 * Signs ServiceAuth HMAC server-side — browser never holds SERVICE_HMAC_SECRET.
 */
import { createHmac, randomUUID } from 'crypto';
import { AppError } from '../middleware/error.middleware';
import { TenantService } from './tenant.service';

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

export type McpProxyInit = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Force admin role when calling /admin/mcp/* */
  asAdmin?: boolean;
};

function buildPath(path: string, query?: Record<string, string | undefined>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v != null && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export class McpConnectorProxyService {
  static async proxy(
    userId: string,
    role: string,
    path: string,
    init: McpProxyInit = {}
  ): Promise<unknown> {
    const tenantId = (await TenantService.getPersonalTenantId(userId)) || userId;
    const effectiveRole = init.asAdmin ? 'admin' : role;
    const headers = signHeaders(tenantId, userId, effectiveRole);
    const url = `${MCP_URL}${buildPath(path, init.query)}`;
    const res = await fetch(url, {
      method: init.method || 'GET',
      headers,
      body: init.body != null ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(Number(process.env.ADVISORY_PROXY_TIMEOUT_MS || 30000))
    });
    const data = (await res.json().catch(() => ({}))) as {
      detail?: string;
      message?: string;
      data?: unknown;
      success?: boolean;
    };
    if (!res.ok) {
      throw new AppError(
        data.detail || data.message || `MCP connector error (${res.status})`,
        res.status
      );
    }
    return data.data !== undefined ? data.data : data;
  }
}
