import { Component, useCallback, useEffect, useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import type { AlgoCatalogItem } from './algosCatalog';
import { loadAlgosCatalog } from './algosCatalog';
import { MostDeployedRail } from './MostDeployedRail';
import { AlgosHome } from './AlgosHome';
import { MyAlgosPanel, type MyAlgoRow } from './MyAlgosPanel';
import { AlgosPositions } from './AlgosPositions';
import { AlgosOrders } from './AlgosOrders';
import { TradingAlgosMarket } from './TradingAlgosMarket';
import { InvestingAlgosMarket } from './InvestingAlgosMarket';
import { AlgoDetailView } from './AlgoDetailView';
import { useAlgosNav, type AlgosTab } from '../../contexts/AlgosNavContext';
import { useTheme } from '../../contexts/ThemeContext';
import { TradingBotsShell } from '../../modules/trading-bots/TradingBotsShell';
import { TradingBotsProvider } from '../../modules/trading-bots/store';

class AlgoViewBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message || 'Could not open this algo' };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, color: '#0f172a' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Algo view failed to load</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{this.state.error}</div>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer'
            }}
          >
            Back to My Algos
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const LIVE_POLL_MS = 45000;

export function AlgosWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { tab, setTab, registerClearDetail } = useAlgosNav();
  const { theme } = useTheme();
  const light = theme === 'light';
  const [items, setItems] = useState<AlgoCatalogItem[]>([]);
  const [usedDemo, setUsedDemo] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AlgoCatalogItem | null>(null);
  const [focusBotId, setFocusBotId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    registerClearDetail(() => setSelected(null));
    return () => registerClearDetail(null);
  }, [registerClearDetail]);

  useEffect(() => {
    if (tab !== 'bots') setFocusBotId(null);
  }, [tab]);

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

  const openMyAlgo = (row: MyAlgoRow) => {
    if (row.type === 'trading_bot') {
      setSelected(null);
      setFocusBotId(row.rawId);
      setTab('bots');
      return;
    }
    const algo = items.find(
      (a) =>
        a.agentId === row.rawId ||
        a.strategyId === row.rawId ||
        a.optionId === row.rawId ||
        a.name.toLowerCase() === row.name.toLowerCase()
    );
    if (algo) setSelected(algo);
  };

  const openTradingBots = (botId?: string) => {
    setSelected(null);
    setFocusBotId(botId || 'bot-sr-nifty');
    setTab('bots');
  };

  const showRail = !selected && (tab === 'home' || tab === 'trading' || tab === 'investing' || tab === 'my');

  return (
    <TradingBotsProvider
      key={focusBotId || 'tb-root'}
      initialPage={focusBotId ? 'bot-detail' : 'dashboard'}
      initialSelectedId={focusBotId || undefined}
    >
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
        boxSizing: 'border-box',
        background: light ? '#ffffff' : 'transparent',
        color: light ? '#0f172a' : '#e2e8f0'
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
              color: usedDemo ? (light ? '#b45309' : '#fbbf24') : light ? '#047857' : '#6ee7b7',
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
            border: light ? '1px solid #38bdf8' : '1px solid rgba(34,211,238,0.35)',
            background: light ? '#f0f9ff' : 'rgba(34,211,238,0.1)',
            color: light ? '#0369a1' : '#67e8f9',
            fontSize: 11,
            cursor: refreshing ? 'wait' : 'pointer'
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" style={{ opacity: refreshing ? 0.5 : 1 }} />
          {refreshing ? 'Syncing…' : 'Sync'}
        </button>
      </div>

      {loading && tab !== 'my' && tab !== 'bots' ? (
        <div style={{ padding: 48, color: '#64748b', fontSize: 13, textAlign: 'center', width: '100%' }}>
          Loading live algos workspace…
        </div>
      ) : selected ? (
        <div style={{ width: '100%', minWidth: 0 }}>
          <AlgoViewBoundary onReset={() => setSelected(null)}>
            <AlgoDetailView
              algo={selected}
              onBack={() => setSelected(null)}
              onDeployed={() => void refresh({ silent: true, generate: false })}
              onOpenTradingBots={() => openTradingBots(selected.botId)}
            />
          </AlgoViewBoundary>
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
            {tab === 'trading' && (
              <TradingAlgosMarket items={items} onSelect={openAlgo} onOpenTradingBots={() => openTradingBots()} />
            )}
            {tab === 'bots' && (
              <AlgoViewBoundary
                onReset={() => {
                  setFocusBotId(null);
                  setTab('my');
                }}
              >
                <TradingBotsShell
                  key={focusBotId || 'tb-dashboard'}
                  embedded
                  focusBotId={focusBotId || undefined}
                />
              </AlgoViewBoundary>
            )}
            {tab === 'investing' && <InvestingAlgosMarket items={items} onSelect={openAlgo} />}
            {tab === 'my' && (
              <MyAlgosPanel
                light={light}
                onDiscover={() => setTab('trading')}
                onOpenTradingBots={openTradingBots}
                onOpenAlgo={openMyAlgo}
              />
            )}
            {tab === 'positions' && <AlgosPositions />}
            {tab === 'orders' && <AlgosOrders />}
          </div>

          {showRail && (
            <MostDeployedRail
              fullWidth
              light={light}
              items={items}
              onSelect={(algo) => {
                openAlgo(algo);
              }}
            />
          )}
        </div>
      )}
    </div>
    </TradingBotsProvider>
  );
}

export type { AlgosTab } from '../../contexts/AlgosNavContext';
