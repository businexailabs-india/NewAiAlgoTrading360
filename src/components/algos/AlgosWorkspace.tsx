import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AlgoCatalogItem } from './algosCatalog';
import { loadAlgosCatalog } from './algosCatalog';
import { MostDeployedRail } from './MostDeployedRail';
import { AlgosHome } from './AlgosHome';
import { MyAlgosPanel } from './MyAlgosPanel';
import { AlgosPositions } from './AlgosPositions';
import { AlgosOrders } from './AlgosOrders';
import { TradingAlgosMarket } from './TradingAlgosMarket';
import { InvestingAlgosMarket } from './InvestingAlgosMarket';
import { AlgoDetailView } from './AlgoDetailView';
import { useAlgosNav, type AlgosTab } from '../../contexts/AlgosNavContext';

const LIVE_POLL_MS = 45000;

export function AlgosWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { tab, setTab, registerClearDetail } = useAlgosNav();
  const [items, setItems] = useState<AlgoCatalogItem[]>([]);
  const [usedDemo, setUsedDemo] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AlgoCatalogItem | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    registerClearDetail(() => setSelected(null));
    return () => registerClearDetail(null);
  }, [registerClearDetail]);

  const refresh = useCallback(async (opts?: { silent?: boolean; generate?: boolean }) => {
    if (!opts?.silent) setRefreshing(true);
    try {
      const { items: catalog, usedDemo: demo, liveCount: n } = await loadAlgosCatalog({
        generateIfEmpty: opts?.generate !== false
      });
      setItems(catalog);
      setUsedDemo(demo);
      setLiveCount(n);
      setLastSync(new Date());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh({ generate: true });
    const id = window.setInterval(() => void refresh({ silent: true, generate: false }), LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const openAlgo = (algo: AlgoCatalogItem) => {
    setSelected(algo);
  };

  const showRail = !selected && (tab === 'home' || tab === 'trading' || tab === 'investing' || tab === 'my');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        width: '100%',
        maxWidth: 'none',
        minWidth: 0,
        height: '100%',
        minHeight: embedded ? 560 : 520,
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 10,
          width: '100%'
        }}
      >
        {!loading && (
          <span
            style={{
              fontSize: 11,
              color: usedDemo ? '#fbbf24' : '#6ee7b7',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: usedDemo ? '#fbbf24' : '#34d399',
                boxShadow: usedDemo ? 'none' : '0 0 8px rgba(52,211,153,0.7)'
              }}
            />
            {usedDemo ? 'Demo fallback' : `Live · ${liveCount} algos`}
            {lastSync ? ` · ${lastSync.toLocaleTimeString()}` : ''}
          </span>
        )}
        <button
          type="button"
          onClick={() => void refresh({ generate: true })}
          disabled={refreshing}
          title="Refresh live catalog"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 10px',
            borderRadius: 8,
            border: '1px solid rgba(34,211,238,0.35)',
            background: 'rgba(34,211,238,0.1)',
            color: '#67e8f9',
            fontSize: 11,
            cursor: refreshing ? 'wait' : 'pointer'
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" style={{ opacity: refreshing ? 0.5 : 1 }} />
          {refreshing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, color: '#64748b', fontSize: 13, textAlign: 'center', width: '100%' }}>
          Loading live algos workspace…
        </div>
      ) : selected ? (
        <div style={{ width: '100%', minWidth: 0 }}>
          <AlgoDetailView
            algo={selected}
            onBack={() => setSelected(null)}
            onDeployed={() => void refresh({ silent: true, generate: false })}
          />
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            width: '100%',
            minWidth: 0
          }}
        >
          <div style={{ width: '100%', minWidth: 0 }}>
            {tab === 'home' && (
              <AlgosHome
                items={items}
                usedDemo={usedDemo}
                onNavigate={(next) => setTab(next as AlgosTab)}
                onSelectAlgo={openAlgo}
              />
            )}
            {tab === 'trading' && <TradingAlgosMarket items={items} onSelect={openAlgo} />}
            {tab === 'investing' && <InvestingAlgosMarket items={items} onSelect={openAlgo} />}
            {tab === 'my' && <MyAlgosPanel onDiscover={() => setTab('trading')} />}
            {tab === 'positions' && <AlgosPositions />}
            {tab === 'orders' && <AlgosOrders />}
          </div>

          {showRail && (
            <MostDeployedRail
              fullWidth
              items={items}
              onSelect={(algo) => {
                openAlgo(algo);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export type { AlgosTab } from '../../contexts/AlgosNavContext';
