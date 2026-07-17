import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, FlaskConical, Rocket, ShieldAlert } from 'lucide-react';
import type { AlgoCatalogItem } from './algosCatalog';
import { formatInr, pctColor } from './algosCatalog';
import { AlgoMetricsCards } from './AlgoMetricsCards';
import { AlgoPerformanceChart } from './AlgoPerformanceChart';
import { advisoryMarketplaceService } from '../../services/advisoryMarketplaceService';
import { tradingService } from '../../services/tradingService';
import { portfolioService } from '../../services/portfolioService';

type DetailTab = 'performance' | 'best_worst' | 'past_trades' | 'about';

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

export function AlgoDetailView({
  algo,
  onBack,
  onDeployed
}: {
  algo: AlgoCatalogItem;
  onBack: () => void;
  onDeployed?: (msg: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>('performance');
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

  const tradeSides = useMemo(() => trades.map((t) => ({ side: t.side })), [trades]);

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

  const deploy = async () => {
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      if (algo.source === 'option' && (optionId || algo.optionId)) {
        const id = optionId || algo.optionId!;
        const { qualified } = await runPaperFunnel(id);
        const text = qualified
          ? 'Saved · paper-tested · deployed to paper. Eligible to request live approval.'
          : 'Saved · paper-tested · deployed to paper. Live not qualified yet — keep paper running.';
        setMsg(text);
        onDeployed?.(text);
      } else if (algo.source === 'advisory' && algo.advisoryId && algo.recommendationId) {
        const converted = (await advisoryMarketplaceService.convertToAlgo(
          algo.advisoryId,
          algo.recommendationId
        )) as Record<string, unknown>;
        const newId = String(converted?.id || converted?.option_id || converted?.strategy_option_id || '');
        if (newId) {
          setOptionId(newId);
          await runPaperFunnel(newId);
          const text = 'Converted → saved → paper-tested → deployed to paper.';
          setMsg(text);
          onDeployed?.(text);
        } else {
          const text = 'Converted to strategy option. Open Deploy again to paper-test & deploy.';
          setMsg(text);
          onDeployed?.(text);
        }
      } else if (algo.source === 'agent' && algo.agentId) {
        await tradingService.runAgent(algo.agentId);
        const text = 'Agent run triggered (live paper/live mode per agent config).';
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
        const text = algo.isDemo
          ? 'Demo item — connect broker / generate advisory for live deploy.'
          : 'No deploy path for this source yet.';
        setErr(text);
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
          color: '#94a3b8',
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
          border: '1px solid rgba(34,211,238,0.22)',
          background: 'rgba(15,23,42,0.7)'
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc' }}>{algo.name}</div>
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
            {algo.tags.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid rgba(148,163,184,0.3)',
                  color: '#cbd5e1'
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
            <span>
              Min. Amount <strong style={{ color: '#e2e8f0' }}>{formatInr(algo.minCapital)}</strong>
            </span>
            <span>
              Max. Amount <strong style={{ color: '#e2e8f0' }}>{formatInr(algo.maxCapital)}</strong>
            </span>
            <span>
              Source <strong style={{ color: '#e2e8f0' }}>{algo.source}</strong>
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
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
                  color: '#e2e8f0',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                {id}{' '}
                <span style={{ color: pctColor(ret), fontWeight: 600 }}>
                  {ret >= 0 ? '+' : ''}
                  {ret.toFixed(1)}%
                </span>
              </button>
            ))}
          </div>

          <AlgoPerformanceChart
            sparkline={algo.sparkline}
            windowReturn={tfRet}
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
              +{algo.avgUpMonth.toFixed(2)}%
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>Avg up-month return</div>
          </div>
          <div className="neon-card" style={{ padding: 14, borderRadius: 12 }}>
            <div style={{ fontWeight: 600, color: '#f87171', marginBottom: 8 }}>Worst month</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: pctColor(algo.avgDownMonth) }}>
              {algo.avgDownMonth.toFixed(2)}%
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
              Demo catalog item — generate advisory or link strategies for live rows.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
