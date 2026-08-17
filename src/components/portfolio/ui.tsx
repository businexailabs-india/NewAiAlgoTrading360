import type { CSSProperties, ReactNode } from 'react';
import type { ConnectionState, DataFreshness, RiskLevel, ReconciliationStatus } from './types';
import { cn } from '@/components/ui/utils';

export const tabular: CSSProperties = { fontVariantNumeric: 'tabular-nums' };

export function FreshnessBadge({ freshness }: { freshness: DataFreshness }) {
  const map: Record<DataFreshness, string> = {
    LIVE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    DELAYED: 'bg-amber-100 text-amber-900 border-amber-300',
    DEMO: 'bg-sky-100 text-sky-900 border-sky-300',
    STALE: 'bg-orange-100 text-orange-900 border-orange-300',
    DISCONNECTED: 'bg-red-100 text-red-800 border-red-300',
  };
  return (
    <span
      className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', map[freshness])}
      title={`Data freshness: ${freshness}`}
    >
      {freshness}
    </span>
  );
}

export function ConnDot({ state }: { state: ConnectionState }) {
  const color =
    state === 'CONNECTED'
      ? 'bg-emerald-500'
      : state === 'DEGRADED'
        ? 'bg-amber-500'
        : state === 'STALE'
          ? 'bg-orange-500'
          : 'bg-red-500';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={cn('h-2 w-2 rounded-full', color)} aria-hidden />
      <span>{state.replace('_', ' ')}</span>
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    NORMAL: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    WARNING: 'bg-amber-50 text-amber-900 border-amber-200',
    CRITICAL: 'bg-red-50 text-red-800 border-red-200',
    TRADING_BLOCKED: 'bg-red-100 text-red-900 border-red-400 font-semibold',
  };
  return (
    <span className={cn('inline-flex rounded border px-2 py-0.5 text-[11px]', map[level])}>
      {level.replace('_', ' ')}
    </span>
  );
}

export function ReconBadge({ status }: { status: ReconciliationStatus }) {
  const map: Record<ReconciliationStatus, string> = {
    MATCHED: 'text-emerald-700',
    PENDING: 'text-slate-600',
    DIFFERENCE_FOUND: 'text-red-700 font-medium',
    BROKER_UNAVAILABLE: 'text-orange-700',
    STALE: 'text-amber-700',
  };
  return <span className={cn('text-xs', map[status])}>{status.replace(/_/g, ' ')}</span>;
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
    <section
      className={cn(
        'rounded-lg border border-slate-200 bg-white shadow-none',
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function MoneyTone({ value, children }: { value: number; children: ReactNode }) {
  return (
    <span
      style={tabular}
      className={value > 0 ? 'text-emerald-700' : value < 0 ? 'text-red-700' : 'text-slate-800'}
    >
      {children}
    </span>
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
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
        <h2 id="confirm-modal-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-3 text-sm text-slate-600">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            onClick={onCancel}
          >
            Cancel
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
