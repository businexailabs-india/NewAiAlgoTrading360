import { useMemo, useState } from 'react';
import { Search, Star } from 'lucide-react';
import type { AlgoCatalogItem } from './algosCatalog';
import { formatInr, pctColor } from './algosCatalog';

type Tf = '1m' | '3m' | '6m' | '1yr';

function retFor(algo: AlgoCatalogItem, tf: Tf): number {
  if (tf === '1m') return algo.returns1m;
  if (tf === '3m') return algo.returns3m;
  if (tf === '6m') return algo.returns6m;
  return algo.returns1y;
}

export function MostDeployedRail({
  items,
  onSelect,
  onSearchChange,
  fullWidth = false
}: {
  items: AlgoCatalogItem[];
  onSelect: (algo: AlgoCatalogItem) => void;
  onSearchChange?: (q: string) => void;
  /** Stretch across the main Algos Live window (no side squeeze). */
  fullWidth?: boolean;
}) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [tf, setTf] = useState<Tf>('3m');
  const pageSize = fullWidth ? 6 : 4;

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.deployedCount - a.deployedCount);
    if (!q.trim()) return sorted;
    const needle = q.toLowerCase();
    return sorted.filter(
      (a) => a.name.toLowerCase().includes(needle) || a.style.toLowerCase().includes(needle) || a.underlying.toLowerCase().includes(needle)
    );
  }, [items, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <aside
      style={{
        width: fullWidth ? '100%' : 280,
        flexShrink: fullWidth ? 0 : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 0,
        minWidth: 0,
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px',
          borderRadius: 10,
          border: '1px solid rgba(148,163,184,0.25)',
          background: 'rgba(15,23,42,0.8)'
        }}
      >
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
            onSearchChange?.(e.target.value);
          }}
          placeholder="Search for algo name, kind etc"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#e2e8f0',
            fontSize: 12
          }}
        />
      </div>

      <div
        className="neon-card"
        style={{
          padding: 12,
          borderRadius: 12,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#f1f5f9', fontSize: 13 }}>
            <Star className="h-4 w-4 text-amber-400" />
            Most Deployed Algos
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: Math.min(5, pages) }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPage(n)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  fontSize: 11,
                  border: page === n ? '1px solid rgba(52,211,153,0.6)' : '1px solid rgba(148,163,184,0.25)',
                  background: page === n ? 'rgba(16,185,129,0.2)' : 'transparent',
                  color: page === n ? '#6ee7b7' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: fullWidth ? 'grid' : 'flex',
            gridTemplateColumns: fullWidth ? 'repeat(auto-fill, minmax(240px, 1fr))' : undefined,
            flexDirection: fullWidth ? undefined : 'column',
            gap: 8,
            overflowY: fullWidth ? 'visible' : 'auto',
            flex: 1,
            minHeight: 0
          }}
        >
          {slice.map((algo) => {
            const r = retFor(algo, tf);
            return (
              <button
                key={algo.id}
                type="button"
                onClick={() => onSelect(algo)}
                style={{
                  textAlign: 'left',
                  padding: 10,
                  borderRadius: 10,
                  border: '1px solid rgba(148,163,184,0.18)',
                  background: 'rgba(2,6,23,0.45)',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{algo.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: pctColor(r) }}>
                    {r >= 0 ? '+' : ''}
                    {r.toFixed(2)}%
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  {algo.underlying} · Min Capital: {formatInr(algo.minCapital)}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  {tf === '1m' ? '1 Month' : tf === '3m' ? '3 Month' : tf === '6m' ? '6 Month' : '1 Year'}
                </div>
              </button>
            );
          })}
          {slice.length === 0 && (
            <div style={{ fontSize: 12, color: '#64748b', padding: 12, textAlign: 'center' }}>No algos match</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyTop: '1px solid rgba(148,163,184,0.15)', paddingTop: 10 }}>
          {(['1m', '3m', '6m', '1yr'] as Tf[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTf(t)}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: 11,
                borderRadius: 6,
                border: tf === t ? '1px solid rgba(34,211,238,0.5)' : '1px solid transparent',
                background: tf === t ? 'rgba(34,211,238,0.15)' : 'transparent',
                color: tf === t ? '#67e8f9' : '#94a3b8',
                cursor: 'pointer'
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
