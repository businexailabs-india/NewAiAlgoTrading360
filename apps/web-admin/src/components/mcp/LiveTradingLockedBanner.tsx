import { Lock, ShieldAlert } from 'lucide-react';

export function LiveTradingLockedBanner({ compact }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? 'flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-sm text-rose-100'
          : 'rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/60 to-zinc-950/80 p-4 text-rose-50'
      }
      role="alert"
      data-testid="live-trading-locked-banner"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-2">
          <Lock className="h-5 w-5 text-rose-300" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-semibold text-rose-100">
            <ShieldAlert className="h-4 w-4" />
            Live trading locked by default
          </div>
          {!compact && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-rose-100/80">
              <li>AI cannot directly execute live trades.</li>
              <li>Live orders require explicit user approval.</li>
              <li>All live orders must pass RMS and OMS.</li>
              <li>Provider direct execution is blocked by default.</li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
