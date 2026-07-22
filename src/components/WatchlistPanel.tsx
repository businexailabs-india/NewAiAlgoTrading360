import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Eye, Plus, Trash2, RefreshCw, Star, LineChart, Sparkles, Loader2, X } from 'lucide-react';
import {
  addWatchlistSymbol,
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  removeWatchlistSymbol,
  type Watchlist,
  type WatchlistItem,
} from '@/api/watchlist';
import { StockSymbolPicker, STOCK_CATALOG, type StockOption } from '@/components/StockSymbolPicker';
import { StockChartModal } from '@/components/StockChartModal';
import { advisorService } from '@/services/advisorService';
import { toast } from 'sonner';

type Bias = 'BUY' | 'SELL' | 'HOLD';

type RowSuggestion = {
  bias: Bias;
  confidence: number;
  reason: string;
};

function rowSuggestion(item: WatchlistItem): RowSuggestion {
  let score = 0;
  const bits: string[] = [];

  if (item.changePercent != null && Number.isFinite(item.changePercent)) {
    if (item.changePercent >= 1.5) {
      score += 1.1;
      bits.push(`+${item.changePercent.toFixed(1)}%`);
    } else if (item.changePercent <= -1.5) {
      score -= 1.1;
      bits.push(`${item.changePercent.toFixed(1)}%`);
    } else if (item.changePercent >= 0.4) {
      score += 0.35;
      bits.push('mild up');
    } else if (item.changePercent <= -0.4) {
      score -= 0.35;
      bits.push('mild down');
    }
  }

  if (
    item.price != null &&
    item.high != null &&
    item.low != null &&
    item.high > item.low
  ) {
    const pos = (item.price - item.low) / (item.high - item.low);
    if (pos >= 0.85) {
      score -= 0.35;
      bits.push('near day high');
    } else if (pos <= 0.15) {
      score += 0.35;
      bits.push('near day low');
    }
  }

  if (
    item.buyers != null &&
    item.sellers != null &&
    item.buyers + item.sellers > 0
  ) {
    if (item.buyers > item.sellers * 1.25) {
      score += 0.45;
      bits.push('buyers heavy');
    } else if (item.sellers > item.buyers * 1.25) {
      score -= 0.45;
      bits.push('sellers heavy');
    }
  }

  const bias: Bias = score >= 0.9 ? 'BUY' : score <= -0.9 ? 'SELL' : 'HOLD';
  const confidence = Math.min(88, Math.max(40, Math.round(48 + Math.abs(score) * 16)));
  return {
    bias,
    confidence,
    reason: bits.slice(0, 2).join(' · ') || 'neutral tape',
  };
}

function biasColor(bias: Bias) {
  if (bias === 'BUY') return '#6ee7b7';
  if (bias === 'SELL') return '#f87171';
  return '#94a3b8';
}

function fmtPrice(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtQty(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-IN');
}

function fmtChange(change?: number, pct?: number) {
  if (change == null || pct == null) return { text: '—', color: '#64748b' };
  const sign = change >= 0 ? '+' : '';
  return {
    text: `${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%)`,
    color: change >= 0 ? '#34d399' : '#f87171',
  };
}

const panelCard: CSSProperties = {
  borderRadius: 12,
  border: '1px solid rgba(34,211,238,0.22)',
  background: 'rgba(15,23,42,0.7)',
};

const tabBtn = (active: boolean): CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  border: active ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.2)',
  background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
  color: active ? '#6ee7b7' : '#94a3b8',
  cursor: 'pointer',
});

const ghostBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(34,211,238,0.35)',
  background: 'rgba(34,211,238,0.1)',
  color: '#67e8f9',
  cursor: 'pointer',
  fontSize: 12,
};

const solidBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#059669',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
};

export function WatchlistPanel() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
  const [exchange, setExchange] = useState('NSE');
  const [newListName, setNewListName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [chartStock, setChartStock] = useState<WatchlistItem | null>(null);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiPopup, setShowAiPopup] = useState(false);
  const aiReqRef = useRef(0);
  const refreshReqRef = useRef(0);

  const active = useMemo(
    () => lists.find((l) => l.id === activeId) || lists[0] || null,
    [lists, activeId]
  );

  const rowIdeas = useMemo(() => {
    const map = new Map<string, RowSuggestion>();
    for (const item of active?.items || []) {
      map.set(item.id, rowSuggestion(item));
    }
    return map;
  }, [active?.items]);

  const listSnapshot = useMemo(() => {
    const items = active?.items || [];
    const buys = items.filter((i) => rowIdeas.get(i.id)?.bias === 'BUY').length;
    const sells = items.filter((i) => rowIdeas.get(i.id)?.bias === 'SELL').length;
    const holds = items.length - buys - sells;
    const ranked = [...items]
      .map((i) => ({ item: i, idea: rowIdeas.get(i.id)! }))
      .sort((a, b) => Math.abs(b.item.changePercent || 0) - Math.abs(a.item.changePercent || 0));
    return { buys, sells, holds, ranked, fingerprint: items.map((i) => i.symbol).join(',') };
  }, [active?.items, rowIdeas]);

  const fetchWatchlistAi = useCallback(async () => {
    if (!active || !active.items.length) {
      setAiText(null);
      setAiError(null);
      return;
    }
    const reqId = ++aiReqRef.current;
    setAiLoading(true);
    setAiError(null);
    const lines = listSnapshot.ranked.slice(0, 8).map(({ item, idea }) => {
      const ch =
        item.changePercent != null ? `${item.changePercent >= 0 ? '+' : ''}${item.changePercent.toFixed(2)}%` : 'n/a';
      return `${item.symbol} LTP=${item.price ?? 'n/a'} ch=${ch} bias=${idea.bias}(${idea.confidence}%) [${idea.reason}]`;
    });
    const prompt = [
      `Summarize a paper-trading watchlist named "${active.name}" with ${active.items.length} NSE stocks.`,
      `Local tape scores: BUY ${listSnapshot.buys}, SELL ${listSnapshot.sells}, HOLD ${listSnapshot.holds}.`,
      'Names:',
      ...lines,
      'Respond in 4-6 short sentences: overall bias, 2-3 names to watch, and a risk note.',
      'Advisory only — do not place or recommend live execution.',
    ].join('\n');
    try {
      const result = await advisorService.chat(prompt, active.items[0]?.symbol);
      if (aiReqRef.current !== reqId) return;
      setAiText(result.reply?.trim() || 'No AI narrative returned.');
      setAiProvider(result.provider || 'advisor');
    } catch (e) {
      if (aiReqRef.current !== reqId) return;
      setAiText(null);
      setAiError(e instanceof Error ? e.message : 'AI suggestion unavailable');
    } finally {
      if (aiReqRef.current === reqId) setAiLoading(false);
    }
  }, [active, listSnapshot]);

  useEffect(() => {
    setAiText(null);
    setAiProvider(null);
    setAiError(null);
    setShowAiPopup(false);
  }, [active?.id, listSnapshot.fingerprint]);

  function openWatchlistAi() {
    setShowAiPopup(true);
    if (!aiText && !aiLoading) void fetchWatchlistAi();
  }

  const refresh = useCallback(async (opts?: { quiet?: boolean }) => {
    const reqId = ++refreshReqRef.current;
    if (!opts?.quiet) setLoading(true);
    else setQuotesLoading(true);
    if (!opts?.quiet) setError(null);
    try {
      const data = await listWatchlists();
      if (refreshReqRef.current !== reqId) return;
      setLists(Array.isArray(data) ? data : []);
      setActiveId((prev) => {
        if (prev && data.some((l) => l.id === prev)) return prev;
        return data.find((l) => l.isDefault)?.id || data[0]?.id || null;
      });
      setError(null);
    } catch (e) {
      if (refreshReqRef.current !== reqId) return;
      const msg = e instanceof Error ? e.message : 'Failed to load watchlists';
      // Keep showing prior lists on quiet poll failures; only hard-fail on first load.
      setError(msg);
      if (!opts?.quiet) toast.error(msg);
    } finally {
      if (refreshReqRef.current === reqId) {
        setLoading(false);
        setQuotesLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Auto-refresh quotes every 30s
  useEffect(() => {
    const id = window.setInterval(() => void refresh({ quiet: true }), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  function resolveExchange(sym: string, preferred?: string) {
    if (preferred) return preferred.toUpperCase();
    const catalogHit = STOCK_CATALOG.find((s) => s.symbol.toUpperCase() === sym);
    if (catalogHit?.exchange) return catalogHit.exchange.toUpperCase();
    if (/^(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|SENSEX|BANKEX)\d{3,6}(CE|PE)$/.test(sym)) return 'NFO';
    if (/^(NIFTY|BANKNIFTY|FINNIFTY|MIDCPNIFTY|SENSEX|BANKEX)FUT$/.test(sym)) return 'NFO';
    return (exchange || 'NSE').toUpperCase();
  }

  async function addScriptToWatchlist(symRaw: string, exchangeHint?: string, openChart = false) {
    if (!active) return;
    const typed = symRaw.trim().toUpperCase();
    const sym = typed.includes(' ') ? typed.replace(/\s+/g, '') : typed;
    if (!/^[A-Z0-9]{1,32}$/.test(sym) || /\d$/.test(sym)) {
      throw new Error('Pick a script from the list (index, CE/PE, or FUT)');
    }
    const ex = resolveExchange(sym, exchangeHint);
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      let updated;
      try {
        updated = await addWatchlistSymbol(active.id, sym, ex);
        toast.success(`${sym} added`);
        setInfo(`${sym} added to ${updated.name}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        if (!/already/i.test(msg)) throw e;
        const data = await listWatchlists();
        updated = (Array.isArray(data) ? data : []).find((l) => l.id === active.id) || active;
        setInfo(`${sym} is already on ${updated.name}`);
      }
      setLists((prev) => {
        const has = prev.some((l) => l.id === updated.id);
        if (!has) return [updated, ...prev];
        return prev.map((l) => (l.id === updated.id ? updated : l));
      });
      const item =
        updated.items.find((i) => i.symbol.toUpperCase() === sym) ||
        ({
          id: `tmp-${sym}`,
          symbol: sym,
          exchange: ex,
          sortOrder: 0,
          name: sym,
        } satisfies WatchlistItem);
      setSymbol('');
      setExchange('NSE');
      if (openChart) setChartStock(item);
    } finally {
      setBusy(false);
    }
  }

  function onPickSymbol(stock: StockOption) {
    const sym = stock.symbol.toUpperCase();
    const ex = (stock.exchange || 'NSE').toUpperCase();
    setSymbol(sym);
    setExchange(ex);
    void addScriptToWatchlist(sym, ex, true).catch((e) => {
      const msg = e instanceof Error ? e.message : 'Failed to add symbol';
      setError(msg);
      toast.error(msg);
      setBusy(false);
    });
  }

  async function onAddSymbol(e?: FormEvent) {
    e?.preventDefault();
    if (!active || !symbol.trim()) return;
    try {
      await addScriptToWatchlist(symbol, exchange, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add symbol';
      setError(msg);
      toast.error(msg);
      setBusy(false);
    }
  }

  async function onRemove(itemId: string, sym: string) {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await removeWatchlistSymbol(active.id, itemId);
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setInfo(`${sym} removed`);
      toast.success(`${sym} removed`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to remove symbol';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onCreateList(e?: FormEvent) {
    e?.preventDefault();
    const name = newListName.trim();
    if (!name) {
      setError('Enter a watchlist name first');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const created = await createWatchlist(name);
      if (!created?.id) {
        throw new Error('Create succeeded but no watchlist was returned');
      }
      setLists((prev) => {
        const without = prev.filter((l) => l.id !== created.id);
        return [created, ...without];
      });
      setActiveId(created.id);
      setNewListName('');
      setInfo(`Watchlist "${name}" created`);
      toast.success(`Watchlist "${name}" created`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create watchlist';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteList() {
    if (!active || active.isDefault) return;
    setBusy(true);
    setError(null);
    try {
      await deleteWatchlist(active.id);
      toast.success('Watchlist deleted');
      setActiveId(null);
      await refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete watchlist';
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          height: 160,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: '#94a3b8',
          fontSize: 13,
        }}
      >
        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
        Loading watchlists…
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minHeight: 420 }} data-testid="watchlist-panel">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 16, color: '#f1f5f9' }}>
            <Eye className="h-4 w-4 text-cyan-300" />
            Stock Watchlists
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Same desk as Trading / Investing Algos · live quotes · tape bias
          </div>
        </div>
        <button
          type="button"
          disabled={busy || quotesLoading}
          onClick={() => void refresh({ quiet: true })}
          style={{ ...ghostBtn, opacity: busy || quotesLoading ? 0.6 : 1 }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${quotesLoading ? 'animate-spin' : ''}`} /> Sync quotes
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          padding: 12,
          ...panelCard,
        }}
      >
        {[
          ['Buy bias', listSnapshot.buys, '#6ee7b7'],
          ['Hold', listSnapshot.holds, '#e2e8f0'],
          ['Sell bias', listSnapshot.sells, '#f87171'],
        ].map(([label, value, color]) => (
          <div key={String(label)}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: String(color), marginTop: 4 }}>{value}</div>
          </div>
        ))}
      </div>

      {error ? (
        <div style={{ fontSize: 12, color: '#fecaca', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.25)' }}>
          {error}
        </div>
      ) : null}
      {info ? (
        <div style={{ fontSize: 12, color: '#67e8f9', padding: '6px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.1)' }}>
          {info}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 14, minHeight: 320 }}>
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.2)',
            background: 'rgba(15,23,42,0.65)',
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', marginBottom: 12 }}>Your lists</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {lists.map((l) => (
              <button key={l.id} type="button" onClick={() => setActiveId(l.id)} style={{ ...tabBtn(active?.id === l.id), textAlign: 'left' }}>
                {l.isDefault ? <Star className="mr-1 inline h-3 w-3 text-amber-400" /> : null}
                {l.name}
                <span style={{ marginLeft: 6, opacity: 0.7 }}>({l.items.length})</span>
              </button>
            ))}
            {lists.length === 0 ? <div style={{ fontSize: 11, color: '#64748b' }}>No lists yet</div> : null}
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>Create list</div>
          <form onSubmit={(e) => void onCreateList(e)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              placeholder="New watchlist name"
              disabled={busy}
              style={{
                height: 34,
                borderRadius: 8,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'rgba(2,6,23,0.45)',
                color: '#e2e8f0',
                padding: '0 10px',
                fontSize: 12,
              }}
            />
            <button type="submit" disabled={busy || !newListName.trim()} style={{ ...solidBtn, opacity: busy || !newListName.trim() ? 0.5 : 1 }}>
              <Plus className="h-3.5 w-3.5" /> Create
            </button>
            {active && !active.isDefault ? (
              <button type="button" disabled={busy} onClick={() => void onDeleteList()} style={{ ...ghostBtn, border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5', background: 'rgba(127,29,29,0.2)' }}>
                <Trash2 className="h-3.5 w-3.5" /> Delete list
              </button>
            ) : null}
          </form>
        </aside>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
            {lists.map((l) => (
              <button key={`tab-${l.id}`} type="button" onClick={() => setActiveId(l.id)} style={tabBtn(active?.id === l.id)}>
                {l.name}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              {active && active.items.length > 0 ? (
                <button type="button" onClick={openWatchlistAi} style={ghostBtn}>
                  <Sparkles className="h-3.5 w-3.5" /> AI advice
                </button>
              ) : null}
            </div>
          </div>

          {active ? (
            <>
              <form onSubmit={(e) => void onAddSymbol(e)} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <StockSymbolPicker
                  value={symbol}
                  disabled={busy}
                  excludeSymbols={(active?.items || []).map((i) => i.symbol)}
                  placeholder="Search stock or index e.g. NIFTY"
                  onChange={(sym) => {
                    setSymbol(sym);
                    if (!sym) setExchange('NSE');
                  }}
                  onSelect={onPickSymbol}
                />
                <button type="submit" disabled={busy || !symbol.trim()} style={{ ...solidBtn, opacity: busy || !symbol.trim() ? 0.5 : 1 }}>
                  <Plus className="h-3.5 w-3.5" /> Add stock
                </button>
              </form>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 0.7fr 0.9fr 1.1fr 0.8fr 0.8fr 0.8fr 0.9fr',
                  gap: 8,
                  padding: '8px 10px',
                  fontSize: 11,
                  color: '#64748b',
                  borderBottom: '1px solid rgba(148,163,184,0.2)',
                }}
              >
                <span>Stock</span>
                <span>Bias</span>
                <span>LTP</span>
                <span>Change</span>
                <span>High</span>
                <span>Low</span>
                <span>Volume</span>
                <span />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {active.items.length === 0 ? (
                  <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No symbols yet — add one above</div>
                ) : (
                  active.items.map((item) => {
                    const ch = fmtChange(item.change, item.changePercent);
                    const idea = rowIdeas.get(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setChartStock(item)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1.4fr 0.7fr 0.9fr 1.1fr 0.8fr 0.8fr 0.8fr 0.9fr',
                          gap: 8,
                          alignItems: 'center',
                          padding: '12px 10px',
                          border: 'none',
                          borderBottom: '1px solid rgba(148,163,184,0.12)',
                          background: 'transparent',
                          textAlign: 'left',
                          cursor: 'pointer',
                          color: '#e2e8f0',
                          width: '100%',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: '#67e8f9' }}>{item.symbol}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.name || item.exchange}</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: idea ? biasColor(idea.bias) : '#64748b' }}>
                          {idea ? `${idea.bias} · ${idea.confidence}%` : '—'}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtPrice(item.price)}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: ch.color }}>{ch.text}</div>
                        <div style={{ fontSize: 12, color: '#6ee7b7' }}>{fmtPrice(item.high)}</div>
                        <div style={{ fontSize: 12, color: '#fca5a5' }}>{fmtPrice(item.low)}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{fmtQty(item.volume)}</div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setChartStock(item);
                            }}
                            style={{ ...ghostBtn, padding: '4px 8px', fontSize: 11 }}
                          >
                            <LineChart className="h-3 w-3" /> Chart
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onRemove(item.id, item.symbol);
                            }}
                            style={{
                              ...ghostBtn,
                              padding: '4px 8px',
                              border: '1px solid rgba(248,113,113,0.35)',
                              color: '#fca5a5',
                              background: 'rgba(127,29,29,0.2)',
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: '#64748b' }}>
                Click a row for the chart · tape bias is local · AI advice summarizes the list · quotes every 30s
              </div>
            </>
          ) : (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No watchlists yet — create one in the left panel</div>
          )}
        </div>
      </div>

      {chartStock ? <StockChartModal stock={chartStock} onClose={() => setChartStock(null)} /> : null}

      {showAiPopup
        ? createPortal(
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 99998,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.72)',
                padding: 16,
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Watchlist AI advice"
              onClick={() => setShowAiPopup(false)}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: 520,
                  borderRadius: 12,
                  border: '1px solid rgba(34,211,238,0.28)',
                  background: 'rgba(15,23,42,0.96)',
                  padding: 16,
                  color: '#e2e8f0',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>AI advice</span>
                  <span style={{ fontSize: 11, color: '#6ee7b7' }}>BUY {listSnapshot.buys}</span>
                  <span style={{ fontSize: 11, color: '#f87171' }}>SELL {listSnapshot.sells}</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>HOLD {listSnapshot.holds}</span>
                  {aiProvider ? <span style={{ fontSize: 10, color: '#64748b' }}>via {aiProvider}</span> : null}
                  <button type="button" disabled={aiLoading} onClick={() => void fetchWatchlistAi()} style={{ ...ghostBtn, marginLeft: 'auto' }}>
                    {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Refresh
                  </button>
                  <button type="button" aria-label="Close AI advice" onClick={() => setShowAiPopup(false)} style={{ ...ghostBtn, padding: 6 }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div
                  style={{
                    maxHeight: 260,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    borderRadius: 10,
                    border: '1px solid rgba(148,163,184,0.18)',
                    background: 'rgba(2,6,23,0.45)',
                    padding: '10px 12px',
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: '#cbd5e1',
                  }}
                >
                  {aiLoading && !aiText
                    ? 'Asking advisor for a watchlist summary…'
                    : aiError
                      ? `AI note unavailable: ${aiError}. Row biases in the table still apply.`
                      : aiText || 'AI narrative will appear here.'}
                </div>
                <div style={{ marginTop: 8, fontSize: 10, color: '#64748b' }}>
                  Advisory only — AI never executes. Close anytime with X or outside click.
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
