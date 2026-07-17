import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  TrendingUp,
  Zap
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { MacWindow } from './ui/mac-window';
import {
  advisoryMarketplaceService,
  LoginAdvisory,
  AdvisoryRecommendation
} from '../services/advisoryMarketplaceService';

interface Props {
  onConvert?: (advisoryId: string, recommendation: AdvisoryRecommendation) => void;
  onOpenMarketplace?: () => void;
  /** Start closed — open from TopBar via popupToken / Window Pane. */
  startClosed?: boolean;
  /** Bump to force floating popup from TopBar. */
  popupToken?: number;
}

export function LoginAdvisoryCard({
  onConvert,
  onOpenMarketplace,
  startClosed = false,
  popupToken = 0
}: Props) {
  const [advisory, setAdvisory] = useState<LoginAdvisory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!silent) setBusy(true);
    try {
      const data = await advisoryMarketplaceService.latest();
      setAdvisory(data);
      setError('');
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load advisory');
    } finally {
      if (!silent) setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const update = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    const timer = window.setInterval(update, 10_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [autoRefresh, load]);

  const refresh = async () => {
    setBusy(true);
    setActionMessage('');
    try {
      if (advisory?.advisory_id) {
        setAdvisory(await advisoryMarketplaceService.refresh(advisory.advisory_id));
      } else {
        setAdvisory(await advisoryMarketplaceService.generate());
      }
      setLastUpdated(new Date());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

  const preparing = !advisory || advisory.status === 'preparing';
  const recommendations = useMemo(
    () =>
      [...(advisory?.recommendations || [])].sort((a, b) => {
        const scoreA = a.confidence_score * 0.75 + (1 - a.risk_score) * 0.25;
        const scoreB = b.confidence_score * 0.75 + (1 - b.risk_score) * 0.25;
        return scoreB - scoreA;
      }),
    [advisory?.recommendations]
  );

  const handleConvert = async (recommendation: AdvisoryRecommendation) => {
    if (!advisory?.advisory_id) return;
    setConvertingId(recommendation.id);
    setActionMessage('');
    setError('');
    try {
      if (onConvert) {
        onConvert(advisory.advisory_id, recommendation);
      } else {
        await advisoryMarketplaceService.convertToAlgo(advisory.advisory_id, recommendation.id);
      }
      setActionMessage(`${recommendation.title} is ready in your strategy workspace.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not convert this strategy');
    } finally {
      setConvertingId(null);
    }
  };

  const formattedUpdate = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Waiting for market';

  return (
    <MacWindow
      windowId="ai-algo-advisory"
      title="AI Algo Trade Advisory"
      subtitle="Personalized paper-trading strategy candidates"
      icon={
        <Sparkles className="h-5 w-5 shrink-0 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      }
      initialWidth={1100}
      initialHeight={720}
      minWidth={640}
      minHeight={480}
      initialPosition={{ x: 120, y: 120 }}
      defaultMode="inline"
      fitMain
      startClosed={startClosed}
      popupToken={popupToken}
      reopenLabel="Open AI Algo Advisory"
      className="w-full"
    >
      <div className="relative isolate flex min-h-0 flex-col overflow-hidden">
        <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-cyan-400/15 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />

        <div
          className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-slate-950/45 px-5 py-3 backdrop-blur-xl"
          style={{ position: 'sticky', top: 0, zIndex: 5 }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <span
                className={`h-2 w-2 rounded-full ${
                  autoRefresh ? 'animate-pulse bg-emerald-400' : 'bg-amber-300'
                }`}
              />
              {autoRefresh ? 'Live market ranking' : 'Live updates paused'}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <Clock3 className="h-3 w-3" />
              Updated {formattedUpdate} · refreshes every 10 seconds
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh((value) => !value)}
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
              title={autoRefresh ? 'Pause automatic market updates' : 'Resume automatic market updates'}
            >
              {autoRefresh ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
              {autoRefresh ? 'Pause' : 'Go live'}
            </Button>
            <Button
              size="sm"
              onClick={refresh}
              disabled={busy}
              className="border border-cyan-200/50 bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.45)] hover:bg-cyan-200"
              title="Generate the latest market advisory now"
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Updating…' : 'Update now'}
            </Button>
          </div>
        </div>

        <div
          className="relative min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          style={{ maxHeight: 'clamp(360px, 62vh, 680px)', scrollbarGutter: 'stable' }}
        >
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {actionMessage && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {actionMessage}
            </div>
          )}

          {preparing ? (
            <div className="flex items-center justify-center gap-3 py-12 text-cyan-100">
              <Loader2 className="h-5 w-5 animate-spin" />
              AI advisory is being prepared
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="border-emerald-300/35 bg-emerald-400/15 text-emerald-100">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {advisory.market_status || 'Market status pending'}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    String(advisory.broker_status || '').toLowerCase().includes('disconnect')
                      ? 'border-red-400/40 bg-red-500/10 text-red-200'
                      : 'border-white/20 bg-white/5 text-slate-100'
                  }
                >
                  Broker: {advisory.broker_status || '—'}
                </Badge>
                <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
                  Risk: {advisory.risk_profile || '—'}
                </Badge>
                <Badge className="border-amber-300/40 bg-amber-400/15 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.2)]">
                  <Shield className="mr-1 h-3 w-3" /> Paper-first
                </Badge>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm leading-relaxed text-slate-100">{advisory.summary}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                  {advisory.disclaimer ||
                    'Not financial advice. No guaranteed returns. Live trading disabled by default.'}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-white">Ranked opportunities</h4>
                  <p className="text-[11px] text-slate-400">
                    Sorted by confidence and risk-adjusted quality
                  </p>
                </div>
                <Badge variant="outline" className="border-cyan-300/25 bg-cyan-400/10 text-cyan-100">
                  {recommendations.length} candidates
                </Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {recommendations.map((recommendation, index) => {
                  const confidence = Math.round(recommendation.confidence_score * 100);
                  const risk = Math.round(recommendation.risk_score * 100);
                  const isTop = index === 0;
                  return (
                    <article
                      key={recommendation.id}
                      className={`relative space-y-3 overflow-hidden rounded-xl border p-4 transition hover:-translate-y-0.5 ${
                        isTop
                          ? 'border-cyan-300/60 bg-gradient-to-br from-cyan-400/20 via-white/10 to-emerald-400/10 shadow-[0_0_24px_rgba(34,211,238,0.28)] md:col-span-2'
                          : 'neon-card-inner border-white/15'
                      }`}
                    >
                      {isTop && (
                        <div className="absolute right-0 top-0 rounded-bl-xl border-b border-l border-cyan-200/30 bg-cyan-300 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-950">
                          <Zap className="mr-1 inline h-3 w-3" /> Top pick
                        </div>
                      )}

                      <div className="pr-20">
                        <h5 className="text-sm font-semibold text-white">{recommendation.title}</h5>
                        <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">
                          {recommendation.type} · {recommendation.timeframe}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-emerald-300/15 bg-emerald-400/10 p-2">
                          <div className="text-[10px] uppercase tracking-wide text-emerald-200/70">
                            Confidence
                          </div>
                          <div className="mt-0.5 text-lg font-semibold text-emerald-200">{confidence}%</div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{ width: `${confidence}%` }}
                            />
                          </div>
                        </div>
                        <div className="rounded-lg border border-amber-300/15 bg-amber-400/10 p-2">
                          <div className="text-[10px] uppercase tracking-wide text-amber-200/70">Risk</div>
                          <div className="mt-0.5 text-lg font-semibold text-amber-100">{risk}%</div>
                          <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                risk > 65 ? 'bg-red-400' : risk > 35 ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${risk}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed text-slate-200/90">
                        {recommendation.rationale}
                      </p>

                      {(recommendation.warnings || []).length > 0 && (
                        <div className="flex gap-2 rounded-lg border border-amber-300/15 bg-amber-400/5 px-2.5 py-2 text-[11px] leading-relaxed text-amber-100/85">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {(recommendation.warnings || []).slice(0, 2).join(' · ')}
                        </div>
                      )}

                      {recommendation.actions?.includes('convert_to_algo') && advisory.advisory_id && (
                        <Button
                          size="sm"
                          disabled={convertingId === recommendation.id}
                          className={`w-full justify-between ${
                            isTop
                              ? 'bg-cyan-300 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.4)] hover:bg-cyan-200'
                              : 'border border-cyan-300/30 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25'
                          }`}
                          onClick={() => void handleConvert(recommendation)}
                        >
                          <span className="flex items-center">
                            {convertingId === recommendation.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Zap className="mr-2 h-4 w-4" />
                            )}
                            {convertingId === recommendation.id ? 'Creating strategy…' : 'Convert to Algo'}
                          </span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </article>
                  );
                })}
              </div>

              {recommendations.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-slate-400">
                  No qualified strategy candidates yet. Keep live updates on or choose Update now.
                </div>
              )}

              {onOpenMarketplace && (
                <Button
                  variant="outline"
                  onClick={onOpenMarketplace}
                  className="w-full justify-between border-white/15 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white"
                >
                  <span className="flex items-center">
                    <ExternalLink className="mr-2 h-4 w-4 text-cyan-300" />
                    Browse the full strategy marketplace
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </MacWindow>
  );
}
