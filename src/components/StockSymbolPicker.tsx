import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { marketDataService } from '@/services/marketDataService';

export type StockOption = {
  symbol: string;
  name: string;
  exchange: string;
};

/** Shared NSE + index catalog for select dropdowns and search fallback */
export const STOCK_CATALOG: StockOption[] = [
  // Index scripts (spot indices — for watchlist / analytics)
  { symbol: 'NIFTY', name: 'Nifty 50 Index', exchange: 'INDEX' },
  { symbol: 'NIFTY50', name: 'Nifty 50 Index', exchange: 'INDEX' },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', exchange: 'INDEX' },
  { symbol: 'FINNIFTY', name: 'Nifty Financial Services Index', exchange: 'INDEX' },
  { symbol: 'MIDCPNIFTY', name: 'Nifty Midcap Select Index', exchange: 'INDEX' },
  { symbol: 'SENSEX', name: 'BSE Sensex Index', exchange: 'INDEX' },
  { symbol: 'BANKEX', name: 'BSE Bankex Index', exchange: 'INDEX' },
  { symbol: 'INDIAVIX', name: 'India VIX', exchange: 'INDEX' },
  { symbol: 'NIFTYIT', name: 'Nifty IT Index', exchange: 'INDEX' },
  { symbol: 'NIFTYAUTO', name: 'Nifty Auto Index', exchange: 'INDEX' },
  { symbol: 'NIFTYPHARMA', name: 'Nifty Pharma Index', exchange: 'INDEX' },
  { symbol: 'NIFTYFMCG', name: 'Nifty FMCG Index', exchange: 'INDEX' },
  { symbol: 'NIFTYMETAL', name: 'Nifty Metal Index', exchange: 'INDEX' },
  { symbol: 'NIFTYENERGY', name: 'Nifty Energy Index', exchange: 'INDEX' },
  { symbol: 'NIFTYREALTY', name: 'Nifty Realty Index', exchange: 'INDEX' },
  // Equity
  { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE' },
  { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE' },
  { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'NSE' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'NSE' },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', exchange: 'NSE' },
  { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE' },
  { symbol: 'WIPRO', name: 'Wipro Ltd', exchange: 'NSE' },
  { symbol: 'LT', name: 'Larsen & Toubro Ltd', exchange: 'NSE' },
  { symbol: 'AXISBANK', name: 'Axis Bank Ltd', exchange: 'NSE' },
  { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', exchange: 'NSE' },
  { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', exchange: 'NSE' },
  { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', exchange: 'NSE' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', exchange: 'NSE' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', exchange: 'NSE' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', exchange: 'NSE' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', exchange: 'NSE' },
  { symbol: 'TITAN', name: 'Titan Company Ltd', exchange: 'NSE' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', exchange: 'NSE' },
  { symbol: 'NESTLEIND', name: 'Nestle India Ltd', exchange: 'NSE' },
  { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd', exchange: 'NSE' },
  { symbol: 'NTPC', name: 'NTPC Ltd', exchange: 'NSE' },
  { symbol: 'ONGC', name: 'Oil and Natural Gas Corporation Ltd', exchange: 'NSE' },
  { symbol: 'COALINDIA', name: 'Coal India Ltd', exchange: 'NSE' },
  { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', exchange: 'NSE' },
  { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', exchange: 'NSE' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', exchange: 'NSE' },
  { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd', exchange: 'NSE' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', exchange: 'NSE' },
  { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank Ltd', exchange: 'NSE' },
  { symbol: 'PNB', name: 'Punjab National Bank', exchange: 'NSE' },
  { symbol: 'BANKBARODA', name: 'Bank of Baroda', exchange: 'NSE' },
  { symbol: 'IRCTC', name: 'IRCTC Ltd', exchange: 'NSE' },
  { symbol: 'IRFC', name: 'IRFC Ltd', exchange: 'NSE' },
  { symbol: 'NHPC', name: 'NHPC Ltd', exchange: 'NSE' },
  { symbol: 'RVNL', name: 'Rail Vikas Nigam Ltd', exchange: 'NSE' },
  { symbol: 'IREDA', name: 'IREDA Ltd', exchange: 'NSE' },
];

const FO_UNDERLYINGS: Array<{ symbol: string; aliases: string[]; name: string; step: number }> = [
  { symbol: 'NIFTY', aliases: ['NIFTY', 'NIFTY50', 'NIFTY 50'], name: 'Nifty 50 Index', step: 50 },
  { symbol: 'BANKNIFTY', aliases: ['BANKNIFTY', 'BANK NIFTY', 'NIFTY BANK'], name: 'Nifty Bank Index', step: 100 },
  { symbol: 'FINNIFTY', aliases: ['FINNIFTY', 'FIN NIFTY'], name: 'Nifty Financial Services Index', step: 50 },
  { symbol: 'MIDCPNIFTY', aliases: ['MIDCPNIFTY', 'MIDCAP NIFTY'], name: 'Nifty Midcap Select Index', step: 25 },
  { symbol: 'NIFTYNXT50', aliases: ['NIFTYNXT50', 'NIFTY NEXT 50', 'NIFTYNXT'], name: 'Nifty Next 50 Index', step: 100 },
  { symbol: 'NIFTYFPI', aliases: ['NIFTYFPI', 'NIFTY FPI'], name: 'Nifty FPI Index', step: 5 },
  { symbol: 'SENSEX', aliases: ['SENSEX'], name: 'BSE Sensex Index', step: 100 },
  { symbol: 'BANKEX', aliases: ['BANKEX'], name: 'BSE Bankex Index', step: 100 },
  { symbol: 'SENSEX50', aliases: ['SENSEX50', 'SENSEX 50'], name: 'BSE Sensex 50 Index', step: 50 },
];

/** Spot-only — no option/future chain on Dhan */
const SPOT_ONLY_INDICES = new Set(['NIFTYAUTO', 'NIFTYIT', 'NIFTYPHARMA', 'NIFTYFMCG', 'NIFTYMETAL', 'NIFTYENERGY', 'NIFTYREALTY', 'INDIAVIX']);

function foStrikeStep(underlying: string): number {
  const u = FO_UNDERLYINGS.find((x) => x.symbol === underlying.toUpperCase());
  return u?.step ?? 50;
}

function relatedFoScripts(query: string): StockOption[] {
  const raw = query.toUpperCase().replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  for (const u of FO_UNDERLYINGS) {
    const alias = [...u.aliases].sort((a, b) => b.length - a.length).find((a) => {
      const compact = a.replace(/\s+/g, '');
      return raw === a || raw === compact || raw.startsWith(`${a} `) || raw.startsWith(compact);
    });
    if (!alias) continue;

    const compactAlias = alias.replace(/\s+/g, '');
    let rest = raw.startsWith(alias)
      ? raw.slice(alias.length).trim()
      : raw.startsWith(compactAlias)
        ? raw.slice(compactAlias.length).trim()
        : '';
    rest = rest.replace(/^(CE|PE)\b/, '').trim();
    const strikeMatch = rest.match(/^(\d{3,6})(?:\s*(CE|PE))?$/);
    const embedded = !rest ? raw.match(new RegExp(`^${compactAlias}(\\d{3,6})(CE|PE)?$`)) : null;
    const strike = strikeMatch ? Number(strikeMatch[1]) : embedded ? Number(embedded[1]) : undefined;

    const out: StockOption[] = [
      { symbol: u.symbol, name: u.name, exchange: 'INDEX' },
      { symbol: `${u.symbol}FUT`, name: `${u.name} Futures`, exchange: 'NFO' },
    ];
    if (strike && Number.isFinite(strike) && strike > 0) {
      const rounded = Math.round(strike / u.step) * u.step;
      for (const s of [rounded - u.step, rounded, rounded + u.step].filter((x) => x > 0)) {
        out.push({ symbol: `${u.symbol}${s}CE`, name: `${u.symbol} ${s} CE`, exchange: 'NFO' });
        out.push({ symbol: `${u.symbol}${s}PE`, name: `${u.symbol} ${s} PE`, exchange: 'NFO' });
      }
    }
    return out;
  }
  return [];
}

function matchesQuery(s: StockOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (s.exchange === 'INDEX' && (q === 'index' || q === 'indices' || 'index'.startsWith(q))) {
    return true;
  }
  const sym = s.symbol.toLowerCase();
  const name = s.name.toLowerCase();
  const hay = `${sym} ${name}`;
  const compactQ = q.replace(/[\s/_-]+/g, '');
  if (sym.includes(q) || name.includes(q) || sym.includes(compactQ) || hay.includes(q)) return true;
  const tokens = q.split(/[\s/_-]+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => hay.includes(t) || sym.includes(t));
}

type Props = {
  value: string;
  onChange: (symbol: string) => void;
  onSelect?: (stock: StockOption) => void;
  disabled?: boolean;
  excludeSymbols?: string[];
  placeholder?: string;
  className?: string;
};

export function StockSymbolPicker({
  value,
  onChange,
  onSelect,
  disabled,
  excludeSymbols = [],
  placeholder = 'Search stock e.g. RELIANCE',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [remote, setRemote] = useState<StockOption[]>([]);
  const [highlight, setHighlight] = useState(0);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const exclude = useMemo(
    () => new Set(excludeSymbols.map((s) => s.toUpperCase())),
    [excludeSymbols]
  );

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const rows = await marketDataService.searchStocks(q);
        if (cancelled) return;
        if (rows?.length) {
          setRemote(
            rows.map((r) => ({
              symbol: r.symbol.toUpperCase(),
              name: r.name || r.symbol,
              exchange: r.exchange || 'NSE',
            }))
          );
        } else if (!q) {
          setRemote(STOCK_CATALOG);
        } else {
          setRemote([]);
        }
      } catch {
        if (!cancelled) setRemote([]);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const options = useMemo(() => {
    const related = relatedFoScripts(query);
    const localHits = STOCK_CATALOG.filter((s) => matchesQuery(s, query));
    // Remote already filtered by API — keep NFO/INDEX hits even if local matcher is strict
    const remoteHits = remote.filter((s) => matchesQuery(s, query) || s.exchange === 'NFO' || s.exchange === 'INDEX');
    const seen = new Set<string>();
    const merged: StockOption[] = [];
    for (const s of [...related, ...remoteHits, ...localHits]) {
      if (exclude.has(s.symbol.toUpperCase())) continue;
      const key = `${s.exchange}:${s.symbol.toUpperCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
    merged.sort((a, b) => {
      const rank = (x: StockOption) => (x.exchange === 'INDEX' ? 0 : x.exchange === 'NFO' ? 1 : 2);
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.symbol.localeCompare(b.symbol);
    });
    return merged.slice(0, 30);
  }, [query, remote, exclude]);

  useEffect(() => {
    if (!open || !wrapRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 360);
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setMenuPos({
        top: rect.bottom + 6,
        left: Math.max(8, left),
        width,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, query]);

  useEffect(() => {
    setHighlight(0);
  }, [options.length, query]);

  function pick(stock: StockOption) {
    onChange(stock.symbol.toUpperCase());
    setQuery(stock.symbol.toUpperCase());
    setOpen(false);
    onSelect?.(stock);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, options.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter' && open && options[highlight]) {
      e.preventDefault();
      pick(options[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const menu =
    open && menuPos
      ? createPortal(
          <ul
            ref={menuRef}
            role="listbox"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
              maxHeight: 288,
              overflowY: 'auto',
              zIndex: 2147483000,
              margin: 0,
              padding: 6,
              listStyle: 'none',
              borderRadius: 10,
              border: '1px solid rgba(34,211,238,0.35)',
              background: '#020617',
              boxShadow: '0 16px 40px rgba(0,0,0,0.75)',
              isolation: 'isolate',
            }}
          >
            {options.length === 0 ? (
              <li style={{ padding: '10px 12px', fontSize: 12, color: '#64748b' }}>
                No matching stocks or F&amp;O scripts
              </li>
            ) : (
              options.map((stock, idx) => {
                const active = idx === highlight;
                return (
                  <li key={`${stock.exchange}-${stock.symbol}`} style={{ marginBottom: 2 }}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => pick(stock)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '9px 10px',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: active ? 'rgba(34,211,238,0.18)' : '#0f172a',
                        color: '#e2e8f0',
                      }}
                    >
                      <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#67e8f9', flexShrink: 0 }}>
                        {stock.symbol}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 12,
                          color: '#94a3b8',
                        }}
                      >
                        {stock.name}
                      </span>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 999,
                          border: '1px solid rgba(148,163,184,0.25)',
                          color: stock.exchange === 'NFO' ? '#fcd34d' : stock.exchange === 'INDEX' ? '#6ee7b7' : '#94a3b8',
                          background: 'rgba(2,6,23,0.8)',
                        }}
                      >
                        {stock.exchange}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={wrapRef} className={`relative min-w-[240px] max-w-sm flex-1 ${className || ''}`}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="border-zinc-600 bg-zinc-950 pl-8 pr-8 font-mono text-white"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            // Keep spaces so "NIFTY 24000" strike search works
            const next = e.target.value.toUpperCase();
            setQuery(next);
            onChange(next);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle stock list"
        >
          <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {menu}
    </div>
  );
}
