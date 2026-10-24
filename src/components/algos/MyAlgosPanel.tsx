import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pause, Play, Rocket, RefreshCw, Wallet } from 'lucide-react';
import { tradingService } from '../../services/tradingService';
import { advisoryMarketplaceService } from '../../services/advisoryMarketplaceService';
import { portfolioService } from '../../services/portfolioService';
import { useTradingDashboard } from '../../hooks/useTradingDashboard';
import { formatInr } from './algosCatalog';
import { FundTransferModal } from './FundTransferModal';
import { SEED_BOTS } from '../../modules/trading-bots/seed';

type KindFilter = 'all' | 'trading' | 'investing';
type StatusFilter = 'active' | 'paused' | 'expired';

export interface MyAlgoRow {
  id: string;
  rawId: string;
  name: string;
  kind: 'trading' | 'investing';
  status: StatusFilter;
  mode?: string;
  meta: string;
  type: 'agent' | 'strategy' | 'option' | 'trading_bot';
}

export function MyAlgosPanel({
  onDiscover,
  onOpenTradingBots,
  onOpenAlgo,
  light = true
}: {
  onDiscover: () => void;
  onOpenTradingBots?: (botId?: string) => void;
  onOpenAlgo?: (row: MyAlgoRow) => void;
  light?: boolean;
}) {
  const { agents, summary, loading, refresh } = useTradingDashboard();
  const [strategies, setStrategies] = useState<Array<Record<string, unknown>>>([]);
  const [options, setOptions] = useState<Array<Record<string, unknown>>>([]);
  const [allocated, setAllocated] = useState<number | null>(null);
  const [availableCash, setAvailableCash] = useState<number | null>(null);
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundMode, setFundMode] = useState<'add' | 'withdraw'>('add');

  const reloadLists = useCallback(async () => {
    const [strats, opts, port, funds] = await Promise.all([
      tradingService.listStrategies().catch(() => []),
      advisoryMarketplaceService.listStrategyOptions().catch(() => []),
      portfolioService.getSummary().catch(() => null),
      portfolioService.getFunds().catch(() => null)
    ]);
    setStrategies(Array.isArray(strats) ? strats : []);
    setOptions(Array.isArray(opts) ? opts : []);
    if (port) {
      const cash = Number(port.availableCash ?? funds?.availableCash ?? 0);
      const holdings = Number(port.totalCurrent ?? 0);
      setAllocated(Number(port.capitalAllocated ?? cash + holdings));
    }
    if (funds) setAvailableCash(funds.availableCash);
    else if (port?.availableCash != null) setAvailableCash(Number(port.availableCash));
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

    const fromBots: MyAlgoRow[] = SEED_BOTS.map((b) => {
      const running = b.status === 'RUNNING';
      const statusNorm: StatusFilter = running ? 'active' : 'paused';
      const strat =
        b.config.strategy === 'sr_hedging'
          ? 'Bull Put / Bear Call'
          : b.config.strategy.replace(/_/g, ' ');
      return {
        id: `bot-${b.id}`,
        rawId: b.id,
        name: b.config.name,
        kind: 'trading' as const,
        status: statusNorm,
        mode: b.mode,
        meta: `TradingBot · ${b.config.underlying} · ${strat} · ${b.mode} · ${b.status}`,
        type: 'trading_bot' as const
      };
    });

    return [...fromBots, ...fromAgents, ...fromOptions, ...fromStrats].filter((r) => {
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

  const ui = light
    ? {
        pageBg: '#ffffff',
        pageFg: '#0f172a',
        muted: '#64748b',
        chipOnBd: '#059669',
        chipOnBg: '#ecfdf5',
        chipOnFg: '#047857',
        chipOffBd: '#cbd5e1',
        chipOffBg: '#ffffff',
        chipOffFg: '#475569',
        withdrawBd: '#fecaca',
        withdrawBg: '#fef2f2',
        withdrawFg: '#b91c1c',
        syncBd: '#cbd5e1',
        syncBg: '#ffffff',
        syncFg: '#475569',
        statsBd: '#e2e8f0',
        statsBg: '#f8fafc',
        statsVal: '#0f172a',
        msgBg: '#f0f9ff',
        msgFg: '#0369a1',
        tabLine: '#e2e8f0',
        tabOn: '#047857',
        tabOff: '#64748b',
        tabAccent: '#059669',
        title: '#0f172a',
        rowBd: '#e2e8f0',
        rowBg: '#ffffff',
        active: '#047857',
        paused: '#b45309',
        openBd: '#5eead4',
        openBg: '#f0fdfa',
        openFg: '#0f766e',
        actBd: '#38bdf8',
        actBg: '#f0f9ff',
        actFg: '#0369a1',
        ghostBd: '#cbd5e1',
        ghostBg: '#ffffff',
        ghostFg: '#334155',
        deployBd: '#34d399',
        deployBg: '#ecfdf5',
        deployFg: '#047857'
      }
    : {
        pageBg: 'transparent',
        pageFg: '#e2e8f0',
        muted: '#94a3b8',
        chipOnBd: 'rgba(52,211,153,0.55)',
        chipOnBg: 'rgba(16,185,129,0.15)',
        chipOnFg: '#6ee7b7',
        chipOffBd: 'rgba(148,163,184,0.25)',
        chipOffBg: 'transparent',
        chipOffFg: '#94a3b8',
        withdrawBd: 'rgba(248,113,113,0.4)',
        withdrawBg: 'rgba(127,29,29,0.25)',
        withdrawFg: '#fecaca',
        syncBd: 'rgba(148,163,184,0.3)',
        syncBg: 'transparent',
        syncFg: '#94a3b8',
        statsBd: 'rgba(34,211,238,0.2)',
        statsBg: 'rgba(15,23,42,0.6)',
        statsVal: '#e2e8f0',
        msgBg: 'rgba(34,211,238,0.1)',
        msgFg: '#67e8f9',
        tabLine: 'rgba(148,163,184,0.2)',
        tabOn: '#6ee7b7',
        tabOff: '#94a3b8',
        tabAccent: '#34d399',
        title: '#f1f5f9',
        rowBd: 'rgba(148,163,184,0.18)',
        rowBg: 'rgba(2,6,23,0.4)',
        active: '#6ee7b7',
        paused: '#fbbf24',
        openBd: 'rgba(45,212,191,0.45)',
        openBg: 'rgba(13,148,136,0.15)',
        openFg: '#5eead4',
        actBd: 'rgba(34,211,238,0.4)',
        actBg: 'rgba(34,211,238,0.1)',
        actFg: '#67e8f9',
        ghostBd: 'rgba(148,163,184,0.3)',
        ghostBg: 'transparent',
        ghostFg: '#cbd5e1',
        deployBd: 'rgba(52,211,153,0.4)',
        deployBg: 'rgba(16,185,129,0.12)',
        deployFg: '#6ee7b7'
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: ui.pageBg, color: ui.pageFg }}>
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
              border: kind === id ? `1px solid ${ui.chipOnBd}` : `1px solid ${ui.chipOffBd}`,
              background: kind === id ? ui.chipOnBg : ui.chipOffBg,
              color: kind === id ? ui.chipOnFg : ui.chipOffFg,
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setFundMode('add');
            setFundOpen(true);
          }}
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 8,
            border: 'none',
            background: '#059669',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600
          }}
        >
          <Wallet className="h-3.5 w-3.5" /> Add Fund
        </button>
        <button
          type="button"
          onClick={() => {
            setFundMode('withdraw');
            setFundOpen(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 8,
            border: `1px solid ${ui.withdrawBd}`,
            background: ui.withdrawBg,
            color: ui.withdrawFg,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 600
          }}
        >
          Withdraw
        </button>
        <button
          type="button"
          onClick={() => {
            refresh();
            reloadLists();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderRadius: 8,
            border: `1px solid ${ui.syncBd}`,
            background: ui.syncBg,
            color: ui.syncFg,
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Sync
        </button>
      </div>

      <FundTransferModal
        open={fundOpen}
        initialMode={fundMode}
        onClose={() => setFundOpen(false)}
        onDone={() => void reloadLists()}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 10,
          padding: 12,
          borderRadius: 12,
          border: `1px solid ${ui.statsBd}`,
          background: ui.statsBg
        }}
      >
        {[
          ['Allocated', allocated != null ? formatInr(allocated) : '—'],
          ['Available Cash', availableCash != null ? formatInr(availableCash) : '—'],
          ["Today's P&L", summary ? `₹${Number(summary.totalPnL).toLocaleString('en-IN')}` : '—'],
          ['Trading Now', String(summary?.activeAgents ?? 0)],
          ['Active On', String(rows.filter((r) => r.status === 'active').length)],
          ['Subscribed to', String(SEED_BOTS.length + agents.length + strategies.length + options.length)]
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: ui.muted }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: ui.statsVal, marginTop: 4 }}>
              {loading ? '…' : value}
            </div>
          </div>
        ))}
      </div>

      {msg && (
        <div style={{ fontSize: 12, color: ui.msgFg, padding: '6px 10px', borderRadius: 8, background: ui.msgBg }}>
          {msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${ui.tabLine}` }}>
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
              borderBottom: status === id ? `2px solid ${ui.tabAccent}` : '2px solid transparent',
              background: 'transparent',
              color: status === id ? ui.tabOn : ui.tabOff,
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
          <div style={{ fontSize: 16, fontWeight: 600, color: ui.title }}>Deploy your 1st Algo today!</div>
          <button
            type="button"
            onClick={onDiscover}
            style={{
              marginTop: 10,
              background: 'transparent',
              border: 'none',
              color: ui.msgFg,
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
              role="button"
              tabIndex={0}
              onClick={() => onOpenAlgo?.(r)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpenAlgo?.(r);
                }
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${ui.rowBd}`,
                background: ui.rowBg,
                cursor: onOpenAlgo ? 'pointer' : 'default'
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: ui.title }}>{r.name}</div>
                <div style={{ fontSize: 11, color: ui.muted, marginTop: 2 }}>{r.meta}</div>
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: r.status === 'active' ? ui.active : ui.paused,
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
                        border: `1px solid ${ui.ghostBd}`,
                        background: ui.ghostBg,
                        color: ui.ghostFg,
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
                        border: `1px solid ${ui.actBd}`,
                        background: ui.actBg,
                        color: ui.actFg,
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
                      border: `1px solid ${ui.deployBd}`,
                      background: ui.deployBg,
                      color: ui.deployFg,
                      cursor: 'pointer',
                      fontSize: 11
                    }}
                  >
                    {busyId === r.id ? '…' : 'Deploy paper'}
                  </button>
                )}
                {r.type === 'trading_bot' && (
                  <button
                    type="button"
                    onClick={() => onOpenTradingBots?.(r.rawId)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 8,
                      border: `1px solid ${ui.openBd}`,
                      background: ui.openBg,
                      color: ui.openFg,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600
                    }}
                  >
                    Open TradingBots
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
                      border: `1px solid ${ui.actBd}`,
                      background: ui.actBg,
                      color: ui.actFg,
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
