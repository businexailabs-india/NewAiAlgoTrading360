import type { ReactNode } from 'react';
import { cn } from '@/components/ui/utils';
import type { IBKRSessionState, MarketDataState, TradingEnvironment } from './types';
import { envLabel, tabularStyle } from './format';

export { tabularStyle };

export function EnvBanner({
  environment,
  profileLabel,
  className,
}: {
  environment: TradingEnvironment | null | undefined;
  profileLabel?: string;
  className?: string;
}) {
  const isLive = environment === 'LIVE';
  const isPaper = environment === 'PAPER';
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 rounded-md border-2 px-3 py-2 text-sm',
        isLive && 'border-red-600 bg-red-50 text-red-950',
        isPaper && 'border-amber-500 bg-sky-50 text-slate-900',
        !isLive && !isPaper && 'border-slate-300 bg-slate-50 text-slate-700',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'inline-flex rounded px-2 py-0.5 text-xs font-bold uppercase tracking-wider',
            isLive && 'bg-red-600 text-white',
            isPaper && 'bg-sky-600 text-white',
            !isLive && !isPaper && 'bg-slate-500 text-white'
          )}
        >
          {envLabel(environment)}
        </span>
        <span className="text-xs text-slate-600">
          Environment is bound to the selected IBKR connection profile — not a cosmetic toggle.
        </span>
      </div>
      {profileLabel ? (
        <span className="text-xs font-medium text-slate-700">Profile: {profileLabel}</span>
      ) : null}
    </div>
  );
}

export function SessionBadge({ state }: { state: IBKRSessionState | undefined }) {
  const map: Record<IBKRSessionState, string> = {
    DISCONNECTED: 'bg-slate-100 text-slate-700 border-slate-300',
    CONNECTING: 'bg-amber-50 text-amber-900 border-amber-300',
    AUTHENTICATING: 'bg-amber-50 text-amber-900 border-amber-300',
    READ_ONLY: 'bg-orange-50 text-orange-900 border-orange-300',
    ESTABLISHING_BROKERAGE_SESSION: 'bg-sky-50 text-sky-900 border-sky-300',
    TRADING_READY: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    COMPETING_SESSION: 'bg-red-50 text-red-800 border-red-400',
    EXPIRED: 'bg-red-50 text-red-800 border-red-300',
    MAINTENANCE: 'bg-amber-50 text-amber-900 border-amber-300',
    ERROR: 'bg-red-100 text-red-900 border-red-400',
  };
  const s = state || 'DISCONNECTED';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        map[s]
      )}
    >
      {s.replace(/_/g, ' ')}
    </span>
  );
}

export function FreshnessBadge({ freshness }: { freshness: MarketDataState | undefined }) {
  const map: Record<MarketDataState, string> = {
    LIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    DELAYED: 'bg-amber-100 text-amber-900 border-amber-300',
    DEMO: 'bg-sky-100 text-sky-900 border-sky-300',
    STALE: 'bg-orange-100 text-orange-900 border-orange-300',
    UNAVAILABLE: 'bg-red-100 text-red-800 border-red-300',
  };
  const f = freshness || 'UNAVAILABLE';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        map[f]
      )}
      title={`Quote freshness: ${f}`}
    >
      {f}
    </span>
  );
}

export function EnvChip({ environment }: { environment: TradingEnvironment | null | undefined }) {
  const isLive = environment === 'LIVE';
  return (
    <span
      className={cn(
        'inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        isLive
          ? 'border-red-500 bg-red-50 text-red-800'
          : environment === 'PAPER'
            ? 'border-sky-500 bg-sky-50 text-sky-800'
            : 'border-slate-300 bg-slate-50 text-slate-600'
      )}
    >
      {environment || 'UNKNOWN'}
    </span>
  );
}

export function MoneyTone({ value, children }: { value: number; children: ReactNode }) {
  return (
    <span
      style={tabularStyle}
      className={value > 0 ? 'text-teal-700' : value < 0 ? 'text-red-700' : 'text-slate-800'}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  onCancel,
  destructive,
  cancelLabel = 'Cancel',
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  cancelLabel?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="us-stocks-confirm-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
        <h2 id="us-stocks-confirm-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
              destructive
                ? 'bg-red-600 hover:bg-red-700 focus-visible:outline-red-600'
                : 'bg-sky-600 hover:bg-sky-700 focus-visible:outline-sky-600'
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
      {message}
    </div>
  );
}
