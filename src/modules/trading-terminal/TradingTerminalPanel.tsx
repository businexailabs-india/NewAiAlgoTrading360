import { useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { tradingApi, type Instrument, type MarketQuote, type ContractQuote, type FoExpiryEntry } from '@/api/trading';
import { ChartTradePanel } from '@/components/trading/ChartTradePanel';
import { StockChartModal } from '@/components/StockChartModal';
import type { WatchlistItem } from '@/api/watchlist';
import { useBasketOrders, useInstrumentSearch } from '@/hooks/trading/useTradingTerminal';

const FO_STRIKE_STEP: Record<string, number> = {
  NIFTY: 50,
  BANKNIFTY: 100,
  FINNIFTY: 50,
  MIDCPNIFTY: 25,
  NIFTYNXT50: 100,
  NIFTYFPI: 5,
  SENSEX: 100,
  BANKEX: 100,
  SENSEX50: 50,
  FOCIT: 100
};

/** Most-traded index desks — one click opens monthly option chain. */
const QUICK_INDICES: Array<{
  symbol: string;
  label: string;
  lot: number;
  step: number;
  exchange: string;
}> = [
  { symbol: 'NIFTY', label: 'Nifty', lot: 65, step: 50, exchange: 'NSE' },
  { symbol: 'BANKNIFTY', label: 'Bank Nifty', lot: 30, step: 100, exchange: 'NSE' },
  { symbol: 'SENSEX', label: 'Sensex', lot: 20, step: 100, exchange: 'BSE' }
];

type ChainLeg = {
  ltp?: number;
  iv?: number;
  oi?: number;
  tradingSymbol?: string;
  id?: string;
};

type ChainQuoteMeta = {
  quoteSource?: string;
  brokerQuoteCount?: number;
  message?: string;
  quoteFreshness?: 'live' | 'delayed';
};

type IndexDeskState = {
  underlying: string;
  label: string;
  lot: number;
  step: number;
  exchange: string;
  expiry: string;
  expiryLabel: string;
  spot: number;
  atm: number;
  rows: Array<{ strike: number; ce?: ChainLeg; pe?: ChainLeg }>;
  loading: boolean;
  quoteMeta?: ChainQuoteMeta;
};

function isLiveBrokerQuotes(meta?: ChainQuoteMeta | null): boolean {
  const src = (meta?.quoteSource || '').toLowerCase();
  return (meta?.brokerQuoteCount || 0) > 0 && !src.includes('model') && src !== 'unavailable';
}

function ChainPremiumBanner({ meta }: { meta?: ChainQuoteMeta | null }) {
  if (!meta?.quoteSource && meta?.brokerQuoteCount == null) return null;
  const live = isLiveBrokerQuotes(meta);
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: 1.35,
        padding: '6px 8px',
        borderRadius: 6,
        border: live ? '1px solid rgba(74,222,128,0.45)' : '1px solid rgba(251,191,36,0.5)',
        background: live ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
        color: live ? '#86efac' : '#fcd34d'
      }}
    >
      {live ? (
        <>
          Live broker premiums ({meta?.quoteSource}
          {meta?.brokerQuoteCount != null ? ` · ${meta.brokerQuoteCount} legs` : ''})
        </>
      ) : (
        <>
          Model premiums (not exchange LTP) — connect Dhan or set DHAN_CLIENT_ID / DHAN_ACCESS_TOKEN
          for prices that match Zerodha/Dhan.
          {meta?.message ? ` ${meta.message}` : ''}
        </>
      )}
    </div>
  );
}

function foStrikeStep(underlying: string): number {
  return FO_STRIKE_STEP[(underlying || '').toUpperCase()] ?? 50;
}

const panel: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(56,189,248,0.35)',
  background: 'rgba(15,23,42,0.9)',
  padding: 16,
  color: '#e2e8f0'
};

const btn: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid rgba(56,189,248,0.4)',
  background: 'rgba(14,165,233,0.15)',
  color: '#7dd3fc',
  cursor: 'pointer',
  fontSize: 12
};

const input: CSSProperties = {
  padding: 8,
  borderRadius: 8,
  border: '1px solid #334155',
  background: '#020617',
  color: '#e2e8f0',
  width: '100%'
};

function formatPrice(n: number) {
  if (!Number.isFinite(n)) return '—';
  return n >= 1000 ? n.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : n.toFixed(2);
}

type Tab = 'ticket' | 'basket' | 'chart' | 'audit';

export function TradingTerminalPanel({ initialTab = 'ticket' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { query, setQuery, results, search, loading, error } = useInstrumentSearch('RELIANCE');
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [tradability, setTradability] = useState<Record<string, unknown> | null>(null);
  const [derivatives, setDerivatives] = useState<Instrument[]>([]);
  const [qty, setQty] = useState(1);
  /** Order size mode: absolute units vs number of lots (FO lot × lots). */
  const [qtyMode, setQtyMode] = useState<'QUANTITY' | 'LOTS'>('LOTS');
  const [lots, setLots] = useState(1);
  const [orderType, setOrderType] = useState('MARKET');
  const [product, setProduct] = useState('CNC');
  const [price, setPrice] = useState(0);
  const [stopLoss, setStopLoss] = useState(0);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [contractQuote, setContractQuote] = useState<ContractQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [expiryKind, setExpiryKind] = useState<'WEEKLY' | 'MONTHLY' | 'ALL'>('ALL');
  const [monthlyOnly, setMonthlyOnly] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [expiryOptions, setExpiryOptions] = useState<FoExpiryEntry[]>([]);
  const [chainRows, setChainRows] = useState<
    Array<{ strike: number; ce?: { ltp: number }; pe?: { ltp: number } }>
  >([]);
  const [chainQuoteMeta, setChainQuoteMeta] = useState<ChainQuoteMeta | null>(null);
  const [liveAtm, setLiveAtm] = useState<number | null>(null);
  const { baskets, reload: reloadBaskets, error: basketsError } = useBasketOrders();
  const [activeBasketId, setActiveBasketId] = useState<string | null>(null);
  const [basketDetail, setBasketDetail] = useState<Record<string, unknown> | null>(null);
  const [basketNameDraft, setBasketNameDraft] = useState('Terminal Basket');
  const [newBasketName, setNewBasketName] = useState('');
  const [audits, setAudits] = useState<Record<string, unknown>[]>([]);
  const [legSymbol, setLegSymbol] = useState('RELIANCE');
  const [legSide, setLegSide] = useState<'BUY' | 'SELL'>('BUY');
  const [legQty, setLegQty] = useState(1);
  const [indexDesk, setIndexDesk] = useState<IndexDeskState | null>(null);
  const [deskBusy, setDeskBusy] = useState(false);
  const [chartStock, setChartStock] = useState<WatchlistItem | null>(null);
  const [chartTradeInstrument, setChartTradeInstrument] = useState<Instrument | null>(null);

  useEffect(() => {
    if (tab === 'basket') {
      void reloadBaskets().catch(() => undefined);
    }
  }, [tab, reloadBaskets]);

  useEffect(() => {
    if (!selected) return;
    void tradingApi.getInstrumentTradability(selected.instrument_id).then(setTradability);
    if (selected.instrument_type === 'INDEX') {
      void tradingApi.getDerivativeContracts(selected.instrument_id).then((d) => {
        setDerivatives(d.contracts || []);
      });
    } else {
      setDerivatives([]);
    }
  }, [selected]);

  useEffect(() => {
    if (!selected?.symbol) {
      setQuote(null);
      setContractQuote(null);
      setQuoteErr(null);
      setExpiryOptions([]);
      setChainRows([]);
      setChainQuoteMeta(null);
      setLiveAtm(null);
      return;
    }
    let cancelled = false;
    let first = true;
    const isOption =
      selected.instrument_type.includes('OPTION') ||
      /CE$|PE$/i.test(selected.symbol);

    const applyContractQuote = (cq: ContractQuote) => {
      setContractQuote(cq);
      setQuote(
        cq.spot
          ? {
              symbol: cq.underlying || selected.symbol,
              price: cq.spot,
              change: cq.spot_change,
              changePercent: cq.spot_change_percent,
              source: cq.spot_source || undefined
            }
          : null
      );
      const orderPx = cq.order_price ?? cq.premium;
      if (orderPx && orderPx > 0) {
        setPrice((prev) => (prev <= 0 ? Math.round(orderPx * 100) / 100 : prev));
      }
      if (cq.lot_size > 1) {
        setQty((prev) => (prev === 1 ? cq.lot_size : prev));
        setLots((prev) => (prev < 1 ? 1 : prev));
      }
    };

    const loadQuote = async () => {
      if (first) setQuoteLoading(true);
      setQuoteErr(null);
      try {
        if (isOption) {
          const cq = await tradingApi.getContractQuote(selected.instrument_id, {
            expiry: selectedExpiry || undefined,
            kind: expiryKind
          });
          if (cancelled) return;
          applyContractQuote(cq);

          const cal = cq.expiry_calendar?.calendar || [];
          const onlyMonthly =
            Boolean((cq.expiry_calendar as { monthly_only?: boolean } | undefined)?.monthly_only) ||
            (cal.length > 0 && cal.every((e) => e.kind === 'MONTHLY'));
          setMonthlyOnly(onlyMonthly);
          const kindFilter = onlyMonthly ? 'MONTHLY' : expiryKind;
          if (onlyMonthly && expiryKind !== 'MONTHLY') setExpiryKind('MONTHLY');
          const filtered =
            kindFilter === 'ALL' ? cal : cal.filter((e) => e.kind === kindFilter);
          setExpiryOptions(filtered.length ? filtered : cal);

          // Keep dropdown + quote on the same settlement date (avoid stale instrument.expiry)
          const exp =
            selectedExpiry && filtered.some((e) => e.date === selectedExpiry)
              ? selectedExpiry
              : filtered[0]?.date || cq.expiry || '';
          if (exp && exp !== selectedExpiry) {
            setSelectedExpiry(exp);
          }

          const und = cq.underlying || selected.underlying_symbol;
          if (und && exp) {
            const chain = await tradingApi.getOptionsChain({
              underlying: und,
              expiry: exp,
              kind: kindFilter
            });
            if (cancelled) return;
            setChainRows(chain.rows || []);
            setChainQuoteMeta({
              quoteSource: chain.quoteSource,
              brokerQuoteCount: chain.brokerQuoteCount,
              message: chain.message,
              quoteFreshness: chain.quoteFreshness
            });
            if (chain.atm != null && chain.atm > 0) setLiveAtm(chain.atm);
            else if (cq.spot && cq.spot > 0) {
              const step = foStrikeStep(und);
              setLiveAtm(Math.round(cq.spot / step) * step);
            }
          }
        } else {
          setContractQuote(null);
          setChainRows([]);
          setChainQuoteMeta(null);
          setLiveAtm(null);
          const q = await tradingApi.getQuote(selected.symbol);
          if (cancelled) return;
          setQuote(q);
          if (q.price > 0) {
            setPrice((prev) => (prev <= 0 ? Math.round(q.price * 100) / 100 : prev));
          }
        }
      } catch (e) {
        if (cancelled) return;
        setQuote(null);
        setContractQuote(null);
        setQuoteErr(e instanceof Error ? e.message : 'Quote unavailable');
      } finally {
        if (!cancelled && first) {
          setQuoteLoading(false);
          first = false;
        }
      }
    };

    void loadQuote();
    const timer = window.setInterval(() => {
      void loadQuote();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [selected?.symbol, selected?.instrument_id, selectedExpiry, expiryKind]);

  const pick = (inst: Instrument) => {
    setSelected(inst);
    setPreview(null);
    setMsg('');
    setQuote(null);
    setContractQuote(null);
    setQuoteErr(null);
    setPrice(0);
    setSelectedExpiry('');
    setExpiryKind('ALL');
    setChainRows([]);
    setChainQuoteMeta(null);
    setLiveAtm(null);
    if (inst.instrument_type.includes('FUTURE') || inst.instrument_type.includes('OPTION')) {
      setProduct('NRML');
      const lot = Math.max(1, inst.lot_size || 1);
      setQtyMode(lot > 1 ? 'LOTS' : 'QUANTITY');
      setLots(1);
      setQty(lot);
    } else {
      setProduct('CNC');
      setQtyMode('QUANTITY');
      setLots(1);
      setQty(1);
    }
  };

  const lotSize = Math.max(
    1,
    Number(contractQuote?.lot_size || selected?.lot_size || 1) || 1
  );
  const isFoLot =
    Boolean(selected) &&
    (selected!.instrument_type.includes('FUTURE') ||
      selected!.instrument_type.includes('OPTION') ||
      /CE$|PE$|FUT$/i.test(selected!.symbol)) &&
    lotSize > 1;

  /** Units sent to the broker / paper engine. */
  const orderQuantity = () => {
    if (qtyMode === 'LOTS' && isFoLot) return Math.max(1, Math.floor(lots)) * lotSize;
    return Math.max(1, Math.floor(qty));
  };

  const resolveOptionInstrument = async (
    underlying: string,
    strike: number,
    side: 'CE' | 'PE',
    expiry?: string
  ): Promise<Instrument | null> => {
    const q = `${underlying} ${strike}`;
    const rows = await tradingApi.searchInstruments(q);
    const sym = `${underlying}${strike}${side}`;
    const hit =
      rows.find((x) => x.symbol === sym) ||
      rows.find(
        (x) =>
          Number(x.strike) === strike &&
          (x.option_type || '').toUpperCase() === side &&
          (x.underlying_symbol || '').toUpperCase() === underlying
      ) ||
      rows.find(
        (x) => Number(x.strike) === strike && (x.option_type || '').toUpperCase() === side
      );
    if (hit && expiry) {
      // Keep monthly expiry on the instrument for premium/quote
      return { ...hit, expiry };
    }
    return hit || null;
  };

  const openIndexDesk = async (idx: (typeof QUICK_INDICES)[number]) => {
    setTab('ticket');
    setIndexDesk({
      underlying: idx.symbol,
      label: idx.label,
      lot: idx.lot,
      step: idx.step,
      exchange: idx.exchange,
      expiry: '',
      expiryLabel: '',
      spot: 0,
      atm: 0,
      rows: [],
      loading: true
    });
    setExpiryKind('MONTHLY');
    setQtyMode('LOTS');
    setLots(1);
    setQty(idx.lot);
    setProduct('NRML');
    setBusy(true);
    try {
      const cal = await tradingApi.getOptionExpiries(idx.symbol);
      const monthly = (cal.monthly?.length ? cal.monthly : cal.calendar.filter((e) => e.kind === 'MONTHLY')) || [];
      const exp = monthly[0]?.date || cal.expiries[0] || '';
      const expLabel = monthly[0]?.label || cal.calendar.find((e) => e.date === exp)?.label || exp;
      if (!exp) throw new Error(`No monthly expiry for ${idx.symbol}`);
      setSelectedExpiry(exp);
      setExpiryOptions(monthly.length ? monthly : cal.calendar);

      const chain = await tradingApi.getOptionsChain({
        underlying: idx.symbol,
        expiry: exp,
        kind: 'MONTHLY'
      });
      const spot = Number(chain.spotPrice || 0);
      const atm =
        chain.atm && chain.atm > 0
          ? chain.atm
          : spot > 0
            ? Math.round(spot / idx.step) * idx.step
            : 0;
      setLiveAtm(atm || null);
      setChainRows(chain.rows || []);
      const quoteMeta: ChainQuoteMeta = {
        quoteSource: chain.quoteSource,
        brokerQuoteCount: chain.brokerQuoteCount,
        message: chain.message,
        quoteFreshness: chain.quoteFreshness
      };
      setChainQuoteMeta(quoteMeta);
      setIndexDesk({
        underlying: idx.symbol,
        label: idx.label,
        lot: idx.lot,
        step: idx.step,
        exchange: idx.exchange,
        expiry: exp,
        expiryLabel: chain.expiry_label || expLabel,
        spot,
        atm,
        rows: chain.rows || [],
        loading: false,
        quoteMeta
      });

      // Seed ticket with ATM CE so Buy/Sell + chart work immediately
      if (atm > 0) {
        const seed = await resolveOptionInstrument(idx.symbol, atm, 'CE', exp);
        if (seed) {
          pick(seed);
          setSelectedExpiry(exp);
          if (chain.rows) {
            const row = chain.rows.find((r) => r.strike === atm);
            if (row?.ce?.ltp && row.ce.ltp > 0) setPrice(Math.round(row.ce.ltp * 100) / 100);
          }
        } else {
          setQuery(`${idx.symbol} ${atm}`);
          void search(`${idx.symbol} ${atm}`);
        }
      }
      toast.success(`${idx.label} monthly chain · ${expLabel}`);
    } catch (e) {
      setIndexDesk(null);
      toast.error(e instanceof Error ? e.message : `Failed to open ${idx.label} chain`);
    } finally {
      setBusy(false);
    }
  };

  const tradeChainLeg = async (
    underlying: string,
    strike: number,
    optionType: 'CE' | 'PE',
    side: 'BUY' | 'SELL',
    ltp?: number,
    expiry?: string
  ) => {
    setDeskBusy(true);
    try {
      const inst = await resolveOptionInstrument(underlying, strike, optionType, expiry || selectedExpiry);
      if (!inst) {
        toast.error(`Could not resolve ${underlying} ${strike} ${optionType}`);
        return;
      }
      pick(inst);
      if (expiry || selectedExpiry) setSelectedExpiry(expiry || selectedExpiry);
      if (ltp && ltp > 0) setPrice(Math.round(ltp * 100) / 100);
      const lot = Math.max(1, inst.lot_size || indexDesk?.lot || 1);
      setQtyMode('LOTS');
      setLots(1);
      setQty(lot);
      const quantity = lot; // 1 lot
      const p = await tradingApi.previewOrder({
        instrument_id: inst.instrument_id,
        symbol: inst.symbol,
        exchange: inst.exchange,
        side,
        quantity,
        order_type: orderType,
        product_type: 'NRML',
        price: ltp && ltp > 0 ? ltp : undefined,
        mode: 'PAPER',
        source: 'ORDER_TICKET'
      });
      if (!p.allowed || !p.preview_id) {
        toast.error(`Blocked: ${JSON.stringify(p.warnings)}`);
        setPreview(p);
        return;
      }
      await tradingApi.submitOrder(String(p.preview_id));
      toast.success(`${side} ${inst.symbol} · 1 lot (${quantity} qty)`);
      setMsg(`${side} submitted ${inst.symbol}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Trade failed');
    } finally {
      setDeskBusy(false);
    }
  };

  const openChartForLeg = async (
    underlying: string,
    strike: number,
    optionType: 'CE' | 'PE',
    ltp?: number,
    expiry?: string
  ) => {
    try {
      const inst = await resolveOptionInstrument(underlying, strike, optionType, expiry || selectedExpiry);
      if (!inst) {
        toast.error(`Could not resolve ${underlying} ${strike} ${optionType}`);
        return;
      }
      pick(inst);
      if (expiry || selectedExpiry) setSelectedExpiry(expiry || selectedExpiry);
      if (ltp && ltp > 0) setPrice(Math.round(ltp * 100) / 100);
      setQtyMode('LOTS');
      setLots(1);
      setQty(Math.max(1, inst.lot_size || 1));
      setChartTradeInstrument(inst);
      setChartStock({
        id: `chart-${underlying}`,
        symbol: underlying,
        exchange: indexDesk?.exchange || (underlying === 'SENSEX' ? 'BSE' : 'NSE'),
        sortOrder: 0,
        name: `${underlying} · ${strike} ${optionType}`
      });
      setTab('chart');
      toast.message(`Chart · trade ${inst.symbol} on the right rail`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chart open failed');
    }
  };

  const orderPrice = () => {
    if (price > 0) return price;
    if (contractQuote?.premium && contractQuote.premium > 0) return contractQuote.premium;
    if (quote?.price && quote.price > 0) return quote.price;
    return undefined;
  };

  const doPreview = async (side: 'BUY' | 'SELL') => {
    if (!selected) return;
    setBusy(true);
    try {
      const p = await tradingApi.previewOrder({
        instrument_id: selected.instrument_id,
        symbol: selected.symbol,
        exchange: selected.exchange,
        side,
        quantity: orderQuantity(),
        order_type: orderType,
        product_type: product,
        price: orderPrice(),
        stop_loss: stopLoss || undefined,
        mode: 'PAPER',
        source: 'ORDER_TICKET'
      });
      setPreview(p);
      setMsg(p.allowed ? `Preview OK — ${p.next_action}` : `Blocked: ${JSON.stringify(p.warnings)}`);
      return p;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
      return null;
    } finally {
      setBusy(false);
    }
  };

  /** Paper Buy/Sell: preview then submit in one click (live remains locked). */
  const doBuySell = async (side: 'BUY' | 'SELL') => {
    if (!selected) return;
    setBusy(true);
    try {
      const p = await tradingApi.previewOrder({
        instrument_id: selected.instrument_id,
        symbol: selected.symbol,
        exchange: selected.exchange,
        side,
        quantity: orderQuantity(),
        order_type: orderType,
        product_type: product,
        price: orderPrice(),
        stop_loss: stopLoss || undefined,
        mode: 'PAPER',
        source: 'ORDER_TICKET'
      });
      setPreview(p);
      if (!p.allowed || !p.preview_id) {
        setMsg(`Blocked: ${JSON.stringify(p.warnings)}`);
        toast.error('Order blocked — check preview warnings');
        return;
      }
      const res = await tradingApi.submitOrder(String(p.preview_id));
      toast.success(`${side} paper order submitted`);
      setMsg(`Submitted ${side} order ${(res.order as { id?: string })?.id || 'ok'}`);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `${side} failed`);
    } finally {
      setBusy(false);
    }
  };

  const doSubmit = async () => {
    if (!preview?.preview_id) return;
    setBusy(true);
    try {
      const res = await tradingApi.submitOrder(String(preview.preview_id));
      toast.success('Paper order submitted via OMS');
      setMsg(`Submitted order ${(res.order as { id?: string })?.id || 'ok'}`);
      setPreview(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  };

  const createBasket = async (name?: string) => {
    setBusy(true);
    try {
      const basket_name = (name || newBasketName || basketNameDraft || 'Terminal Basket').trim();
      const b = await tradingApi.createBasket({ basket_name, mode: 'PAPER' });
      const id = String(b.id || '');
      if (!id) throw new Error('Basket created but no id returned');
      setActiveBasketId(id);
      setBasketNameDraft(basket_name);
      setNewBasketName('');
      await reloadBaskets();
      setBasketDetail(await tradingApi.getBasket(id));
      toast.success(`Saved basket “${basket_name}”`);
      setTab('basket');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create basket failed');
    } finally {
      setBusy(false);
    }
  };

  const saveBasketName = async () => {
    if (!activeBasketId) return;
    const name = basketNameDraft.trim();
    if (!name) {
      toast.error('Enter a basket name');
      return;
    }
    setBusy(true);
    try {
      const updated = await tradingApi.updateBasket(activeBasketId, { basket_name: name });
      setBasketDetail(updated);
      setBasketNameDraft(String(updated.basket_name || updated.basketName || name));
      await reloadBaskets();
      toast.success(`Basket saved as “${name}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save basket failed');
    } finally {
      setBusy(false);
    }
  };

  const selectBasket = async (id: string) => {
    setActiveBasketId(id);
    try {
      const detail = await tradingApi.getBasket(id);
      setBasketDetail(detail);
      setBasketNameDraft(String(detail.basket_name || detail.basketName || 'Basket'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Load basket failed');
    }
  };

  const addLeg = async () => {
    if (!activeBasketId) return;
    setBusy(true);
    try {
      await tradingApi.addBasketLeg(activeBasketId, {
        symbol: legSymbol,
        side: legSide,
        quantity: legQty,
        order_type: 'MARKET',
        price
      });
      setBasketDetail(await tradingApi.getBasket(activeBasketId));
      toast.success('Leg added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Add leg failed');
    } finally {
      setBusy(false);
    }
  };

  const previewBasket = async () => {
    if (!activeBasketId) return;
    setBusy(true);
    try {
      const p = await tradingApi.previewBasket(activeBasketId);
      setMsg(
        `Basket margin ₹${p.total_estimated_margin} · risk ₹${p.total_risk} · allowed=${p.allowed}`
      );
      setBasketDetail(await tradingApi.getBasket(activeBasketId));
      toast.success(p.allowed ? 'Risk preview OK' : 'Risk preview blocked — check warnings');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview basket failed');
    } finally {
      setBusy(false);
    }
  };

  const submitBasket = async () => {
    if (!activeBasketId) return;
    const legs = (basketDetail?.legs as unknown[]) || [];
    if (!legs.length) {
      toast.error('Add at least one leg before executing');
      return;
    }
    const name = String(basketDetail?.basket_name || basketDetail?.basketName || basketNameDraft);
    if (
      !window.confirm(
        `Execute paper basket “${name}” with ${legs.length} leg(s) now?\nThis places paper orders immediately.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      // Persist name before execute so the fill is attributed to the saved label
      if (basketNameDraft.trim() && basketNameDraft.trim() !== name) {
        await tradingApi.updateBasket(activeBasketId, { basket_name: basketNameDraft.trim() });
      }
      const res = await tradingApi.submitBasket(activeBasketId);
      const status = String((res.basket as { status?: string })?.status || 'EXECUTED');
      toast.success(`Executed “${name}” · ${status} · filled ${res.filled}`);
      setBasketDetail(await tradingApi.getBasket(activeBasketId));
      await reloadBaskets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Execute basket failed');
    } finally {
      setBusy(false);
    }
  };

  const duplicateBasket = async () => {
    if (!activeBasketId) return;
    setBusy(true);
    try {
      const copy = await tradingApi.duplicateBasket(activeBasketId);
      const id = String(copy.id || '');
      await reloadBaskets();
      if (id) await selectBasket(id);
      toast.success(`Duplicated as “${String(copy.basket_name || copy.basketName)}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  };

  const loadAudits = async () => {
    setAudits(await tradingApi.listAudits());
  };

  const buySellEnabled = Boolean(tradability?.buy_sell_enabled);
  const indexBlocked = Boolean(tradability?.index_spot_blocked);

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#7dd3fc' }}>Trading Terminal</div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Stocks &amp; index derivatives · Basket · Chart qty · Paper default · Live locked
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['ticket', 'basket', 'chart', 'audit'] as Tab[]).map((t) => (
            <button key={t} type="button" style={{ ...btn, opacity: tab === t ? 1 : 0.65 }} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {msg ? <div style={{ marginTop: 10, color: '#fde68a', fontSize: 13 }}>{msg}</div> : null}

      {(tab === 'ticket' || tab === 'chart') && (
        <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Index desk</span>
            {QUICK_INDICES.map((idx) => (
              <button
                key={idx.symbol}
                type="button"
                style={{
                  ...btn,
                  fontWeight: 700,
                  borderColor:
                    indexDesk?.underlying === idx.symbol ? '#22d3ee' : 'rgba(56,189,248,0.45)',
                  background:
                    indexDesk?.underlying === idx.symbol
                      ? 'rgba(34,211,238,0.22)'
                      : 'rgba(14,165,233,0.18)'
                }}
                disabled={busy}
                onClick={() => void openIndexDesk(idx)}
              >
                {idx.label}
                <span style={{ opacity: 0.75, fontWeight: 500 }}> · lot {idx.lot}</span>
              </button>
            ))}
            <span style={{ fontSize: 11, color: '#64748b' }}>Opens monthly option chain + Buy/Sell</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input}
              value={query}
              placeholder="Search RELIANCE, NIFTY, TCS, SBIN…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search(query);
              }}
            />
            <button type="button" style={btn} onClick={() => void search(query)} disabled={loading}>
              {loading ? '…' : 'Search'}
            </button>
          </div>
          {error ? (
            <div style={{ color: '#fca5a5', fontSize: 12 }}>{error}</div>
          ) : null}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 140, overflow: 'auto' }}>
            {(results || []).map((r) => (
              <button
                key={r.instrument_id}
                type="button"
                style={{
                  ...btn,
                  borderColor:
                    selected?.instrument_id === r.instrument_id ? '#22d3ee' : 'rgba(56,189,248,0.4)'
                }}
                onClick={() => pick(r)}
              >
                {r.symbol} · {r.instrument_type}
              </button>
            ))}
          </div>

          {tab === 'ticket' && indexDesk ? (
            <div
              style={{
                marginTop: 4,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(34,211,238,0.35)',
                background: 'rgba(8,47,73,0.35)',
                display: 'grid',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ fontWeight: 700, color: '#ecfeff', fontSize: 15 }}>
                  {indexDesk.label} · monthly chain
                </div>
                <span style={{ fontSize: 12, color: '#7dd3fc' }}>
                  {indexDesk.expiryLabel || indexDesk.expiry}
                </span>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  Spot ₹{formatPrice(indexDesk.spot)}
                  {indexDesk.atm ? ` · ATM ${indexDesk.atm}` : ''}
                  {` · lot ${indexDesk.lot}`}
                </span>
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  style={{ ...btn, padding: '4px 10px' }}
                  disabled={busy || indexDesk.loading}
                  onClick={() => {
                    const idx = QUICK_INDICES.find((x) => x.symbol === indexDesk.underlying);
                    if (idx) void openIndexDesk(idx);
                  }}
                >
                  Refresh
                </button>
                <button
                  type="button"
                  style={{ ...btn, padding: '4px 10px' }}
                  onClick={() => {
                    setChartTradeInstrument(selected);
                    setChartStock({
                      id: `chart-${indexDesk.underlying}`,
                      symbol: indexDesk.underlying,
                      exchange: indexDesk.exchange,
                      sortOrder: 0,
                      name: indexDesk.label
                    });
                  }}
                >
                  Open chart
                </button>
                <button type="button" style={{ ...btn, padding: '4px 10px' }} onClick={() => setIndexDesk(null)}>
                  Close desk
                </button>
              </div>
              {indexDesk.loading ? (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading monthly option chain…</div>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  <ChainPremiumBanner meta={indexDesk.quoteMeta} />
                <div style={{ overflowX: 'auto', maxHeight: 360, borderRadius: 8, border: '1px solid #334155' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ color: '#94a3b8', position: 'sticky', top: 0, background: '#0f172a' }}>
                        <th style={{ padding: 6, textAlign: 'left' }}>CE LTP</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>CE</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>Strike</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>PE</th>
                        <th style={{ padding: 6, textAlign: 'right' }}>PE LTP</th>
                        <th style={{ padding: 6, textAlign: 'center' }}>Chart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(indexDesk.rows.length
                        ? indexDesk.rows.filter((r) => {
                            if (!indexDesk.atm) return true;
                            return Math.abs(r.strike - indexDesk.atm) <= indexDesk.step * 8;
                          })
                        : []
                      )
                        .sort((a, b) => a.strike - b.strike)
                        .map((r) => {
                          const isAtm = indexDesk.atm > 0 && r.strike === indexDesk.atm;
                          const mini = (label: string, onClick: () => void, color: string) => (
                            <button
                              key={label}
                              type="button"
                              disabled={deskBusy || busy}
                              style={{
                                ...btn,
                                padding: '2px 6px',
                                fontSize: 10,
                                color,
                                borderColor: 'rgba(148,163,184,0.35)'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onClick();
                              }}
                            >
                              {label}
                            </button>
                          );
                          return (
                            <tr
                              key={r.strike}
                              style={{
                                background: isAtm ? 'rgba(34,197,94,0.16)' : 'transparent',
                                borderTop: '1px solid rgba(51,65,85,0.45)'
                              }}
                            >
                              <td style={{ padding: 6, color: '#86efac' }}>
                                {r.ce?.ltp != null ? formatPrice(r.ce.ltp) : '—'}
                              </td>
                              <td style={{ padding: 4, textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: 4 }}>
                                  {mini('B', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'CE',
                                      'BUY',
                                      r.ce?.ltp,
                                      indexDesk.expiry
                                    ), '#86efac')}
                                  {mini('S', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'CE',
                                      'SELL',
                                      r.ce?.ltp,
                                      indexDesk.expiry
                                    ), '#fca5a5')}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: 6,
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  color: isAtm ? '#86efac' : '#e2e8f0'
                                }}
                              >
                                {r.strike}
                                {isAtm ? ' ATM' : ''}
                              </td>
                              <td style={{ padding: 4, textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: 4 }}>
                                  {mini('B', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'PE',
                                      'BUY',
                                      r.pe?.ltp,
                                      indexDesk.expiry
                                    ), '#86efac')}
                                  {mini('S', () =>
                                    void tradeChainLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'PE',
                                      'SELL',
                                      r.pe?.ltp,
                                      indexDesk.expiry
                                    ), '#fca5a5')}
                                </div>
                              </td>
                              <td style={{ padding: 6, textAlign: 'right', color: '#fca5a5' }}>
                                {r.pe?.ltp != null ? formatPrice(r.pe.ltp) : '—'}
                              </td>
                              <td style={{ padding: 4, textAlign: 'center' }}>
                                <button
                                  type="button"
                                  style={{ ...btn, padding: '2px 8px', fontSize: 10 }}
                                  onClick={() =>
                                    void openChartForLeg(
                                      indexDesk.underlying,
                                      r.strike,
                                      'CE',
                                      r.ce?.ltp,
                                      indexDesk.expiry
                                    )
                                  }
                                >
                                  Chart
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#64748b' }}>
                B/S = Buy/Sell 1 lot on that CE/PE. Chart opens underlying candles with option ticket on the
                right.
              </div>
            </div>
          ) : null}
        </div>
      )}

      {tab === 'ticket' && selected && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 700 }}>
                  {selected.display_name} ({selected.symbol})
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  {selected.instrument_type} · lot{' '}
                  {contractQuote?.lot_size || selected.lot_size} ·{' '}
                  {selected.direct_trading_allowed ? 'direct OK' : 'no direct trade'}
                </div>
                {contractQuote?.strike != null || selected.strike != null ? (
                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      gap: 10,
                      flexWrap: 'wrap',
                      fontSize: 12
                    }}
                  >
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(14,165,233,0.15)',
                        border: '1px solid rgba(56,189,248,0.35)',
                        color: '#7dd3fc'
                      }}
                    >
                      Strike{' '}
                      <b style={{ color: '#f8fafc' }}>
                        {formatPrice(Number(contractQuote?.strike ?? selected.strike))}
                      </b>
                    </span>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'rgba(51,65,85,0.5)',
                        border: '1px solid #475569',
                        color: '#e2e8f0'
                      }}
                    >
                      {(contractQuote?.option_type || selected.option_type || '—') as string}
                    </span>
                    <span style={{ color: '#94a3b8', alignSelf: 'center' }}>
                      Underlying {contractQuote?.underlying || selected.underlying_symbol || '—'}
                    </span>
                  </div>
                ) : null}
                {(selected.instrument_type.includes('OPTION') || /CE$|PE$/i.test(selected.symbol)) && (
                  <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {((monthlyOnly ? ['MONTHLY'] : ['ALL', 'WEEKLY', 'MONTHLY']) as const).map((k) => (
                        <button
                          key={k}
                          type="button"
                          style={{
                            ...btn,
                            padding: '4px 10px',
                            opacity: expiryKind === k ? 1 : 0.65,
                            borderColor:
                              expiryKind === k ? '#22d3ee' : 'rgba(56,189,248,0.4)',
                            background:
                              expiryKind === k ? 'rgba(34,211,238,0.2)' : 'rgba(14,165,233,0.15)'
                          }}
                          onClick={() => {
                            setExpiryKind(k);
                            setSelectedExpiry('');
                            setPrice(0);
                          }}
                        >
                          {k === 'ALL' ? 'All expiries' : k === 'WEEKLY' ? 'Weekly' : 'Monthly'}
                        </button>
                      ))}
                    </div>
                    <label style={{ fontSize: 12, color: '#94a3b8' }}>
                      Expiry
                      <select
                        style={input}
                        value={selectedExpiry}
                        onChange={(e) => {
                          setSelectedExpiry(e.target.value);
                          setPrice(0);
                        }}
                      >
                        {!expiryOptions.length ? <option value="">Loading…</option> : null}
                        {expiryOptions.map((ex) => (
                          <option key={ex.date} value={ex.date}>
                            {ex.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {(() => {
                      const expMeta =
                        expiryOptions.find((e) => e.date === selectedExpiry) ||
                        expiryOptions.find((e) => e.date === contractQuote?.expiry);
                      return expMeta || selectedExpiry ? (
                        <div style={{ fontSize: 12, color: '#7dd3fc' }}>
                          Selected: {expMeta?.label || selectedExpiry}
                          {expMeta?.kind ? ` · ${expMeta.kind}` : ''}
                        </div>
                      ) : null;
                    })()}
                    {liveAtm != null || contractQuote?.spot ? (
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 8,
                          alignItems: 'center',
                          fontSize: 12
                        }}
                      >
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            background: isLiveBrokerQuotes(chainQuoteMeta)
                              ? 'rgba(34,197,94,0.15)'
                              : 'rgba(245,158,11,0.12)',
                            border: isLiveBrokerQuotes(chainQuoteMeta)
                              ? '1px solid rgba(74,222,128,0.4)'
                              : '1px solid rgba(251,191,36,0.45)',
                            color: isLiveBrokerQuotes(chainQuoteMeta) ? '#86efac' : '#fcd34d'
                          }}
                        >
                          {isLiveBrokerQuotes(chainQuoteMeta) ? 'Live ATM' : 'ATM'}{' '}
                          <b style={{ color: '#f8fafc' }}>
                            {liveAtm != null
                              ? liveAtm
                              : Math.round(Number(contractQuote?.spot || 0) / 50) * 50}
                          </b>
                          {contractQuote?.spot
                            ? ` · spot ₹${formatPrice(contractQuote.spot)}`
                            : ''}
                        </span>
                        <button
                          type="button"
                          style={{ ...btn, padding: '4px 10px', fontSize: 11 }}
                          onClick={() => {
                            const und =
                              contractQuote?.underlying ||
                              selected.underlying_symbol ||
                              'NIFTY';
                            const side = (contractQuote?.option_type ||
                              selected.option_type ||
                              'CE') as 'CE' | 'PE';
                            const step = foStrikeStep(und);
                            const atm =
                              liveAtm ??
                              Math.round(Number(contractQuote?.spot || 0) / step) * step;
                            if (!atm) return;
                            const keepExpiry = selectedExpiry;
                            const q = `${und} ${atm}`;
                            setQuery(q);
                            void tradingApi.searchInstruments(q).then((rows) => {
                              const sym = `${und}${atm}${side}`;
                              const hit =
                                rows.find((x) => x.symbol === sym) ||
                                rows.find(
                                  (x) =>
                                    Number(x.strike) === atm &&
                                    (x.option_type || '').toUpperCase() === side
                                );
                              if (hit) {
                                pick(hit);
                                if (keepExpiry) setSelectedExpiry(keepExpiry);
                                toast.success(`Live ATM ${sym}`);
                              } else {
                                void search(q);
                                toast.message(`Search results for live ATM ${atm}`);
                              }
                            });
                          }}
                        >
                          Select live ATM
                        </button>
                      </div>
                    ) : null}
                    {chainRows.length > 0 ? (
                      <div style={{ display: 'grid', gap: 8 }}>
                        <ChainPremiumBanner meta={chainQuoteMeta} />
                      <div style={{ overflowX: 'auto', maxHeight: 220, borderRadius: 8, border: '1px solid #334155' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr style={{ color: '#94a3b8' }}>
                              <th style={{ padding: 6, textAlign: 'left' }}>CE</th>
                              <th style={{ padding: 6, textAlign: 'center' }}>Strike</th>
                              <th style={{ padding: 6, textAlign: 'right' }}>PE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const selectedStrike = Number(
                                contractQuote?.strike ?? selected.strike ?? 0
                              );
                              const atm =
                                liveAtm ??
                                (contractQuote?.spot
                                  ? Math.round(Number(contractQuote.spot) / 50) * 50
                                  : 0);
                              // Center on live ATM so spot-nearest strikes are visible
                              const center = atm > 0 ? atm : selectedStrike;
                              const band = chainRows
                                .filter((r) => {
                                  if (!center) return true;
                                  return Math.abs(r.strike - center) <= 400;
                                })
                                .sort((a, b) => a.strike - b.strike);
                              // Keep selected strike in view even if far OTM
                              const withSelected =
                                selectedStrike &&
                                !band.some((r) => r.strike === selectedStrike)
                                  ? [
                                      ...band,
                                      ...chainRows.filter((r) => r.strike === selectedStrike)
                                    ].sort((a, b) => a.strike - b.strike)
                                  : band;
                              return withSelected.map((r) => {
                                const isAtm = atm > 0 && r.strike === atm;
                                const isSelected = selectedStrike > 0 && r.strike === selectedStrike;
                                return (
                                  <tr
                                    key={r.strike}
                                    style={{
                                      background: isAtm
                                        ? 'rgba(34,197,94,0.18)'
                                        : isSelected
                                          ? 'rgba(34,211,238,0.12)'
                                          : 'transparent',
                                      borderTop: '1px solid rgba(51,65,85,0.45)',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                      const und =
                                        contractQuote?.underlying ||
                                        selected.underlying_symbol ||
                                        'NIFTY';
                                      const side = (contractQuote?.option_type ||
                                        selected.option_type ||
                                        'CE') as 'CE' | 'PE';
                                      const keepExpiry = selectedExpiry;
                                      const q = `${und} ${r.strike}`;
                                      setQuery(q);
                                      void tradingApi.searchInstruments(q).then((rows) => {
                                        const sym = `${und}${r.strike}${side}`;
                                        const hit =
                                          rows.find((x) => x.symbol === sym) ||
                                          rows.find(
                                            (x) =>
                                              Number(x.strike) === r.strike &&
                                              (x.option_type || '').toUpperCase() === side
                                          );
                                        if (hit) {
                                          pick(hit);
                                          if (keepExpiry) setSelectedExpiry(keepExpiry);
                                        } else {
                                          void search(q);
                                          toast.message(`Search ${sym} to trade this strike`);
                                        }
                                      });
                                    }}
                                  >
                                    <td style={{ padding: 6, color: '#86efac' }}>
                                      {r.ce?.ltp != null ? formatPrice(r.ce.ltp) : '—'}
                                    </td>
                                    <td
                                      style={{
                                        padding: 6,
                                        textAlign: 'center',
                                        fontWeight: 700,
                                        color: isAtm
                                          ? '#86efac'
                                          : isSelected
                                            ? '#67e8f9'
                                            : '#e2e8f0'
                                      }}
                                    >
                                      {r.strike}
                                      {isAtm ? ' ATM' : ''}
                                    </td>
                                    <td style={{ padding: 6, textAlign: 'right', color: '#fca5a5' }}>
                                      {r.pe?.ltp != null ? formatPrice(r.pe.ltp) : '—'}
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', minWidth: 160 }}>
                {quoteLoading && !quote && !contractQuote ? (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>Fetching quote…</div>
                ) : contractQuote?.premium != null ? (
                  <>
                    <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.3 }}>
                      Option premium
                      {contractQuote.premium_source === 'broker'
                        ? ' · live'
                        : contractQuote.premium_source
                          ? ` · ${contractQuote.premium_source}`
                          : ''}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', lineHeight: 1.1 }}>
                      ₹{formatPrice(contractQuote.premium)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      Spot ₹{formatPrice(Number(contractQuote.spot || 0))}
                      {contractQuote.spot_change_percent
                        ? ` (${contractQuote.spot_change_percent >= 0 ? '+' : ''}${contractQuote.spot_change_percent.toFixed(2)}%)`
                        : ''}
                    </div>
                    {contractQuote.intrinsic != null ? (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Intrinsic ₹{formatPrice(contractQuote.intrinsic)}
                        {contractQuote.time_value != null
                          ? ` · TV ₹${formatPrice(contractQuote.time_value)}`
                          : ''}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      style={{ ...btn, marginTop: 6, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => {
                        if (contractQuote.premium && contractQuote.premium > 0) {
                          setPrice(Math.round(contractQuote.premium * 100) / 100);
                        }
                      }}
                    >
                      Use premium as price
                    </button>
                  </>
                ) : quote ? (
                  <>
                    <div style={{ fontSize: 11, color: '#94a3b8', letterSpacing: 0.3 }}>LTP</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#f8fafc', lineHeight: 1.1 }}>
                      ₹{formatPrice(quote.price)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: quote.change >= 0 ? '#86efac' : '#fca5a5',
                        marginTop: 2
                      }}
                    >
                      {quote.change >= 0 ? '+' : ''}
                      {formatPrice(quote.change)} ({quote.changePercent >= 0 ? '+' : ''}
                      {quote.changePercent.toFixed(2)}%)
                      {quote.stale ? ' · stale' : ''}
                      {quote.source ? ` · ${quote.source}` : ''}
                    </div>
                    <button
                      type="button"
                      style={{ ...btn, marginTop: 6, padding: '4px 8px', fontSize: 11 }}
                      onClick={() => {
                        if (quote.price > 0) setPrice(Math.round(quote.price * 100) / 100);
                      }}
                    >
                      Use as order price
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: '#fca5a5' }}>
                    {quoteErr || 'Quote unavailable'}
                  </div>
                )}
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Mode: <b style={{ color: '#86efac' }}>Paper</b> ·{' '}
              <span style={{ color: '#fca5a5' }}>Live locked</span>
            </div>
            {contractQuote?.message ? (
              <div style={{ marginTop: 6, fontSize: 11, color: '#94a3b8' }}>{contractQuote.message}</div>
            ) : null}
          </div>

          {indexBlocked ? (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(127,29,29,0.35)', color: '#fecaca' }}>
              Index spot cannot be directly traded. Select futures/options contract.
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {derivatives.map((d) => (
                  <button key={d.instrument_id} type="button" style={btn} onClick={() => pick(d)}>
                    {d.display_name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gap: 8 }}>
                {isFoLot ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Size by</span>
                    {(['LOTS', 'QUANTITY'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        style={{
                          ...btn,
                          padding: '4px 10px',
                          opacity: qtyMode === m ? 1 : 0.65,
                          borderColor: qtyMode === m ? '#22d3ee' : 'rgba(56,189,248,0.4)',
                          background:
                            qtyMode === m ? 'rgba(34,211,238,0.2)' : 'rgba(14,165,233,0.15)'
                        }}
                        onClick={() => {
                          if (m === 'LOTS') {
                            setLots(Math.max(1, Math.round(qty / lotSize) || 1));
                          } else {
                            setQty(Math.max(lotSize, Math.floor(lots) * lotSize));
                          }
                          setQtyMode(m);
                        }}
                      >
                        {m === 'LOTS' ? 'Lots' : 'Quantity'}
                      </button>
                    ))}
                    <span style={{ fontSize: 11, color: '#64748b' }}>
                      1 lot = {lotSize} units
                      {selected?.underlying_symbol || /NIFTY|SENSEX/i.test(selected?.symbol || '')
                        ? ` · ${selected?.underlying_symbol || selected?.symbol}`
                        : ''}
                    </span>
                  </div>
                ) : null}
                <div
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}
                >
                  {qtyMode === 'LOTS' && isFoLot ? (
                    <label style={{ fontSize: 12 }}>
                      Lots
                      <input
                        style={input}
                        type="number"
                        min={1}
                        step={1}
                        value={lots}
                        onChange={(e) => setLots(Math.max(1, Number(e.target.value) || 1))}
                      />
                      <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#7dd3fc' }}>
                        Order qty = {orderQuantity().toLocaleString('en-IN')} ({lots} × {lotSize})
                      </span>
                    </label>
                  ) : (
                    <label style={{ fontSize: 12 }}>
                      Quantity
                      <input
                        style={input}
                        type="number"
                        min={1}
                        step={isFoLot ? lotSize : 1}
                        value={qty}
                        onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                      />
                      {isFoLot ? (
                        <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#94a3b8' }}>
                          Multiple of {lotSize}
                          {qty % lotSize !== 0 ? (
                            <span style={{ color: '#fca5a5' }}> · not a full lot</span>
                          ) : (
                            <span style={{ color: '#86efac' }}>
                              {' '}
                              · {Math.floor(qty / lotSize)} lot
                              {Math.floor(qty / lotSize) === 1 ? '' : 's'}
                            </span>
                          )}
                        </span>
                      ) : null}
                    </label>
                  )}
                <label style={{ fontSize: 12 }}>
                  Price
                  <input
                    style={input}
                    type="number"
                    value={price || ''}
                    placeholder={quote?.price ? String(quote.price) : 'LTP'}
                    onChange={(e) => setPrice(Number(e.target.value))}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Stop loss
                  <input
                    style={input}
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(Number(e.target.value))}
                  />
                </label>
                <label style={{ fontSize: 12 }}>
                  Order type
                  <select style={input} value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                    {['MARKET', 'LIMIT', 'SL', 'SL-M'].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 12 }}>
                  Product
                  <select style={input} value={product} onChange={(e) => setProduct(e.target.value)}>
                    {['CNC', 'MIS', 'NRML'].map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </label>
                </div>
              </div>
              {!buySellEnabled ? (
                <div style={{ color: '#fca5a5', fontSize: 12 }}>
                  Buy/Sell disabled for this instrument (check lot size / tradability / role).
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ ...btn, background: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doBuySell('BUY')}
                >
                  Buy
                  {isFoLot && qtyMode === 'LOTS' ? ` ${lots} lot${lots === 1 ? '' : 's'}` : ''}
                </button>
                <button
                  type="button"
                  style={{ ...btn, background: 'rgba(248,113,113,0.25)', color: '#fca5a5' }}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doBuySell('SELL')}
                >
                  Sell
                  {isFoLot && qtyMode === 'LOTS' ? ` ${lots} lot${lots === 1 ? '' : 's'}` : ''}
                </button>
                <button
                  type="button"
                  style={btn}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doPreview('BUY')}
                >
                  Preview only
                </button>
                {preview?.allowed ? (
                  <button type="button" style={btn} disabled={busy} onClick={() => void doSubmit()}>
                    Confirm paper submit
                  </button>
                ) : null}
                <button type="button" style={btn} onClick={() => void createBasket()}>
                  Create basket
                </button>
              </div>
            </>
          )}

          {preview ? (
            <div style={{ padding: 12, borderRadius: 8, background: '#020617', fontSize: 12 }}>
              <div>Est. margin: ₹{String(preview.estimated_margin)}</div>
              <div>Est. charges: ₹{String(preview.estimated_charges)}</div>
              <div>Est. max loss: ₹{String(preview.estimated_max_loss)}</div>
              <div>Next: {String(preview.next_action)}</div>
              {!stopLoss ? (
                <div style={{ color: '#fbbf24', marginTop: 6 }}>Stop-loss recommended (required for live)</div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {tab === 'basket' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          {basketsError ? (
            <div style={{ color: '#fca5a5', fontSize: 12 }}>Basket list error: {basketsError}</div>
          ) : null}
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {baskets.length} basket{baskets.length === 1 ? '' : 's'}
            <button type="button" style={{ ...btn, marginLeft: 8, padding: '4px 8px' }} onClick={() => void reloadBaskets()}>
              Refresh
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 8,
              padding: 12,
              borderRadius: 10,
              border: '1px solid rgba(56,189,248,0.28)',
              background: 'rgba(8,47,73,0.28)'
            }}
          >
            <div style={{ fontSize: 12, color: '#7dd3fc', fontWeight: 600 }}>New basket</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                style={{ ...input, flex: 1, minWidth: 180 }}
                value={newBasketName}
                placeholder="Basket name (e.g. Nifty straddle Aug)"
                onChange={(e) => setNewBasketName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createBasket(newBasketName);
                }}
              />
              <button
                type="button"
                style={btn}
                disabled={busy}
                onClick={() => void createBasket(newBasketName || 'Terminal Basket')}
              >
                Create &amp; save
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {baskets.map((b) => {
              const id = String(b.id || '');
              const name = String(b.basketName || b.basket_name || 'Basket');
              return (
                <button
                  key={id || name}
                  type="button"
                  style={{
                    ...btn,
                    borderColor: activeBasketId === id ? '#22d3ee' : 'rgba(56,189,248,0.4)'
                  }}
                  onClick={() => void selectBasket(id)}
                >
                  {name} · {String(b.status || 'DRAFT')}
                  {b.legs_count != null ? ` · ${String(b.legs_count)} legs` : ''}
                </button>
              );
            })}
          </div>
          {!baskets.length && !basketsError ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              No saved baskets yet. Name one above and click Create &amp; save.
            </div>
          ) : null}
          {activeBasketId ? (
            <>
              <div
                style={{
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.25)',
                  background: 'rgba(15,23,42,0.5)'
                }}
              >
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'flex', gap: 8, alignItems: 'center', flex: 1, minWidth: 220 }}>
                  Basket name
                  <input
                    style={{ ...input, flex: 1 }}
                    value={basketNameDraft}
                    onChange={(e) => setBasketNameDraft(e.target.value)}
                    placeholder="Name this basket"
                  />
                </label>
                <button type="button" style={btn} disabled={busy} onClick={() => void saveBasketName()}>
                  Save name
                </button>
                <button type="button" style={btn} disabled={busy} onClick={() => void duplicateBasket()}>
                  Duplicate
                </button>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Status {String(basketDetail?.status || 'DRAFT')}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8 }}>
                <input style={input} value={legSymbol} onChange={(e) => setLegSymbol(e.target.value)} placeholder="Symbol" />
                <select style={input} value={legSide} onChange={(e) => setLegSide(e.target.value as 'BUY' | 'SELL')}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
                <input
                  style={input}
                  type="number"
                  value={legQty}
                  onChange={(e) => setLegQty(Number(e.target.value))}
                />
                <button type="button" style={btn} disabled={busy} onClick={() => void addLeg()}>
                  Add leg
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#94a3b8', textAlign: 'left' }}>
                      <th>Symbol</th>
                      <th>Type</th>
                      <th>Side</th>
                      <th>Qty</th>
                      <th>Lot</th>
                      <th>Margin</th>
                      <th>Risk</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((basketDetail?.legs as Record<string, unknown>[]) || []).map((leg) => (
                      <tr key={String(leg.id)} style={{ borderTop: '1px solid #334155' }}>
                        <td>{String(leg.symbol)}</td>
                        <td>{String(leg.instrumentType || leg.instrument_type)}</td>
                        <td>{String(leg.side)}</td>
                        <td>{String(leg.quantity)}</td>
                        <td>{String(leg.lotSize || leg.lot_size)}</td>
                        <td>{String(leg.estimatedMargin ?? '—')}</td>
                        <td>{String(leg.estimatedRisk ?? '—')}</td>
                        <td>{String(leg.legStatus || leg.leg_status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!((basketDetail?.legs as unknown[]) || []).length ? (
                  <div style={{ padding: 12, fontSize: 12, color: '#94a3b8' }}>
                    No legs yet — add symbols above, then execute.
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="button" style={btn} disabled={busy} onClick={() => void previewBasket()}>
                  Preview / risk
                </button>
                <button
                  type="button"
                  style={{
                    ...btn,
                    fontWeight: 700,
                    borderColor: 'rgba(52,211,153,0.65)',
                    background: 'rgba(16,185,129,0.2)',
                    color: '#6ee7b7'
                  }}
                  disabled={busy || !((basketDetail?.legs as unknown[]) || []).length}
                  onClick={() => void submitBasket()}
                >
                  Execute paper now
                </button>
                <span style={{ fontSize: 11, color: '#64748b' }}>
                  Approves risk + places all legs as paper orders in one step
                </span>
              </div>
            </>
          ) : (
            <div style={{ color: '#94a3b8' }}>Create or select a basket</div>
          )}
        </div>
      )}

      {tab === 'chart' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          {!selected ? (
            <div style={{ color: '#94a3b8' }}>
              Select Nifty / Bank Nifty / Sensex above, pick a strike, then open Chart — or search any symbol.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div style={{ fontWeight: 650, color: '#e2e8f0' }}>
                  {selected.display_name || selected.symbol}
                </div>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  Paper Buy/Sell on chart · lot {selected.lot_size || 1}
                </span>
                <button
                  type="button"
                  style={btn}
                  onClick={() => {
                    const und =
                      selected.underlying_symbol ||
                      indexDesk?.underlying ||
                      (/^(NIFTY|BANKNIFTY|SENSEX)/i.test(selected.symbol)
                        ? selected.symbol.replace(/\d+.*$/, '')
                        : selected.symbol);
                    setChartTradeInstrument(selected);
                    setChartStock({
                      id: `chart-${und}`,
                      symbol: und,
                      exchange: indexDesk?.exchange || selected.exchange || 'NSE',
                      sortOrder: 0,
                      name: selected.display_name || selected.symbol
                    });
                  }}
                >
                  Open full chart + ticket
                </button>
              </div>
              <ChartTradePanel
                symbol={selected.symbol}
                instrument={selected}
                price={price}
                qty={orderQuantity()}
                onQtyChange={(n) => {
                  if (qtyMode === 'LOTS' && lotSize > 1) {
                    setLots(Math.max(1, Math.round(n / lotSize)));
                    setQty(n);
                  } else setQty(n);
                }}
              />
            </>
          )}
        </div>
      )}

      {chartStock ? (
        <StockChartModal
          stock={chartStock}
          tradeInstrument={chartTradeInstrument}
          onClose={() => {
            setChartStock(null);
            setChartTradeInstrument(null);
          }}
        />
      ) : null}

      {tab === 'audit' && (
        <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          <button type="button" style={btn} onClick={() => void loadAudits()}>
            Refresh audits
          </button>
          {audits.map((a) => (
            <div key={String(a.id)} style={{ padding: 8, borderRadius: 8, border: '1px solid #334155', fontSize: 12 }}>
              <b>{String(a.eventType || a.event_type)}</b> · {String(a.detail)} ·{' '}
              {new Date(String(a.createdAt || a.created_at)).toLocaleString()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
