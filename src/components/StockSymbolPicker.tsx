import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { marketDataService } from '@/services/marketDataService';

export type StockOption = {
  symbol: string;
  name: string;
  exchange: string;
};

/** Shared NSE catalog for select dropdowns and search fallback */
export const STOCK_CATALOG: StockOption[] = [
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
  const wrapRef = useRef<HTMLDivElement>(null);
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
        if (!cancelled && rows?.length) {
          setRemote(
            rows.map((r) => ({
              symbol: r.symbol.toUpperCase(),
              name: r.name || r.symbol,
              exchange: r.exchange || 'NSE',
            }))
          );
        } else if (!cancelled && !q) {
          setRemote(STOCK_CATALOG);
        }
      } catch {
        /* local fallback below */
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = remote.length ? remote : STOCK_CATALOG;
    const filtered = source.filter((s) => {
      if (exclude.has(s.symbol.toUpperCase())) return false;
      if (!q) return true;
      return (
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
      );
    });
    // Prefer local names if remote only has symbol
    return filtered.slice(0, 12);
  }, [query, remote, exclude]);

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

      {open ? (
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-950 py-1 shadow-xl"
          role="listbox"
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">No matching stocks</li>
          ) : (
            options.map((stock, idx) => (
              <li key={`${stock.exchange}-${stock.symbol}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={idx === highlight}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${
                    idx === highlight
                      ? 'bg-cyan-500/20 text-cyan-100'
                      : 'text-zinc-200 hover:bg-zinc-800'
                  }`}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => pick(stock)}
                >
                  <span className="font-mono font-medium text-cyan-300">{stock.symbol}</span>
                  <span className="truncate text-xs text-zinc-400">{stock.name}</span>
                  <span className="shrink-0 text-[10px] text-zinc-500">{stock.exchange}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
