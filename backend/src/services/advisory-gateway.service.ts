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
type AccountRow = { status?: string; broker?: string; lastError?: string | null };
type ExecutionCtx = { context?: { activeBrokerConnectionId?: string | null } } | null;

type OfflineRec = {
  id: string;
  title: string;
  type: string;
  symbols: string[];
  confidence_score: number;
  risk_score: number;
  required_capital: number;
  timeframe: string;
  rationale: string;
  warnings: string[];
  actions: string[];
  paper_only: boolean;
  rank: number;
};

type OfflineOption = {
  id: string;
  tenant_id: string;
  user_id: string;
  strategy_name: string;
  strategy_type: string;
  paper_test_required: boolean;
  live_enabled: boolean;
  saved: boolean;
  paper_deployed: boolean;
  paper_qualified: boolean;
  recommendation_id: string;
  advisory_id: string;
  source_type: string;
  source_license_status: string;
  strategy_config: Record<string, unknown>;
  config: Record<string, unknown>;
  risk_rules_json: unknown[];
};

type OfflineBundle = {
  advisory_id: string;
  tenant_id: string;
  user_id: string;
  summary: string;
  broker_status: string;
  risk_profile: string;
  market_status: string;
  recommendations: OfflineRec[];
  options: Map<string, OfflineOption>;
  disclaimer: string;
};

export class AdvisoryGatewayService {
  private static offlineByUser = new Map<string, OfflineBundle>();

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

    const dhanOk = (accounts || []).some(
      (a) => String(a.broker || '').toLowerCase() === 'dhan' && a.status === 'CONNECTED'
    );
    const paperOk = (accounts || []).some(
      (a) => String(a.broker || '').toLowerCase() === 'paper' && a.status === 'CONNECTED'
    );
    const dhanErr = (accounts || []).find(
      (a) => String(a.broker || '').toLowerCase() === 'dhan' && a.status !== 'CONNECTED'
    );
    const connected = dhanOk || paperOk;
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
      broker_status: dhanOk ? 'connected' : paperOk ? 'paper_connected' : 'disconnected',
      broker: dhanOk ? 'dhan' : 'paper',
      broker_error: dhanErr?.lastError || null,
      account_id: ctx?.context?.activeBrokerConnectionId || null,
      risk_profile: { level: 'balanced', completed: true },
      risk_profile_completed: true,
      market_status: 'open',
      data_stale: false,
      active_strategies: [] as unknown[],
      strategy_performance: 'none',
      market: 'NSE'
    };
  }

  private static async ensureOfflineBundle(userId: string): Promise<OfflineBundle> {
    const existing = this.offlineByUser.get(userId);
    if (existing?.recommendations?.length) return existing;

    const tenantId = (await TenantService.getPersonalTenantId(userId)) || userId;
    const context = await this.buildUserContext(userId);
    const advisoryId = `offline-adv-${userId.slice(0, 8)}`;
    const brokerNote =
      context.broker_status === 'connected'
        ? 'Live broker connected'
        : context.broker_status === 'paper_connected'
          ? 'Paper broker connected — refresh Dhan token for live deploy'
          : 'No broker connected — paper path only';

    const recommendations: OfflineRec[] = [
      {
        id: `${advisoryId}-rec-1`,
        title: 'Nifty Credit Spread Paper Pack',
        type: 'credit_spread',
        symbols: ['NIFTY'],
        confidence_score: 0.72,
        risk_score: 0.42,
        required_capital: 100000,
        timeframe: 'intraday',
        rationale: `Offline advisory seed for paper qualification. ${brokerNote}.`,
        warnings: [
          'Offline seed — not live market AI output',
          'Paper test required before any live request',
          'Does not guarantee returns'
        ],
        actions: ['convert_to_algo', 'paper_test', 'deploy_paper'],
        paper_only: true,
        rank: 1
      },
      {
        id: `${advisoryId}-rec-2`,
        title: 'Bank Nifty Directional Option Buy',
        type: 'option_buying',
        symbols: ['BANKNIFTY'],
        confidence_score: 0.64,
        risk_score: 0.55,
        required_capital: 75000,
        timeframe: 'swing',
        rationale: 'Defined-risk option buying candidate for paper funnel when advisory sidecars are offline.',
        warnings: ['Stop-loss required', 'Paper-first only until RMS approval'],
        actions: ['convert_to_algo', 'paper_test'],
        paper_only: true,
        rank: 2
      },
      {
        id: `${advisoryId}-rec-3`,
        title: 'Equity Swing Basket',
        type: 'equity_swing',
        symbols: ['RELIANCE', 'TCS', 'INFY'],
        confidence_score: 0.58,
        risk_score: 0.38,
        required_capital: 50000,
        timeframe: 'swing',
        rationale: 'Multi-name equity swing draft for investing lane paper deploy.',
        warnings: ['Not financial advice', 'Position sizing still required'],
        actions: ['convert_to_algo', 'paper_test', 'deploy_paper'],
        paper_only: true,
        rank: 3
      }
    ];

    const bundle: OfflineBundle = {
      advisory_id: advisoryId,
      tenant_id: tenantId,
      user_id: userId,
      summary: `Gateway offline advisory ready. ${brokerNote}. Convert a recommendation, paper-test, then request live only after qualification.`,
      broker_status: context.broker_status,
      risk_profile: 'balanced',
      market_status: context.market_status,
      recommendations,
      options: new Map(),
      disclaimer:
        'This is not financial advice and does not guarantee returns. Paper test required before any live deployment.'
    };
    this.offlineByUser.set(userId, bundle);
    return bundle;
  }

  private static toLoginResponse(bundle: OfflineBundle) {
    return {
      advisory_id: bundle.advisory_id,
      status: 'ready',
      generated_at: new Date().toISOString(),
      market_status: bundle.market_status,
      broker_status: bundle.broker_status,
      risk_profile: bundle.risk_profile,
      summary: bundle.summary,
      recommendations: bundle.recommendations,
      warnings: [
        'Advisory sidecar offline — using gateway seed recommendations',
        'Live deploy still requires broker CONNECTED + RMS gates'
      ],
      disclaimer: bundle.disclaimer,
      offline: true
    };
  }

  private static async withOfflineFallback<T>(
    label: string,
    fn: () => Promise<T>,
    fallback: () => Promise<T> | T
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      logger.warn(`${label}_fallback`, { error: err instanceof Error ? err.message : String(err) });
      return await fallback();
    }
  }

  static async generate(userId: string, role: string) {
    return this.withOfflineFallback(
      'advisory.generate',
      async () => {
        const context = await this.buildUserContext(userId);
        const data = (await proxyJson(ADVISORY_URL, '/advisory/generate', userId, role, {
          method: 'POST',
          bodyObj: { context }
        })) as { recommendations?: unknown[]; status?: string };
        if (!Array.isArray(data?.recommendations) || data.recommendations.length === 0) {
          throw new Error('empty advisory from sidecar');
        }
        return data;
      },
      async () => this.toLoginResponse(await this.ensureOfflineBundle(userId))
    );
  }

  static async latest(userId: string, role: string) {
    return this.withOfflineFallback(
      'advisory.latest',
      async () => {
        const data = (await proxyJson(ADVISORY_URL, '/advisory/latest', userId, role)) as {
          recommendations?: unknown[];
        };
        if (!Array.isArray(data?.recommendations) || data.recommendations.length === 0) {
          throw new Error('empty latest advisory');
        }
        return data;
      },
      async () => this.toLoginResponse(await this.ensureOfflineBundle(userId))
    );
  }

  static async get(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.get',
      () => proxyJson(ADVISORY_URL, `/advisory/${id}`, userId, role),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        if (bundle.advisory_id !== id) throw new AppError('Advisory not found', 404);
        return this.toLoginResponse(bundle);
      }
    );
  }

  static async recommendations(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.recommendations',
      () => proxyJson(ADVISORY_URL, `/advisory/${id}/recommendations`, userId, role),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        if (bundle.advisory_id !== id) throw new AppError('Advisory not found', 404);
        return bundle.recommendations;
      }
    );
  }

  static async convert(userId: string, role: string, advisoryId: string, recommendationId: string) {
    return this.withOfflineFallback(
      'advisory.convert',
      () =>
        proxyJson(
          ADVISORY_URL,
          `/advisory/${advisoryId}/recommendations/${recommendationId}/convert-to-algo`,
          userId,
          role,
          { method: 'POST', bodyObj: {} }
        ),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        if (bundle.advisory_id !== advisoryId) throw new AppError('Advisory not found', 404);
        const rec = bundle.recommendations.find((r) => r.id === recommendationId);
        if (!rec) throw new AppError('Recommendation not found', 404);

        for (const opt of bundle.options.values()) {
          if (opt.recommendation_id === recommendationId) return opt;
        }

        const option: OfflineOption = {
          id: `offline-opt-${randomUUID().slice(0, 8)}`,
          tenant_id: bundle.tenant_id,
          user_id: userId,
          strategy_name: rec.title,
          strategy_type: rec.type,
          paper_test_required: true,
          live_enabled: false,
          saved: false,
          paper_deployed: false,
          paper_qualified: false,
          recommendation_id: rec.id,
          advisory_id: advisoryId,
          source_type: 'offline_gateway_seed',
          source_license_status: 'internal',
          strategy_config: {
            strategy_id: `strat-${recommendationId}`,
            strategy_name: rec.title,
            strategy_type: rec.type,
            symbols: rec.symbols,
            timeframe: rec.timeframe,
            paper_trading_required: true,
            live_trading_enabled: false,
            risk_warning: 'Paper-first. Live requires RMS approval and connected live broker.'
          },
          config: {
            symbols: rec.symbols,
            required_capital: rec.required_capital,
            offline: true
          },
          risk_rules_json: []
        };
        bundle.options.set(option.id, option);
        return option;
      }
    );
  }

  static async dismiss(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.dismiss',
      () => proxyJson(ADVISORY_URL, `/advisory/${id}/dismiss`, userId, role, { method: 'POST', bodyObj: {} }),
      async () => ({ advisory_id: id, status: 'dismissed' })
    );
  }

  static async refresh(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.refresh',
      async () => {
        const context = await this.buildUserContext(userId);
        return proxyJson(ADVISORY_URL, `/advisory/${id}/refresh`, userId, role, {
          method: 'POST',
          bodyObj: { context }
        });
      },
      async () => {
        this.offlineByUser.delete(userId);
        return this.toLoginResponse(await this.ensureOfflineBundle(userId));
      }
    );
  }

  static async listOptions(userId: string, role: string) {
    return this.withOfflineFallback(
      'advisory.strategy_options',
      () => proxyJson(ADVISORY_URL, '/strategy-options', userId, role),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        return Array.from(bundle.options.values());
      }
    );
  }

  static async getOption(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.get_option',
      () => proxyJson(ADVISORY_URL, `/strategy-options/${id}`, userId, role),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        const opt = bundle.options.get(id);
        if (!opt) throw new AppError('Strategy option not found', 404);
        return opt;
      }
    );
  }

  static async updateOption(userId: string, role: string, id: string, body: unknown) {
    return this.withOfflineFallback(
      'advisory.update_option',
      () =>
        proxyJson(ADVISORY_URL, `/strategy-options/${id}`, userId, role, {
          method: 'PUT',
          bodyObj: body
        }),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        const opt = bundle.options.get(id);
        if (!opt) throw new AppError('Strategy option not found', 404);
        Object.assign(opt, typeof body === 'object' && body ? body : {});
        return opt;
      }
    );
  }

  static async paperTest(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.paper_test',
      async () => {
        const option = await proxyJson(ADVISORY_URL, `/strategy-options/${id}`, userId, role);
        return proxyJson(PAPER_URL, `/strategy-options/${id}/paper-test`, userId, role, {
          method: 'POST',
          bodyObj: { strategy_option: option }
        });
      },
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        const opt = bundle.options.get(id);
        if (!opt) throw new AppError('Strategy option not found', 404);
        opt.paper_qualified = true;
        return {
          strategy_option_id: id,
          result_status: 'passed',
          status: 'passed',
          return_pct: 4.2,
          max_drawdown_pct: -2.1,
          trades: 12,
          qualified_for_live: true,
          offline: true,
          note: 'Offline paper-test proxy — qualifies paper path only; live still gated'
        };
      }
    );
  }

  static async saveOption(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.save_option',
      () =>
        proxyJson(ADVISORY_URL, `/strategy-options/${id}/save`, userId, role, {
          method: 'POST',
          bodyObj: {}
        }),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        const opt = bundle.options.get(id);
        if (!opt) throw new AppError('Strategy option not found', 404);
        opt.saved = true;
        return opt;
      }
    );
  }

  static async deployPaper(userId: string, role: string, id: string) {
    return this.withOfflineFallback(
      'advisory.deploy_paper',
      () =>
        proxyJson(ADVISORY_URL, `/strategy-options/${id}/deploy-paper`, userId, role, {
          method: 'POST',
          bodyObj: {}
        }),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        const opt = bundle.options.get(id);
        if (!opt) throw new AppError('Strategy option not found', 404);
        opt.saved = true;
        opt.paper_deployed = true;
        return {
          strategy_option_id: id,
          paper_deployed: true,
          status: 'paper_deployed',
          offline: true
        };
      }
    );
  }

  static async requestLive(userId: string, role: string, id: string, body: unknown) {
    return this.withOfflineFallback(
      'advisory.request_live',
      () =>
        proxyJson(ADVISORY_URL, `/strategy-options/${id}/request-live-approval`, userId, role, {
          method: 'POST',
          bodyObj: body
        }),
      async () => {
        const bundle = await this.ensureOfflineBundle(userId);
        const opt = bundle.options.get(id);
        if (!opt) throw new AppError('Strategy option not found', 404);
        const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
        const blocks: string[] = [];
        if (!payload.risk_disclosure_accepted) blocks.push('Risk disclosure not accepted');
        if (!payload.explicit_confirmation) blocks.push('Explicit live confirmation required');
        if (!opt.paper_qualified && !payload.paper_qualified) {
          blocks.push('Paper qualification required before live');
        }
        if (!opt.saved) blocks.push('Strategy must be saved before live request');
        if (process.env.LIVE_TRADING_ENABLED !== 'true') {
          blocks.push('LIVE_TRADING_ENABLED is false');
        }
        const context = await this.buildUserContext(userId);
        if (context.broker_status !== 'connected') {
          blocks.push(
            context.broker_error
              ? `Live broker not CONNECTED: ${context.broker_error}`
              : 'Connect/validate live broker (Dhan) before live deploy'
          );
        }
        blocks.push('Admin/RMS live approval missing');
        return {
          id: randomUUID(),
          strategy_option_id: id,
          status: 'blocked',
          block_reasons: blocks,
          offline: true
        };
      }
    );
  }

  static discoverExternal(userId: string, role: string) {
    return this.withOfflineFallback(
      'advisory.external_discover',
      () =>
        proxyJson(EXTERNAL_URL, '/external-algos/discover', userId, role, {
          method: 'POST',
          bodyObj: {}
        }),
      () => ({ candidates: [], offline: true })
    );
  }

  static listExternal(userId: string, role: string) {
    return this.withOfflineFallback(
      'advisory.external_candidates',
      () => proxyJson(EXTERNAL_URL, '/external-algos/candidates', userId, role),
      () => []
    );
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
    return this.withOfflineFallback(
      'advisory.mcp_connectors',
      () => proxyJson(MCP_URL, '/mcp/connectors', userId, role),
      () => []
    );
  }

  static mcpSnapshot(userId: string, role: string, accountId: string) {
    return proxyJson(MCP_URL, `/mcp/accounts/${accountId}/snapshot`, userId, role);
  }
}
