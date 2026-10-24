import { useCallback, useMemo, useState, type CSSProperties } from 'react';

const KEY = 'smarttrade_terminal_watchlists_v1';
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export type WatchlistSymbol = {
  symbol: string;
  name?: string;
  exchange: string;
};

type Store = Record<number, WatchlistSymbol[]>;

function emptyStore(): Store {
  return Object.fromEntries(SLOTS.map((n) => [n, []])) as Store;
}

function loadStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Store;
    const next = emptyStore();
    for (const n of SLOTS) {
      const rows = Array.isArray(parsed?.[n]) ? parsed[n] : [];
      next[n] = rows
        .filter((r) => r && typeof r.symbol === 'string' && r.symbol.trim())
        .map((r) => ({
          symbol: r.symbol.trim().toUpperCase(),
          name: r.name,
          exchange: r.exchange || 'NSE'
        }));
    }
    return next;
  } catch {
    return emptyStore();
  }
}

function saveStore(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function TerminalWatchlists({
  selectedSymbol,
  selectedName,
  onPickSymbol,
  btn,
  light = true
}: {
  selectedSymbol?: string;
  selectedName?: string;
  onPickSymbol: (symbol: string, name?: string) => void;
  btn: CSSProperties;
  light?: boolean;
}) {
  const [store, setStore] = useState<Store>(() => loadStore());
  const [active, setActive] = useState(1);
  const [draft, setDraft] = useState('');

  const rows = store[active] || [];
  const addSymbol = (selectedSymbol || draft).trim().toUpperCase();

  const fg = light ? '#0f172a' : '#e2e8f0';
  const muted = light ? '#64748b' : '#94a3b8';
  const accent = light ? '#0369a1' : '#7dd3fc';
  const accentOn = light ? '#0c4a6e' : '#e0f2fe';
  const cardBg = light ? '#f8fafc' : 'rgba(15,23,42,0.88)';
  const cardBd = light ? '#bae6fd' : 'rgba(56,189,248,0.28)';
  const surface = light ? '#ffffff' : 'rgba(2,6,23,0.92)';
  const surfaceHi = light ? '#e0f2fe' : 'rgba(14,165,233,0.22)';
  const chipBd = light ? '#7dd3fc' : 'rgba(56,189,248,0.45)';

  const update = useCallback((next: Store) => {
    setStore(next);
    saveStore(next);
  }, []);

  const add = () => {
    const symbol = addSymbol.replace(/[^A-Z0-9&]/g, '');
    if (!symbol) return;
    const list = store[active] || [];
    if (list.some((r) => r.symbol === symbol)) return;
    update({
      ...store,
      [active]: [...list, { symbol, name: selectedName, exchange: 'NSE' }]
    });
    setDraft('');
  };

  const remove = (symbol: string) => {
    update({
      ...store,
      [active]: (store[active] || []).filter((r) => r.symbol !== symbol)
    });
  };

  const counts = useMemo(
    () => Object.fromEntries(SLOTS.map((n) => [n, (store[n] || []).length])) as Record<number, number>,
    [store]
  );

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        border: `1px solid ${cardBd}`,
        background: cardBg,
        display: 'grid',
        gap: 8
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: accent }}>WATCHLISTS</span>
        {SLOTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setActive(n)}
            style={{
              ...btn,
              minWidth: 36,
              fontWeight: 800,
              padding: '6px 10px',
              borderColor: active === n ? (light ? '#0284c7' : '#38bdf8') : cardBd,
              background: active === n ? surfaceHi : surface,
              color: active === n ? accentOn : accent
            }}
            title={`Watchlist ${n}`}
          >
            {n}
            {counts[n] ? (
              <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, opacity: 0.75 }}>{counts[n]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 800, color: fg, fontSize: 13 }}>WATCHLIST {active}</div>
        <span style={{ fontSize: 11, color: muted }}>
          {rows.length ? `${rows.length} SYMBOL${rows.length === 1 ? '' : 'S'}` : 'EMPTY — ADD A STOCK FROM SEARCH'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder={selectedSymbol ? selectedSymbol.toUpperCase() : 'SYMBOL'}
            style={{
              padding: '6px 8px',
              borderRadius: 8,
              border: light ? '1px solid #cbd5e1' : '1px solid rgba(148,163,184,0.35)',
              background: surface,
              color: fg,
              width: 120,
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase'
            }}
          />
          <button type="button" style={{ ...btn, fontWeight: 800 }} onClick={add} disabled={!addSymbol}>
            ADD TO {active}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 36, alignItems: 'center' }}>
        {rows.length === 0 ? (
          <span style={{ fontSize: 12, color: muted }}>NO SYMBOLS IN WATCHLIST {active}</span>
        ) : (
          rows.map((r) => (
            <span
              key={r.symbol}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                borderRadius: 8,
                border: `1px solid ${chipBd}`,
                background: surface
              }}
            >
              <button
                type="button"
                onClick={() => onPickSymbol(r.symbol, r.name)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontWeight: 800,
                  color: fg,
                  fontSize: 12,
                  padding: 0
                }}
                title={r.name || r.symbol}
              >
                {r.symbol}
              </button>
              <button
                type="button"
                onClick={() => remove(r.symbol)}
                aria-label={`Remove ${r.symbol}`}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: muted,
                  fontSize: 12,
                  fontWeight: 800,
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
