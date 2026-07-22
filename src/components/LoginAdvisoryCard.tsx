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

type AdviceTone = 'top' | 'growth' | 'balanced' | 'caution' | 'standaside';

function adviceTone(rec: AdvisoryRecommendation, index: number): AdviceTone {
  const type = (rec.type || '').toLowerCase();
  const title = (rec.title || '').toLowerCase();
  if (type.includes('no_trade') || title.includes('stand') || title.includes('no-trade')) {
    return 'standaside';
  }
  if (rec.risk_score >= 0.65) return 'caution';
  if (index === 0) return 'top';
  if (rec.confidence_score >= 0.65) return 'growth';
  return 'balanced';
}

const TONE_STYLES: Record<
  AdviceTone,
  {
    label: string;
    ring: string;
    card: string;
    badge: string;
    adviceBg: string;
    adviceText: string;
    accentBar: string;
    cta: string;
  }
> = {
  top: {
    label: 'Top pick',
    ring: '',
    card: 'border-[rgba(52,211,153,0.45)] bg-[rgba(2,6,23,0.45)]',
    badge: 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-300',
    adviceBg: 'border-slate-600/60 bg-slate-950/50',
    adviceText: 'text-slate-200',
    accentBar: 'bg-emerald-400',
    cta: 'bg-[#059669] text-white hover:bg-emerald-600 font-semibold'
  },
  growth: {
    label: 'Growth',
    ring: '',
    card: 'border-[rgba(34,211,238,0.28)] bg-[rgba(2,6,23,0.4)]',
    badge: 'border border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    adviceBg: 'border-slate-600/60 bg-slate-950/50',
    adviceText: 'text-slate-200',
    accentBar: 'bg-cyan-400',
    cta: 'bg-[#059669] text-white hover:bg-emerald-600 font-semibold'
  },
  balanced: {
    label: 'Balanced',
    ring: '',
    card: 'border-[rgba(148,163,184,0.22)] bg-[rgba(2,6,23,0.4)]',
    badge: 'border border-slate-500/50 bg-slate-800/80 text-slate-300',
    adviceBg: 'border-slate-600/60 bg-slate-950/50',
    adviceText: 'text-slate-200',
    accentBar: 'bg-slate-400',
    cta: 'bg-[#059669] text-white hover:bg-emerald-600 font-semibold'
  },
  caution: {
    label: 'Higher risk',
    ring: '',
    card: 'border-[rgba(251,191,36,0.35)] bg-[rgba(2,6,23,0.4)]',
    badge: 'border border-amber-500/40 bg-amber-500/10 text-amber-300',
    adviceBg: 'border-amber-500/25 bg-amber-500/5',
    adviceText: 'text-amber-100',
    accentBar: 'bg-amber-400',
    cta: 'bg-[#059669] text-white hover:bg-emerald-600 font-semibold'
  },
  standaside: {
    label: 'Stand aside',
    ring: '',
    card: 'border-[rgba(248,113,113,0.35)] bg-[rgba(2,6,23,0.4)]',
    badge: 'border border-rose-500/40 bg-rose-500/10 text-rose-300',
    adviceBg: 'border-rose-500/25 bg-rose-500/5',
    adviceText: 'text-rose-100',
    accentBar: 'bg-rose-400',
    cta: 'border border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 font-semibold'
  }
};

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
      subtitle="Same desk as Trading / Investing Algos · paper-first"
      icon={<Sparkles className="h-5 w-5 shrink-0 text-cyan-300" />}
      initialWidth={1140}
      initialHeight={760}
      minWidth={640}
      minHeight={480}
      initialPosition={{ x: 100, y: 96 }}
      defaultMode="inline"
      fitMain
      startClosed={startClosed}
      popupToken={popupToken}
      reopenLabel="Open AI Algo Advisory"
      className="w-full neon-card"
    >
      <div className="flex min-h-0 flex-col overflow-hidden text-slate-200" style={{ background: 'rgba(15,23,42,0.65)' }}>
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 5,
            borderBottom: '1px solid rgba(34,211,238,0.22)',
            background: 'rgba(15,23,42,0.92)',
          }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
              <span
                className={`h-2 w-2 rounded-full ${
                  autoRefresh ? 'bg-emerald-400' : 'bg-slate-500'
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
              className="border-slate-600 bg-transparent font-medium text-slate-300 hover:bg-slate-800"
              title={autoRefresh ? 'Pause automatic market updates' : 'Resume automatic market updates'}
            >
              {autoRefresh ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
              {autoRefresh ? 'Pause' : 'Go live'}
            </Button>
            <Button
              size="sm"
              onClick={refresh}
              disabled={busy}
              className="border-0 bg-[#059669] font-semibold text-white hover:bg-emerald-600"
              title="Generate the latest market advisory now"
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Updating…' : 'Update now'}
            </Button>
          </div>
        </div>

        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
          style={{ maxHeight: 'clamp(360px, 62vh, 720px)', scrollbarGutter: 'stable' }}
        >
          <div
            className="flex flex-wrap gap-2 rounded-xl px-3 py-2.5 text-[11px]"
            style={{ border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(2,6,23,0.4)' }}
          >
            <span className="mr-1 font-semibold uppercase tracking-wide text-slate-400">Legend</span>
            {(
              [
                ['top', 'Top pick'],
                ['growth', 'Growth'],
                ['balanced', 'Balanced'],
                ['caution', 'Higher risk'],
                ['standaside', 'Stand aside']
              ] as const
            ).map(([key, label]) => (
              <span
                key={key}
                className={`rounded-full px-2.5 py-0.5 font-medium ${TONE_STYLES[key].badge}`}
              >
                {label}
              </span>
            ))}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-rose-200"
              style={{ border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(127,29,29,0.25)' }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {actionMessage && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-cyan-200"
              style={{ background: 'rgba(34,211,238,0.1)' }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" /> {actionMessage}
            </div>
          )}

          {preparing ? (
            <div className="flex items-center justify-center gap-3 py-12 text-base text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
              AI advisory is being prepared
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge className="border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300">
                  <TrendingUp className="mr-1 h-3 w-3" />
                  {advisory.market_status || 'Market status pending'}
                </Badge>
                <Badge
                  className={
                    String(advisory.broker_status || '').toLowerCase().includes('disconnect')
                      ? 'border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 font-medium text-rose-300'
                      : 'border border-slate-600 bg-slate-900/80 px-2.5 py-1 font-medium text-slate-300'
                  }
                >
                  Broker: {advisory.broker_status || '—'}
                </Badge>
                <Badge className="border border-slate-600 bg-slate-900/80 px-2.5 py-1 font-medium text-slate-300">
                  Risk: {advisory.risk_profile || '—'}
                </Badge>
                <Badge className="border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1 font-medium text-cyan-300">
                  <Shield className="mr-1 h-3 w-3" /> Paper-first
                </Badge>
              </div>

              <div
                className="rounded-xl p-4"
                style={{ border: '1px solid rgba(34,211,238,0.22)', background: 'rgba(15,23,42,0.7)' }}
              >
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80">
                  Market advice
                </div>
                <p className="text-sm leading-relaxed text-slate-100">{advisory.summary}</p>
                <p
                  className="mt-2 rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-400"
                  style={{ border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.4)' }}
                >
                  {advisory.disclaimer ||
                    'Not financial advice. No guaranteed returns. Live trading disabled by default.'}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-100">Ranked trade opportunities</h4>
                  <p className="text-[11px] text-slate-400">
                    Algos Live layout · emerald tabs · slate cards · convert to paper algo
                  </p>
                </div>
                <Badge className="border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-medium text-emerald-300">
                  {recommendations.length} candidates
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {recommendations.map((recommendation, index) => {
                  const confidence = Math.round(recommendation.confidence_score * 100);
                  const risk = Math.round(recommendation.risk_score * 100);
                  const tone = adviceTone(recommendation, index);
                  const style = TONE_STYLES[tone];
                  const isWide = tone === 'top' || tone === 'standaside';
                  return (
                    <article
                      key={recommendation.id}
                      className={`relative space-y-3 overflow-hidden rounded-lg border p-4 ${style.ring} ${style.card} ${
                        isWide ? 'md:col-span-2' : ''
                      }`}
                    >
                      <div className={`absolute inset-y-0 left-0 w-1 ${style.accentBar}`} />

                      <div className="absolute right-0 top-0 text-[10px] font-semibold uppercase tracking-wider">
                        <span className={`inline-block rounded-bl-lg px-3 py-1 ${style.badge}`}>
                          <Zap className="mr-1 inline h-3 w-3" />
                          #{index + 1} {style.label}
                        </span>
                      </div>

                      <div className="pr-28 pl-2">
                        <h5 className="text-base font-semibold text-slate-100">{recommendation.title}</h5>
                        <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {recommendation.type} · {recommendation.timeframe}
                        </div>
                      </div>

                      <div
                        className={`ml-2 rounded-lg border px-3 py-2 text-xs leading-relaxed ${style.adviceBg} ${style.adviceText}`}
                      >
                        <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Advice
                        </span>
                        {recommendation.rationale}
                      </div>

                      <div className="ml-2 grid grid-cols-2 gap-2">
                        <div
                          className="rounded-lg p-2.5"
                          style={{ border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.4)' }}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                            Confidence
                          </div>
                          <div className="mt-0.5 text-xl font-semibold text-emerald-300">{confidence}%</div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className="h-full rounded-full bg-emerald-400"
                              style={{ width: `${confidence}%` }}
                            />
                          </div>
                        </div>
                        <div
                          className="rounded-lg p-2.5"
                          style={{ border: '1px solid rgba(148,163,184,0.18)', background: 'rgba(2,6,23,0.4)' }}
                        >
                          <div
                            className={`text-[10px] font-semibold uppercase tracking-wide ${
                              risk > 65 ? 'text-rose-300' : risk > 35 ? 'text-amber-300' : 'text-slate-400'
                            }`}
                          >
                            Risk
                          </div>
                          <div
                            className={`mt-0.5 text-xl font-semibold ${
                              risk > 65 ? 'text-rose-300' : risk > 35 ? 'text-amber-300' : 'text-slate-100'
                            }`}
                          >
                            {risk}%
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                risk > 65 ? 'bg-rose-400' : risk > 35 ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                              style={{ width: `${risk}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {(recommendation.warnings || []).length > 0 && (
                        <div
                          className="ml-2 flex gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed text-amber-100"
                          style={{ border: '1px solid rgba(251,191,36,0.3)', background: 'rgba(245,158,11,0.08)' }}
                        >
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
                          {(recommendation.warnings || []).slice(0, 2).join(' · ')}
                        </div>
                      )}

                      {recommendation.actions?.includes('convert_to_algo') && advisory.advisory_id && (
                        <div className="ml-2 pt-1">
                          <Button
                            size="sm"
                            disabled={convertingId === recommendation.id}
                            className={`h-10 w-full justify-between text-sm ${style.cta}`}
                            onClick={() => void handleConvert(recommendation)}
                          >
                            <span className="flex items-center">
                              {convertingId === recommendation.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Zap className="mr-2 h-4 w-4" />
                              )}
                              {convertingId === recommendation.id
                                ? 'Creating strategy…'
                                : tone === 'standaside'
                                  ? 'Review stand-aside plan'
                                  : 'Convert to Algo'}
                            </span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              {recommendations.length === 0 && (
                <div
                  className="rounded-xl px-4 py-8 text-center text-sm text-slate-400"
                  style={{ border: '1px dashed rgba(148,163,184,0.25)', background: 'rgba(2,6,23,0.35)' }}
                >
                  No qualified strategy candidates yet. Keep live updates on or choose Update now.
                </div>
              )}

              {onOpenMarketplace && (
                <Button
                  onClick={onOpenMarketplace}
                  className="h-11 w-full justify-between border-0 bg-[#059669] font-semibold text-white hover:bg-emerald-600"
                >
                  <span className="flex items-center">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Browse full strategy marketplace
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
