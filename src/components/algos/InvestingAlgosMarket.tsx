import { useMemo, useState } from 'react';
import type { AlgoCatalogItem } from './algosCatalog';
import { formatInr, pctColor } from './algosCatalog';
import { Sparkline } from './Sparkline';

export function InvestingAlgosMarket({
  items,
  onSelect
}: {
  items: AlgoCatalogItem[];
  onSelect: (algo: AlgoCatalogItem) => void;
}) {
  const [sub, setSub] = useState<'all' | 'investing' | 'swing'>('all');
  const [capital, setCapital] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);

  const toggle = (list: string[], v: string, set: (x: string[]) => void) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const filtered = useMemo(() => {
    let rows = items.filter((a) => a.lane === 'investing');
    if (sub === 'swing') rows = rows.filter((a) => a.category === 'equity_swing');
    if (sub === 'investing') rows = rows.filter((a) => a.category === 'equity_long_term');
    if (capital.includes('1L')) rows = rows.filter((a) => a.minCapital <= 100000);
    if (capital.includes('2L')) rows = rows.filter((a) => a.minCapital <= 200000);
    if (styles.length) {
      rows = rows.filter((a) => styles.some((s) => a.style.toLowerCase().includes(s.toLowerCase())));
    }
    return rows;
  }, [items, sub, capital, styles]);

  return (
    <div style={{ display: 'flex', gap: 14, minHeight: 420 }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRadius: 12,
          border: '1px solid rgba(148,163,184,0.2)',
          background: 'rgba(15,23,42,0.65)',
          padding: 12
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9', marginBottom: 12 }}>Find best algos by</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>Capital Required</div>
          {[
            ['1L', 'Under ₹ 1,00,000'],
            ['2L', 'Under ₹ 2,00,000']
          ].map(([id, label]) => (
            <label key={id} style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
              <input type="checkbox" checked={capital.includes(id)} onChange={() => toggle(capital, id, setCapital)} />
              {label}
            </label>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', marginBottom: 8 }}>Trading Style</div>
          {['Long Term Investing', 'Swing Trading'].map((s) => (
            <label key={s} style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
              <input type="checkbox" checked={styles.includes(s)} onChange={() => toggle(styles, s, setStyles)} />
              {s}
            </label>
          ))}
        </div>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(
            [
              ['all', 'All Algos'],
              ['investing', 'Investing'],
              ['swing', 'Swing']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                border: sub === id ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.2)',
                background: sub === id ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: sub === id ? '#6ee7b7' : '#94a3b8',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1.2fr 0.7fr 0.7fr 0.7fr',
            gap: 8,
            padding: '8px 10px',
            fontSize: 11,
            color: '#64748b',
            borderBottom: '1px solid rgba(148,163,184,0.2)'
          }}
        >
          <span>Algo</span>
          <span>Margin Required</span>
          <span>1m Rolling Returns</span>
          <span>3m</span>
          <span>6m</span>
          <span>1y</span>
        </div>

        {filtered.map((algo) => (
          <button
            key={algo.id}
            type="button"
            onClick={() => onSelect(algo)}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.2fr 0.7fr 0.7fr 0.7fr',
              gap: 8,
              alignItems: 'center',
              padding: '12px 10px',
              width: '100%',
              border: 'none',
              borderBottom: '1px solid rgba(148,163,184,0.12)',
              background: 'transparent',
              textAlign: 'left',
              cursor: 'pointer',
              color: '#e2e8f0'
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{algo.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Equity · {algo.category === 'equity_long_term' ? 'Long-Term' : 'Swing'}
              </div>
            </div>
            <div style={{ fontSize: 13 }}>{formatInr(algo.minCapital)}</div>
            <Sparkline data={algo.sparkline} />
            <div style={{ fontWeight: 600, color: pctColor(algo.returns3m) }}>{algo.returns3m.toFixed(2)}%</div>
            <div style={{ fontWeight: 600, color: pctColor(algo.returns6m) }}>{algo.returns6m.toFixed(2)}%</div>
            <div style={{ fontWeight: 600, color: pctColor(algo.returns1y) }}>{algo.returns1y.toFixed(2)}%</div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No investing algos match filters</div>
        )}
      </div>
    </div>
  );
}
