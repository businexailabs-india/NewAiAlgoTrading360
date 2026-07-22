import axios from 'axios';
import { prisma } from '../../config/database';
import { EncryptionService } from '../encryption.service';
import { DhanService, DHAN_IDX_IDS, DHAN_NSE_EQ_IDS } from '../dhan.service';
import { logger } from '../../utils/logger';

const DHAN_BASE = 'https://api.dhan.co/v2';

/** Index / equity underlying → Dhan optionchain request identity */
const UNDERLYING_SCRIP: Record<string, { scrip: number; seg: string }> = {
  NIFTY: { scrip: DHAN_IDX_IDS['NIFTY 50'] ?? 13, seg: 'IDX_I' },
  NIFTY50: { scrip: 13, seg: 'IDX_I' },
  BANKNIFTY: { scrip: DHAN_IDX_IDS['NIFTY BANK'] ?? 25, seg: 'IDX_I' },
  FINNIFTY: { scrip: 27, seg: 'IDX_I' },
  MIDCPNIFTY: { scrip: 442, seg: 'IDX_I' },
  SENSEX: { scrip: DHAN_IDX_IDS.SENSEX ?? 51, seg: 'IDX_I' },
  BANKEX: { scrip: 12, seg: 'IDX_I' }
};

export type DepthQuote = {
  securityId: string;
  strike: number;
  optionType: 'CE' | 'PE';
  ltp: number;
  oi: number;
  previousOi: number;
  iv: number;
  bid: number;
  ask: number;
  bidQty: number;
  askQty: number;
  volume: number;
  change: number;
  changePercent: number;
  greeks?: { delta: number; gamma: number; theta: number; vega: number };
};

export type OptionChainQuoteOverlay = {
  spot: number;
  asOf: string;
  quoteFreshness: 'live' | 'delayed';
  quoteSource: 'dhan_optionchain' | 'dhan_marketfeed' | 'model_overlay' | 'unavailable';
  bySecurityId: Map<string, DepthQuote>;
  byStrikeType: Map<string, DepthQuote>; // `${strike}|CE`
  message?: string;
};

type CacheEntry = { at: number; payload: Omit<OptionChainQuoteOverlay, 'bySecurityId' | 'byStrikeType'> & { rows: DepthQuote[] } };

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = Number(process.env.OPTIONS_QUOTE_CACHE_MS || 3500); // respect ~3s Dhan rate limit
const LIVE_MAX_AGE_MS = Number(process.env.OPTIONS_QUOTE_LIVE_MS || 8000);

function resolveUnderlying(symbol: string): { scrip: number; seg: string } | null {
  const key = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (UNDERLYING_SCRIP[key]) return UNDERLYING_SCRIP[key];
  const eq = DHAN_NSE_EQ_IDS[key];
  if (eq) return { scrip: eq, seg: 'NSE_EQ' };
  return null;
}

async function resolveDhanCredentials(userId?: string): Promise<{ clientId: string; accessToken: string } | null> {
  if (userId) {
    const conn = await prisma.brokerConnection.findFirst({
      where: { userId, broker: 'dhan', isActive: true, isEnabled: true },
      orderBy: { updatedAt: 'desc' }
    });
    if (conn) {
      try {
        const fromBundle = EncryptionService.decryptJson<{ clientId?: string; accessToken?: string }>(
          conn.credentialsEncrypted
        );
        const clientId =
          fromBundle?.clientId ||
          (conn.clientIdEncrypted ? EncryptionService.decrypt(conn.clientIdEncrypted) : '') ||
          (conn.apiKeyEncrypted ? EncryptionService.decrypt(conn.apiKeyEncrypted) : '') ||
          '';
        const accessToken =
          fromBundle?.accessToken ||
          (conn.accessTokenEncrypted ? EncryptionService.decrypt(conn.accessTokenEncrypted) : '') ||
          '';
        if (clientId && accessToken) return { clientId, accessToken };
      } catch (err) {
        logger.warn(`Dhan credential decrypt failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  if (DhanService.isConfigured()) {
    return {
      clientId: process.env.DHAN_CLIENT_ID || '',
      accessToken: process.env.DHAN_ACCESS_TOKEN || ''
    };
  }
  return null;
}

function parseOcPayload(data: unknown): { spot: number; quotes: DepthQuote[] } {
  const root = data as {
    data?: { last_price?: number; oc?: Record<string, { ce?: Record<string, unknown>; pe?: Record<string, unknown> }> };
    last_price?: number;
    oc?: Record<string, { ce?: Record<string, unknown>; pe?: Record<string, unknown> }>;
  };
  const body = root.data || root;
  const oc = body.oc || {};
  const spot = Number(body.last_price || 0);
  const quotes: DepthQuote[] = [];

  for (const [strikeKey, sides] of Object.entries(oc)) {
    const strike = Number(strikeKey);
    if (!Number.isFinite(strike)) continue;
    for (const side of ['ce', 'pe'] as const) {
      const row = sides?.[side];
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const greeksRaw = (r.greeks || {}) as Record<string, number>;
      const ltp = Number(r.last_price ?? 0);
      const prevClose = Number(r.previous_close_price ?? ltp);
      const change = ltp - prevClose;
      const changePercent = prevClose ? (change / prevClose) * 100 : 0;
      const oi = Number(r.oi ?? 0);
      const previousOi = Number(r.previous_oi ?? oi);
      quotes.push({
        securityId: String(r.security_id ?? ''),
        strike,
        optionType: side === 'ce' ? 'CE' : 'PE',
        ltp,
        oi,
        previousOi,
        iv: Number(r.implied_volatility ?? 0),
        bid: Number(r.top_bid_price ?? 0),
        ask: Number(r.top_ask_price ?? 0),
        bidQty: Number(r.top_bid_quantity ?? 0),
        askQty: Number(r.top_ask_quantity ?? 0),
        volume: Number(r.volume ?? 0),
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        greeks:
          greeksRaw.delta != null
            ? {
                delta: Number(greeksRaw.delta),
                gamma: Number(greeksRaw.gamma),
                theta: Number(greeksRaw.theta),
                vega: Number(greeksRaw.vega)
              }
            : undefined
      });
    }
  }
  return { spot, quotes };
}

function toOverlay(quotes: DepthQuote[], spot: number, source: OptionChainQuoteOverlay['quoteSource'], fetchedAt: number): OptionChainQuoteOverlay {
  const bySecurityId = new Map<string, DepthQuote>();
  const byStrikeType = new Map<string, DepthQuote>();
  for (const q of quotes) {
    if (q.securityId) bySecurityId.set(q.securityId, q);
    byStrikeType.set(`${q.strike}|${q.optionType}`, q);
  }
  const age = Date.now() - fetchedAt;
  const quoteFreshness: 'live' | 'delayed' = age <= LIVE_MAX_AGE_MS ? 'live' : 'delayed';
  return {
    spot,
    asOf: new Date(fetchedAt).toISOString(),
    quoteFreshness,
    quoteSource: source,
    bySecurityId,
    byStrikeType
  };
}

/**
 * Fetch Dhan option chain depth (LTP, OI, bid/ask, IV, greeks) and map for overlay.
 * Cached ~3.5s to respect Dhan optionchain rate limit.
 */
export class OptionQuoteService {
  static resolveUnderlyingIdentity(symbol: string) {
    return resolveUnderlying(symbol);
  }

  static async fetchOverlay(params: {
    underlying: string;
    expiry: string;
    userId?: string;
  }): Promise<OptionChainQuoteOverlay> {
    const underlying = params.underlying.toUpperCase();
    const cacheKey = `${underlying}|${params.expiry}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return toOverlay(hit.payload.rows, hit.payload.spot, hit.payload.quoteSource, hit.at);
    }

    const identity = resolveUnderlying(underlying);
    if (!identity) {
      return {
        spot: 0,
        asOf: new Date().toISOString(),
        quoteFreshness: 'delayed',
        quoteSource: 'unavailable',
        bySecurityId: new Map(),
        byStrikeType: new Map(),
        message: `No Dhan underlying mapping for ${underlying}`
      };
    }

    const creds = await resolveDhanCredentials(params.userId);
    if (!creds) {
      return {
        spot: 0,
        asOf: new Date().toISOString(),
        quoteFreshness: 'delayed',
        quoteSource: 'unavailable',
        bySecurityId: new Map(),
        byStrikeType: new Map(),
        message: 'Dhan credentials not available — connect broker or set DHAN_* env'
      };
    }

    try {
      const res = await axios.post(
        `${DHAN_BASE}/optionchain`,
        {
          UnderlyingScrip: identity.scrip,
          UnderlyingSeg: identity.seg,
          Expiry: params.expiry
        },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'access-token': creds.accessToken,
            'client-id': creds.clientId
          },
          timeout: 15000
        }
      );

      const { spot, quotes } = parseOcPayload(res.data);
      if (!quotes.length) {
        return {
          spot,
          asOf: new Date().toISOString(),
          quoteFreshness: 'delayed',
          quoteSource: 'unavailable',
          bySecurityId: new Map(),
          byStrikeType: new Map(),
          message: 'Dhan optionchain returned empty OC'
        };
      }

      const at = Date.now();
      cache.set(cacheKey, {
        at,
        payload: {
          spot,
          asOf: new Date(at).toISOString(),
          quoteFreshness: 'live',
          quoteSource: 'dhan_optionchain',
          rows: quotes
        }
      });
      return toOverlay(quotes, spot, 'dhan_optionchain', at);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Dhan optionchain failed for ${underlying} ${params.expiry}: ${message}`);
      // Fallback: batch marketfeed/quote for tokens already in master (near-ATM handled by caller volume)
      return {
        spot: 0,
        asOf: new Date().toISOString(),
        quoteFreshness: 'delayed',
        quoteSource: 'unavailable',
        bySecurityId: new Map(),
        byStrikeType: new Map(),
        message: `Option chain quote unavailable: ${message}`
      };
    }
  }

  /** Batch marketfeed/quote for NSE_FNO security ids (fallback / futures). */
  static async fetchMarketfeedQuotes(
    tokens: string[],
    userId?: string,
    segment: 'NSE_FNO' | 'BSE_FNO' = 'NSE_FNO'
  ): Promise<Map<string, { ltp: number; oi: number; bid: number; ask: number }>> {
    const out = new Map<string, { ltp: number; oi: number; bid: number; ask: number }>();
    const creds = await resolveDhanCredentials(userId);
    if (!creds || !tokens.length) return out;

    const ids = tokens.map((t) => Number(t)).filter((n) => Number.isFinite(n) && n > 0);
    const chunkSize = 100;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      try {
        const res = await axios.post(
          `${DHAN_BASE}/marketfeed/quote`,
          { [segment]: chunk },
          {
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
              'access-token': creds.accessToken,
              'client-id': creds.clientId
            },
            timeout: 12000
          }
        );
        const bag = res.data?.data?.[segment] || res.data?.[segment] || {};
        for (const [sid, row] of Object.entries(bag as Record<string, Record<string, unknown>>)) {
          const depth = (row.depth || row.market_depth || {}) as {
            buy?: Array<{ price?: number }>;
            sell?: Array<{ price?: number }>;
          };
          out.set(String(sid), {
            ltp: Number(row.last_price ?? row.ltp ?? 0),
            oi: Number(row.oi ?? row.open_interest ?? 0),
            bid: Number(depth.buy?.[0]?.price ?? row.top_bid_price ?? 0),
            ask: Number(depth.sell?.[0]?.price ?? row.top_ask_price ?? 0)
          });
        }
      } catch (err) {
        logger.warn(`marketfeed/quote chunk failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return out;
  }

  /** Pure helper for unit tests */
  static parseOptionChainResponseForTest(data: unknown) {
    return parseOcPayload(data);
  }

  static clearCacheForTest() {
    cache.clear();
  }
}
