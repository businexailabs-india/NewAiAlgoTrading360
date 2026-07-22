import { MarketService } from '../market.service';
import { InstrumentMasterService } from './instrument-master.service';
import { blackScholesGreeks, daysToExpiry } from './greeks.service';
import { OptionsService } from '../options.service';
import { OptionQuoteService } from './option-quote.service';

export type ChainRow = {
  strike: number;
  ce?: ContractQuote;
  pe?: ContractQuote;
};

export type ContractQuote = {
  id: string;
  tradingSymbol: string;
  instrumentToken: string;
  optionType: 'CE' | 'PE';
  strike: number;
  expiry: string;
  lotSize: number;
  freezeQty: number | null;
  ltp: number;
  oi: number;
  iv: number;
  change: number;
  changePercent: number;
  bid?: number;
  ask?: number;
  bidQty?: number;
  askQty?: number;
  volume?: number;
  oiSignal: 'BUILD_UP' | 'UNWIND' | 'NEUTRAL';
  quoteSource?: 'broker' | 'model';
  greeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    iv: number;
    model: 'black-scholes';
    estimate: boolean;
    broker?: boolean;
  };
};

function estimatePremium(spot: number, strike: number, optionType: 'CE' | 'PE', ivPct: number): number {
  const intrinsic =
    optionType === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const timeValue = Math.max(spot * (ivPct / 100) * 0.08, spot * 0.002);
  return Number((intrinsic + timeValue).toFixed(2));
}

function oiSignal(oi: number, previousOi: number, changePercent: number): ContractQuote['oiSignal'] {
  if (oi <= 0) return 'NEUTRAL';
  if (previousOi > 0) {
    const oiChg = ((oi - previousOi) / previousOi) * 100;
    if (oiChg > 2) return 'BUILD_UP';
    if (oiChg < -2) return 'UNWIND';
  }
  if (changePercent > 0.5) return 'BUILD_UP';
  if (changePercent < -0.5) return 'UNWIND';
  return 'NEUTRAL';
}

export class OptionsChainService {
  static async getUnderlyings() {
    const list = await InstrumentMasterService.listUnderlyings();
    return {
      underlyings: list,
      source: 'instrument_master' as const,
      empty: list.length === 0
    };
  }

  static async getExpiries(underlying: string) {
    const expiries = await InstrumentMasterService.listExpiries(underlying);
    return { underlying: underlying.toUpperCase(), expiries, source: 'instrument_master' as const };
  }

  static async getChain(params: {
    underlying: string;
    expiry?: string;
    userId?: string;
    includeGreeks?: boolean;
  }) {
    const underlying = params.underlying.toUpperCase();
    let expiry = params.expiry;
    if (!expiry) {
      const expiries = await InstrumentMasterService.listExpiries(underlying);
      expiry = expiries[0];
    }

    if (!expiry) {
      const heuristic = await OptionsService.getOptionsChain(underlying, params.userId);
      return {
        ...heuristic,
        providerStatus: 'heuristic' as const,
        quoteFreshness: 'delayed' as const,
        message:
          heuristic.message ||
          'No instrument master contracts found — heuristic strikes for dev only. Run POST /api/options/sync.'
      };
    }

    const { underlying: u, contracts } = await InstrumentMasterService.getContracts(underlying, expiry);
    if (!u || !contracts.length) {
      const heuristic = await OptionsService.getOptionsChain(underlying, params.userId);
      return {
        ...heuristic,
        providerStatus: 'heuristic' as const,
        quoteFreshness: 'delayed' as const,
        message: 'Master empty for expiry — heuristic fallback (dev only).'
      };
    }

    const overlay = await OptionQuoteService.fetchOverlay({
      underlying,
      expiry,
      userId: params.userId
    });

    let spot = overlay.spot > 0 ? overlay.spot : 0;
    let changePercent = 0;
    let spotAvailable = overlay.spot > 0;
    if (!spotAvailable) {
      try {
        const q = await MarketService.getQuote(underlying, params.userId);
        if (q.price > 0) {
          spot = q.price;
          changePercent = q.changePercent || 0;
          spotAvailable = true;
        }
      } catch {
        /* spot optional */
      }
    }

    const ivBase = Math.min(45, Math.max(12, 14 + Math.abs(changePercent) * 2.5));
    const byStrike = new Map<number, ChainRow>();
    let brokerQuoteCount = 0;

    for (const c of contracts) {
      if (c.instrumentType === 'FUT' || c.strike == null || !c.optionType) continue;
      const strike = c.strike;
      const optionType = c.optionType as 'CE' | 'PE';
      const depth =
        overlay.bySecurityId.get(String(c.instrumentToken)) ||
        overlay.byStrikeType.get(`${strike}|${optionType}`);

      const modelIv = ivBase + (Math.abs(strike - (spot || strike)) / Math.max(spot || 1, 1)) * 8;
      const modelLtp = spot > 0 ? estimatePremium(spot, strike, optionType, modelIv) : 0;

      const fromBroker = !!(depth && (depth.ltp > 0 || depth.oi > 0));
      if (fromBroker) brokerQuoteCount++;

      const ltp = fromBroker && depth!.ltp > 0 ? depth!.ltp : modelLtp;
      const oi = fromBroker ? depth!.oi : 0;
      const iv = fromBroker && depth!.iv > 0 ? depth!.iv : Number(modelIv.toFixed(1));
      const chg = fromBroker ? depth!.change : Number((ltp * (changePercent / 100)).toFixed(2));
      const chgPct = fromBroker ? depth!.changePercent : Number(changePercent.toFixed(2));

      const quote: ContractQuote = {
        id: c.id,
        tradingSymbol: c.tradingSymbol,
        instrumentToken: c.instrumentToken,
        optionType,
        strike,
        expiry: c.expiry.toISOString().slice(0, 10),
        lotSize: c.lotSize,
        freezeQty: c.freezeQty,
        ltp,
        oi,
        iv: Number(Number(iv).toFixed(2)),
        change: chg,
        changePercent: chgPct,
        bid: depth?.bid,
        ask: depth?.ask,
        bidQty: depth?.bidQty,
        askQty: depth?.askQty,
        volume: depth?.volume,
        oiSignal: oiSignal(oi, depth?.previousOi || 0, chgPct),
        quoteSource: fromBroker ? 'broker' : 'model'
      };

      if (params.includeGreeks && spot > 0) {
        if (depth?.greeks) {
          quote.greeks = {
            delta: Number(depth.greeks.delta.toFixed(4)),
            gamma: Number(depth.greeks.gamma.toFixed(6)),
            theta: Number(depth.greeks.theta.toFixed(4)),
            vega: Number(depth.greeks.vega.toFixed(4)),
            iv: quote.iv,
            model: 'black-scholes',
            estimate: false,
            broker: true
          };
        } else {
          quote.greeks = blackScholesGreeks({
            spot,
            strike,
            timeYears: daysToExpiry(c.expiry) / 365,
            ivPct: quote.iv,
            optionType
          });
        }
      }

      const row: ChainRow = byStrike.get(strike) || { strike };
      if (quote.optionType === 'CE') row.ce = quote;
      else row.pe = quote;
      byStrike.set(strike, row);
    }

    // If optionchain failed entirely, try marketfeed quote for ATM window
    if (brokerQuoteCount === 0 && overlay.quoteSource === 'unavailable') {
      const tokens = contracts
        .filter((c) => c.instrumentType !== 'FUT' && c.instrumentToken)
        .map((c) => c.instrumentToken);
      // Limit to ~120 nearest strikes for rate/payload
      const withStrike = contracts
        .filter((c) => c.strike != null && c.instrumentType !== 'FUT')
        .sort((a, b) => Math.abs(Number(a.strike) - (spot || 0)) - Math.abs(Number(b.strike) - (spot || 0)))
        .slice(0, 120);
      const feed = await OptionQuoteService.fetchMarketfeedQuotes(
        withStrike.map((c) => c.instrumentToken),
        params.userId,
        u.segment === 'BFO' ? 'BSE_FNO' : 'NSE_FNO'
      );
      if (feed.size) {
        for (const row of byStrike.values()) {
          for (const leg of [row.ce, row.pe]) {
            if (!leg) continue;
            const q = feed.get(String(leg.instrumentToken));
            if (!q || !(q.ltp > 0 || q.oi > 0)) continue;
            leg.ltp = q.ltp > 0 ? q.ltp : leg.ltp;
            leg.oi = q.oi;
            leg.bid = q.bid || undefined;
            leg.ask = q.ask || undefined;
            leg.quoteSource = 'broker';
            leg.oiSignal = oiSignal(q.oi, q.oi, leg.changePercent);
            brokerQuoteCount++;
          }
        }
        overlay.quoteSource = 'dhan_marketfeed';
        overlay.quoteFreshness = 'live';
        overlay.message = 'Quotes from Dhan marketfeed/quote (optionchain unavailable)';
      }
      void tokens;
    }

    const rows = Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);
    const atm =
      spot > 0
        ? rows.reduce(
            (best, r) => (Math.abs(r.strike - spot) < Math.abs(best - spot) ? r.strike : best),
            rows[0]?.strike || 0
          )
        : rows[0]?.strike || 0;

    const metrics = this.computePcrAndMaxPain(rows, spot);

    const hasBroker = brokerQuoteCount > 0;
    const quoteFreshness = hasBroker ? overlay.quoteFreshness : 'delayed';
    const quoteSource = hasBroker ? overlay.quoteSource : 'model_overlay';

    return {
      underlying,
      underlyingMeta: u,
      spotPrice: spot,
      spotAvailable,
      expiry,
      atm,
      pcr: metrics.pcr,
      maxPain: metrics.maxPain,
      pcrBasis: metrics.pcrBasis,
      maxPainBasis: metrics.maxPainBasis,
      callOi: metrics.callOi,
      putOi: metrics.putOi,
      rows,
      contractCount: contracts.length,
      brokerQuoteCount,
      analyzedAt: overlay.asOf || new Date().toISOString(),
      available: true,
      providerStatus: 'ok' as const,
      quoteFreshness,
      quoteSource,
      message: hasBroker
        ? `Master contracts + ${overlay.quoteSource} depth (${brokerQuoteCount} legs)`
        : overlay.message ||
          'Contracts from instrument master; broker quotes unavailable — showing model overlay.'
    };
  }

  /**
   * PCR / max-pain from real OI when present; otherwise synthetic weights from LTP
   * so analytics stay useful under model-overlay / expired Dhan token.
   */
  private static computePcrAndMaxPain(
    rows: Array<{
      strike: number;
      ce?: { oi?: number; ltp?: number } | null;
      pe?: { oi?: number; ltp?: number } | null;
    }>,
    spot: number
  ) {
    const callOiRaw = rows.reduce((s, r) => s + (r.ce?.oi || 0), 0);
    const putOiRaw = rows.reduce((s, r) => s + (r.pe?.oi || 0), 0);
    const useSynthetic = callOiRaw + putOiRaw <= 0;

    const syntheticOi = (ltp: number, strike: number) => {
      const dist = Math.abs(strike - (spot || strike)) + 25;
      const px = Math.max(ltp || 1, 1);
      // Higher weight near ATM / richer premium — stable proxy when OI feed is empty.
      return Math.max(1, Math.round((250_000 / dist) * (50 / px)));
    };

    const weight = (leg: { oi?: number; ltp?: number } | null | undefined, strike: number) => {
      if (!leg) return 0;
      if (!useSynthetic) return leg.oi || 0;
      return syntheticOi(Number(leg.ltp || 0), strike);
    };

    let callOi = 0;
    let putOi = 0;
    for (const r of rows) {
      callOi += weight(r.ce, r.strike);
      putOi += weight(r.pe, r.strike);
    }

    const pcr = callOi > 0 ? putOi / callOi : null;
    let maxPain: number | null = null;
    if (callOi + putOi > 0 && rows.length) {
      let bestPain = Infinity;
      for (const row of rows) {
        let pain = 0;
        for (const r of rows) {
          pain += weight(r.ce, r.strike) * Math.max(0, r.strike - row.strike);
          pain += weight(r.pe, r.strike) * Math.max(0, row.strike - r.strike);
        }
        if (pain < bestPain) {
          bestPain = pain;
          maxPain = row.strike;
        }
      }
    }

    return {
      pcr: pcr != null ? Number(pcr.toFixed(3)) : null,
      maxPain,
      callOi,
      putOi,
      pcrBasis: useSynthetic ? ('synthetic' as const) : ('oi' as const),
      maxPainBasis: useSynthetic ? ('synthetic' as const) : ('oi' as const)
    };
  }

  static async getAnalytics(underlying: string, expiry: string | undefined, userId?: string) {
    const chain = await this.getChain({ underlying, expiry, userId, includeGreeks: true });
    const rows = 'rows' in chain ? chain.rows : [];
    return {
      underlying: underlying.toUpperCase(),
      expiry: 'expiry' in chain ? chain.expiry : null,
      atm: 'atm' in chain ? chain.atm : null,
      pcr: 'pcr' in chain ? chain.pcr : null,
      maxPain: 'maxPain' in chain ? chain.maxPain : null,
      pcrBasis: 'pcrBasis' in chain ? chain.pcrBasis : null,
      maxPainBasis: 'maxPainBasis' in chain ? chain.maxPainBasis : null,
      callOi: 'callOi' in chain ? chain.callOi : null,
      putOi: 'putOi' in chain ? chain.putOi : null,
      spotPrice: chain.spotPrice,
      providerStatus: chain.providerStatus,
      quoteFreshness: 'quoteFreshness' in chain ? chain.quoteFreshness : 'delayed',
      quoteSource: 'quoteSource' in chain ? chain.quoteSource : undefined,
      brokerQuoteCount: 'brokerQuoteCount' in chain ? chain.brokerQuoteCount : 0,
      contractCount: 'contractCount' in chain ? chain.contractCount : 0,
      message: 'message' in chain ? chain.message : null,
      analyzedAt: chain.analyzedAt,
      rows: Array.isArray(rows)
        ? rows.slice(0, 40).map((r) => ({
            strike: r.strike,
            ceLtp: r.ce?.ltp ?? null,
            peLtp: r.pe?.ltp ?? null,
            ceOi: r.ce?.oi ?? null,
            peOi: r.pe?.oi ?? null
          }))
        : []
    };
  }

  static async getGreeks(params: {
    underlying: string;
    expiry?: string;
    strike: number;
    optionType: 'CE' | 'PE';
    userId?: string;
  }) {
    const chain = await this.getChain({
      underlying: params.underlying,
      expiry: params.expiry,
      userId: params.userId,
      includeGreeks: true
    });
    if (!('rows' in chain)) {
      return { available: false, message: 'Greeks unavailable without master chain' };
    }
    const row = chain.rows.find((r) => r.strike === params.strike);
    const leg = params.optionType === 'CE' ? row?.ce : row?.pe;
    if (!leg?.greeks) {
      return { available: false, message: 'Contract or spot missing for greeks' };
    }
    return {
      available: true,
      contract: leg,
      greeks: leg.greeks,
      estimate: !!(leg.greeks as { estimate?: boolean }).estimate,
      quoteSource: leg.quoteSource
    };
  }
}
