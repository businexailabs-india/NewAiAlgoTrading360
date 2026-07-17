import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Shield, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
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
    <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/30 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" /> AI Algo Advisory
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Personalized strategy candidates for paper testing — never auto-trades.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
          <RefreshCw className={`w-4 h-4 mr-1 ${busy ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {preparing ? (
        <div className="flex items-center gap-3 text-cyan-200 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" />
          AI advisory is being prepared
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{advisory.market_status || 'market?'}</Badge>
            <Badge variant="outline">Broker: {advisory.broker_status || '—'}</Badge>
            <Badge variant="outline">Risk: {advisory.risk_profile || '—'}</Badge>
            <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/30">
              <Shield className="w-3 h-3 mr-1" /> Paper-first
            </Badge>
          </div>
          <p className="text-sm text-gray-200">{advisory.summary}</p>
          <p className="text-xs text-gray-500">
            {advisory.disclaimer ||
              'Not financial advice. No guaranteed returns. Live trading disabled by default.'}
          </p>

          <div className="grid md:grid-cols-2 gap-3">
            {(advisory.recommendations || []).map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
                <div className="text-white text-sm font-medium">{r.title}</div>
                <div className="text-xs text-gray-400">
                  {r.type} · {r.timeframe} · Conf {(r.confidence_score * 100).toFixed(0)}% · Risk{' '}
                  {(r.risk_score * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-300">{r.rationale}</div>
                <div className="text-xs text-amber-200/80">
                  {(r.warnings || []).slice(0, 2).join(' · ')}
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {r.actions?.includes('convert_to_algo') && advisory.advisory_id && (
                    <Button
                      size="sm"
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
            <Button variant="ghost" size="sm" onClick={onOpenMarketplace}>
              Browse external algo candidates
            </Button>
          )}
        </>
      )}
    </div>
  );
}
