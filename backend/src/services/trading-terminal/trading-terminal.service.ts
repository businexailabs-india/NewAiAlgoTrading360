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
import { hasPermission, roleFromUserRole, type TradePermission } from '../../libs/trading/permissions';

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

  static async searchInstruments(query: string, limit = 20): Promise<CatalogInstrument[]> {
    await this.ensureCatalogSeeded();
    const q = (query || '').trim();
    const rows = await prisma.tradeInstrument.findMany({
      where: q
        ? {
            OR: [
              { symbol: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
              { underlyingSymbol: { contains: q, mode: 'insensitive' } }
            ]
          }
        : undefined,
      take: Math.min(50, limit),
      orderBy: [{ instrumentType: 'asc' }, { symbol: 'asc' }]
    });
    return rows.map(mapDbInstrument);
  }

  static async getInstrument(instrumentId: string): Promise<CatalogInstrument> {
    await this.ensureCatalogSeeded();
    const row = await prisma.tradeInstrument.findUnique({ where: { id: instrumentId } });
    if (!row) throw new AppError('Instrument not found', 404);
    return mapDbInstrument(row);
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
      hasPermission(role, inst.instrument_type.includes('OPTION') ? 'trade_options' : 'trade_stock');

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

    const order = await OrderExecutionService.placeOrder({
      userId,
      symbol: preview.symbol,
      tradeType: preview.side as 'BUY' | 'SELL',
      quantity: preview.quantity,
      orderType: preview.orderType as 'MARKET' | 'LIMIT' | 'SL' | 'SL-M',
      product: preview.productType as 'CNC' | 'MIS' | 'NRML',
      price: preview.price ?? undefined,
      triggerPrice: preview.triggerPrice ?? undefined,
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
    return basket;
  }

  static async listBaskets(userId: string) {
    return prisma.basketOrder.findMany({
      where: { userId },
      include: { legs: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  static async getBasket(userId: string, basketId: string) {
    const b = await prisma.basketOrder.findFirst({
      where: { id: basketId, userId },
      include: { legs: true }
    });
    if (!b) throw new AppError('Basket not found', 404);
    return b;
  }

  static async updateBasket(
    userId: string,
    basketId: string,
    body: { basket_name?: string; partial_allowed?: boolean; all_or_none?: boolean }
  ) {
    await this.getBasket(userId, basketId);
    return prisma.basketOrder.update({
      where: { id: basketId },
      data: {
        basketName: body.basket_name,
        partialAllowed: body.partial_allowed,
        allOrNone: body.all_or_none
      },
      include: { legs: true }
    });
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
    const instrumentType = instrument?.instrument_type || 'STOCK';
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
