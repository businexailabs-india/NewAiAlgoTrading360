import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Shield, Sparkles } from 'lucide-react';
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
}

export function LoginAdvisoryCard({ onConvert, onOpenMarketplace }: Props) {
  const [advisory, setAdvisory] = useState<LoginAdvisory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await advisoryMarketplaceService.latest();
      setAdvisory(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load advisory');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const refresh = async () => {
    setBusy(true);
    try {
      if (advisory?.advisory_id) {
        setAdvisory(await advisoryMarketplaceService.refresh(advisory.advisory_id));
      } else {
        setAdvisory(await advisoryMarketplaceService.generate());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setBusy(false);
    }
  };

  const preparing = !advisory || advisory.status === 'preparing';

  return (
    <MacWindow
      title="AI Algo Trade Advisory"
      subtitle="Personalized paper-trading strategy candidates"
      icon={
        <Sparkles className="h-5 w-5 shrink-0 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
      }
      initialWidth={820}
      initialHeight={580}
      reopenLabel="Open AI Algo Advisory"
    >
      <div className="relative isolate space-y-4 overflow-hidden p-5">
        <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-cyan-400/15 blur-2xl" />
        <span className="pointer-events-none absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />

        <div className="relative flex items-center justify-between gap-3">
          <p className="text-sm text-slate-300/80">
            AI-ranked opportunities with explicit risk controls. No automatic execution.
          </p>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={busy}
          className="border-cyan-400/30 bg-white/5 text-cyan-100 hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </Button>
        </div>

      {error && (
        <div className="relative text-sm text-red-300 flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {preparing ? (
        <div className="relative flex items-center gap-3 text-cyan-100 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          AI advisory is being prepared
        </div>
      ) : (
        <>
          <div className="relative flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-white/20 bg-white/5 text-slate-100">
              {advisory.market_status || 'market?'}
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
            <Badge className="bg-amber-400/15 text-amber-100 border-amber-300/40 shadow-[0_0_12px_rgba(251,191,36,0.2)]">
              <Shield className="w-3 h-3 mr-1" /> Paper-first
            </Badge>
          </div>
          <p className="relative text-sm text-slate-100">{advisory.summary}</p>
          <p className="relative text-xs text-slate-400">
            {advisory.disclaimer ||
              'Not financial advice. No guaranteed returns. Live trading disabled by default.'}
          </p>

          <div className="relative grid md:grid-cols-2 gap-3">
            {(advisory.recommendations || []).map((r) => (
              <div key={r.id} className="neon-card-inner rounded-xl p-3.5 space-y-2">
                <div className="text-white text-sm font-medium">{r.title}</div>
                <div className="text-xs text-slate-400">
                  {r.type} · {r.timeframe} · Conf {(r.confidence_score * 100).toFixed(0)}% · Risk{' '}
                  {(r.risk_score * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-slate-200/90">{r.rationale}</div>
                <div className="text-xs text-amber-200/85">
                  {(r.warnings || []).slice(0, 2).join(' · ')}
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {r.actions?.includes('convert_to_algo') && advisory.advisory_id && (
                    <Button
                      size="sm"
                      className="bg-cyan-400/90 text-slate-950 hover:bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.35)]"
                      onClick={() => onConvert?.(advisory.advisory_id!, r)}
                    >
                      Convert to Algo
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {onOpenMarketplace && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenMarketplace}
              className="relative text-cyan-200 hover:text-cyan-100 hover:bg-white/5"
            >
              Browse external algo candidates
            </Button>
          )}
        </>
      )}
      </div>
    </MacWindow>
  );
}
