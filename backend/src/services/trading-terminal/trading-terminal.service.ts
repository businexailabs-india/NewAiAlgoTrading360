import { randomUUID } from 'crypto';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import { OrderExecutionService } from '../order-execution.service';
import { RiskGateService } from '../risk-gate.service';
import {
  SEED_INSTRUMENTS,
  mapDbInstrument,
  productForInstrument,
  validateLotSize,
  parseFoContractSymbol,
  estimateOptionPremium,
  type CatalogInstrument,
  type InstrumentType
} from '../../libs/trading/instrument-catalog';
import {
  estimateCharges,
  estimateMargin,
  estimateMaxLoss,
  oppositeSide,
  type ChartOrderActionRequest,
  type OrderPreviewRequest
} from '../../libs/trading/order-ticket';
import { hasPermission, roleFromUserRole, permissionForInstrumentType, type TradePermission } from '../../libs/trading/permissions';
import { MarketService } from '../market.service';

async function audit(
  userId: string,
  eventType: string,
  entityType: string,
  detail: string,
  entityId?: string,
  meta?: object
) {
  await prisma.tradeComplianceAudit.create({
    data: { userId, eventType, entityType, entityId, detail, meta: meta || undefined }
  });
}

function liveEnvEnabled() {
  return process.env.LIVE_TRADING_ENABLED === 'true';
}

export class TradingTerminalService {
  static async ensureCatalogSeeded() {
    const count = await prisma.tradeInstrument.count();
    if (count > 0) return;
    for (const s of SEED_INSTRUMENTS) {
      await prisma.tradeInstrument.create({
        data: {
          symbol: s.symbol,
          displayName: s.display_name,
          exchange: s.exchange,
          segment: s.segment,
          assetClass: s.asset_class,
          instrumentType: s.instrument_type,
          tradable: s.tradable,
          directTradingAllowed: s.direct_trading_allowed,
          lotSize: s.lot_size,
          tickSize: s.tick_size,
          expiry: s.expiry ?? null,
          strike: s.strike ?? null,
          optionType: s.option_type ?? null,
          underlyingSymbol: s.underlying_symbol ?? null,
          brokerSymbol: s.broker_symbol ?? null,
          providerId: s.provider_id ?? null,
          tradingStatus: s.trading_status
        }
      });
    }
  }

  static catalogFromMarketQuery(query: string, limit = 20): CatalogInstrument[] {
    const hits = MarketService.searchSymbols(query).slice(0, Math.min(50, Math.max(limit, 20)));
    return hits.map((hit) => {
      const symbol = String(hit.symbol || '')
        .trim()
        .toUpperCase();
      const exchangeRaw = String(hit.exchange || 'NSE').toUpperCase();
      const isIndex = exchangeRaw === 'INDEX';
      const isNfo = exchangeRaw === 'NFO';
      const isMcx = exchangeRaw === 'MCX';
      const fo = parseFoContractSymbol(symbol);
      let instrumentType: InstrumentType = 'STOCK';
      let direct = true;
      let assetClass = 'EQUITY';
      if (isMcx && !(fo?.strike || fo?.optionType || fo?.isFuture || /FUT$/i.test(symbol))) {
        instrumentType = 'COMMODITY';
        direct = false;
        assetClass = 'COMMODITY';
      } else if (isMcx || (fo && isMcx)) {
        instrumentType = fo?.isFuture || /FUT/i.test(symbol) ? 'COMMODITY_FUTURE' : 'COMMODITY_OPTION';
        assetClass = 'DERIVATIVE';
      } else if (isIndex && !(fo?.strike || fo?.optionType || fo?.isFuture)) {
        instrumentType = 'INDEX';
        direct = false;
        assetClass = 'INDEX';
      } else if (isNfo || fo?.optionType || fo?.isFuture || /[-_]?(CE|PE)$/i.test(symbol)) {
        instrumentType = fo?.isFuture || /FUT/i.test(symbol) ? 'INDEX_FUTURE' : 'INDEX_OPTION';
        assetClass = 'DERIVATIVE';
      }
      const optionType = fo?.optionType || (/CE$/i.test(symbol) ? 'CE' : /PE$/i.test(symbol) ? 'PE' : null);
      const strike = fo?.strike ?? null;
      const underlyingSymbol =
        fo?.underlying ||
        (isIndex || isNfo || isMcx ? symbol.replace(/(\d{3,6})?(CE|PE|FUT)$/i, '') || symbol : null);
      const lotSize = fo?.lotSize || (instrumentType.includes('OPTION') || instrumentType.includes('FUTURE') ? 25 : 1);
      return {
        instrument_id: `mkt-${exchangeRaw}-${symbol}`,
        symbol,
        display_name:
          strike && optionType ? `${underlyingSymbol} ${strike} ${optionType}` : String(hit.name || symbol),
        exchange: isMcx ? 'MCX' : isIndex || isNfo ? 'NSE' : exchangeRaw,
        segment: isMcx ? 'MCX' : isIndex ? 'IDX' : isNfo ? 'NFO' : 'EQ',
        asset_class: assetClass,
        instrument_type: instrumentType,
        tradable: true,
        direct_trading_allowed: direct,
        lot_size: lotSize,
        tick_size: 0.05,
        expiry: null,
        strike,
        option_type: optionType,
        underlying_symbol: underlyingSymbol,
        broker_symbol: symbol,
        provider_id: null,
        trading_status: 'OPEN'
      } satisfies CatalogInstrument;
    });
  }

  static async searchInstruments(query: string, limit = 20): Promise<CatalogInstrument[]> {
    const q = (query || '').trim();
    const fallback = () => this.catalogFromMarketQuery(q, limit);
    try {
      await Promise.race([
        this.ensureCatalogSeeded(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('catalog seed timeout')), 1500))
      ]).catch(() => undefined);
      void this.syncMarketSearchHits(q).catch(() => undefined);
      const rows = await Promise.race([
        prisma.tradeInstrument.findMany({
          where: q
            ? {
                OR: [
                  { symbol: { contains: q, mode: 'insensitive' } },
                  { displayName: { contains: q, mode: 'insensitive' } },
                  { underlyingSymbol: { contains: q, mode: 'insensitive' } },
                  { brokerSymbol: { contains: q, mode: 'insensitive' } }
                ]
              }
            : undefined,
          take: Math.min(50, Math.max(limit, 20)),
          orderBy: [{ instrumentType: 'asc' }, { symbol: 'asc' }]
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('instrument search timeout')), 2000))
      ]);
      const repaired = await Promise.all(rows.map((r) => this.repairFoInstrument(r).catch(() => r)));
      const mapped = repaired.map(mapDbInstrument);
      return mapped.length ? mapped : fallback();
    } catch {
      return fallback();
    }
  }

  /** Pull market-search hits into trade_instruments so terminal search is not limited to the tiny seed. */
  private static async syncMarketSearchHits(query: string) {
    const q = (query || '').trim();
    if (q.length < 1) return;
    const { MarketService } = await import('../market.service');
    const hits = MarketService.searchSymbols(q).slice(0, 25);
    for (const hit of hits) {
      const symbol = String(hit.symbol || '')
        .trim()
        .toUpperCase();
      if (!symbol) continue;
      const exchangeRaw = String(hit.exchange || 'NSE').toUpperCase();
      const isIndex = exchangeRaw === 'INDEX';
      const isNfo = exchangeRaw === 'NFO';
      const isMcx = exchangeRaw === 'MCX';
      const exchange = isMcx ? 'MCX' : isIndex || isNfo ? 'NSE' : exchangeRaw;
      const segment = isMcx ? 'MCX' : isIndex ? 'IDX' : isNfo ? 'NFO' : 'EQ';
      const fo = parseFoContractSymbol(symbol);
      let instrumentType: InstrumentType = 'STOCK';
      let direct = true;
      let assetClass = 'EQUITY';
      if (isMcx && !(fo?.strike || fo?.optionType || fo?.isFuture || /FUT$/i.test(symbol))) {
        instrumentType = 'COMMODITY';
        direct = false;
        assetClass = 'COMMODITY';
      } else if (isMcx) {
        instrumentType = fo?.isFuture || /FUT/i.test(symbol) ? 'COMMODITY_FUTURE' : 'COMMODITY_OPTION';
        assetClass = 'DERIVATIVE';
      } else if (isIndex && !(fo?.strike || fo?.optionType || fo?.isFuture)) {
        instrumentType = 'INDEX';
        direct = false;
        assetClass = 'INDEX';
      } else if (isNfo || fo?.optionType || fo?.isFuture || /[-_]?(CE|PE)$/i.test(symbol)) {
        instrumentType = fo?.isFuture || /FUT/i.test(symbol) ? 'INDEX_FUTURE' : 'INDEX_OPTION';
        assetClass = 'DERIVATIVE';
      } else if (/FUT/i.test(symbol)) {
        instrumentType = 'INDEX_FUTURE';
        assetClass = 'DERIVATIVE';
      }

      const optionType = fo?.optionType || (/CE$/i.test(symbol) ? 'CE' : /PE$/i.test(symbol) ? 'PE' : null);
      const strike = fo?.strike ?? null;
      const underlyingSymbol =
        fo?.underlying ||
        (isIndex || isNfo || isMcx ? symbol.replace(/(\d{3,6})?(CE|PE|FUT)$/i, '') || symbol : null);
      const lotSize = fo?.lotSize || (instrumentType.includes('OPTION') || instrumentType.includes('FUTURE') ? 25 : 1);
      const displayName =
        strike && optionType
          ? `${underlyingSymbol} ${strike} ${optionType}`
          : String(hit.name || symbol);

      const existing = await prisma.tradeInstrument.findFirst({
        where: {
          symbol,
          exchange,
          instrumentType,
          optionType: optionType ?? undefined
        }
      });
      if (existing) {
        const needsRepair =
          (strike != null && existing.strike == null) ||
          (underlyingSymbol && existing.underlyingSymbol !== underlyingSymbol) ||
          (optionType && existing.optionType !== optionType) ||
          (lotSize > 1 && existing.lotSize !== lotSize) ||
          existing.displayName !== displayName;
        if (needsRepair) {
          await prisma.tradeInstrument.update({
            where: { id: existing.id },
            data: {
              displayName,
              strike: strike ?? existing.strike,
              optionType: optionType ?? existing.optionType,
              underlyingSymbol: underlyingSymbol || existing.underlyingSymbol,
              lotSize: lotSize > 1 ? lotSize : existing.lotSize
            }
          });
        }
        continue;
      }
      await prisma.tradeInstrument.create({
        data: {
          symbol,
          displayName,
          exchange,
          segment,
          assetClass,
          instrumentType,
          tradable: true,
          directTradingAllowed: direct,
          lotSize,
          tickSize: 0.05,
          strike,
          optionType,
          underlyingSymbol,
          tradingStatus: 'OPEN'
        }
      });
    }
  }

  static async getInstrument(instrumentId: string): Promise<CatalogInstrument> {
    await this.ensureCatalogSeeded();
    let row = await prisma.tradeInstrument.findUnique({ where: { id: instrumentId } });
    if (!row) throw new AppError('Instrument not found', 404);
    row = await this.repairFoInstrument(row);
    return mapDbInstrument(row);
  }

  /** Backfill strike / underlying / lot when compact F&O symbols were synced incorrectly. */
  private static async repairFoInstrument<
    T extends {
      id: string;
      symbol: string;
      displayName: string;
      strike: number | null;
      optionType: string | null;
      underlyingSymbol: string | null;
      lotSize: number;
      instrumentType: string;
    }
  >(row: T): Promise<T> {
    const fo = parseFoContractSymbol(row.symbol);
    if (!fo) return row;
    const needs =
      (fo.strike != null && row.strike == null) ||
      row.underlyingSymbol !== fo.underlying ||
      (fo.optionType && row.optionType !== fo.optionType) ||
      (fo.lotSize > 1 && row.lotSize !== fo.lotSize);
    if (!needs) return row;
    const displayName =
      fo.strike && fo.optionType
        ? `${fo.underlying} ${fo.strike} ${fo.optionType}`
        : row.displayName;
    const updated = await prisma.tradeInstrument.update({
      where: { id: row.id },
      data: {
        displayName,
        strike: fo.strike ?? row.strike,
        optionType: fo.optionType ?? row.optionType,
        underlyingSymbol: fo.underlying,
        lotSize: fo.lotSize > 1 ? fo.lotSize : row.lotSize
      }
    });
    return updated as unknown as T;
  }

  /** Option/future contract card: strike, spot, estimated premium (paper). */
  static async getContractQuote(
    userId: string,
    instrumentId: string,
    opts?: { expiry?: string; kind?: 'WEEKLY' | 'MONTHLY' | 'ALL' }
  ) {
    const inst = await this.getInstrument(instrumentId);
    const fo = parseFoContractSymbol(inst.symbol);
    const underlying = (inst.underlying_symbol || fo?.underlying || '').toUpperCase();
    const strike = Number(inst.strike ?? fo?.strike ?? 0) || null;
    const optionType = (inst.option_type || fo?.optionType || null) as 'CE' | 'PE' | null;
    const isOption = Boolean(optionType && strike);

    let expiryCalendar: Awaited<
      ReturnType<(typeof import('../options/instrument-master.service'))['InstrumentMasterService']['listExpiryCalendar']>
    > | null = null;
    // Prefer explicit UI expiry; ignore stale instrument.expiry when caller passes one
    let expiry = opts?.expiry || null;
    if (!expiry) expiry = inst.expiry || null;
    let expiryKind: 'WEEKLY' | 'MONTHLY' | null = null;
    let expiryLabel: string | null = null;

    if (underlying) {
      try {
        const { InstrumentMasterService } = await import('../options/instrument-master.service');
        expiryCalendar = await InstrumentMasterService.listExpiryCalendar(underlying);
        if (!expiry) {
          const filtered =
            opts?.kind && opts.kind !== 'ALL'
              ? expiryCalendar.calendar.filter((e) => e.kind === opts.kind)
              : expiryCalendar.calendar;
          expiry = filtered[0]?.date || expiryCalendar.expiries[0] || null;
        }
        const meta = expiryCalendar.calendar.find((e) => e.date === expiry);
        expiryKind = meta?.kind || null;
        expiryLabel = meta?.label || null;
      } catch {
        expiryCalendar = null;
      }
    }

    let spot: number | null = null;
    let spotChange = 0;
    let spotChangePercent = 0;
    let spotSource: string | undefined;
    if (underlying) {
      try {
        const { MarketService } = await import('../market.service');
        const q = await MarketService.getQuote(underlying, userId);
        spot = q.price;
        spotChange = q.change;
        spotChangePercent = q.changePercent;
        spotSource = q.source;
      } catch {
        spot = null;
      }
    }

    let premium: number | null = null;
    let intrinsic: number | null = null;
    let timeValue: number | null = null;
    let premiumSource: string | null = null;

    if (isOption && spot && spot > 0 && strike && optionType) {
      const selectedExpiry = expiry;

      // 1) Prefer live Dhan option-chain LTP when credentials work
      if (selectedExpiry) {
        try {
          const { OptionQuoteService } = await import('../options/option-quote.service');
          const overlay = await OptionQuoteService.fetchOverlay({
            underlying,
            expiry: selectedExpiry,
            userId
          });
          const live = overlay.byStrikeType.get(`${strike}|${optionType}`);
          if (live && live.ltp > 0) {
            premium = live.ltp;
            premiumSource = 'broker';
            if (overlay.spot > 0) {
              spot = overlay.spot;
              spotSource = 'dhan';
            }
          }
        } catch {
          /* continue */
        }
      }

      // 2) Chain / BS model for this expiry + strike
      if (premium == null) {
        try {
          const { OptionsChainService } = await import('../options/options-chain.service');
          const chain = await OptionsChainService.getChain({
            underlying,
            expiry: selectedExpiry || undefined,
            kind: opts?.kind,
            userId,
            includeGreeks: false
          });
          if ('rows' in chain && Array.isArray(chain.rows)) {
            const row = chain.rows.find((r: { strike: number }) => r.strike === strike);
            const leg = optionType === 'CE' ? row?.ce : row?.pe;
            if (leg && Number(leg.ltp) > 0) {
              premium = Number(leg.ltp);
              premiumSource = leg.quoteSource === 'broker' ? 'broker' : 'bs-model';
            }
            if (!opts?.expiry && 'expiry' in chain && chain.expiry) {
              expiry = String(chain.expiry);
            }
            if ('expiry_kind' in chain) expiryKind = (chain.expiry_kind as typeof expiryKind) || expiryKind;
            if ('expiry_label' in chain) expiryLabel = (chain.expiry_label as string) || expiryLabel;
          } else if ('contracts' in chain && Array.isArray((chain as { contracts?: unknown[] }).contracts)) {
            const hit = (
              chain as {
                contracts: Array<{ strike: number; optionType: string; ltp: number; expiry?: string }>;
              }
            ).contracts.find((c) => c.strike === strike && c.optionType === optionType);
            if (hit && hit.ltp > 0) {
              premium = hit.ltp;
              premiumSource = 'bs-model';
              if (!opts?.expiry && hit.expiry) expiry = hit.expiry;
            }
          }
        } catch {
          /* fall through to model */
        }
      }

      // 3) Direct BS fallback with correct DTE + India VIX when available
      if (premium == null) {
        const { estimateIndexOptionIv, daysToExpiry } = await import('../options/greeks.service');
        const dte = selectedExpiry
          ? daysToExpiry(new Date(`${selectedExpiry}T15:30:00+05:30`))
          : 7;
        let indiaVix: number | null = null;
        try {
          const { MarketService } = await import('../market.service');
          const vixQ = await MarketService.getQuote('INDIAVIX', userId);
          if (vixQ.price > 0 && vixQ.price < 80) indiaVix = vixQ.price;
        } catch {
          /* optional */
        }
        const iv = estimateIndexOptionIv(spot, strike, dte, optionType, { indiaVix });
        const est = estimateOptionPremium(spot, strike, optionType, iv, {
          expiry: selectedExpiry,
          daysToExpiry: dte
        });
        premium = est.premium;
        intrinsic = est.intrinsic;
        timeValue = est.timeValue;
        premiumSource = indiaVix != null ? 'bs-model+vix' : 'bs-model';
      } else {
        const est = estimateOptionPremium(spot, strike, optionType, 14, {
          expiry: selectedExpiry || expiry
        });
        intrinsic = est.intrinsic;
        timeValue = Number(Math.max(0, premium - est.intrinsic).toFixed(2));
      }
    }

    // Persist selected expiry on instrument for ticket display
    if (expiry && isOption && inst.expiry !== expiry) {
      await prisma.tradeInstrument.update({
        where: { id: instrumentId },
        data: { expiry }
      });
    }

    return {
      instrument: { ...inst, expiry },
      underlying: underlying || null,
      strike,
      option_type: optionType,
      expiry,
      expiry_kind: expiryKind,
      expiry_label: expiryLabel,
      expiry_calendar: expiryCalendar,
      lot_size: inst.lot_size,
      spot,
      spot_change: spotChange,
      spot_change_percent: spotChangePercent,
      spot_source: spotSource || null,
      premium,
      intrinsic,
      time_value: timeValue,
      premium_source: premiumSource,
      order_price: isOption ? premium : spot,
      message: isOption
        ? premiumSource === 'broker'
          ? `Live option LTP · ${expiryLabel || expiry || ''}`
          : `BS option premium for ${expiryLabel || expiry || 'nearest expiry'} (not broker tape — connect Dhan for live LTP).`
        : null
    };
  }

  static async getTradability(userId: string, instrumentId: string) {
    const inst = await this.getInstrument(instrumentId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const role = roleFromUserRole(user?.role);
    const controls = await RiskGateService.getLiveControlsSnapshot(userId);
    const isIndexSpot = inst.instrument_type === 'INDEX' && !inst.direct_trading_allowed;
    const warnings: string[] = [];
    if (isIndexSpot) {
      warnings.push('Index spot cannot be directly traded. Select futures/options contract.');
    }
    if (!inst.tradable) warnings.push('Instrument not tradable');
    if (!liveEnvEnabled() || !controls.liveTradingEnabled) {
      warnings.push('Live trading locked — paper mode default');
    }
    if (controls.killSwitch) warnings.push('Kill switch active — new entries blocked');

    const buySellEnabled =
      inst.tradable &&
      inst.direct_trading_allowed &&
      hasPermission(role, 'paper_trade') &&
      hasPermission(role, permissionForInstrumentType(inst.instrument_type));

    return {
      instrument: inst,
      tradable: inst.tradable,
      direct_trading_allowed: inst.direct_trading_allowed,
      buy_sell_enabled: buySellEnabled && !isIndexSpot,
      index_spot_blocked: isIndexSpot,
      message: isIndexSpot
        ? 'Index cannot be directly traded. Choose futures/options instrument.'
        : null,
      permissions: {
        paper_trade: hasPermission(role, 'paper_trade'),
        live_trade: hasPermission(role, 'live_trade') && liveEnvEnabled() && controls.liveTradingEnabled,
        chart_quick_trade: hasPermission(role, 'chart_quick_trade'),
        create_basket_order: hasPermission(role, 'create_basket_order')
      },
      broker_capability_status: controls.liveTradingEnabled ? 'LIVE_CAPABLE' : 'PAPER_ONLY',
      kill_switch: controls.killSwitch,
      live_locked: !(liveEnvEnabled() && controls.liveTradingEnabled),
      warnings,
      quick_actions: isIndexSpot
        ? []
        : ['BUY', 'SELL', 'ADD_QTY', 'REDUCE_QTY', 'EXIT_QTY', 'EXIT_FULL']
    };
  }

  static async getDerivatives(instrumentId: string) {
    const inst = await this.getInstrument(instrumentId);
    const underlying = inst.underlying_symbol || inst.symbol;
    await this.ensureCatalogSeeded();
    const rows = await prisma.tradeInstrument.findMany({
      where: {
        OR: [
          { underlyingSymbol: underlying, instrumentType: { in: ['INDEX_FUTURE', 'INDEX_OPTION', 'STOCK_FUTURE', 'STOCK_OPTION'] } },
          { symbol: underlying, instrumentType: { in: ['INDEX_FUTURE', 'INDEX_OPTION'] } }
        ]
      },
      orderBy: { instrumentType: 'asc' }
    });
    return {
      underlying: inst,
      contracts: rows.map(mapDbInstrument),
      selectors: [
        { key: 'CURRENT_MONTH_FUTURE', label: 'Current month futures' },
        { key: 'ATM_CALL', label: 'ATM call' },
        { key: 'ATM_PUT', label: 'ATM put' },
        { key: 'NEARBY_OPTIONS', label: 'Nearby expiry options' },
        { key: 'PAPER_INDEX_SIM', label: 'Paper index simulation' }
      ]
    };
  }

  private static async assertPerm(userId: string, perm: TradePermission) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const role = roleFromUserRole(user?.role);
    if (!hasPermission(role, perm)) throw new AppError(`Permission denied: ${perm}`, 403);
  }

  static async previewOrder(userId: string, body: OrderPreviewRequest) {
    await this.assertPerm(userId, 'paper_trade');
    let instrument: CatalogInstrument | null = null;
    if (body.instrument_id) {
      instrument = await this.getInstrument(body.instrument_id);
    } else if (body.symbol) {
      await this.ensureCatalogSeeded();
      const row = await prisma.tradeInstrument.findFirst({
        where: {
          symbol: body.symbol.toUpperCase(),
          instrumentType: { in: ['STOCK', 'ETF', 'INDEX_FUTURE', 'INDEX_OPTION', 'STOCK_FUTURE', 'STOCK_OPTION'] }
        }
      });
      if (row) instrument = mapDbInstrument(row);
    }

    const symbol = (instrument?.symbol || body.symbol || '').toUpperCase();
    const exchange = instrument?.exchange || body.exchange || 'NSE';
    const side = body.side;
    const qty = Math.floor(Number(body.quantity) || 0);
    const mode = body.mode === 'LIVE' ? 'LIVE' : 'PAPER';
    const source = body.source || 'ORDER_TICKET';
    const orderType = body.order_type || 'MARKET';
    const productType =
      body.product_type ||
      (instrument ? productForInstrument(instrument.instrument_type) : 'CNC');
    const instrumentType = (instrument?.instrument_type || 'STOCK') as InstrumentType;
    const lotSize = instrument?.lot_size || 1;
    const warnings: string[] = [];
    const blockers: string[] = [];

    if (!symbol) blockers.push('Symbol required');
    if (!['BUY', 'SELL'].includes(side)) blockers.push('Invalid side');
    if (qty <= 0) blockers.push('Invalid quantity');

    if (instrument) {
      if (instrument.instrument_type === 'INDEX' && !instrument.direct_trading_allowed) {
        blockers.push('Index spot cannot be directly traded. Select futures/options contract.');
        await audit(userId, 'index_trade_attempted', 'INSTRUMENT', symbol, instrument.instrument_id);
      }
      if (!instrument.tradable) blockers.push('Instrument not tradable');
      const lotErr = validateLotSize(qty, lotSize);
      if (lotErr) blockers.push(lotErr);
    }

    const controls = await RiskGateService.getLiveControlsSnapshot(userId);
    if (mode === 'LIVE') {
      if (!liveEnvEnabled()) blockers.push('LIVE_TRADING_ENABLED is not true');
      if (!controls.liveTradingEnabled) blockers.push('TradingControl liveTradingEnabled=false');
      if (controls.killSwitch) blockers.push('Kill switch active');
      if (controls.approvalState !== 'APPROVED') blockers.push('RMS approval required');
      if (!body.stop_loss) warnings.push('Stop-loss required for live — missing');
      if (!body.stop_loss) blockers.push('Stop-loss required for live');
    } else if (controls.killSwitch) {
      warnings.push('Kill switch active — paper entries may still be limited by RMS');
    }

    const price = Number(body.price) || (instrumentType.includes('OPTION') ? 100 : 1000);
    const notional = price * qty;
    const estimatedMargin = estimateMargin(notional, productType, instrumentType);
    const estimatedCharges = estimateCharges(notional);
    const estimatedMaxLoss = estimateMaxLoss(qty, price, body.stop_loss, side);
    const requiredApproval = mode === 'LIVE';
    const allowed = blockers.length === 0 && (mode === 'PAPER' || requiredApproval);

    const idempotencyKey = body.idempotency_key || `preview-${randomUUID()}`;
    const preview = await prisma.orderPreview.create({
      data: {
        userId,
        tenantId: body.tenant_id,
        accountId: body.account_id,
        instrumentId: instrument?.instrument_id,
        symbol,
        exchange,
        side,
        quantity: qty,
        orderType,
        productType,
        price: body.price,
        triggerPrice: body.trigger_price,
        stopLoss: body.stop_loss,
        target: body.target,
        mode,
        source,
        status: 'PREVIEWED',
        allowed: allowed && blockers.length === 0,
        requiredApproval,
        warnings: [...warnings, ...blockers],
        riskSummary: {
          estimated_max_loss: estimatedMaxLoss,
          lot_size: lotSize,
          instrument_type: instrumentType,
          kill_switch: controls.killSwitch,
          blockers
        },
        estimatedPrice: price,
        estimatedMargin,
        estimatedCharges,
        estimatedMaxLoss,
        brokerCapabilityStatus: mode === 'LIVE' ? 'LIVE_REQUIRES_APPROVAL' : 'PAPER_OK',
        nextAction:
          blockers.length > 0
            ? 'FIX_ERRORS'
            : mode === 'LIVE'
              ? 'REQUEST_APPROVAL'
              : 'SUBMIT_PAPER',
        idempotencyKey,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000)
      }
    });

    await audit(userId, 'order_preview_created', 'PREVIEW', `${side} ${qty} ${symbol}`, preview.id, {
      mode,
      source
    });
    if (side === 'BUY') await audit(userId, 'stock_buy_clicked', 'PREVIEW', symbol, preview.id);
    if (side === 'SELL') await audit(userId, 'stock_sell_clicked', 'PREVIEW', symbol, preview.id);

    return {
      preview_id: preview.id,
      tradable: instrument?.tradable ?? true,
      allowed: preview.allowed,
      warnings: preview.warnings,
      estimated_price: price,
      estimated_margin: estimatedMargin,
      estimated_charges: estimatedCharges,
      estimated_max_loss: estimatedMaxLoss,
      required_approval: requiredApproval,
      risk_summary: preview.riskSummary,
      broker_capability_status: preview.brokerCapabilityStatus,
      next_action: preview.nextAction,
      mode,
      source,
      instrument
    };
  }

  static async approveOrder(userId: string, previewId: string, approve: boolean) {
    await this.assertPerm(userId, 'approve_order');
    const preview = await prisma.orderPreview.findFirst({ where: { id: previewId, userId } });
    if (!preview) throw new AppError('Preview not found', 404);
    if (preview.mode === 'LIVE' && approve) {
      // Live never auto-executes; mark approval pending only
      const updated = await prisma.orderPreview.update({
        where: { id: previewId },
        data: { status: approve ? 'APPROVED' : 'REJECTED', allowed: approve }
      });
      await audit(
        userId,
        approve ? 'rms_approved' : 'rms_rejected',
        'PREVIEW',
        `Live preview ${approve ? 'approved (still needs OMS)' : 'rejected'}`,
        previewId
      );
      return {
        preview: updated,
        message: approve
          ? 'Approved for live path — submit still requires LIVE_TRADING_ENABLED, RMS, OMS'
          : 'Rejected'
      };
    }
    const updated = await prisma.orderPreview.update({
      where: { id: previewId },
      data: { status: approve ? 'APPROVED' : 'REJECTED', allowed: approve }
    });
    await audit(userId, approve ? 'rms_approved' : 'rms_rejected', 'PREVIEW', preview.symbol, previewId);
    return { preview: updated };
  }

  static async submitOrder(userId: string, previewId: string) {
    const preview = await prisma.orderPreview.findFirst({ where: { id: previewId, userId } });
    if (!preview) throw new AppError('Preview not found', 404);
    if (preview.status === 'SUBMITTED') throw new AppError('Preview already submitted', 409);

    const warnings = (preview.warnings as string[]) || [];
    if (!preview.allowed && preview.mode === 'LIVE') {
      throw new AppError('Live order not allowed — approval + RMS required', 403);
    }
    if (preview.mode === 'LIVE') {
      const controls = await RiskGateService.getLiveControlsSnapshot(userId);
      if (!liveEnvEnabled() || !controls.liveTradingEnabled || controls.killSwitch) {
        await audit(userId, 'rms_rejected', 'PREVIEW', 'Live submit blocked', previewId);
        throw new AppError('Live trading blocked by policy / kill switch', 403);
      }
      if (preview.status !== 'APPROVED') {
        throw new AppError('Live order requires explicit approval first', 403);
      }
    }

    // Paper default path through OMS
    const isPaper = preview.mode !== 'LIVE';
    if (!isPaper) {
      throw new AppError('Live OMS submit locked by default — use paper', 403);
    }

    let instrumentType: 'EQUITY' | 'OPTION' = 'EQUITY';
    let exchange = preview.exchange || 'NSE';
    let optionDetails:
      | { strike: number; expiry: string; optionType: 'CE' | 'PE' }
      | undefined;
    let fillPrice = preview.price != null ? Number(preview.price) : undefined;

    if (preview.instrumentId) {
      try {
        const inst = await this.getInstrument(preview.instrumentId);
        if (inst.instrument_type.includes('OPTION')) {
          instrumentType = 'OPTION';
          exchange = inst.segment === 'NFO' || inst.exchange === 'NSE' ? 'NFO' : inst.exchange;
          optionDetails = {
            strike: Number(inst.strike || 0),
            expiry: String(inst.expiry || ''),
            optionType: (inst.option_type as 'CE' | 'PE') || (/PE$/i.test(inst.symbol) ? 'PE' : 'CE')
          };
        }
      } catch {
        /* catalog optional */
      }
    }
    if (instrumentType === 'EQUITY' && /CE$|PE$/i.test(preview.symbol)) {
      instrumentType = 'OPTION';
      exchange = 'NFO';
      const fo = parseFoContractSymbol(preview.symbol);
      optionDetails = {
        strike: Number(fo?.strike || 0),
        expiry: '',
        optionType: (fo?.optionType as 'CE' | 'PE') || (/PE$/i.test(preview.symbol) ? 'PE' : 'CE')
      };
    }

    // Prefer explicit premium for options — never let equity LTP overwrite
    if (instrumentType === 'OPTION' && !(fillPrice && fillPrice > 0)) {
      try {
        const cq = await this.getContractQuote(userId, preview.instrumentId || '', {
          expiry: optionDetails?.expiry || undefined
        });
        if (cq.premium && cq.premium > 0) fillPrice = cq.premium;
        if (cq.expiry && optionDetails) optionDetails.expiry = cq.expiry;
      } catch {
        /* keep preview price */
      }
    }

    const order = await OrderExecutionService.placeOrder({
      userId,
      symbol: preview.symbol,
      exchange,
      tradeType: preview.side as 'BUY' | 'SELL',
      quantity: preview.quantity,
      orderType: preview.orderType as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
      product: preview.productType as 'CNC' | 'MIS' | 'NRML',
      price: fillPrice,
      triggerPrice: preview.triggerPrice ?? undefined,
      instrumentType,
      optionDetails,
      isPaper: true,
      source: preview.source === 'CHART' ? 'CHART' : preview.source === 'BASKET' ? 'BASKET' : 'MANUAL',
      idempotencyKey: `submit-${preview.idempotencyKey}`,
      meta: {
        previewId: preview.id,
        stopLoss: preview.stopLoss,
        target: preview.target
      }
    });

    await prisma.orderPreview.update({
      where: { id: previewId },
      data: { status: 'SUBMITTED', orderId: order.id }
    });
    await audit(userId, 'oms_order_created', 'ORDER', `${preview.side} ${preview.symbol}`, order.id);
    await audit(userId, 'broker_response_received', 'ORDER', `Paper fill status=${order.status}`, order.id);

    return { order, preview_id: previewId, warnings, mode: 'PAPER' };
  }

  // ─── Baskets ─────────────────────────────────────────────

  static async createBasket(
    userId: string,
    body: { basket_name?: string; mode?: string; partial_allowed?: boolean; all_or_none?: boolean }
  ) {
    await this.assertPerm(userId, 'create_basket_order');
    const mode = body.mode === 'LIVE' ? 'LIVE' : 'PAPER';
    if (mode === 'LIVE') throw new AppError('Live baskets locked by default — use PAPER', 403);
    const basket = await prisma.basketOrder.create({
      data: {
        userId,
        basketName: body.basket_name || 'My Basket',
        mode,
        status: 'DRAFT',
        partialAllowed: !!body.partial_allowed,
        allOrNone: body.all_or_none !== false
      }
    });
    await audit(userId, 'basket_created', 'BASKET', basket.basketName, basket.id);
    return {
      ...basket,
      id: basket.id,
      basket_name: basket.basketName,
      basketName: basket.basketName,
      legs_count: 0
    };
  }

  static async listBaskets(userId: string) {
    let rows: Array<{
      id: string;
      basketName: string;
      createdAt: Date;
      legs?: unknown[];
      [key: string]: unknown;
    }> = [];
    try {
      rows = (await prisma.basketOrder.findMany({
      where: { userId },
      include: { legs: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    })) as typeof rows;
    } catch {
      return [];
    }
    // Normalize for FE (camel + snake) so basket chips always render
    return rows.map((b) => ({
      ...b,
      id: b.id,
      basket_name: b.basketName,
      basketName: b.basketName,
      created_at: b.createdAt,
      legs_count: b.legs?.length || 0
    }));
  }

  static async getBasket(userId: string, basketId: string) {
    const b = await prisma.basketOrder.findFirst({
      where: { id: basketId, userId },
      include: { legs: true }
    });
    if (!b) throw new AppError('Basket not found', 404);
    return {
      ...b,
      basket_name: b.basketName,
      basketName: b.basketName,
      legs: b.legs
    };
  }

  static async updateBasket(
    userId: string,
    basketId: string,
    body: { basket_name?: string; partial_allowed?: boolean; all_or_none?: boolean }
  ) {
    await this.getBasket(userId, basketId);
    const data: {
      basketName?: string;
      partialAllowed?: boolean;
      allOrNone?: boolean;
    } = {};
    if (body.basket_name != null && String(body.basket_name).trim()) {
      data.basketName = String(body.basket_name).trim();
    }
    if (body.partial_allowed !== undefined) data.partialAllowed = !!body.partial_allowed;
    if (body.all_or_none !== undefined) data.allOrNone = !!body.all_or_none;
    const updated = await prisma.basketOrder.update({
      where: { id: basketId },
      data,
      include: { legs: true }
    });
    await audit(userId, 'basket_updated', 'BASKET', updated.basketName, basketId);
    return {
      ...updated,
      basket_name: updated.basketName,
      basketName: updated.basketName,
      legs: updated.legs
    };
  }

  static async deleteBasket(userId: string, basketId: string) {
    await this.getBasket(userId, basketId);
    await prisma.basketOrder.delete({ where: { id: basketId } });
    return { deleted: true };
  }

  static async addBasketLeg(
    userId: string,
    basketId: string,
    leg: {
      instrument_id?: string;
      symbol: string;
      exchange?: string;
      side: 'BUY' | 'SELL';
      quantity: number;
      order_type?: string;
      product_type?: string;
      price?: number;
      stop_loss?: number;
      target?: number;
      weight_percent?: number;
    }
  ) {
    const basket = await this.getBasket(userId, basketId);
    if (!['DRAFT', 'PREVIEWED', 'RISK_REJECTED'].includes(basket.status)) {
      throw new AppError('Cannot add legs in current basket status', 400);
    }
    let instrument: CatalogInstrument | null = null;
    if (leg.instrument_id) instrument = await this.getInstrument(leg.instrument_id);
    const sym = String(instrument?.symbol || leg.symbol || '').toUpperCase();
    let instrumentType = instrument?.instrument_type || 'STOCK';
    if (/FUT$/i.test(sym) || instrumentType.includes('FUTURE')) {
      instrumentType = /NIFTY|SENSEX|BANKEX/.test(sym)
        ? 'INDEX_FUTURE'
        : instrumentType.includes('COMMODITY') || instrument?.exchange === 'MCX'
          ? 'COMMODITY_FUTURE'
          : 'STOCK_FUTURE';
    } else if (/\d+(CE|PE)$/i.test(sym) || instrumentType.includes('OPTION')) {
      instrumentType = /NIFTY|SENSEX|BANKEX/.test(sym)
        ? 'INDEX_OPTION'
        : instrumentType.includes('COMMODITY') || instrument?.exchange === 'MCX'
          ? 'COMMODITY_OPTION'
          : 'STOCK_OPTION';
    }
    if (instrumentType === 'INDEX' && !instrument?.direct_trading_allowed) {
      throw new AppError('Index spot cannot be a basket leg — choose futures/options', 400);
    }
    const qty = Math.floor(Number(leg.quantity) || 0);
    const lotErr = validateLotSize(qty, instrument?.lot_size || 1);
    if (lotErr) throw new AppError(lotErr, 400);

    const created = await prisma.basketOrderLeg.create({
      data: {
        basketId,
        instrumentId: instrument?.instrument_id,
        symbol: (instrument?.symbol || leg.symbol).toUpperCase(),
        exchange: instrument?.exchange || leg.exchange || 'NSE',
        instrumentType,
        side: leg.side,
        quantity: qty,
        lotSize: instrument?.lot_size || 1,
        orderType: leg.order_type || 'MARKET',
        productType: leg.product_type || productForInstrument(instrumentType as InstrumentType),
        price: leg.price,
        stopLoss: leg.stop_loss,
        target: leg.target,
        weightPercent: leg.weight_percent,
        legStatus: 'DRAFT',
        idempotencyKey: `leg-${basketId}-${randomUUID()}`
      }
    });
    await prisma.basketOrder.update({ where: { id: basketId }, data: { status: 'DRAFT' } });
    await audit(userId, 'basket_leg_added', 'BASKET', `${leg.side} ${leg.symbol}`, basketId, {
      legId: created.id
    });
    if (instrument?.instrument_type.includes('OPTION') || instrument?.instrument_type.includes('FUTURE')) {
      await audit(userId, 'derivative_contract_selected', 'INSTRUMENT', created.symbol, instrument.instrument_id);
    }
    return created;
  }

  static async updateBasketLeg(
    userId: string,
    basketId: string,
    legId: string,
    patch: Partial<{ quantity: number; side: string; price: number; order_type: string; stop_loss: number; target: number }>
  ) {
    await this.getBasket(userId, basketId);
    return prisma.basketOrderLeg.update({
      where: { id: legId },
      data: {
        quantity: patch.quantity,
        side: patch.side,
        price: patch.price,
        orderType: patch.order_type,
        stopLoss: patch.stop_loss,
        target: patch.target
      }
    });
  }

  static async deleteBasketLeg(userId: string, basketId: string, legId: string) {
    await this.getBasket(userId, basketId);
    await prisma.basketOrderLeg.delete({ where: { id: legId } });
    return { deleted: true };
  }

  static async previewBasket(userId: string, basketId: string) {
    const basket = await this.getBasket(userId, basketId);
    if (!basket.legs.length) throw new AppError('Basket has no legs', 400);

    const legRisks = [];
    let totalMargin = 0;
    let totalCharges = 0;
    let totalRisk = 0;
    let worstCase = 0;
    const invalidLegs: string[] = [];
    const symbols = new Set<string>();

    for (const leg of basket.legs) {
      const price = Number(leg.price) || 1000;
      const notional = price * leg.quantity;
      const margin = estimateMargin(notional, leg.productType, leg.instrumentType);
      const charges = estimateCharges(notional);
      const risk = estimateMaxLoss(leg.quantity, price, leg.stopLoss, leg.side as 'BUY' | 'SELL');
      const lotErr = validateLotSize(leg.quantity, leg.lotSize);
      if (lotErr) invalidLegs.push(`${leg.symbol}: ${lotErr}`);
      if (leg.instrumentType === 'INDEX') invalidLegs.push(`${leg.symbol}: index spot not allowed`);
      symbols.add(leg.symbol);
      totalMargin += margin;
      totalCharges += charges;
      totalRisk += risk;
      worstCase += risk;
      await prisma.basketOrderLeg.update({
        where: { id: leg.id },
        data: { estimatedMargin: margin, estimatedRisk: risk, legStatus: lotErr ? 'INVALID' : 'PREVIEWED' }
      });
      legRisks.push({ leg_id: leg.id, symbol: leg.symbol, margin, risk, charges, valid: !lotErr });
    }

    const concentration = {
      unique_symbols: symbols.size,
      symbol_concentration: symbols.size === 1 ? 1 : 1 / symbols.size,
      sector_concentration: null,
      options_exposure: basket.legs.filter((l) => l.instrumentType.includes('OPTION')).length
    };

    const maxBasketValue = 500000;
    const blockers: string[] = [];
    if (totalMargin > maxBasketValue) blockers.push(`Basket margin exceeds max ${maxBasketValue}`);
    if (basket.legs.length > 25) blockers.push('Max 25 legs');
    if (invalidLegs.length && basket.allOrNone) {
      blockers.push(...invalidLegs);
    }

    const riskOk = blockers.length === 0 || (basket.partialAllowed && invalidLegs.length < basket.legs.length);
    const status = riskOk ? 'RISK_APPROVED' : 'RISK_REJECTED';

    const updated = await prisma.basketOrder.update({
      where: { id: basketId },
      data: {
        status: riskOk ? 'PREVIEWED' : 'RISK_REJECTED',
        totalMargin,
        totalRisk,
        totalCharges,
        worstCaseLoss: worstCase,
        riskSummary: { legRisks, concentration, blockers, max_basket_value: maxBasketValue }
      },
      include: { legs: true }
    });

    if (riskOk) {
      await prisma.basketOrder.update({ where: { id: basketId }, data: { status: 'RISK_APPROVED' } });
      await audit(userId, 'rms_approved', 'BASKET', 'Basket risk approved (paper)', basketId);
    } else {
      await audit(userId, 'rms_rejected', 'BASKET', blockers.join('; '), basketId);
    }
    await audit(userId, 'basket_previewed', 'BASKET', `margin=${totalMargin}`, basketId);

    return {
      basket: { ...updated, status },
      total_estimated_margin: totalMargin,
      total_estimated_charges: totalCharges,
      total_risk: totalRisk,
      worst_case_loss: worstCase,
      leg_level_risk: legRisks,
      concentration,
      blockers,
      allowed: riskOk,
      mode: basket.mode
    };
  }

  static async riskCheckBasket(userId: string, basketId: string) {
    return this.previewBasket(userId, basketId);
  }

  static async approveBasket(userId: string, basketId: string) {
    await this.assertPerm(userId, 'approve_order');
    const basket = await this.getBasket(userId, basketId);
    if (basket.mode === 'LIVE') throw new AppError('Live basket approval locked by default', 403);
    if (!['PREVIEWED', 'RISK_APPROVED', 'USER_APPROVAL_PENDING'].includes(basket.status)) {
      const preview = await this.previewBasket(userId, basketId);
      if (!preview.allowed) throw new AppError('Basket failed risk check', 400);
    }
    const updated = await prisma.basketOrder.update({
      where: { id: basketId },
      data: { status: 'APPROVED' },
      include: { legs: true }
    });
    await audit(userId, 'basket_approved', 'BASKET', updated.basketName, basketId);
    return updated;
  }

  static async submitBasket(userId: string, basketId: string) {
    await this.assertPerm(userId, 'submit_basket_order');
    let basket = await this.getBasket(userId, basketId);
    if (basket.mode === 'LIVE') throw new AppError('Live basket execution locked by default', 403);
    if (basket.status !== 'APPROVED') {
      await this.approveBasket(userId, basketId);
      basket = await this.getBasket(userId, basketId);
    }

    await prisma.basketOrder.update({ where: { id: basketId }, data: { status: 'SENT_TO_OMS' } });
    await audit(userId, 'basket_submitted', 'BASKET', basket.basketName, basketId);

    let filled = 0;
    let failed = 0;
    for (const leg of basket.legs) {
      if (leg.legStatus === 'INVALID') {
        if (basket.allOrNone && !basket.partialAllowed) {
          failed++;
          continue;
        }
        if (!basket.partialAllowed) {
          failed++;
          continue;
        }
        continue;
      }
      try {
        const order = await OrderExecutionService.placeOrder({
          userId,
          symbol: leg.symbol,
          tradeType: leg.side as 'BUY' | 'SELL',
          quantity: leg.quantity,
          orderType: leg.orderType,
          product: leg.productType,
          price: leg.price ?? undefined,
          isPaper: true,
          source: 'BASKET',
          idempotencyKey: leg.idempotencyKey
        });
        await prisma.basketOrderLeg.update({
          where: { id: leg.id },
          data: { legStatus: 'EXECUTED', orderId: order.id }
        });
        await audit(userId, 'basket_leg_executed', 'BASKET', `${leg.symbol} ${order.status}`, basketId, {
          legId: leg.id,
          orderId: order.id
        });
        await audit(userId, 'oms_order_created', 'ORDER', leg.symbol, order.id);
        filled++;
      } catch (e) {
        failed++;
        await prisma.basketOrderLeg.update({
          where: { id: leg.id },
          data: { legStatus: 'FAILED' }
        });
        await audit(
          userId,
          'rms_rejected',
          'BASKET',
          e instanceof Error ? e.message : 'leg failed',
          basketId,
          { legId: leg.id }
        );
      }
    }

    const status =
      failed === 0 ? 'EXECUTED' : filled > 0 ? 'PARTIALLY_EXECUTED' : 'FAILED';
    const updated = await prisma.basketOrder.update({
      where: { id: basketId },
      data: { status },
      include: { legs: true }
    });
    return { basket: updated, filled, failed };
  }

  static async cancelBasket(userId: string, basketId: string) {
    await this.getBasket(userId, basketId);
    return prisma.basketOrder.update({
      where: { id: basketId },
      data: { status: 'CANCELLED' },
      include: { legs: true }
    });
  }

  static async duplicateBasket(userId: string, basketId: string) {
    const src = await this.getBasket(userId, basketId);
    const copy = await this.createBasket(userId, {
      basket_name: `${src.basketName} (copy)`,
      mode: 'PAPER',
      partial_allowed: src.partialAllowed,
      all_or_none: src.allOrNone
    });
    for (const leg of src.legs) {
      await this.addBasketLeg(userId, copy.id, {
        instrument_id: leg.instrumentId || undefined,
        symbol: leg.symbol,
        exchange: leg.exchange,
        side: leg.side as 'BUY' | 'SELL',
        quantity: leg.quantity,
        order_type: leg.orderType,
        product_type: leg.productType,
        price: leg.price ?? undefined,
        stop_loss: leg.stopLoss ?? undefined,
        target: leg.target ?? undefined,
        weight_percent: leg.weightPercent ?? undefined
      });
    }
    return this.getBasket(userId, copy.id);
  }

  // ─── Chart trading ───────────────────────────────────────

  static async getChartPositions(userId: string, instrumentId?: string, symbol?: string) {
    let sym = symbol?.toUpperCase();
    if (instrumentId) {
      const inst = await this.getInstrument(instrumentId);
      sym = inst.symbol;
    }
    const holdings = await prisma.holding.findMany({
      where: {
        userId,
        ...(sym ? { symbol: sym } : {})
      },
      take: 50
    });
    const orders = await prisma.order.findMany({
      where: {
        userId,
        isPaper: true,
        ...(sym ? { symbol: sym } : {}),
        status: { in: ['FILLED', 'EXECUTED', 'COMPLETE', 'COMPLETED'] }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    return {
      positions: holdings.map((h) => ({
        position_id: h.id,
        symbol: h.symbol,
        exchange: h.exchange,
        side: h.quantity >= 0 ? 'BUY' : 'SELL',
        quantity: Math.abs(h.quantity),
        average_price: Number(h.averagePrice),
        last_price: Number(h.lastPrice),
        unrealized_pnl: Number(h.pnl),
        stop_loss: null,
        target: null,
        risk_used: null
      })),
      recent_orders: orders
    };
  }

  static async chartOrderAction(userId: string, body: ChartOrderActionRequest) {
    await this.assertPerm(userId, body.action.startsWith('EXIT') || body.action === 'REDUCE_QTY' ? 'chart_exit_position' : 'chart_quick_trade');

    const controls = await RiskGateService.getLiveControlsSnapshot(userId);
    const mode = body.mode === 'LIVE' ? 'LIVE' : 'PAPER';
    if (mode === 'LIVE') throw new AppError('Chart live trading locked — paper only', 403);

    let instrument: CatalogInstrument | null = null;
    if (body.instrument_id) instrument = await this.getInstrument(body.instrument_id);
    const symbol = (instrument?.symbol || body.symbol || '').toUpperCase();
    if (!symbol) throw new AppError('Symbol required', 400);

    if (instrument?.instrument_type === 'INDEX' && !instrument.direct_trading_allowed) {
      await audit(userId, 'index_trade_attempted', 'CHART', symbol, instrument.instrument_id);
      throw new AppError(
        'Index spot cannot be directly traded. Select futures/options contract.',
        400
      );
    }

    const positions = await this.getChartPositions(userId, body.instrument_id, symbol);
    const openQty = positions.positions.reduce((s, p) => s + p.quantity, 0);
    const openSide = (positions.positions[0]?.side || 'BUY') as 'BUY' | 'SELL';

    let side: 'BUY' | 'SELL' = 'BUY';
    let quantity = Math.floor(Number(body.quantity) || 0);
    const action = body.action;

    if (action === 'BUY' || action === 'ADD_QTY') {
      if (controls.killSwitch) throw new AppError('Kill switch blocks new add quantity', 403);
      side = 'BUY';
      if (quantity <= 0) quantity = 1;
      await audit(userId, 'chart_add_quantity_requested', 'CHART', `${symbol} +${quantity}`, undefined, {
        action
      });
    } else if (action === 'SELL') {
      if (controls.killSwitch) throw new AppError('Kill switch blocks new entries', 403);
      side = 'SELL';
      if (quantity <= 0) quantity = 1;
    } else if (action === 'REDUCE_QTY' || action === 'EXIT_QTY') {
      if (openQty <= 0) throw new AppError('No open position to reduce/exit', 400);
      if (quantity <= 0) throw new AppError('Quantity required', 400);
      if (quantity > openQty) throw new AppError('Reduce quantity cannot exceed open quantity', 400);
      side = oppositeSide(openSide);
      await audit(userId, 'chart_reduce_quantity_requested', 'CHART', `${symbol} -${quantity}`);
    } else if (action === 'EXIT_FULL') {
      if (openQty <= 0) throw new AppError('No open position to exit', 400);
      quantity = openQty;
      side = oppositeSide(openSide);
      await audit(userId, 'chart_exit_quantity_requested', 'CHART', `${symbol} EXIT_FULL`);
    } else {
      throw new AppError('Unknown chart action', 400);
    }

    const lotErr = validateLotSize(quantity, instrument?.lot_size || 1);
    if (lotErr && (action === 'BUY' || action === 'ADD_QTY' || action === 'SELL')) {
      throw new AppError(lotErr, 400);
    }

    const preview = await this.previewOrder(userId, {
      instrument_id: instrument?.instrument_id,
      symbol,
      exchange: instrument?.exchange || body.exchange || 'NSE',
      side,
      quantity,
      order_type: body.order_type || 'MARKET',
      price: body.price,
      trigger_price: body.trigger_price,
      mode: 'PAPER',
      source: 'CHART',
      idempotency_key: body.idempotency_key || `chart-${action}-${randomUUID()}`
    });

    if (!preview.allowed) {
      return { preview, submitted: false, message: 'Preview blocked — fix warnings' };
    }

    const submitted = await this.submitOrder(userId, preview.preview_id);
    const updatedPositions = await this.getChartPositions(userId, body.instrument_id, symbol);

    return {
      action,
      preview,
      order: submitted.order,
      positions: updatedPositions.positions,
      websocket_hint: {
        channels: ['chart.position.updated', 'chart.order.filled']
      }
    };
  }

  static async addChartLegToBasket(
    userId: string,
    body: { basket_id: string; instrument_id?: string; symbol: string; side: 'BUY' | 'SELL'; quantity: number }
  ) {
    return this.addBasketLeg(userId, body.basket_id, {
      instrument_id: body.instrument_id,
      symbol: body.symbol,
      side: body.side,
      quantity: body.quantity
    });
  }

  static async listAudits(userId: string, limit = 50) {
    return prisma.tradeComplianceAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, limit)
    });
  }
}
