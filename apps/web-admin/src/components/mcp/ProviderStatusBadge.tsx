import { Badge } from '@/components/ui/badge';
import { cn } from '@/components/ui/utils';

const STYLES: Record<string, string> = {
  enabled: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  disabled: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/40',
  connected: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  error: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  placeholder: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  requires_credentials: 'bg-orange-500/15 text-orange-200 border-orange-500/40',
  requires_subscription: 'bg-violet-500/15 text-violet-200 border-violet-500/40',
  paper: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  live_locked: 'bg-rose-600/20 text-rose-200 border-rose-500/50',
};

export function ProviderStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const style =
    STYLES[key] ||
    (key.includes('error')
      ? STYLES.error
      : key.includes('placeholder')
        ? STYLES.placeholder
        : STYLES.disabled);
  return (
    <Badge variant="outline" className={cn('capitalize', style, className)}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
