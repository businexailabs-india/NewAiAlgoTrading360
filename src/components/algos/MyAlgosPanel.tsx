import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pause, Play, Rocket, RefreshCw } from 'lucide-react';
import { tradingService } from '../../services/tradingService';
import { advisoryMarketplaceService } from '../../services/advisoryMarketplaceService';
import { portfolioService } from '../../services/portfolioService';
import { useTradingDashboard } from '../../hooks/useTradingDashboard';
import { formatInr } from './algosCatalog';

type KindFilter = 'all' | 'trading' | 'investing';
type StatusFilter = 'active' | 'paused' | 'expired';

interface MyAlgoRow {
  id: string;
  rawId: string;
  name: string;
  kind: 'trading' | 'investing';
  status: StatusFilter;
  mode?: string;
  meta: string;
  type: 'agent' | 'strategy' | 'option';
}

export function MyAlgosPanel({ onDiscover }: { onDiscover: () => void }) {
  const { agents, summary, loading, refresh } = useTradingDashboard();
  const [strategies, setStrategies] = useState<Array<Record<string, unknown>>>([]);
  const [options, setOptions] = useState<Array<Record<string, unknown>>>([]);
  const [allocated, setAllocated] = useState<number | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reloadLists = useCallback(async () => {
    const [strats, opts, port] = await Promise.all([
      tradingService.listStrategies().catch(() => []),
      advisoryMarketplaceService.listStrategyOptions().catch(() => []),
      portfolioService.getSummary().catch(() => null)
    ]);
    setStrategies(Array.isArray(strats) ? strats : []);
    setOptions(Array.isArray(opts) ? opts : []);
    if (port) setAllocated(Number(port.totalCurrent ?? port.totalInvested ?? 0));
  }, []);

  useEffect(() => {
    reloadLists();
  }, [reloadLists]);

  const rows = useMemo(() => {
    const fromAgents: MyAlgoRow[] = (agents || []).map((a) => {
      const st = String(a.status || (a.isActive ? 'active' : 'paused')).toLowerCase();
      const statusNorm: StatusFilter = st.includes('expir')
        ? 'expired'
        : st.includes('pause') || st.includes('stop') || st === 'inactive' || a.isActive === false
          ? 'paused'
          : 'active';
      return {
        id: `agent-${String(a.id)}`,
        rawId: String(a.id),
        name: String(a.name || 'Agent'),
        kind: 'trading' as const,
        status: statusNorm,
        mode: String(a.mode || 'paper'),
        meta: `Agent · ${String(a.mode || 'paper')}`,
        type: 'agent' as const
      };
    });

    const fromStrats: MyAlgoRow[] = strategies.map((s) => {
      const cat = String(s.category || '');
      const kind: 'trading' | 'investing' = /invest|equity|swing|long/i.test(cat + String(s.name))
        ? 'investing'
        : 'trading';
      const active = s.isActive !== false && s.status !== 'paused';
      return {
        id: `strat-${String(s.id)}`,
        rawId: String(s.id),
        name: String(s.name || 'Strategy'),
        kind,
        status: active ? 'active' : 'paused',
        meta: `Rule strategy · ${cat || 'custom'}`,
        type: 'strategy' as const
      };
    });

    const fromOptions: MyAlgoRow[] = options.map((o) => {
      const st = String(o.status || o.lifecycle || 'active').toLowerCase();
      const statusNorm: StatusFilter = st.includes('expir')
        ? 'expired'
        : st.includes('pause') || st.includes('draft')
          ? 'paused'
          : 'active';
      const name = String(o.name || o.strategy_name || o.title || 'Strategy option');
      const kind: 'trading' | 'investing' = /invest|equity|swing|long/i.test(name + String(o.strategy_type || ''))
        ? 'investing'
        : 'trading';
      return {
        id: `opt-${String(o.id)}`,
        rawId: String(o.id),
        name,
        kind,
        status: statusNorm,
        mode: String(o.mode || (o.deployed ? 'paper' : 'option')),
        meta: `Option · ${String(o.strategy_type || o.type || 'algo')} · ${st}`,
        type: 'option' as const
      };
    });

    return [...fromAgents, ...fromOptions, ...fromStrats].filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      return r.status === status;
    });
  }, [agents, strategies, options, kind, status]);

  const toggleAgent = async (row: MyAlgoRow) => {
    if (row.type !== 'agent') return;
    setBusyId(row.id);
    setMsg(null);
    try {
      const nextActive = row.status !== 'active';
      await tradingService.updateAgent(row.rawId, {
        isActive: nextActive,
        status: nextActive ? 'active' : 'paused'
      });
      setMsg(nextActive ? `${row.name} resumed` : `${row.name} paused`);
      await refresh();
      await reloadLists();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  };

  const runAgent = async (row: MyAlgoRow) => {
    if (row.type !== 'agent') return;
    setBusyId(row.id);
    setMsg(null);
    try {
      await tradingService.runAgent(row.rawId);
      setMsg(`${row.name} run triggered`);
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Run failed');
    } finally {
      setBusyId(null);
    }
  };

  const deployOption = async (row: MyAlgoRow) => {
    if (row.type !== 'option') return;
    setBusyId(row.id);
    setMsg(null);
    try {
      await advisoryMarketplaceService.save(row.rawId).catch(() => null);
      await advisoryMarketplaceService.paperTest(row.rawId);
      await advisoryMarketplaceService.deployPaper(row.rawId);
      setMsg(`${row.name} saved · paper-tested · deployed`);
      await reloadLists();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, justifyWrap: 'wrap' }}>
        {(
          [
            ['all', 'All'],
            ['trading', 'Trading Algos'],
            ['investing', 'Investing Algos']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setKind(id)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              border: kind === id ? '1px solid rgba(52,211,153,0.55)' : '1px solid rgba(148,163,184,0.25)',
              background: kind === id ? 'rgba(16,185,129,0.15)' : 'transparent',
              color: kind === id ? '#6ee7b7' : '#94a3b8',
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            refresh();
            reloadLists();
          }}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid rgba(148,163,184,0.3)',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Sync
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 10,
          padding: 12,
          borderRadius: 12,
          border: '1px solid rgba(34,211,238,0.2)',
          background: 'rgba(15,23,42,0.6)'
        }}
      >
        {[
          ['Allocated', allocated != null ? formatInr(allocated) : '—'],
          ["Today's P&L", summary ? `₹${Number(summary.totalPnL).toLocaleString('en-IN')}` : '—'],
          ['Overall P&L', summary ? `₹${Number(summary.totalPnL).toLocaleString('en-IN')}` : '—'],
          ['Trading Now', String(summary?.activeAgents ?? 0)],
          ['Active On', String(rows.filter((r) => r.status === 'active').length)],
          ['Subscribed to', String(agents.length + strategies.length + options.length)]
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#e2e8f0', marginTop: 4 }}>
              {loading ? '…' : value}
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ fontSize: 12, color: '#67e8f9', padding: '6px 10px', borderRadius: 8, background: 'rgba(34,211,238,0.1)' }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
        {(
          [
            ['active', 'Active Algos'],
            ['paused', 'Paused Algos'],
            ['expired', 'Expired Algos']
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatus(id)}
            style={{
              padding: '8px 12px',
              fontSize: 12,
              border: 'none',
              borderBottom: status === id ? '2px solid #34d399' : '2px solid transparent',
              background: 'transparent',
              color: status === id ? '#6ee7b7' : '#94a3b8',
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div style={{ padding: '40px 16px', textAlign: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              margin: '0 auto 14px',
              borderRadius: 16,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(16,185,129,0.35))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Rocket className="h-8 w-8 text-cyan-200" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Deploy your 1st Algo today!</div>
          <button
            type="button"
            onClick={onDiscover}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: 'none',
              color: '#67e8f9',
              cursor: 'pointer',
              fontSize: 13,
              textDecoration: 'underline'
            }}
          >
            Discover algos to deploy
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.18)',
                background: 'rgba(2,6,23,0.4)'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#e2e8f0' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.meta}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    color: r.status === 'active' ? '#6ee7b7' : '#fbbf24',
                    textTransform: 'capitalize'
                  }}
                >
                  {r.status}
                </span>
                {r.type === 'agent' && (
                  <>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => toggleAgent(r)}
                      title={r.status === 'active' ? 'Pause' : 'Resume'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '5px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(148,163,184,0.3)',
                        background: 'transparent',
                        color: '#cbd5e1',
                        cursor: 'pointer',
                        fontSize: 11
                      }}
                    >
                      {r.status === 'active' ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {r.status === 'active' ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => runAgent(r)}
                      style={{
                        padding: '5px 8px',
                        borderRadius: 8,
                        border: '1px solid rgba(34,211,238,0.4)',
                        background: 'rgba(34,211,238,0.1)',
                        color: '#67e8f9',
                        cursor: 'pointer',
                        fontSize: 11
                      }}
                    >
                      Run
                    </button>
                  </>
                )}
                {r.type === 'option' && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => deployOption(r)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 8,
                      border: '1px solid rgba(52,211,153,0.4)',
                      background: 'rgba(16,185,129,0.12)',
                      color: '#6ee7b7',
                      cursor: 'pointer',
                      fontSize: 11
                    }}
                  >
                    {busyId === r.id ? '…' : 'Deploy paper'}
                  </button>
                )}
                {r.type === 'strategy' && (
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={async () => {
                      setBusyId(r.id);
                      try {
                        await tradingService.backtestStrategy(r.rawId, 14);
                        await tradingService.evaluateStrategy(r.rawId);
                        setMsg(`${r.name} backtest + evaluate done`);
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : 'Evaluate failed');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 8,
                      border: '1px solid rgba(34,211,238,0.4)',
                      background: 'rgba(34,211,238,0.1)',
                      color: '#67e8f9',
                      cursor: 'pointer',
                      fontSize: 11
                    }}
                  >
                    Evaluate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
