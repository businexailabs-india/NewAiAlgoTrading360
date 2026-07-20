import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export function ProviderHealthBadge({ health }: { health?: string | null }) {
  const h = (health || 'unknown').toLowerCase();
  if (h.includes('healthy') || h === 'ok' || h === 'up') {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 gap-1">
        <CheckCircle2 className="w-3 h-3" /> Healthy
      </Badge>
    );
  }
  if (h.includes('degraded') || h.includes('warn')) {
    return (
      <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/40 gap-1">
        <AlertTriangle className="w-3 h-3" /> Degraded
      </Badge>
    );
  }
  if (h.includes('error') || h.includes('down') || h.includes('fail')) {
    return (
      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 gap-1">
        <XCircle className="w-3 h-3" /> Error
      </Badge>
    );
  }
  return (
    <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/40 gap-1">
      <Activity className="w-3 h-3" /> {health || 'Unknown'}
    </Badge>
  );
}
