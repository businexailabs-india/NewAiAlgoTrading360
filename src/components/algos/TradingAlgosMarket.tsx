import { useMemo, useState, type ReactNode } from 'react';
import type { AlgoCatalogItem, AlgoCategory } from './algosCatalog';
import { categoryLabel, formatInr, pctColor } from './algosCatalog';
import { Sparkline } from './Sparkline';
import { useTheme } from '../../contexts/ThemeContext';

const SUB_TABS: Array<{ id: 'all' | AlgoCategory; label: string }> = [
  { id: 'all', label: 'All Algos' },
  { id: 'hedged_options', label: 'Hedged Options' },
  { id: 'credit_spread', label: 'Credit Spread' },
  { id: 'option_buying', label: 'Option Buying' },
  { id: 'short_straddle', label: 'Short Straddle' },
  { id: 'short_strangle', label: 'Short Strangle' }
];

export function TradingAlgosMarket({
  items,
  onSelect,
  showFilters = true,
  onOpenTradingBots
}: {
  items: AlgoCatalogItem[];
  onSelect: (algo: AlgoCatalogItem) => void;
  showFilters?: boolean;
  onOpenTradingBots?: () => void;
}) {
  const { theme } = useTheme();
  const light = theme === 'light';
  const ink = light ? '#0f172a' : '#e2e8f0';
  const muted = light ? '#64748b' : '#94a3b8';
  const [sub, setSub] = useState<'all' | AlgoCategory>('all');
  const [capital, setCapital] = useState<string[]>([]);
  const [popularity, setPopularity] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);

  const toggle = (list: string[], v: string, set: (x: string[]) => void) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const filtered = useMemo(() => {
    let rows = items.filter((a) => a.lane === 'trading');
    if (sub !== 'all') rows = rows.filter((a) => a.category === sub);
    if (capital.length) {
      rows = rows.filter((a) =>
        capital.some((c) => {
          if (c === '50k') return a.minCapital <= 50000;
          if (c === '1L') return a.minCapital <= 100000;
          if (c === '2L') return a.minCapital <= 200000;
          return a.minCapital <= 500000;
        })
      );
    }
    if (popularity.includes('deployed')) rows = [...rows].sort((a, b) => b.deployedCount - a.deployedCount);
    if (popularity.includes('tracked')) rows = [...rows].sort((a, b) => b.trackedCount - a.trackedCount);
    if (styles.length) {
      rows = rows.filter((a) => styles.some((s) => a.style.toLowerCase().includes(s.toLowerCase()) || a.tradeType.toLowerCase().includes(s.toLowerCase())));
    }
    return rows;
  }, [items, sub, capital, popularity, styles]);

  return (
    <div style={{ display: 'flex', gap: 14, minHeight: 420 }}>
      {showFilters && (
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            borderRadius: 12,
            border: '1px solid rgba(148,163,184,0.2)',
            background: light ? '#f8fafc' : 'rgba(15,23,42,0.65)',
            padding: 12
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, color: ink, marginBottom: 12 }}>Find best algos by</div>
          <FilterGroup title="Capital Required">
            {[
              ['50k', 'Under ₹ 50,000'],
              ['1L', 'Under ₹ 1,00,000'],
              ['2L', 'Under ₹ 2,00,000'],
              ['5L', 'Under ₹ 5,00,000']
            ].map(([id, label]) => (
              <Check key={id} label={label} checked={capital.includes(id)} onChange={() => toggle(capital, id, setCapital)} />
            ))}
          </FilterGroup>
          <FilterGroup title="Popularity">
            <Check label="Most deployed" checked={popularity.includes('deployed')} onChange={() => toggle(popularity, 'deployed', setPopularity)} />
            <Check label="Most tracked" checked={popularity.includes('tracked')} onChange={() => toggle(popularity, 'tracked', setPopularity)} />
          </FilterGroup>
          <FilterGroup title="Trading Style">
            {['Directional Options', 'Hedged Options', 'Option Buying', 'Option Selling'].map((s) => (
              <Check key={s} label={s} checked={styles.includes(s)} onChange={() => toggle(styles, s, setStyles)} />
            ))}
          </FilterGroup>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {onOpenTradingBots ? (
          <button
            type="button"
            onClick={onOpenTradingBots}
            style={{
              width: '100%',
              marginBottom: 12,
              padding: '12px 14px',
              borderRadius: 12,
              textAlign: 'left',
              cursor: 'pointer',
              border: '1px solid rgba(45,212,191,0.45)',
              background: 'rgba(45,212,191,0.08)',
              color: ink
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>TradingBots · Support & Resistance Hedging</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>
              Built-in paper bot: resistance break → bull put · support break → bear call. Open the TradingBots tab.
            </div>
          </button>
        ) : null}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                border: sub === t.id ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.2)',
                background: sub === t.id ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: sub === t.id ? (light ? '#047857' : '#6ee7b7') : muted,
                cursor: 'pointer'
              }}
            >
              {t.label}
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

        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                border: 'none',
                borderBottom: '1px solid rgba(148,163,184,0.12)',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
                color: ink
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{algo.name}</div>
                <div style={{ fontSize: 11, color: muted }}>
                  {categoryLabel(algo.category)} · {algo.style}
                </div>
              </div>
              <div style={{ fontSize: 13 }}>{formatInr(algo.minCapital)}</div>
              <div>
                <Sparkline data={algo.sparkline} />
              </div>
              <div style={{ fontWeight: 600, color: pctColor(algo.returns3m) }}>{algo.returns3m.toFixed(2)}%</div>
              <div style={{ fontWeight: 600, color: pctColor(algo.returns6m) }}>{algo.returns6m.toFixed(2)}%</div>
              <div style={{ fontWeight: 600, color: pctColor(algo.returns1y) }}>{algo.returns1y.toFixed(2)}%</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: '#64748b', fontSize: 13 }}>No trading algos match filters</div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
