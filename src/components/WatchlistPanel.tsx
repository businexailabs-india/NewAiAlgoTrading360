import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Plus, Trash2, RefreshCw, Star, LineChart, Sparkles, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addWatchlistSymbol,
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  removeWatchlistSymbol,
  type Watchlist,
  type WatchlistItem,
} from '@/api/watchlist';
import { STOCK_CATALOG } from '@/components/StockSymbolPicker';
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

function biasClass(bias: Bias) {
  if (bias === 'BUY') return 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300';
  if (bias === 'SELL') return 'border-rose-500/45 bg-rose-500/10 text-rose-300';
  return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
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
  if (change == null || pct == null) return { text: '—', className: 'text-zinc-500' };
  const sign = change >= 0 ? '+' : '';
  return {
    text: `${sign}${change.toFixed(2)} (${sign}${pct.toFixed(2)}%)`,
    className: change >= 0 ? 'text-emerald-400' : 'text-rose-400',
  };
}

export function WatchlistPanel() {
  const [lists, setLists] = useState<Watchlist[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState('');
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
    if (!opts?.quiet) setLoading(true);
    else setQuotesLoading(true);
    setError(null);
    try {
      const data = await listWatchlists();
      setLists(Array.isArray(data) ? data : []);
      setActiveId((prev) => {
        if (prev && data.some((l) => l.id === prev)) return prev;
        return data.find((l) => l.isDefault)?.id || data[0]?.id || null;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load watchlists';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      setQuotesLoading(false);
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

  async function onAddSymbol(e?: FormEvent) {
    e?.preventDefault();
    if (!active || !symbol.trim()) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const sym = symbol.trim().toUpperCase();
      const updated = await addWatchlistSymbol(active.id, sym);
      setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setSymbol('');
      setInfo(`${sym} added to ${updated.name}`);
      toast.success(`${sym} added`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to add symbol';
      setError(msg);
      toast.error(msg);
    } finally {
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
      <div className="flex h-40 items-center justify-center text-sm text-zinc-400">
        Loading watchlists…
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="watchlist-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Eye className="h-5 w-5 text-cyan-400" />
            Stock Watchlists
          </h2>
          <p className="text-sm text-zinc-400">
            Track NSE symbols. Default list seeds 10 large-cap names on first open.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh({ quiet: true })}
          disabled={busy || quotesLoading}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${quotesLoading ? 'animate-spin' : ''}`} />
          Refresh quotes
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {info}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {lists.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setActiveId(l.id)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
              active?.id === l.id
                ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-200'
                : 'border-zinc-700 bg-zinc-900/50 text-zinc-300 hover:border-zinc-500'
            }`}
          >
            {l.isDefault ? <Star className="mr-1 inline h-3 w-3 text-amber-400" /> : null}
            {l.name}
            <span className="ml-1 text-zinc-500">({l.items.length})</span>
          </button>
        ))}
      </div>

      <form
        className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3"
        onSubmit={(e) => void onCreateList(e)}
      >
        <Input
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          placeholder="New watchlist name"
          className="max-w-xs border-zinc-600 bg-zinc-950 text-white"
          disabled={busy}
          autoComplete="off"
        />
        <Button
          type="submit"
          size="sm"
          className="bg-cyan-600 text-white hover:bg-cyan-500"
          disabled={busy || !newListName.trim()}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          {busy ? 'Creating…' : 'Create list'}
        </Button>
        {active && !active.isDefault ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => void onDeleteList()}
            disabled={busy}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Delete list
          </Button>
        ) : null}
      </form>

      {active ? (
        <div className="space-y-3 rounded-xl border border-zinc-700/70 bg-zinc-900/40 p-4">
          <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => void onAddSymbol(e)}>
            <select
              value={symbol}
              disabled={busy}
              onChange={(e) => setSymbol(e.target.value)}
              className="h-9 min-w-[280px] max-w-md flex-1 rounded-md border border-zinc-600 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 disabled:opacity-50"
              aria-label="Select stock"
            >
              <option value="">Select a stock…</option>
              {STOCK_CATALOG.filter(
                (s) => !active.items.some((i) => i.symbol.toUpperCase() === s.symbol.toUpperCase())
              ).map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} — {s.name} ({s.exchange})
                </option>
              ))}
            </select>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 text-white hover:bg-emerald-500"
              disabled={busy || !symbol.trim()}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add stock
            </Button>
            {active.items.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/10"
                onClick={openWatchlistAi}
              >
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                AI advice
              </Button>
            ) : null}
          </form>

          <div className="overflow-auto rounded-lg border border-zinc-800">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-zinc-950 text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Stock</th>
                  <th className="px-3 py-2">AI</th>
                  <th className="px-3 py-2">LTP</th>
                  <th className="px-3 py-2">Change</th>
                  <th className="px-3 py-2">Open</th>
                  <th className="px-3 py-2">Day high</th>
                  <th className="px-3 py-2">Day low</th>
                  <th className="px-3 py-2">Volume</th>
                  <th className="px-3 py-2">Buyers</th>
                  <th className="px-3 py-2">Sellers</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {active.items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-3 py-6 text-center text-zinc-500">
                      No symbols yet — add one above.
                    </td>
                  </tr>
                ) : (
                  active.items.map((item, idx) => {
                    const ch = fmtChange(item.change, item.changePercent);
                    const idea = rowIdeas.get(item.id);
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-t border-zinc-800 text-zinc-200 hover:bg-cyan-500/5"
                        onClick={() => setChartStock(item)}
                        title={`Open ${item.symbol} chart`}
                      >
                        <td className="px-3 py-2 text-zinc-500">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="font-mono font-medium text-cyan-300 underline-offset-2 hover:underline">
                            {item.symbol}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {item.name || item.exchange}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {idea ? (
                            <div className="space-y-0.5">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${biasClass(idea.bias)}`}
                              >
                                {idea.bias} · {idea.confidence}%
                              </span>
                              <div className="max-w-[140px] truncate text-[10px] text-zinc-500">
                                {idea.reason}
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium tabular-nums">{fmtPrice(item.price)}</td>
                        <td className={`px-3 py-2 text-xs tabular-nums ${ch.className}`}>{ch.text}</td>
                        <td className="px-3 py-2 tabular-nums text-zinc-300">{fmtPrice(item.open)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-300/90">{fmtPrice(item.high)}</td>
                        <td className="px-3 py-2 tabular-nums text-rose-300/90">{fmtPrice(item.low)}</td>
                        <td className="px-3 py-2 tabular-nums text-zinc-400">{fmtQty(item.volume)}</td>
                        <td className="px-3 py-2 tabular-nums text-emerald-400">{fmtQty(item.buyers)}</td>
                        <td className="px-3 py-2 tabular-nums text-rose-400">{fmtQty(item.sellers)}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setChartStock(item);
                              }}
                            >
                              <LineChart className="mr-1 h-3.5 w-3.5" />
                              Chart
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-rose-400 hover:text-rose-300"
                              disabled={busy}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onRemove(item.id, item.symbol);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-500">
            Click a stock row to open its price chart. Use AI advice when you want a list summary.
            Row AI is tape-based. Quotes refresh every 30s.
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No watchlists yet — create one above.</p>
      )}

      {chartStock ? (
        <StockChartModal stock={chartStock} onClose={() => setChartStock(null)} />
      ) : null}

      {showAiPopup
        ? createPortal(
            <div
              className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/70 p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Watchlist AI advice"
              onClick={() => setShowAiPopup(false)}
            >
              <div
                className="w-full max-w-lg rounded-xl border border-cyan-500/30 bg-zinc-950 p-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-300" />
                  <span className="text-sm font-semibold text-cyan-200">AI advice</span>
                  <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    BUY {listSnapshot.buys}
                  </span>
                  <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-300">
                    SELL {listSnapshot.sells}
                  </span>
                  <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-200">
                    HOLD {listSnapshot.holds}
                  </span>
                  {aiProvider ? (
                    <span className="text-[10px] text-zinc-500">via {aiProvider}</span>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7 border-zinc-600 text-zinc-300"
                    disabled={aiLoading}
                    onClick={() => void fetchWatchlistAi()}
                  >
                    {aiLoading ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-3 w-3" />
                    )}
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-zinc-400"
                    aria-label="Close AI advice"
                    onClick={() => setShowAiPopup(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-sm leading-relaxed text-zinc-300">
                  {aiLoading && !aiText
                    ? 'Asking advisor for a watchlist summary…'
                    : aiError
                      ? `AI note unavailable: ${aiError}. Row biases in the table still apply.`
                      : aiText || 'AI narrative will appear here.'}
                </div>
                <p className="mt-2 text-[10px] text-zinc-500">
                  Advisory only — AI never executes. Close anytime with X or outside click.
                </p>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
