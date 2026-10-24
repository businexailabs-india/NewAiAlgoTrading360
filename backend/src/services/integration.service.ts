import { prisma } from '../config/database';
import { EncryptionService } from './encryption.service';
import { McpHttpClient } from './mcp-http.client';
import { capabilityMatrixFromTools, DHAN_CAPABILITY_REGISTRY } from './dhan-capability.registry';
import { DhanDirectAdapter } from './dhan-direct.adapter';
import { FyersDirectAdapter } from './fyers-direct.adapter';
import { DhanMcpAdapter } from './dhan-mcp.adapter';
import { ExecutionTargetResolver } from './execution-target.resolver';
import { RiskGateService } from './risk-gate.service';
import { DatabaseService } from './database.service';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';
import { listIndianMcpPresets, type ResolvedIndianMcpPreset } from './indian-mcp-catalog';

function sanitizeMcp(config: {
  id: string;
  userId: string;
  name: string;
  provider: string;
  transport: string;
  endpoint: string;
  isEnabled: boolean;
  lastHealthStatus: string | null;
  lastHealthCheckedAt: Date | null;
  lastError: string | null;
  discoveredTools: unknown;
  capabilities: unknown;
  latencyMs: number | null;
  createdAt: Date;
  updatedAt: Date;
  headersEncrypted?: string | null;
  authConfigEncrypted?: string | null;
}) {
  return {
    id: config.id,
    userId: config.userId,
    name: config.name,
    provider: config.provider,
    transport: config.transport,
    endpoint: config.endpoint,
    isEnabled: config.isEnabled,
    lastHealthStatus: config.lastHealthStatus,
    lastHealthCheckedAt: config.lastHealthCheckedAt,
    lastError: config.lastError,
    discoveredTools: config.discoveredTools,
    capabilities: config.capabilities,
    latencyMs: config.latencyMs,
    hasHeaders: !!config.headersEncrypted,
    hasAuth: !!config.authConfigEncrypted,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt
  };
}

function sanitizeAccount(conn: {
  id: string;
  userId: string;
  broker: string;
  displayName: string | null;
  externalAccountId: string | null;
  providerType: string;
  mcpServerConfigId: string | null;
  status: string;
  isEnabled: boolean;
  isActive: boolean;
  capabilities: unknown;
  lastValidatedAt: Date | null;
  lastError: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  clientIdEncrypted?: string | null;
}) {
  let maskedClientId = '';
  try {
    if (conn.clientIdEncrypted) maskedClientId = EncryptionService.maskSecret(EncryptionService.decrypt(conn.clientIdEncrypted));
  } catch { /* ignore */ }
  return {
    id: conn.id,
    userId: conn.userId,
    broker: conn.broker,
    displayName: conn.displayName,
    externalAccountId: conn.externalAccountId,
    providerType: conn.providerType,
    mcpServerConfigId: conn.mcpServerConfigId,
    status: conn.status,
    isEnabled: conn.isEnabled,
    isActive: conn.isActive,
    capabilities: conn.capabilities,
    lastValidatedAt: conn.lastValidatedAt,
    lastError: conn.lastError,
    expiresAt: conn.expiresAt,
    maskedClientId,
    createdAt: conn.createdAt,
    updatedAt: conn.updatedAt
  };
}

export class IntegrationService {
  static capabilityCatalog() {
    return DHAN_CAPABILITY_REGISTRY;
  }

  // ── MCP servers ──────────────────────────────────────────────
  static async listMcpServers(userId: string) {
    const rows = await prisma.mcpServerConfig.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
    return rows.map(sanitizeMcp);
  }

  static async createMcpServer(userId: string, body: {
    name: string;
    endpoint: string;
    transport?: 'HTTP' | 'SSE';
    provider?: string;
    headers?: Record<string, string>;
    authConfig?: Record<string, string>;
    isEnabled?: boolean;
  }) {
    if (!body.name?.trim() || !body.endpoint?.trim()) {
      throw new AppError('name and endpoint are required', 400);
    }
    const created = await prisma.mcpServerConfig.create({
      data: {
        userId,
        name: body.name.trim(),
        endpoint: body.endpoint.trim(),
        transport: body.transport || 'HTTP',
        provider: body.provider || 'dhan',
        headersEncrypted: body.headers ? EncryptionService.encryptJson(body.headers) : null,
        authConfigEncrypted: body.authConfig ? EncryptionService.encryptJson(body.authConfig) : null,
        credentialKeyVersion: EncryptionService.currentKeyVersion(),
        isEnabled: body.isEnabled !== false
      }
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MCP_SERVER_CREATE',
        resource: 'mcp_server_configs',
        details: { id: created.id, name: created.name, endpoint: created.endpoint }
      }
    });
    return sanitizeMcp(created);
  }

  static async updateMcpServer(userId: string, id: string, body: {
    name?: string;
    endpoint?: string;
    transport?: string;
    headers?: Record<string, string>;
    authConfig?: Record<string, string>;
    isEnabled?: boolean;
  }) {
    const existing = await prisma.mcpServerConfig.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError('MCP server not found', 404);
    const updated = await prisma.mcpServerConfig.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.endpoint && { endpoint: body.endpoint }),
        ...(body.transport && { transport: body.transport }),
        ...(body.headers && { headersEncrypted: EncryptionService.encryptJson(body.headers) }),
        ...(body.authConfig && { authConfigEncrypted: EncryptionService.encryptJson(body.authConfig) }),
        ...(body.isEnabled !== undefined && { isEnabled: body.isEnabled })
      }
    });
    return sanitizeMcp(updated);
  }

  static async deleteMcpServer(userId: string, id: string) {
    const existing = await prisma.mcpServerConfig.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError('MCP server not found', 404);
    await prisma.mcpServerConfig.delete({ where: { id } });
    return { message: 'MCP server deleted' };
  }

  static async testMcpServer(userId: string, id: string) {
    const config = await prisma.mcpServerConfig.findFirst({ where: { id, userId } });
    if (!config) throw new AppError('MCP server not found', 404);

    const headers = EncryptionService.decryptJson<Record<string, string>>(config.headersEncrypted) || {};
    const auth = EncryptionService.decryptJson<Record<string, string>>(config.authConfigEncrypted) || {};
    const client = new McpHttpClient({
      endpoint: config.endpoint,
      transport: config.transport as 'HTTP' | 'SSE',
      headers: { ...headers, ...auth }
    });

    const health = await client.health();
    const tools = health.tools.map(name => ({ name }));
    const capabilities = capabilityMatrixFromTools(health.tools);

    const updated = await prisma.mcpServerConfig.update({
      where: { id },
      data: {
        lastHealthStatus: health.ok ? 'HEALTHY' : 'UNHEALTHY',
        lastHealthCheckedAt: new Date(),
        lastError: health.error || null,
        latencyMs: health.latencyMs,
        discoveredTools: tools,
        capabilities
      }
    });

    return { health, server: sanitizeMcp(updated), capabilityCatalog: DHAN_CAPABILITY_REGISTRY };
  }

  /** Preset catalog of Indian broker MCP servers (env-overridable endpoints). */
  static listIndianMcpCatalog() {
    return {
      region: 'IN' as const,
      count: listIndianMcpPresets().length,
      presets: listIndianMcpPresets()
    };
  }

  /**
   * Probe Indian MCP presets for reachability and mark which are already configured.
   */
  static async scanIndianMcpServers(userId: string, opts?: { probe?: boolean; providers?: string[] }) {
    const probe = opts?.probe !== false;
    const filter = new Set((opts?.providers || []).map((p) => p.toLowerCase()));
    const existing = await prisma.mcpServerConfig.findMany({ where: { userId } });
    const byProvider = new Map(existing.map((e) => [e.provider.toLowerCase(), e]));

    let presets = listIndianMcpPresets();
    if (filter.size) {
      presets = presets.filter((p) => filter.has(p.provider.toLowerCase()));
    }

    const results = await Promise.all(
      presets.map(async (preset) => {
        const saved = byProvider.get(preset.provider.toLowerCase());
        let reachable = false;
        let latencyMs: number | null = null;
        let toolsCount = 0;
        let error: string | null = null;

        if (probe) {
          const client = new McpHttpClient({
            endpoint: preset.endpoint,
            transport: preset.transport,
            timeoutMs: 4000
          });
          const health = await client.health();
          reachable = health.ok;
          latencyMs = health.latencyMs;
          toolsCount = health.tools.length;
          error = health.error || null;
        }

        return {
          ...preset,
          alreadyAdded: Boolean(saved),
          existingId: saved?.id || null,
          existingEndpoint: saved?.endpoint || null,
          reachable,
          latencyMs,
          toolsCount,
          probeError: error,
          status: saved
            ? saved.lastHealthStatus || 'CONFIGURED'
            : reachable
              ? 'REACHABLE'
              : probe
                ? 'UNREACHABLE'
                : 'NOT_ADDED'
        };
      })
    );

    return {
      scannedAt: new Date().toISOString(),
      probed: probe,
      total: results.length,
      alreadyAdded: results.filter((r) => r.alreadyAdded).length,
      reachable: results.filter((r) => r.reachable).length,
      results
    };
  }

  /**
   * Add (or refresh endpoints for) Indian MCP presets.
   * Skips providers already present unless `updateExisting` is true.
   */
  static async addIndianMcpServers(
    userId: string,
    opts?: {
      providers?: string[];
      onlyReachable?: boolean;
      updateExisting?: boolean;
      probeFirst?: boolean;
    }
  ) {
    const onlyReachable = !!opts?.onlyReachable;
    const updateExisting = !!opts?.updateExisting;
    const probeFirst = opts?.probeFirst !== false && onlyReachable;

    const scan = await this.scanIndianMcpServers(userId, {
      probe: probeFirst || onlyReachable,
      providers: opts?.providers
    });

    const created: ReturnType<typeof sanitizeMcp>[] = [];
    const updated: ReturnType<typeof sanitizeMcp>[] = [];
    const skipped: Array<{ provider: string; reason: string }> = [];

    for (const row of scan.results as Array<
      ResolvedIndianMcpPreset & {
        alreadyAdded: boolean;
        existingId: string | null;
        reachable: boolean;
        status: string;
      }
    >) {
      if (onlyReachable && !row.reachable) {
        skipped.push({ provider: row.provider, reason: 'unreachable' });
        continue;
      }

      if (row.alreadyAdded && row.existingId) {
        if (!updateExisting) {
          skipped.push({ provider: row.provider, reason: 'already_added' });
          continue;
        }
        const saved = await prisma.mcpServerConfig.update({
          where: { id: row.existingId },
          data: {
            name: row.name,
            endpoint: row.endpoint,
            transport: row.transport,
            provider: row.provider,
            isEnabled: true
          }
        });
        updated.push(sanitizeMcp(saved));
        continue;
      }

      const saved = await prisma.mcpServerConfig.create({
        data: {
          userId,
          name: row.name,
          endpoint: row.endpoint,
          transport: row.transport,
          provider: row.provider,
          isEnabled: true,
          credentialKeyVersion: EncryptionService.currentKeyVersion()
        }
      });
      created.push(sanitizeMcp(saved));
    }

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'MCP_INDIAN_CATALOG_ADD',
        resource: 'mcp_server_configs',
        details: {
          created: created.map((c) => c.provider),
          updated: updated.map((u) => u.provider),
          skipped
        }
      }
    });

    logger.info('indian_mcp.add_complete', {
      userId,
      created: created.length,
      updated: updated.length,
      skipped: skipped.length
    });

    return {
      created,
      updated,
      skipped,
      summary: {
        created: created.length,
        updated: updated.length,
        skipped: skipped.length
      },
      scan
    };
  }

  // ── Dhan accounts ────────────────────────────────────────────
  static async listAccounts(userId: string) {
    const rows = await prisma.brokerConnection.findMany({
      where: { userId, isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
    return rows.map(sanitizeAccount);
  }

  static async upsertDhanAccount(userId: string, body: {
    displayName?: string;
    clientId: string;
    accessToken: string;
    providerType?: 'DIRECT' | 'MCP';
    mcpServerConfigId?: string;
    externalAccountId?: string;
  }) {
    if (!body.clientId || !body.accessToken) {
      throw new AppError('clientId and accessToken are required', 400);
    }

    if (body.mcpServerConfigId) {
      const mcp = await prisma.mcpServerConfig.findFirst({ where: { id: body.mcpServerConfigId, userId } });
      if (!mcp) throw new AppError('MCP server not found', 404);
    }

    const existing = await prisma.brokerConnection.findFirst({
      where: { userId, broker: 'dhan', isActive: true, externalAccountId: body.externalAccountId || body.clientId }
    });

    const data = {
      displayName: body.displayName || `Dhan ${EncryptionService.maskSecret(body.clientId, 4)}`,
      externalAccountId: body.externalAccountId || body.clientId,
      clientIdEncrypted: EncryptionService.encrypt(body.clientId),
      accessTokenEncrypted: EncryptionService.encrypt(body.accessToken),
      credentialsEncrypted: EncryptionService.encryptJson({
        clientId: body.clientId,
        accessToken: body.accessToken
      }),
      credentialKeyVersion: EncryptionService.currentKeyVersion(),
      providerType: body.providerType || (body.mcpServerConfigId ? 'MCP' : 'DIRECT'),
      mcpServerConfigId: body.mcpServerConfigId || null,
      status: 'PENDING',
      isEnabled: true,
      isActive: true,
      broker: 'dhan'
    };

    const conn = existing
      ? await prisma.brokerConnection.update({ where: { id: existing.id }, data })
      : await prisma.brokerConnection.create({ data: { userId, ...data } });

    await prisma.auditLog.create({
      data: {
        userId,
        action: existing ? 'DHAN_ACCOUNT_UPDATE' : 'DHAN_ACCOUNT_CREATE',
        resource: 'broker_connections',
        details: { id: conn.id, providerType: conn.providerType }
      }
    });

    return sanitizeAccount(conn);
  }

  static async upsertFyersAccount(userId: string, body: {
    displayName?: string;
    appId: string;
    accessToken: string;
    providerType?: 'DIRECT' | 'MCP';
    mcpServerConfigId?: string;
    externalAccountId?: string;
  }) {
    if (!body.appId || !body.accessToken) {
      throw new AppError('appId and accessToken are required', 400);
    }

    if (body.mcpServerConfigId) {
      const mcp = await prisma.mcpServerConfig.findFirst({ where: { id: body.mcpServerConfigId, userId } });
      if (!mcp) throw new AppError('MCP server not found', 404);
    }

    const existing = await prisma.brokerConnection.findFirst({
      where: { userId, broker: 'fyers', isActive: true, externalAccountId: body.externalAccountId || body.appId }
    });

    const data = {
      displayName: body.displayName || `Fyers ${EncryptionService.maskSecret(body.appId, 4)}`,
      externalAccountId: body.externalAccountId || body.appId,
      clientIdEncrypted: EncryptionService.encrypt(body.appId),
      accessTokenEncrypted: EncryptionService.encrypt(body.accessToken),
      credentialsEncrypted: EncryptionService.encryptJson({
        appId: body.appId,
        clientId: body.appId,
        accessToken: body.accessToken
      }),
      credentialKeyVersion: EncryptionService.currentKeyVersion(),
      providerType: body.providerType || (body.mcpServerConfigId ? 'MCP' : 'DIRECT'),
      mcpServerConfigId: body.mcpServerConfigId || null,
      status: 'PENDING',
      isEnabled: true,
      isActive: true,
      broker: 'fyers'
    };

    const conn = existing
      ? await prisma.brokerConnection.update({ where: { id: existing.id }, data })
      : await prisma.brokerConnection.create({ data: { userId, ...data } });

    await prisma.auditLog.create({
      data: {
        userId,
        action: existing ? 'FYERS_ACCOUNT_UPDATE' : 'FYERS_ACCOUNT_CREATE',
        resource: 'broker_connections',
        details: { id: conn.id, providerType: conn.providerType }
      }
    });

    return sanitizeAccount(conn);
  }

  static async validateAccount(userId: string, id: string) {
    const conn = await prisma.brokerConnection.findFirst({
      where: { id, userId },
      include: { mcpServerConfig: true }
    });
    if (!conn) throw new AppError('Account not found', 404);

    let ok = false;
    let error: string | undefined;
    let capabilities: Record<string, boolean> = {};

    try {
      // Paper is local simulation — never require Dhan/MCP credentials.
      if (String(conn.broker).toLowerCase() === 'paper') {
        ok = true;
        capabilities = {
          'portfolio.funds': true,
          'trading.place': true,
          'portfolio.holdings': true,
          'orderbook.list': true
        };
      } else if (conn.providerType === 'MCP' && conn.mcpServerConfig) {
        const result = await this.testMcpServer(userId, conn.mcpServerConfig.id);
        ok = result.health.ok;
        error = result.health.error;
        capabilities = (result.server.capabilities as Record<string, boolean>) || {};
      } else if (String(conn.broker).toLowerCase() === 'dhan') {
        const creds = EncryptionService.decryptJson<{ clientId: string; accessToken: string }>(
          conn.credentialsEncrypted
        );
        if (!creds?.clientId || !creds?.accessToken) throw new Error('Missing credentials');
        const adapter = new DhanDirectAdapter(creds);
        const probe = await adapter.probe();
        ok = probe.ok;
        error = probe.error;
        capabilities = {
          'portfolio.funds': ok,
          'trading.place': ok,
          'portfolio.holdings': ok,
          'orderbook.list': ok
        };
      } else if (String(conn.broker).toLowerCase() === 'fyers') {
        const creds = EncryptionService.decryptJson<{ appId?: string; clientId?: string; accessToken: string }>(
          conn.credentialsEncrypted
        );
        const appId =
          creds?.appId ||
          creds?.clientId ||
          (conn.clientIdEncrypted ? EncryptionService.decrypt(conn.clientIdEncrypted) : '') ||
          process.env.FYERS_APP_ID ||
          '';
        const accessToken =
          creds?.accessToken ||
          (conn.accessTokenEncrypted ? EncryptionService.decrypt(conn.accessTokenEncrypted) : '');
        if (!appId || !accessToken) throw new Error('Missing Fyers appId / accessToken');
        const adapter = new FyersDirectAdapter({ appId, accessToken });
        const probe = await adapter.probe();
        ok = probe.ok;
        error = probe.error;
        capabilities = {
          'market.quotes': ok,
          'portfolio.holdings': ok,
          'portfolio.funds': ok
        };
      } else {
        throw new Error(`Unsupported broker for validation: ${conn.broker}`);
      }
    } catch (err) {
      ok = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const updated = await prisma.brokerConnection.update({
      where: { id },
      data: {
        status: ok ? 'CONNECTED' : 'ERROR',
        lastValidatedAt: new Date(),
        lastError: error || null,
        capabilities
      }
    });

    return { ok, error, account: sanitizeAccount(updated) };
  }

  /**
   * Pull live holdings from Dhan (DIRECT or MCP) into local portfolio DB.
   * Portfolio UI only reads DB holdings — this is required for Dhan to show.
   */
  static async syncAccountPortfolio(userId: string, accountId: string) {
    const conn = await prisma.brokerConnection.findFirst({
      where: { id: accountId, userId },
      include: { mcpServerConfig: true }
    });
    if (!conn) throw new AppError('Account not found', 404);
    if (conn.broker !== 'dhan' && conn.broker !== 'fyers') {
      throw new AppError('Portfolio sync currently supports Dhan and Fyers accounts', 400);
    }

    let raw: unknown;
    try {
      if (conn.broker === 'fyers') {
        const creds = EncryptionService.decryptJson<{ appId?: string; clientId?: string; accessToken: string }>(
          conn.credentialsEncrypted
        );
        const appId =
          creds?.appId ||
          creds?.clientId ||
          (conn.clientIdEncrypted ? EncryptionService.decrypt(conn.clientIdEncrypted) : '') ||
          process.env.FYERS_APP_ID ||
          '';
        const accessToken =
          creds?.accessToken ||
          (conn.accessTokenEncrypted ? EncryptionService.decrypt(conn.accessTokenEncrypted) : '');
        if (!appId || !accessToken) throw new AppError('Account credentials missing — re-save Fyers App ID + token', 400);
        const adapter = new FyersDirectAdapter({ appId, accessToken });
        raw = await adapter.getHoldings();
      } else if (conn.providerType === 'MCP' && conn.mcpServerConfig) {
        const headers = EncryptionService.decryptJson<Record<string, string>>(conn.mcpServerConfig.headersEncrypted) || {};
        const auth = EncryptionService.decryptJson<Record<string, string>>(conn.mcpServerConfig.authConfigEncrypted) || {};
        const client = new McpHttpClient({
          endpoint: conn.mcpServerConfig.endpoint,
          transport: conn.mcpServerConfig.transport as 'HTTP' | 'SSE',
          headers: { ...headers, ...auth }
        });
        const mcp = new DhanMcpAdapter(client);
        raw = await mcp.getHoldings();
      } else {
        const creds = EncryptionService.decryptJson<{ clientId: string; accessToken: string }>(
          conn.credentialsEncrypted
        );
        const clientId = creds?.clientId
          || (conn.clientIdEncrypted ? EncryptionService.decrypt(conn.clientIdEncrypted) : '');
        const accessToken = creds?.accessToken
          || (conn.accessTokenEncrypted ? EncryptionService.decrypt(conn.accessTokenEncrypted) : '');
        if (!clientId || !accessToken) throw new AppError('Account credentials missing — re-save Dhan Client ID + token', 400);
        const adapter = new DhanDirectAdapter({ clientId, accessToken });
        raw = await adapter.getHoldings();
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { errorMessage?: string; errorCode?: string } }; message?: string };
      const msg = ax.response?.data?.errorMessage || ax.message || 'Dhan holdings fetch failed';
      const code = ax.response?.data?.errorCode;
      await prisma.brokerConnection.update({
        where: { id: accountId },
        data: { status: 'ERROR', lastError: code ? `${code}: ${msg}` : msg }
      });
      throw new AppError(code ? `Dhan sync failed (${code}): ${msg}` : `Dhan sync failed: ${msg}`, 502);
    }

    const rows = conn.broker === 'fyers' ? this.normalizeFyersHoldings(raw) : this.normalizeDhanHoldings(raw);
    // Replace prior Dhan holdings for this account so UI matches broker snapshot
    await prisma.holding.deleteMany({ where: { userId, brokerConnectionId: accountId } });

    let count = 0;
    let totalCurrent = 0;
    let totalInvested = 0;
    for (const h of rows) {
      if (!h.symbol || h.quantity <= 0) continue;
      const invested = h.quantity * h.averagePrice;
      const current = h.quantity * h.lastPrice;
      const pnl = current - invested;
      const pnlPercentage = invested ? (pnl / invested) * 100 : 0;
      await DatabaseService.createHolding({
        userId,
        brokerConnectionId: accountId,
        symbol: h.symbol,
        exchange: h.exchange,
        quantity: h.quantity,
        averagePrice: h.averagePrice,
        lastPrice: h.lastPrice,
        pnl,
        pnlPercentage,
        currentValue: current,
        investedValue: invested,
        product: h.product,
        isin: h.isin
      });
      count += 1;
      totalCurrent += current;
      totalInvested += invested;
    }

    await prisma.brokerConnection.update({
      where: { id: accountId },
      data: {
        status: 'CONNECTED',
        lastValidatedAt: new Date(),
        lastError: null,
        metadata: {
          lastPortfolioSyncAt: new Date().toISOString(),
          holdingsCount: count,
          totalCurrent,
          totalInvested
        }
      }
    });

    // Ensure this account is selected so dashboard uses it
    await ExecutionTargetResolver.setContext(userId, {
      activeBrokerConnectionId: accountId,
      executionMode: 'PAPER'
    });

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'DHAN_PORTFOLIO_SYNC',
        resource: 'holdings',
        details: { accountId, count, totalCurrent, totalInvested }
      }
    });

    return {
      accountId,
      holdingsCount: count,
      totalInvested,
      totalCurrent,
      totalPnL: totalCurrent - totalInvested,
      holdings: rows.slice(0, 50)
    };
  }

  /** Create/update Dhan account from env DHAN_* (local convenience) then sync portfolio */
  static async bootstrapEnvDhanAndSync(userId: string) {
    const clientId = process.env.DHAN_CLIENT_ID || '';
    const accessToken = process.env.DHAN_ACCESS_TOKEN || '';
    if (!clientId || !accessToken) {
      throw new AppError('DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN not set in backend .env', 400);
    }
    const account = await this.upsertDhanAccount(userId, {
      displayName: process.env.DHAN_APP_NAME || 'Dhan Env Account',
      clientId,
      accessToken,
      providerType: 'DIRECT',
      externalAccountId: clientId
    });
    const sync = await this.syncAccountPortfolio(userId, account.id);
    return { account, sync };
  }

  static async bootstrapEnvFyersAndSync(userId: string) {
    const appId = process.env.FYERS_APP_ID || '';
    const accessToken = process.env.FYERS_ACCESS_TOKEN || '';
    if (!appId || !accessToken) {
      throw new AppError('FYERS_APP_ID / FYERS_ACCESS_TOKEN not set in backend .env', 400);
    }
    const account = await this.upsertFyersAccount(userId, {
      displayName: 'Fyers Env Account',
      appId,
      accessToken,
      providerType: 'DIRECT',
      externalAccountId: appId
    });
    let sync: Awaited<ReturnType<typeof IntegrationService.syncAccountPortfolio>> | null = null;
    try {
      sync = await this.syncAccountPortfolio(userId, account.id);
    } catch {
      /* quotes can work even if holdings sync fails */
    }
    return { account, sync };
  }

  private static normalizeDhanHoldings(raw: unknown): Array<{
    symbol: string;
    exchange: string;
    quantity: number;
    averagePrice: number;
    lastPrice: number;
    product: string;
    isin?: string;
  }> {
    const list = Array.isArray(raw)
      ? raw
      : Array.isArray((raw as { data?: unknown })?.data)
        ? (raw as { data: unknown[] }).data
        : Array.isArray((raw as { holdings?: unknown })?.holdings)
          ? (raw as { holdings: unknown[] }).holdings
          : [];

    return list.map((item) => {
      const h = item as Record<string, unknown>;
      const symbol = String(
        h.tradingSymbol || h.tradingsymbol || h.symbol || h.trading_symbol || h.securityId || ''
      ).toUpperCase();
      const qty = Number(h.totalQty ?? h.quantity ?? h.qty ?? h.availableQty ?? 0);
      const avg = Number(h.avgCostPrice ?? h.averagePrice ?? h.average_price ?? h.avg_price ?? h.costPrice ?? 0);
      const ltp = Number(h.lastTradedPrice ?? h.lastPrice ?? h.last_price ?? h.ltp ?? avg);
      const exchangeRaw = String(h.exchange || h.exchangeSegment || 'NSE').toUpperCase();
      const exchange = exchangeRaw.includes('BSE') ? 'BSE' : 'NSE';
      return {
        symbol,
        exchange,
        quantity: qty,
        averagePrice: avg,
        lastPrice: ltp || avg,
        product: String(h.product || h.productType || 'CNC'),
        isin: h.isin ? String(h.isin) : undefined
      };
    }).filter(h => h.symbol && h.quantity > 0);
  }

  private static normalizeFyersHoldings(raw: unknown): Array<{
    symbol: string;
    exchange: string;
    quantity: number;
    averagePrice: number;
    lastPrice: number;
    product: string;
    isin?: string;
  }> {
    const list = Array.isArray((raw as { holdings?: unknown })?.holdings)
      ? (raw as { holdings: unknown[] }).holdings
      : Array.isArray((raw as { data?: unknown })?.data)
        ? (raw as { data: unknown[] }).data
        : Array.isArray(raw)
          ? raw
          : [];

    return list.map((item) => {
      const h = item as Record<string, unknown>;
      const rawSymbol = String(h.symbol || h.tradingSymbol || h.fyToken || '');
      const symbol = rawSymbol.includes(':')
        ? rawSymbol.split(':')[1].replace(/-EQ$/i, '').replace(/-INDEX$/i, '')
        : rawSymbol.toUpperCase();
      const qty = Number(h.qty ?? h.quantity ?? h.remainingQuantity ?? 0);
      const avg = Number(h.costPrice ?? h.avgPrice ?? h.averagePrice ?? 0);
      const ltp = Number(h.ltp ?? h.lastPrice ?? h.marketVal ?? avg);
      const exchange = rawSymbol.startsWith('BSE:') ? 'BSE' : 'NSE';
      return {
        symbol: symbol.toUpperCase(),
        exchange,
        quantity: qty,
        averagePrice: avg,
        lastPrice: ltp || avg,
        product: String(h.holdingType || h.product || 'CNC'),
        isin: h.isin ? String(h.isin) : undefined
      };
    }).filter((h) => h.symbol && h.quantity > 0);
  }

  static async setAccountEnabled(userId: string, id: string, enabled: boolean) {
    const conn = await prisma.brokerConnection.findFirst({ where: { id, userId } });
    if (!conn) throw new AppError('Account not found', 404);
    const updated = await prisma.brokerConnection.update({
      where: { id },
      data: { isEnabled: enabled, status: enabled ? conn.status : 'DISABLED' }
    });
    return sanitizeAccount(updated);
  }

  static async getExecutionContext(userId: string) {
    const ctx = await ExecutionTargetResolver.getOrCreateContext(userId);
    const full = await prisma.userExecutionContext.findUnique({
      where: { userId },
      include: { activeBrokerConnection: true, activeMcpServerConfig: true }
    });
    await RiskGateService.ensureGlobalControl();
    const controls = await prisma.tradingControl.findMany({
      where: {
        OR: [
          { scope: 'GLOBAL', userId: null },
          { scope: 'USER', userId },
          { scope: 'ACCOUNT', userId }
        ]
      }
    });
    return {
      context: {
        id: ctx.id,
        userId: ctx.userId,
        executionMode: ctx.executionMode,
        version: ctx.version,
        activeBrokerConnectionId: ctx.activeBrokerConnectionId,
        activeMcpServerConfigId: ctx.activeMcpServerConfigId,
        activeAccount: full?.activeBrokerConnection ? sanitizeAccount(full.activeBrokerConnection) : null,
        activeMcp: full?.activeMcpServerConfig ? sanitizeMcp(full.activeMcpServerConfig) : null
      },
      controls: controls.map(c => ({
        id: c.id,
        scope: c.scope,
        liveTradingEnabled: c.liveTradingEnabled,
        killSwitch: c.killSwitch,
        approvalState: c.approvalState,
        maxOrderValue: c.maxOrderValue ? Number(c.maxOrderValue) : null,
        maxDailyOrderValue: c.maxDailyOrderValue ? Number(c.maxDailyOrderValue) : null,
        maxDailyLoss: c.maxDailyLoss ? Number(c.maxDailyLoss) : null,
        requirePaperQualify: c.requirePaperQualify
      })),
      liveTradingEnvEnabled: process.env.LIVE_TRADING_ENABLED === 'true'
    };
  }

  static async updateExecutionContext(userId: string, body: {
    activeBrokerConnectionId?: string | null;
    activeMcpServerConfigId?: string | null;
    executionMode?: 'PAPER' | 'LIVE';
    expectedVersion?: number;
  }) {
    // Mode is owned by TradingModeService (TopBar + PIN). Integrations only select account/MCP.
    if (body.executionMode != null) {
      throw new AppError(
        'executionMode cannot be changed here — use TopBar LIVE/PAPER switch with Trading PIN',
        400,
        {
          reason: 'MODE_VIA_TOPBAR',
          correctiveAction: 'Switch mode from the TopBar ModeSwitchModal (PIN required for LIVE)'
        }
      );
    }
    const updated = await ExecutionTargetResolver.setContext(userId, {
      activeBrokerConnectionId: body.activeBrokerConnectionId,
      activeMcpServerConfigId: body.activeMcpServerConfigId,
      expectedVersion: body.expectedVersion
    });
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'EXECUTION_CONTEXT_UPDATE',
        resource: 'user_execution_contexts',
        details: {
          executionMode: updated.executionMode,
          activeBrokerConnectionId: updated.activeBrokerConnectionId,
          activeMcpServerConfigId: updated.activeMcpServerConfigId,
          version: updated.version
        }
      }
    });
    return this.getExecutionContext(userId);
  }

  static async updateTradingControl(actorUserId: string, body: {
    scope: 'GLOBAL' | 'USER' | 'ACCOUNT';
    userId?: string;
    brokerConnectionId?: string;
    liveTradingEnabled?: boolean;
    killSwitch?: boolean;
    approvalState?: 'NONE' | 'PENDING' | 'APPROVED' | 'REVOKED';
    maxOrderValue?: number;
    maxDailyOrderValue?: number;
    maxDailyLoss?: number;
    requirePaperQualify?: boolean;
    notes?: string;
  }, opts?: { isAdmin?: boolean }) {
    if (body.scope === 'GLOBAL' && !opts?.isAdmin) {
      throw new AppError('Only admins can update GLOBAL trading controls', 403);
    }
    // Users cannot self-approve live trading or enable live for other users
    if (body.approvalState === 'APPROVED' && !opts?.isAdmin) {
      throw new AppError('Only admins can set approvalState=APPROVED', 403);
    }
    if (body.liveTradingEnabled === true && !opts?.isAdmin) {
      throw new AppError('Only admins can enable liveTradingEnabled', 403);
    }
    if (body.userId && body.userId !== actorUserId && !opts?.isAdmin) {
      throw new AppError('Cannot modify another user trading controls', 403);
    }
    const targetUserId = body.scope === 'GLOBAL' ? null : (body.userId || actorUserId);
    const brokerConnectionId = body.scope === 'ACCOUNT' ? body.brokerConnectionId : null;
    if (body.scope === 'ACCOUNT' && !brokerConnectionId) {
      throw new AppError('brokerConnectionId required for ACCOUNT scope', 400);
    }
    if (body.scope === 'ACCOUNT' && brokerConnectionId) {
      const owned = await prisma.brokerConnection.findFirst({
        where: { id: brokerConnectionId, userId: targetUserId || actorUserId }
      });
      if (!owned && !opts?.isAdmin) {
        throw new AppError('Account not found or not owned by user', 404);
      }
    }

    const existing = await prisma.tradingControl.findFirst({
      where: {
        scope: body.scope,
        userId: targetUserId,
        brokerConnectionId: brokerConnectionId || null
      }
    });

    const data = {
      liveTradingEnabled: body.liveTradingEnabled,
      killSwitch: body.killSwitch,
      approvalState: body.approvalState,
      maxOrderValue: body.maxOrderValue,
      maxDailyOrderValue: body.maxDailyOrderValue,
      maxDailyLoss: body.maxDailyLoss,
      requirePaperQualify: body.requirePaperQualify,
      notes: body.notes,
      ...(body.approvalState === 'APPROVED'
        ? { approvedAt: new Date(), approvedBy: actorUserId }
        : {})
    };

    const saved = existing
      ? await prisma.tradingControl.update({
          where: { id: existing.id },
          data: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
        })
      : await prisma.tradingControl.create({
          data: {
            scope: body.scope,
            userId: targetUserId,
            brokerConnectionId,
            liveTradingEnabled: body.liveTradingEnabled ?? false,
            killSwitch: body.killSwitch ?? false,
            approvalState: body.approvalState || 'NONE',
            maxOrderValue: body.maxOrderValue,
            maxDailyOrderValue: body.maxDailyOrderValue,
            maxDailyLoss: body.maxDailyLoss,
            requirePaperQualify: body.requirePaperQualify ?? true,
            notes: body.notes,
            approvedAt: body.approvalState === 'APPROVED' ? new Date() : null,
            approvedBy: body.approvalState === 'APPROVED' ? actorUserId : null
          }
        });

    await prisma.auditLog.create({
      data: {
        userId: actorUserId,
        action: 'TRADING_CONTROL_UPDATE',
        resource: 'trading_controls',
        details: { id: saved.id, scope: saved.scope, liveTradingEnabled: saved.liveTradingEnabled, killSwitch: saved.killSwitch }
      }
    });

    return saved;
  }

  static async featureStatus(userId: string) {
    const [mcpServers, accounts, ctx, globalCtrl] = await Promise.all([
      this.listMcpServers(userId),
      this.listAccounts(userId),
      this.getExecutionContext(userId),
      RiskGateService.ensureGlobalControl()
    ]);

    const selected = accounts.find(a => a.id === ctx.context.activeBrokerConnectionId);
    return {
      backend: 'ok',
      liveTradingEnvEnabled: process.env.LIVE_TRADING_ENABLED === 'true',
      globalLiveEnabled: globalCtrl.liveTradingEnabled,
      killSwitch: globalCtrl.killSwitch,
      mcpServers: mcpServers.map(s => ({
        id: s.id,
        name: s.name,
        health: s.lastHealthStatus,
        latencyMs: s.latencyMs,
        tools: Array.isArray(s.discoveredTools) ? (s.discoveredTools as unknown[]).length : 0
      })),
      accounts: accounts.map(a => ({
        id: a.id,
        broker: a.broker,
        status: a.status,
        providerType: a.providerType,
        selected: a.id === ctx.context.activeBrokerConnectionId
      })),
      executionMode: ctx.context.executionMode,
      selectedAccount: selected || null,
      capabilities: selected?.capabilities || {},
      capabilityCatalog: DHAN_CAPABILITY_REGISTRY
    };
  }
}
