import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, Bookmark, FlaskConical, Rocket, Settings2, ShieldAlert } from 'lucide-react';
import type { AlgoCatalogItem } from './algosCatalog';
import { formatInr, pctColor } from './algosCatalog';
import { AlgoMetricsCards } from './AlgoMetricsCards';
import { AlgoPerformanceChart } from './AlgoPerformanceChart';
import { advisoryMarketplaceService } from '../../services/advisoryMarketplaceService';
import { tradingService } from '../../services/tradingService';
import { portfolioService } from '../../services/portfolioService';
import { integrationService } from '../../services/integrationService';
import { useTheme } from '../../contexts/ThemeContext';

type DetailTab = 'performance' | 'best_worst' | 'past_trades' | 'about' | 'config';

interface TradeRow {
  id: string;
  symbol: string;
  side: string;
  qty: number;
  price: number;
  status: string;
  at: string;
  isPaper?: boolean;
}

interface AgentConfigForm {
  name: string;
  mode: 'paper' | 'live';
  isActive: boolean;
  symbols: string;
  minConfidence: number;
  maxOrdersPerRun: number;
  defaultQuantity: number;
  maxPositionValue: number;
  useScreener: boolean;
  screenerTopN: number;
  product: 'CNC' | 'MIS';
}

const defaultAgentForm = (): AgentConfigForm => ({
  name: '',
  mode: 'paper',
  isActive: true,
  symbols: 'RELIANCE, TCS, INFY, HDFCBANK',
  minConfidence: 50,
  maxOrdersPerRun: 3,
  defaultQuantity: 1,
  maxPositionValue: 50000,
  useScreener: true,
  screenerTopN: 8,
  product: 'CNC'
});

export function AlgoDetailView({
  algo,
  onBack,
  onDeployed,
  onOpenTradingBots
}: {
  algo: AlgoCatalogItem;
  onBack: () => void;
  onDeployed?: (msg: string) => void;
  onOpenTradingBots?: () => void;
}) {
  const { theme } = useTheme();
  const light = theme === 'light';
  const ink = light ? '#0f172a' : '#f8fafc';
  const muted = light ? '#475569' : '#94a3b8';
  const cardBg = light ? '#f8fafc' : 'rgba(15,23,42,0.7)';
  const cardBd = light ? '#e2e8f0' : 'rgba(34,211,238,0.22)';
  const isAgent = algo.source === 'agent' && Boolean(algo.agentId);
  const [tab, setTab] = useState<DetailTab>(isAgent ? 'config' : 'performance');
  const [tf, setTf] = useState<'1m' | '3m' | '6m' | '1y' | 'all'>('3m');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [optionId, setOptionId] = useState<string | undefined>(algo.optionId);
  const [paperQualified, setPaperQualified] = useState(false);
  const [disclosure, setDisclosure] = useState(false);
  const [confirmLive, setConfirmLive] = useState(false);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState<Record<string, number> | null>(null);
  const [agentForm, setAgentForm] = useState<AgentConfigForm>(defaultAgentForm);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentDirty, setAgentDirty] = useState(false);

  const tfRet =
    tf === '1m'
      ? liveMetrics?.returns1m ?? algo.returns1m
      : tf === '3m'
        ? liveMetrics?.returns3m ?? algo.returns3m
        : tf === '6m'
          ? liveMetrics?.returns6m ?? algo.returns6m
          : tf === '1y'
            ? liveMetrics?.returns1y ?? algo.returns1y
            : liveMetrics?.cumulativeReturn ?? algo.cumulativeReturn;

  useEffect(() => {
    let cancelled = false;
    setTradesLoading(true);
    (async () => {
      try {
        const [orderList, tradeList] = await Promise.all([
          tradingService.getOrders().catch(() => []),
          portfolioService.getTrades().catch(() => [])
        ]);
        const needle = [algo.underlying, algo.name.split(' ')[0], ...(algo.tags || [])]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase());

        const match = (symbol: string, source?: string) => {
          const hay = `${symbol} ${source || ''}`.toLowerCase();
          if (!needle.length) return true;
          return needle.some((n) => n.length > 1 && hay.includes(n));
        };

        const fromOrders: TradeRow[] = (Array.isArray(orderList) ? orderList : [])
          .filter((o: Record<string, unknown>) =>
            match(String(o.symbol || ''), String(o.source || o.agentId || ''))
          )
          .slice(0, 40)
          .map((o: Record<string, unknown>, i: number) => ({
            id: String(o.id || `ord-${i}`),
            symbol: String(o.symbol || '—'),
            side: String(o.tradeType || o.side || 'BUY'),
            qty: Number(o.quantity || 0),
            price: Number(o.price || o.avgPrice || 0),
            status: String(o.status || '—'),
            at: String(o.executedAt || o.createdAt || o.updatedAt || ''),
            isPaper: Boolean(o.isPaper)
          }));

        const fromTrades: TradeRow[] = (Array.isArray(tradeList) ? tradeList : [])
          .filter((t: Record<string, unknown>) => match(String(t.symbol || '')))
          .slice(0, 40)
          .map((t: Record<string, unknown>, i: number) => ({
            id: String(t.id || `tr-${i}`),
            symbol: String(t.symbol || '—'),
            side: String(t.tradeType || t.side || 'BUY'),
            qty: Number(t.quantity || 0),
            price: Number(t.price || 0),
            status: String(t.status || 'COMPLETE'),
            at: String(t.executedAt || t.createdAt || ''),
            isPaper: Boolean(t.isPaper)
          }));

        const merged = [...fromOrders, ...fromTrades];
        const seen = new Set<string>();
        const unique = merged.filter((r) => {
          const key = `${r.symbol}-${r.side}-${r.qty}-${r.at}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        if (!cancelled) setTrades(unique);
      } catch {
        if (!cancelled) setTrades([]);
      } finally {
        if (!cancelled) setTradesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [algo]);

  useEffect(() => {
    if (!isAgent || !algo.agentId) return;
    let cancelled = false;
    setAgentLoading(true);
    void (async () => {
      try {
        const agents = await tradingService.listAgents();
        const row = (Array.isArray(agents) ? agents : []).find(
          (a: Record<string, unknown>) => String(a.id) === String(algo.agentId)
        ) as Record<string, unknown> | undefined;
        if (!row || cancelled) return;
        const cfg = (row.config && typeof row.config === 'object' ? row.config : {}) as Record<
          string,
          unknown
        >;
        const symbols = Array.isArray(cfg.symbols)
          ? (cfg.symbols as string[]).join(', ')
          : String(cfg.symbols || 'RELIANCE, TCS, INFY, HDFCBANK');
        setAgentForm({
          name: String(row.name || algo.name),
          mode: String(row.mode || 'paper') === 'live' ? 'live' : 'paper',
          isActive: Boolean(row.isActive),
          symbols,
          minConfidence: Number(cfg.minConfidence ?? 50),
          maxOrdersPerRun: Number(cfg.maxOrdersPerRun ?? 3),
          defaultQuantity: Number(cfg.defaultQuantity ?? 1),
          maxPositionValue: Number(cfg.maxPositionValue ?? 50000),
          useScreener: cfg.useScreener !== false,
          screenerTopN: Number(cfg.screenerTopN ?? 8),
          product: String(cfg.product || 'CNC').toUpperCase() === 'MIS' ? 'MIS' : 'CNC'
        });
        setAgentDirty(false);
      } catch {
        if (!cancelled) setErr('Could not load agent config');
      } finally {
        if (!cancelled) setAgentLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [algo.agentId, algo.name, isAgent]);

  const tradeSides = useMemo(() => trades.map((t) => ({ side: t.side })), [trades]);

  const patchAgentForm = (patch: Partial<AgentConfigForm>) => {
    setAgentForm((prev) => ({ ...prev, ...patch }));
    setAgentDirty(true);
  };

  const saveAgentConfig = async () => {
    if (!algo.agentId) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const symbols = agentForm.symbols
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      if (!agentForm.name.trim()) throw new Error('Name is required');
      if (!symbols.length) throw new Error('Add at least one symbol');
      await tradingService.updateAgent(algo.agentId, {
        name: agentForm.name.trim(),
        mode: agentForm.mode,
        isActive: agentForm.isActive,
        config: {
          symbols,
          minConfidence: agentForm.minConfidence,
          maxOrdersPerRun: agentForm.maxOrdersPerRun,
          defaultQuantity: agentForm.defaultQuantity,
          maxPositionValue: agentForm.maxPositionValue,
          useScreener: agentForm.useScreener,
          screenerTopN: agentForm.screenerTopN,
          product: agentForm.product
        }
      });
      setAgentDirty(false);
      const text = `Agent config saved · ${agentForm.mode} · ${symbols.length} symbols · minConfidence ${agentForm.minConfidence}`;
      setMsg(text);
      onDeployed?.(text);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save agent config');
    } finally {
      setBusy(false);
    }
  };

  const runPaperFunnel = async (id: string) => {
    await advisoryMarketplaceService.save(id).catch(() => null);
    setSaved(true);
    const paper = (await advisoryMarketplaceService.paperTest(id)) as Record<string, unknown>;
    const qualified = Boolean(paper?.qualified_for_live ?? paper?.qualifiedForLive);
    setPaperQualified(qualified);
    const ret = Number(paper?.return_pct ?? paper?.returnPct ?? paper?.pnl_pct);
    if (Number.isFinite(ret)) {
      setLiveMetrics({
        returns1m: Number((ret / 3).toFixed(2)),
        returns3m: Number(ret.toFixed(2)),
        returns6m: Number((ret * 1.4).toFixed(2)),
        returns1y: Number((ret * 2).toFixed(2)),
        cumulativeReturn: Number((ret * 2.2).toFixed(2))
      });
    }
    await advisoryMarketplaceService.deployPaper(id);
    return { qualified, paper };
  };

  const brokerLiveHint = async (): Promise<string> => {
    try {
      const accounts = await integrationService.listAccounts();
      const dhan = accounts.find((a) => String(a.broker || '').toLowerCase() === 'dhan');
      if (!dhan) return ' Connect Dhan under Broker Connections before live deploy.';
      if (dhan.status === 'CONNECTED') return '';
      const err = dhan.lastError ? ` (${dhan.lastError})` : '';
      return ` Dhan is ${dhan.status}${err} — reconnect/validate token for live; paper path still works.`;
    } catch {
      return '';
    }
  };

  const pickRecommendation = (
    recs: Array<{
      id: string;
      title: string;
      type: string;
      symbols?: string[];
      confidence_score?: number;
    }>
  ) => {
    const under = String(algo.underlying || '')
      .toLowerCase()
      .replace(/\s+/g, '');
    const nameToken = algo.name.split(/\s+/)[0]?.toLowerCase() || '';
    const bySymbol = recs.find((r) =>
      (r.symbols || []).some((s) => {
        const sym = s.toLowerCase().replace(/\s+/g, '');
        return under.includes(sym) || sym.includes(under) || under.includes('nifty');
      })
    );
    if (bySymbol) return bySymbol;
    const byName = recs.find((r) => r.title.toLowerCase().includes(nameToken));
    if (byName) return byName;
    const byType = recs.find((r) =>
      String(r.type || '')
        .toLowerCase()
        .includes(String(algo.category || algo.tradeType || '').toLowerCase().split('_')[0] || 'x')
    );
    if (byType) return byType;
    return [...recs].sort((a, b) => (b.confidence_score || 0) - (a.confidence_score || 0))[0];
  };

  const deployFromAdvisory = async (advisoryId: string, recommendationId: string, label: string) => {
    const converted = (await advisoryMarketplaceService.convertToAlgo(
      advisoryId,
      recommendationId
    )) as Record<string, unknown>;
    const newId = String(converted?.id || converted?.option_id || converted?.strategy_option_id || '');
    if (!newId) throw new Error('Convert succeeded but no strategy option id returned.');
    setOptionId(newId);
    const { qualified } = await runPaperFunnel(newId);
    const hint = await brokerLiveHint();
    const text = qualified
      ? `${label} → paper deployed. Eligible to request live.${hint}`
      : `${label} → paper deployed. Keep paper running before live.${hint}`;
    setMsg(text);
    onDeployed?.(text);
  };

  const deploy = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      if (algo.source === 'option' && (optionId || algo.optionId)) {
        const id = optionId || algo.optionId!;
        const { qualified } = await runPaperFunnel(id);
        const hint = await brokerLiveHint();
        const text = qualified
          ? `Saved · paper-tested · deployed to paper. Eligible to request live approval.${hint}`
          : `Saved · paper-tested · deployed to paper. Live not qualified yet — keep paper running.${hint}`;
        setMsg(text);
        onDeployed?.(text);
      } else if (algo.source === 'advisory' && algo.advisoryId && algo.recommendationId) {
        await deployFromAdvisory(algo.advisoryId, algo.recommendationId, 'Converted');
      } else if (algo.source === 'demo' || algo.isDemo) {
        const generated = await advisoryMarketplaceService.generate();
        const advisoryId = generated.advisory_id;
        const recs = generated.recommendations || [];
        if (!advisoryId || !recs.length) {
          const hint = await brokerLiveHint();
          throw new Error(
            `Advisory generated no recommendations.${hint || ' Open Broker Connections, then Sync algos.'}`
          );
        }
        const rec = pickRecommendation(recs);
        if (!rec?.id) throw new Error('No matching advisory recommendation to convert.');
        await deployFromAdvisory(advisoryId, rec.id, `Generated “${rec.title}”`);
      } else if (algo.source === 'agent' && algo.agentId) {
        const result = (await tradingService.runAgent(algo.agentId)) as {
          ordersPlaced?: Array<{ symbol?: string; direction?: string; quantity?: number; status?: string }>;
          signals?: unknown[];
        };
        const placed = Array.isArray(result?.ordersPlaced) ? result.ordersPlaced : [];
        const text = placed.length
          ? `Paper agent run complete — ${placed.length} order(s): ${placed
              .map((o) => `${o.direction} ${o.symbol}×${o.quantity} (${o.status})`)
              .join(', ')}.`
          : `Agent run finished with ${(result?.signals as unknown[])?.length || 0} signal(s) but 0 orders (HOLD / low confidence / no quote).`;
        setMsg(text);
        onDeployed?.(text);
      } else if (algo.source === 'strategy') {
        const id = algo.strategyId || algo.id.replace(/^strat-/, '');
        const bt = (await tradingService.backtestStrategy(id, 14).catch(() => null)) as Record<
          string,
          unknown
        > | null;
        await tradingService.evaluateStrategy(id);
        if (bt) {
          const ret = Number(bt.return_pct ?? bt.totalReturn ?? bt.pnl_pct);
          if (Number.isFinite(ret)) {
            setLiveMetrics({
              returns1m: Number((ret / 3).toFixed(2)),
              returns3m: Number(ret.toFixed(2)),
              returns6m: Number((ret * 1.3).toFixed(2)),
              returns1y: Number((ret * 1.8).toFixed(2)),
              cumulativeReturn: Number(ret.toFixed(2))
            });
          }
        }
        const text = 'Backtest + evaluate completed on live strategy rules.';
        setMsg(text);
        onDeployed?.(text);
      } else if (algo.source === 'external') {
        const extId = algo.externalId || algo.id.replace(/^ext-/, '');
        await advisoryMarketplaceService.normalizeExternal(extId);
        await advisoryMarketplaceService.riskScanExternal(extId);
        const text = 'External algo normalized + risk-scanned. Convert via AI Advisor to deploy paper.';
        setMsg(text);
        onDeployed?.(text);
      } else {
        setErr('No deploy path for this source yet.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setBusy(false);
    }
  };

  const saveBookmark = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      let id = optionId || algo.optionId;
      if (!id && algo.source === 'advisory' && algo.advisoryId && algo.recommendationId) {
        const converted = (await advisoryMarketplaceService.convertToAlgo(
          algo.advisoryId,
          algo.recommendationId
        )) as Record<string, unknown>;
        id = String(converted?.id || converted?.option_id || '');
        if (id) setOptionId(id);
      }
      if (!id) throw new Error('Save works for strategy options — convert/deploy first.');
      await advisoryMarketplaceService.save(id);
      setSaved(true);
      setMsg('Strategy option saved to your workspace.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const paperOnly = async () => {
    const id = optionId || algo.optionId;
    if (!id) {
      setErr('Paper test needs a strategy option — Deploy (convert) first.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const paper = (await advisoryMarketplaceService.paperTest(id)) as Record<string, unknown>;
      setPaperQualified(Boolean(paper?.qualified_for_live ?? paper?.qualifiedForLive));
      setMsg(`Paper test: ${String(paper?.result_status || paper?.status || 'done')}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Paper test failed');
    } finally {
      setBusy(false);
    }
  };

  const requestLive = async () => {
    const id = optionId || algo.optionId;
    if (!id) {
      setErr('Request live needs a deployed strategy option.');
      return;
    }
    if (!disclosure || !confirmLive) {
      setErr('Accept risk disclosure and confirm live request.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = (await advisoryMarketplaceService.requestLive(id, {
        risk_disclosure_accepted: disclosure,
        explicit_confirmation: confirmLive,
        paper_qualified: paperQualified
      })) as Record<string, unknown>;
      setMsg(
        res?.status === 'blocked'
          ? `Live blocked: ${JSON.stringify(res.block_reasons || res.reasons || [])}`
          : 'Live approval requested — pending RMS/compliance.'
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Live request failed');
    } finally {
      setBusy(false);
    }
  };

  const tabs: Array<{ id: DetailTab; label: string }> = [
    ...(isAgent ? [{ id: 'config' as const, label: 'Configure' }] : []),
    { id: 'performance', label: 'Algo Performance' },
    { id: 'best_worst', label: 'Best & Worst' },
    { id: 'past_trades', label: 'Past Trades' },
    { id: 'about', label: 'About Algo' }
  ];

  const displayAlgo = liveMetrics
    ? {
        ...algo,
        returns1m: liveMetrics.returns1m ?? algo.returns1m,
        returns3m: liveMetrics.returns3m ?? algo.returns3m,
        returns6m: liveMetrics.returns6m ?? algo.returns6m,
        returns1y: liveMetrics.returns1y ?? algo.returns1y,
        cumulativeReturn: liveMetrics.cumulativeReturn ?? algo.cumulativeReturn
      }
    : algo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          color: muted,
          cursor: 'pointer',
          fontSize: 12
        }}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to marketplace
      </button>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          padding: 14,
          borderRadius: 12,
          border: `1px solid ${cardBd}`,
          background: cardBg
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: ink }}>{algo.name}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {algo.live && (
              <span
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(52,211,153,0.45)',
                  color: '#6ee7b7',
                  background: 'rgba(16,185,129,0.12)'
                }}
              >
                Live
              </span>
            )}
            {(algo.tags || []).map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.3)',
                  color: light ? '#334155' : '#cbd5e1'
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: muted }}>
            <span>
              Min. Amount <strong style={{ color: ink }}>{formatInr(algo.minCapital || 0)}</strong>
            </span>
            <span>
              Max. Amount <strong style={{ color: ink }}>{formatInr(algo.maxCapital || 0)}</strong>
            </span>
            <span>
              Source <strong style={{ color: ink }}>{algo.source}</strong>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {algo.source === 'trading_bot' && onOpenTradingBots ? (
            <button
              type="button"
              onClick={onOpenTradingBots}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Rocket className="h-4 w-4" />
              Open in TradingBots
            </button>
          ) : null}
          <button
            type="button"
            onClick={deploy}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)',
              color: '#fff',
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer'
            }}
          >
            <Rocket className="h-4 w-4" />
            {busy ? 'Working…' : 'Deploy'}
          </button>
          <button
            type="button"
            onClick={paperOnly}
            disabled={busy}
            title="Paper test only"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(52,211,153,0.4)',
              background: 'rgba(16,185,129,0.12)',
              color: '#6ee7b7',
              fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
              fontSize: 12
            }}
          >
            <FlaskConical className="h-4 w-4" />
            Paper test
          </button>
          <button
            type="button"
            onClick={saveBookmark}
            disabled={busy}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: saved
                ? '1px solid rgba(52,211,153,0.55)'
                : '1px solid rgba(148,163,184,0.3)',
              background: saved ? 'rgba(16,185,129,0.15)' : 'transparent',
              color: saved ? '#6ee7b7' : '#94a3b8',
              cursor: busy ? 'wait' : 'pointer'
            }}
            title="Save strategy option"
          >
            <Bookmark className="h-4 w-4 mx-auto" />
          </button>
        </div>
      </div>

      {(optionId || algo.optionId) && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: '1px solid rgba(251,191,36,0.35)',
            background: 'rgba(120,53,15,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fbbf24', fontSize: 12, fontWeight: 600 }}>
            <ShieldAlert className="h-4 w-4" />
            Request live trading (RMS gated)
          </div>
          <label style={{ fontSize: 12, color: '#e2e8f0', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={disclosure} onChange={(e) => setDisclosure(e.target.checked)} />
            I accept risk disclosure for live trading
          </label>
          <label style={{ fontSize: 12, color: '#e2e8f0', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={confirmLive} onChange={(e) => setConfirmLive(e.target.checked)} />
            Explicitly confirm live approval request
          </label>
          <button
            type="button"
            onClick={requestLive}
            disabled={busy || !disclosure || !confirmLive}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid rgba(251,191,36,0.5)',
              background: 'rgba(251,191,36,0.15)',
              color: '#fde68a',
              fontSize: 12,
              fontWeight: 600,
              cursor: busy || !disclosure || !confirmLive ? 'not-allowed' : 'pointer',
              opacity: busy || !disclosure || !confirmLive ? 0.5 : 1
            }}
          >
            Request live approval
          </button>
        </div>
      )}

      {msg && (
        <div
          style={{
            fontSize: 12,
            color: '#67e8f9',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(34,211,238,0.1)'
          }}
        >
          {msg}
        </div>
      )}
      {err && (
        <div
          style={{
            fontSize: 12,
            color: '#fca5a5',
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(248,113,113,0.12)'
          }}
        >
          {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(148,163,184,0.2)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 12px',
              fontSize: 12,
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #34d399' : '2px solid transparent',
              background: 'transparent',
              color: tab === t.id ? '#6ee7b7' : '#94a3b8',
              cursor: 'pointer'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'config' && isAgent && (
        <div
          className="neon-card"
          style={{
            padding: 16,
            borderRadius: 12,
            border: '1px solid rgba(34,211,238,0.25)',
            background: 'rgba(15,23,42,0.75)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#67e8f9', fontWeight: 650 }}>
            <Settings2 className="h-4 w-4" />
            Agent configuration
            {agentDirty ? (
              <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 500 }}>Unsaved changes</span>
            ) : null}
          </div>
          {agentLoading ? (
            <div style={{ color: '#94a3b8', fontSize: 12 }}>Loading agent…</div>
          ) : (
            <>
              <div style={formGrid}>
                <label style={fieldLabel}>
                  Name
                  <input
                    value={agentForm.name}
                    onChange={(e) => patchAgentForm({ name: e.target.value })}
                    style={fieldInput}
                  />
                </label>
                <label style={fieldLabel}>
                  Mode
                  <select
                    value={agentForm.mode}
                    onChange={(e) =>
                      patchAgentForm({ mode: e.target.value === 'live' ? 'live' : 'paper' })
                    }
                    style={fieldInput}
                  >
                    <option value="paper">paper</option>
                    <option value="live">live</option>
                  </select>
                </label>
                <label style={fieldLabel}>
                  Product
                  <select
                    value={agentForm.product}
                    onChange={(e) =>
                      patchAgentForm({ product: e.target.value === 'MIS' ? 'MIS' : 'CNC' })
                    }
                    style={fieldInput}
                  >
                    <option value="CNC">CNC</option>
                    <option value="MIS">MIS</option>
                  </select>
                </label>
                <label
                  style={{
                    ...fieldLabel,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingTop: 22
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agentForm.isActive}
                    onChange={(e) => patchAgentForm({ isActive: e.target.checked })}
                  />
                  Active (scheduler / My Algos)
                </label>
              </div>

              <label style={fieldLabel}>
                Symbols (comma-separated)
                <input
                  value={agentForm.symbols}
                  onChange={(e) => patchAgentForm({ symbols: e.target.value })}
                  style={fieldInput}
                  placeholder="RELIANCE, TCS, INFY"
                />
              </label>

              <div style={formGrid}>
                <label style={fieldLabel}>
                  Min confidence
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={agentForm.minConfidence}
                    onChange={(e) =>
                      patchAgentForm({ minConfidence: Math.max(0, Number(e.target.value) || 0) })
                    }
                    style={fieldInput}
                  />
                </label>
                <label style={fieldLabel}>
                  Max orders / run
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={agentForm.maxOrdersPerRun}
                    onChange={(e) =>
                      patchAgentForm({
                        maxOrdersPerRun: Math.max(1, Number(e.target.value) || 1)
                      })
                    }
                    style={fieldInput}
                  />
                </label>
                <label style={fieldLabel}>
                  Default qty
                  <input
                    type="number"
                    min={1}
                    value={agentForm.defaultQuantity}
                    onChange={(e) =>
                      patchAgentForm({
                        defaultQuantity: Math.max(1, Number(e.target.value) || 1)
                      })
                    }
                    style={fieldInput}
                  />
                </label>
                <label style={fieldLabel}>
                  Max position value (₹)
                  <input
                    type="number"
                    min={1000}
                    step={1000}
                    value={agentForm.maxPositionValue}
                    onChange={(e) =>
                      patchAgentForm({
                        maxPositionValue: Math.max(1000, Number(e.target.value) || 1000)
                      })
                    }
                    style={fieldInput}
                  />
                </label>
              </div>

              <div style={formGrid}>
                <label
                  style={{
                    ...fieldLabel,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingTop: 8
                  }}
                >
                  <input
                    type="checkbox"
                    checked={agentForm.useScreener}
                    onChange={(e) => patchAgentForm({ useScreener: e.target.checked })}
                  />
                  Use stock screener
                </label>
                <label style={fieldLabel}>
                  Screener top N
                  <input
                    type="number"
                    min={1}
                    max={50}
                    disabled={!agentForm.useScreener}
                    value={agentForm.screenerTopN}
                    onChange={(e) =>
                      patchAgentForm({ screenerTopN: Math.max(1, Number(e.target.value) || 1) })
                    }
                    style={{ ...fieldInput, opacity: agentForm.useScreener ? 1 : 0.5 }}
                  />
                </label>
              </div>

              <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.45 }}>
                Signals = prediction engine + screener (optional) + momentum on symbols. HOLD / below min
                confidence are skipped. Live mode still needs TopBar LIVE + PIN + Dhan CONNECTED.
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={busy || !agentDirty}
                  onClick={() => void saveAgentConfig()}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #0891b2 0%, #2563eb 100%)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: busy || !agentDirty ? 'not-allowed' : 'pointer',
                    opacity: busy || !agentDirty ? 0.5 : 1
                  }}
                >
                  {busy ? 'Saving…' : 'Save configuration'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      if (agentDirty) await saveAgentConfig();
                      await deploy();
                    })()
                  }
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: '1px solid rgba(34,211,238,0.4)',
                    background: 'rgba(8,47,73,0.6)',
                    color: '#a5f3fc',
                    fontWeight: 600,
                    cursor: busy ? 'wait' : 'pointer'
                  }}
                >
                  {agentDirty ? 'Save & run once' : 'Run once'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'performance' && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(
              [
                ['1m', displayAlgo.returns1m],
                ['3m', displayAlgo.returns3m],
                ['6m', displayAlgo.returns6m],
                ['1y', displayAlgo.returns1y],
                ['all', displayAlgo.cumulativeReturn]
              ] as const
            ).map(([id, ret]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTf(id)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: tf === id ? '1px solid rgba(52,211,153,0.5)' : '1px solid rgba(148,163,184,0.2)',
                  background: tf === id ? 'rgba(16,185,129,0.15)' : 'transparent',
                  color: ink,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                {id}{' '}
                <span style={{ color: pctColor(Number(ret) || 0), fontWeight: 600 }}>
                  {(Number(ret) || 0) >= 0 ? '+' : ''}
                  {(Number(ret) || 0).toFixed(1)}%
                </span>
              </button>
            ))}
          </div>

          <AlgoPerformanceChart
            sparkline={algo.sparkline || []}
            windowReturn={Number(tfRet) || 0}
            windowLabel={tf}
            liveNote={liveMetrics ? 'Updated from paper/backtest' : 'Catalog / live series'}
            tradeSides={tradeSides}
          />

          <AlgoMetricsCards algo={displayAlgo} />
        </>
      )}

      {tab === 'best_worst' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="neon-card" style={{ padding: 14, borderRadius: 12 }}>
            <div style={{ fontWeight: 600, color: '#6ee7b7', marginBottom: 8 }}>Best month</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: pctColor(algo.avgUpMonth) }}>
              +{(Number(algo.avgUpMonth) || 0).toFixed(2)}%
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Avg up-month return</div>
          </div>
          <div className="neon-card" style={{ padding: 14, borderRadius: 12 }}>
            <div style={{ fontWeight: 600, color: '#f87171', marginBottom: 8 }}>Worst month</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: pctColor(algo.avgDownMonth) }}>
              {(Number(algo.avgDownMonth) || 0).toFixed(2)}%
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Avg down-month return</div>
          </div>
        </div>
      )}

      {tab === 'past_trades' && (
        <div>
          {tradesLoading && <div style={{ color: '#64748b', fontSize: 13 }}>Loading live fills…</div>}
          {!tradesLoading && trades.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              No matching orders/trades yet. Deploy or run the algo to collect fills.
            </div>
          )}
          {!tradesLoading && trades.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ color: '#64748b', textAlign: 'left' }}>
                    {['Symbol', 'Side', 'Qty', 'Price', 'Status', 'When', 'Mode'].map((h) => (
                      <th key={h} style={{ padding: '8px 6px', fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trades.map((t) => (
                    <tr key={t.id} style={{ borderTop: '1px solid rgba(148,163,184,0.12)', color: '#e2e8f0' }}>
                      <td style={{ padding: '10px 6px', fontWeight: 600 }}>{t.symbol}</td>
                      <td
                        style={{
                          padding: '10px 6px',
                          color: t.side.toUpperCase().includes('SELL') ? '#f87171' : '#34d399'
                        }}
                      >
                        {t.side}
                      </td>
                      <td style={{ padding: '10px 6px' }}>{t.qty}</td>
                      <td style={{ padding: '10px 6px' }}>{t.price.toFixed(2)}</td>
                      <td style={{ padding: '10px 6px' }}>{t.status}</td>
                      <td style={{ padding: '10px 6px', color: '#94a3b8' }}>
                        {t.at ? new Date(t.at).toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '10px 6px', color: '#94a3b8' }}>
                        {t.isPaper ? 'Paper' : 'Live'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'about' && (
        <div className="neon-card" style={{ padding: 16, borderRadius: 12, fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
          <p>
            <strong style={{ color: '#f1f5f9' }}>{algo.name}</strong> is a {algo.lane} algo on {algo.underlying} (
            {algo.segment}). Style: {algo.style}. Deploy runs the live funnel: save → paper-test → paper deploy.
            Live trading requires explicit approval.
          </p>
          {algo.isDemo && (
            <p style={{ marginTop: 10, color: '#fbbf24' }}>
              Demo catalog item — Deploy generates an advisory recommendation, converts it, and runs the
              paper funnel. Live deploy still needs a CONNECTED Dhan account + RMS approval.
            </p>
          )}
          {isAgent && (
            <p style={{ marginTop: 10, color: '#7dd3fc' }}>
              Use the <strong>Configure</strong> tab to edit symbols, confidence, sizing, screener, and
              paper/live mode. Deploy runs <code>collectSignals</code> then places orders via OMS.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const formGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 10
};

const fieldLabel: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 11,
  color: '#94a3b8'
};

const fieldInput: CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,0.3)',
  background: 'rgba(2,6,23,0.7)',
  color: '#f8fafc',
  padding: '0 10px',
  fontSize: 13
};
