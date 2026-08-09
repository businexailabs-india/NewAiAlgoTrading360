import { useEffect, useState, type CSSProperties } from 'react';
import { toast } from 'sonner';
import { tradingApi, type ChartPosition, type Instrument } from '@/api/trading';

type Props = {
  symbol: string;
  instrument?: Instrument | null;
  price?: number;
  onFilled?: () => void;
  /** Vertical trade rail for chart-first layout */
  variant?: 'default' | 'rail';
  /** Shared qty from parent ticket (optional) */
  qty?: number;
  onQtyChange?: (qty: number) => void;
};

const railWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  height: '100%',
  minHeight: 0,
  padding: 12,
  borderLeft: '1px solid rgba(56,189,248,0.28)',
  background: 'linear-gradient(180deg, rgba(8,47,73,0.45) 0%, rgba(2,6,23,0.95) 40%)',
  color: '#e2e8f0',
  fontSize: 12,
  boxSizing: 'border-box',
};

const btn = (bg: string, opts?: { tall?: boolean }): CSSProperties => ({
  padding: opts?.tall ? '10px 12px' : '7px 10px',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.35)',
  background: bg,
  color: '#f8fafc',
  cursor: 'pointer',
  fontSize: opts?.tall ? 13 : 11,
  fontWeight: opts?.tall ? 700 : 600,
  width: '100%',
});

/**
 * Chart Trading Layer — never live-executes on click.
 * Always: preview → paper submit via RMS/OMS.
 */
export function ChartTradePanel({
  symbol,
  instrument,
  price,
  onFilled,
  variant = 'default',
  qty: controlledQty,
  onQtyChange,
}: Props) {
  const [localQty, setLocalQty] = useState(1);
  const qty = controlledQty ?? localQty;
  const setQty = (n: number) => {
    const v = Math.max(1, n);
    if (onQtyChange) onQtyChange(v);
    else setLocalQty(v);
  };
  const [positions, setPositions] = useState<ChartPosition[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const blockedIndex =
    instrument?.instrument_type === 'INDEX' && !instrument.direct_trading_allowed;

  const reload = async () => {
    const data = await tradingApi.getChartPositions({
      symbol,
      instrument_id: instrument?.instrument_id,
    });
    setPositions(data.positions || []);
  };

  useEffect(() => {
    void reload().catch(() => setPositions([]));
  }, [symbol, instrument?.instrument_id]);

  const runAction = async (
    action: 'BUY' | 'SELL' | 'ADD_QTY' | 'REDUCE_QTY' | 'EXIT_QTY' | 'EXIT_FULL'
  ) => {
    if (blockedIndex) {
      toast.error('Index spot cannot be directly traded. Choose futures/options.');
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      const p = await tradingApi.previewOrder({
        instrument_id: instrument?.instrument_id,
        symbol,
        side:
          action === 'SELL' || action.startsWith('EXIT') || action === 'REDUCE_QTY' ? 'SELL' : 'BUY',
        quantity: action === 'EXIT_FULL' ? Math.max(1, positions[0]?.quantity || qty) : qty,
        order_type: 'MARKET',
        price,
        mode: 'PAPER',
        source: 'CHART',
      });
      setPreview(p);
      if (!p.allowed) {
        setMsg(`Preview blocked: ${JSON.stringify(p.warnings)}`);
        toast.error('Order preview blocked');
        return;
      }

      const body = {
        instrument_id: instrument?.instrument_id,
        symbol,
        quantity: qty,
        order_type: 'MARKET',
        price,
        mode: 'PAPER',
      };
      if (action === 'ADD_QTY' || action === 'BUY') await tradingApi.chartAddQuantity(body);
      else if (action === 'REDUCE_QTY') await tradingApi.chartReduceQuantity(body);
      else if (action === 'EXIT_QTY') await tradingApi.chartExitQuantity(body);
      else if (action === 'EXIT_FULL') await tradingApi.chartExitFull(body);
      else await tradingApi.submitOrder(String(p.preview_id));

      toast.success(`Paper ${action} submitted (RMS/OMS)`);
      setMsg(`OK ${action}`);
      await reload();
      onFilled?.();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Chart action failed';
      setMsg(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  };

  const open = positions[0];

  if (variant === 'rail') {
    return (
      <aside style={railWrap} aria-label="Paper order ticket">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#7dd3fc', fontSize: 13 }}>Order ticket</div>
            <div style={{ color: '#64748b', fontSize: 10 }}>Paper · Live locked</div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#fde68a',
              border: '1px solid rgba(253,224,71,0.35)',
              borderRadius: 999,
              padding: '3px 8px',
            }}
          >
            LIVE LOCKED
          </span>
        </div>

        {blockedIndex ? (
          <div style={{ color: '#fda4af', fontSize: 11 }}>
            Index spot blocked — use futures/options.
          </div>
        ) : null}

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, color: '#94a3b8' }}>
          Quantity
          <input
            type="number"
            min={1}
            value={qty}
            disabled={blockedIndex || busy}
            onChange={(e) => setQty(Number(e.target.value) || 1)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid #334155',
              background: '#020617',
              color: '#e2e8f0',
              boxSizing: 'border-box',
            }}
          />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            type="button"
            style={btn('rgba(16,185,129,0.4)', { tall: true })}
            disabled={busy || blockedIndex}
            onClick={() => void runAction('BUY')}
          >
            Buy
          </button>
          <button
            type="button"
            style={btn('rgba(248,113,113,0.4)', { tall: true })}
            disabled={busy || blockedIndex}
            onClick={() => void runAction('SELL')}
          >
            Sell
          </button>
        </div>

        <div style={{ borderTop: '1px solid rgba(51,65,85,0.8)', paddingTop: 8 }}>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, letterSpacing: 0.4 }}>
            POSITION
          </div>
          {open ? (
            <div
              style={{
                padding: 8,
                borderRadius: 8,
                background: 'rgba(15,23,42,0.9)',
                border: '1px solid #334155',
                marginBottom: 8,
                fontSize: 11,
              }}
            >
              {open.side} {open.quantity} @ ₹{open.average_price}
              <div style={{ color: '#94a3b8' }}>PnL {open.unrealized_pnl}</div>
            </div>
          ) : (
            <div style={{ color: '#64748b', marginBottom: 8, fontSize: 11 }}>No open position</div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <button type="button" style={btn('rgba(56,189,248,0.28)')} disabled={busy || blockedIndex} onClick={() => void runAction('ADD_QTY')}>
              Add
            </button>
            <button type="button" style={btn('rgba(251,191,36,0.28)')} disabled={busy || blockedIndex} onClick={() => void runAction('REDUCE_QTY')}>
              Reduce
            </button>
            <button type="button" style={btn('rgba(244,63,94,0.3)')} disabled={busy || blockedIndex} onClick={() => void runAction('EXIT_QTY')}>
              Exit qty
            </button>
            <button type="button" style={btn('rgba(127,29,29,0.55)')} disabled={busy || blockedIndex} onClick={() => void runAction('EXIT_FULL')}>
              Exit all
            </button>
          </div>
        </div>

        <div style={{ marginTop: 'auto', fontSize: 10, color: '#64748b' }}>
          Preview → RMS → OMS · no live click-trading
        </div>
        {preview ? (
          <div style={{ color: '#a5f3fc', fontSize: 10 }}>
            Margin ₹{String(preview.estimated_margin)} · max loss ₹{String(preview.estimated_max_loss)}
          </div>
        ) : null}
        {msg ? <div style={{ color: '#fde68a', fontSize: 10 }}>{msg}</div> : null}
      </aside>
    );
  }

  // Inline panel for trading terminal / other call sites
  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
        border: '1px solid rgba(56,189,248,0.35)',
        background: 'rgba(2,6,23,0.75)',
        color: '#e2e8f0',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 700, color: '#7dd3fc' }}>Chart Trade · Paper default</div>
          <div style={{ color: '#94a3b8' }}>Live locked — Preview → RMS → OMS only</div>
        </div>
        <span style={{ color: '#fde68a', fontSize: 11 }}>LIVE LOCKED</span>
      </div>
      {blockedIndex ? (
        <div style={{ marginTop: 8, color: '#fda4af' }}>
          Index spot blocked — use futures/options.
        </div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Qty{' '}
          <input
            type="number"
            min={1}
            value={qty}
            disabled={blockedIndex || busy}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
            style={{
              width: 72,
              marginLeft: 4,
              padding: 4,
              borderRadius: 6,
              border: '1px solid #334155',
              background: '#020617',
              color: '#e2e8f0',
            }}
          />
        </label>
        <button type="button" style={btn('rgba(16,185,129,0.35)')} disabled={busy || blockedIndex} onClick={() => void runAction('BUY')}>
          Buy
        </button>
        <button type="button" style={btn('rgba(248,113,113,0.35)')} disabled={busy || blockedIndex} onClick={() => void runAction('SELL')}>
          Sell
        </button>
        <button type="button" style={btn('rgba(56,189,248,0.28)')} disabled={busy || blockedIndex} onClick={() => void runAction('ADD_QTY')}>
          Add Qty
        </button>
        <button type="button" style={btn('rgba(251,191,36,0.28)')} disabled={busy || blockedIndex} onClick={() => void runAction('REDUCE_QTY')}>
          Reduce Qty
        </button>
        <button type="button" style={btn('rgba(244,63,94,0.3)')} disabled={busy || blockedIndex} onClick={() => void runAction('EXIT_QTY')}>
          Exit Qty
        </button>
        <button type="button" style={btn('rgba(127,29,29,0.55)')} disabled={busy || blockedIndex} onClick={() => void runAction('EXIT_FULL')}>
          Exit Full
        </button>
      </div>
      {open ? (
        <div style={{ marginTop: 8, color: '#cbd5e1' }}>
          Open: {open.side} {open.quantity} @ ₹{open.average_price} · PnL {open.unrealized_pnl}
        </div>
      ) : (
        <div style={{ marginTop: 8, color: '#64748b' }}>No open position marker.</div>
      )}
      {msg ? <div style={{ marginTop: 6, color: '#fde68a' }}>{msg}</div> : null}
    </div>
  );
}
