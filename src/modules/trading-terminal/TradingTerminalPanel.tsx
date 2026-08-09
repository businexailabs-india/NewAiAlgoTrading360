import { useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { tradingApi, type Instrument } from '@/api/trading';
import { ChartTradePanel } from '@/components/trading/ChartTradePanel';
import { useBasketOrders, useInstrumentSearch } from '@/hooks/trading/useTradingTerminal';

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

type Tab = 'ticket' | 'basket' | 'chart' | 'audit';

export function TradingTerminalPanel({ initialTab = 'ticket' }: { initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const { query, setQuery, results, search, loading } = useInstrumentSearch('RELIANCE');
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [tradability, setTradability] = useState<Record<string, unknown> | null>(null);
  const [derivatives, setDerivatives] = useState<Instrument[]>([]);
  const [qty, setQty] = useState(1);
  const [orderType, setOrderType] = useState('MARKET');
  const [product, setProduct] = useState('CNC');
  const [price, setPrice] = useState(1000);
  const [stopLoss, setStopLoss] = useState(0);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const { baskets, reload: reloadBaskets } = useBasketOrders();
  const [activeBasketId, setActiveBasketId] = useState<string | null>(null);
  const [basketDetail, setBasketDetail] = useState<Record<string, unknown> | null>(null);
  const [audits, setAudits] = useState<Record<string, unknown>[]>([]);
  const [legSymbol, setLegSymbol] = useState('RELIANCE');
  const [legSide, setLegSide] = useState<'BUY' | 'SELL'>('BUY');
  const [legQty, setLegQty] = useState(1);

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

  const pick = (inst: Instrument) => {
    setSelected(inst);
    setPreview(null);
    setMsg('');
    if (inst.instrument_type.includes('FUTURE') || inst.instrument_type.includes('OPTION')) {
      setProduct('NRML');
      setQty(inst.lot_size || 1);
    } else {
      setProduct('CNC');
      setQty(1);
    }
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
        quantity: qty,
        order_type: orderType,
        product_type: product,
        price,
        stop_loss: stopLoss || undefined,
        mode: 'PAPER',
        source: 'ORDER_TICKET'
      });
      setPreview(p);
      setMsg(p.allowed ? `Preview OK — ${p.next_action}` : `Blocked: ${JSON.stringify(p.warnings)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview failed');
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

  const createBasket = async () => {
    setBusy(true);
    try {
      const b = await tradingApi.createBasket({ basket_name: 'Terminal Basket', mode: 'PAPER' });
      setActiveBasketId(String(b.id));
      await reloadBaskets();
      setBasketDetail(await tradingApi.getBasket(String(b.id)));
      toast.success('Basket created (paper)');
      setTab('basket');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Create basket failed');
    } finally {
      setBusy(false);
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
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Preview basket failed');
    } finally {
      setBusy(false);
    }
  };

  const submitBasket = async () => {
    if (!activeBasketId) return;
    setBusy(true);
    try {
      const res = await tradingApi.submitBasket(activeBasketId);
      toast.success(`Basket ${String((res.basket as { status?: string })?.status)} · filled ${res.filled}`);
      setBasketDetail(await tradingApi.getBasket(activeBasketId));
      await reloadBaskets();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit basket failed');
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
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              style={input}
              value={query}
              placeholder="Search RELIANCE, NIFTY, TCS…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void search(query);
              }}
            />
            <button type="button" style={btn} onClick={() => void search(query)} disabled={loading}>
              Search
            </button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: 120, overflow: 'auto' }}>
            {results.map((r) => (
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
        </div>
      )}

      {tab === 'ticket' && selected && (
        <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 8, border: '1px solid #334155' }}>
            <div style={{ fontWeight: 700 }}>
              {selected.display_name} ({selected.symbol})
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {selected.instrument_type} · lot {selected.lot_size} ·{' '}
              {selected.direct_trading_allowed ? 'direct OK' : 'no direct trade'}
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              Mode: <b style={{ color: '#86efac' }}>Paper</b> ·{' '}
              <span style={{ color: '#fca5a5' }}>Live locked</span>
            </div>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
                <label style={{ fontSize: 12 }}>
                  Qty
                  <input style={input} type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
                </label>
                <label style={{ fontSize: 12 }}>
                  Price
                  <input style={input} type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
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
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  style={{ ...btn, background: 'rgba(16,185,129,0.25)', color: '#6ee7b7' }}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doPreview('BUY')}
                >
                  Buy
                </button>
                <button
                  type="button"
                  style={{ ...btn, background: 'rgba(248,113,113,0.25)', color: '#fca5a5' }}
                  disabled={!buySellEnabled || busy}
                  onClick={() => void doPreview('SELL')}
                >
                  Sell
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={() => void createBasket()}>
              New basket
            </button>
            {baskets.map((b) => (
              <button
                key={String(b.id)}
                type="button"
                style={btn}
                onClick={() => {
                  setActiveBasketId(String(b.id));
                  void tradingApi.getBasket(String(b.id)).then(setBasketDetail);
                }}
              >
                {String(b.basketName || b.basket_name)} · {String(b.status)}
              </button>
            ))}
          </div>
          {activeBasketId ? (
            <>
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
                <button type="button" style={btn} onClick={() => void addLeg()}>
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
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={btn} onClick={() => void previewBasket()}>
                  Preview / risk
                </button>
                <button type="button" style={btn} onClick={() => void submitBasket()}>
                  Approve &amp; submit paper
                </button>
              </div>
            </>
          ) : (
            <div style={{ color: '#94a3b8' }}>Create or select a basket</div>
          )}
        </div>
      )}

      {tab === 'chart' && (
        <div style={{ marginTop: 14 }}>
          {!selected ? (
            <div style={{ color: '#94a3b8' }}>Select an instrument above</div>
          ) : (
            <ChartTradePanel symbol={selected.symbol} instrument={selected} price={price} />
          )}
        </div>
      )}

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
