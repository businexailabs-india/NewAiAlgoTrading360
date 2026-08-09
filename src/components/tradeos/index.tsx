import type { CSSProperties, ReactNode } from 'react';
import { toneColor, tradeos, type StatusTone } from './tokens';

export function StatusPill({
  label,
  tone = 'info'
}: {
  label: string;
  tone?: StatusTone;
}) {
  const c = toneColor[tone];
  return (
    <span
      role="status"
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.2,
        color: c,
        background: `${c}18`,
        border: `1px solid ${c}44`
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: c }} />
      {label}
    </span>
  );
}

export function SafetyBanner({
  title,
  body,
  tone = 'info'
}: {
  title: string;
  body?: string;
  tone?: StatusTone;
}) {
  const c = toneColor[tone];
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: tradeos.radius,
        background: `${c}12`,
        border: `1px solid ${c}33`,
        color: tradeos.text
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, color: c }}>{title}</div>
      {body ? <div style={{ marginTop: 4, fontSize: 13, color: tradeos.muted, lineHeight: 1.5 }}>{body}</div> : null}
    </div>
  );
}

export function ModeToggle({
  paper = true
}: {
  paper?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <StatusPill label={paper ? 'Paper mode active' : 'Live mode'} tone={paper ? 'safe' : 'warning'} />
      <StatusPill label="Live locked" tone="locked" />
    </div>
  );
}

export function RiskHealthRing({ score = 82, size = 72 }: { score?: number; size?: number }) {
  const c = score >= 70 ? tradeos.green : score >= 40 ? tradeos.amber : tradeos.red;
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ;
  return (
    <div style={{ width: size, height: size, position: 'relative' }} aria-label={`Risk health ${score}`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.2)" strokeWidth={8} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c}
          strokeWidth={8}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 700,
          fontSize: 18,
          color: tradeos.text
        }}
      >
        {score}
      </div>
    </div>
  );
}

export function RiskBudgetMeter({ used = 0, max = 1000 }: { used?: number; max?: number }) {
  const pct = Math.min(100, Math.round((used / Math.max(1, max)) * 100));
  const tone: StatusTone = pct >= 80 ? 'blocked' : pct >= 50 ? 'warning' : 'safe';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: tradeos.muted }}>
        <span>Daily risk used</span>
        <span>
          ₹{used} / ₹{max}
        </span>
      </div>
      <div style={{ marginTop: 8, height: 8, borderRadius: 99, background: 'rgba(148,163,184,0.15)' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 99,
            background: toneColor[tone],
            transition: 'width 0.4s ease'
          }}
        />
      </div>
    </div>
  );
}

export function ConfidenceScore({ score }: { score: number }) {
  const tone: StatusTone = score >= 75 ? 'safe' : score >= 55 ? 'info' : 'warning';
  return <StatusPill label={`Suitability ${score}`} tone={tone} />;
}

export function PremiumCard({
  children,
  title,
  subtitle,
  action,
  style
}: {
  children?: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        borderRadius: tradeos.radius,
        background: 'linear-gradient(180deg, rgba(18,26,43,0.95), rgba(11,18,32,0.98))',
        border: `1px solid ${tradeos.cardBorder}`,
        boxShadow: tradeos.shadow,
        padding: 18,
        color: tradeos.text,
        ...style
      }}
    >
      {(title || action) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: children ? 12 : 0 }}>
          <div>
            {title ? <div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div> : null}
            {subtitle ? <div style={{ fontSize: 12, color: tradeos.muted, marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function TradeosButton({
  children,
  onClick,
  variant = 'primary',
  disabled,
  ariaLabel
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const bg =
    variant === 'primary'
      ? 'rgba(45,212,191,0.18)'
      : variant === 'danger'
        ? 'rgba(248,113,113,0.18)'
        : variant === 'ghost'
          ? 'transparent'
          : 'rgba(56,189,248,0.12)';
  const border =
    variant === 'primary'
      ? 'rgba(45,212,191,0.45)'
      : variant === 'danger'
        ? 'rgba(248,113,113,0.45)'
        : 'rgba(148,163,184,0.28)';
  const color =
    variant === 'primary' ? tradeos.teal : variant === 'danger' ? tradeos.red : tradeos.blue;
  return (
    <button
      type="button"
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '10px 14px',
        minHeight: 40,
        borderRadius: 12,
        border: `1px solid ${border}`,
        background: bg,
        color,
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }}
    >
      {children}
    </button>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div style={{ padding: 28, textAlign: 'center', color: tradeos.muted }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: tradeos.text }}>{title}</div>
      {body ? <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>{body}</div> : null}
    </div>
  );
}

export function KillSwitchButton({ onClick, active }: { onClick?: () => void; active?: boolean }) {
  return (
    <TradeosButton
      variant="danger"
      ariaLabel={active ? 'Kill switch is on' : 'Trigger kill switch'}
      onClick={onClick}
    >
      {active ? 'Kill switch ON' : 'Kill switch'}
    </TradeosButton>
  );
}

export function BlockedReasonCard({
  title,
  why,
  next
}: {
  title: string;
  why: string;
  next: string;
}) {
  return (
    <PremiumCard>
      <StatusPill label="Trade blocked for your safety" tone="blocked" />
      <div style={{ marginTop: 10, fontWeight: 700, fontSize: 15 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 13, color: tradeos.muted, lineHeight: 1.55 }}>
        <b style={{ color: tradeos.text }}>Why:</b> {why}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: tradeos.muted, lineHeight: 1.55 }}>
        <b style={{ color: tradeos.text }}>Next:</b> {next}
      </div>
    </PremiumCard>
  );
}

export function AlgoCard({
  name,
  bestFor,
  risk,
  mode,
  score,
  locked,
  lockReason,
  onUse,
  onPaper,
  onWhy
}: {
  name: string;
  bestFor: string;
  risk: string;
  mode: string;
  score?: number;
  locked?: boolean;
  lockReason?: string;
  onUse?: () => void;
  onPaper?: () => void;
  onWhy?: () => void;
}) {
  return (
    <PremiumCard
      title={name}
      subtitle={bestFor}
      action={locked ? <StatusPill label="Locked" tone="locked" /> : score != null ? <ConfidenceScore score={score} /> : null}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatusPill label={`Risk · ${risk}`} tone={risk === 'Low' ? 'safe' : risk === 'High' ? 'warning' : 'info'} />
        <StatusPill label={mode} tone="info" />
        <StatusPill label="Paper test required" tone="warning" />
      </div>
      {locked ? (
        <div style={{ fontSize: 13, color: tradeos.muted, marginBottom: 12 }}>{lockReason || 'Unlock after paper tests and approval.'}</div>
      ) : null}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!locked ? <TradeosButton onClick={onUse}>Use Algo</TradeosButton> : null}
        <TradeosButton variant="secondary" onClick={onPaper}>
          Paper Test
        </TradeosButton>
        <TradeosButton variant="ghost" onClick={onWhy}>
          See Why
        </TradeosButton>
      </div>
    </PremiumCard>
  );
}

export function ExecutionTimelineView({
  events
}: {
  events: Array<{ status: string; detail: string; createdAt?: string }>;
}) {
  const friendly: Record<string, string> = {
    RECEIVED: 'Signal received',
    NORMALIZED: 'Checked and cleaned',
    STRATEGY_MATCHED: 'Strategy matched',
    SUITABILITY_SCORED: 'Suitability scored',
    PAPER_TEST_REQUIRED: 'Paper test needed',
    PAPER_TEST_PASSED: 'Paper test checked',
    USER_APPROVAL_REQUIRED: 'Approval required',
    USER_APPROVED: 'You approved',
    USER_REJECTED: 'You declined',
    RMS_PENDING: 'Safety check running',
    RMS_APPROVED: 'RiskGuard approved',
    RMS_REJECTED: 'RiskGuard blocked',
    OMS_ACCEPTED: 'Order desk accepted',
    OMS_REJECTED: 'Order desk blocked',
    BROKER_SENT: 'Sent to paper broker',
    EXECUTED: 'Portfolio updated',
    BLOCKED: 'Blocked for safety',
    SOURCE_AUTHORITY: 'Source can recommend only'
  };
  if (!events.length) return <EmptyState title="No timeline yet" body="Actions will appear here as your trade moves through safety checks." />;
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {events.map((e, i) => (
        <li
          key={`${e.status}-${i}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '16px 1fr',
            gap: 12,
            padding: '10px 0',
            borderTop: i ? '1px solid rgba(148,163,184,0.12)' : 'none'
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              marginTop: 5,
              borderRadius: 99,
              background: e.status.includes('REJECT') || e.status === 'BLOCKED' ? tradeos.red : tradeos.teal
            }}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{friendly[e.status] || e.status}</div>
            <div style={{ fontSize: 12, color: tradeos.muted, marginTop: 2 }}>{e.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function PremiumModal({
  open,
  title,
  children,
  onClose,
  confirmLabel,
  onConfirm,
  danger
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  confirmLabel?: string;
  onConfirm?: () => void;
  danger?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(2,6,23,0.72)',
        display: 'grid',
        placeItems: 'center',
        padding: 20
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(480px, 100%)',
          borderRadius: 20,
          background: tradeos.navySoft,
          border: `1px solid ${tradeos.cardBorder}`,
          padding: 22,
          boxShadow: tradeos.shadow
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 14, color: tradeos.muted, lineHeight: 1.6 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <TradeosButton variant="ghost" onClick={onClose}>
            Cancel
          </TradeosButton>
          {onConfirm ? (
            <TradeosButton variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
              {confirmLabel || 'Confirm'}
            </TradeosButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function CopyWebhookBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, color: tradeos.muted, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: 10,
          borderRadius: 12,
          background: 'rgba(2,6,23,0.7)',
          border: `1px solid ${tradeos.cardBorder}`
        }}
      >
        <code style={{ flex: 1, fontSize: 12, wordBreak: 'break-all', color: tradeos.blue }}>{value}</code>
        <TradeosButton
          variant="secondary"
          ariaLabel={`Copy ${label}`}
          onClick={() => void navigator.clipboard.writeText(value)}
        >
          Copy
        </TradeosButton>
      </div>
    </div>
  );
}

export function PageHero({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: -0.4 }}>{title}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: tradeos.muted, maxWidth: 560, lineHeight: 1.55 }}>
          {subtitle}
        </p>
      </div>
      {right}
    </div>
  );
}

export function FlowSteps() {
  const steps = ['Idea', 'Check', 'Paper Test', 'Approve', 'Execute', 'Monitor'];
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      {steps.map((s, i) => (
        <div
          key={s}
          style={{
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            color: tradeos.muted,
            background: 'rgba(148,163,184,0.08)',
            border: '1px solid rgba(148,163,184,0.14)'
          }}
        >
          {i + 1}. {s}
        </div>
      ))}
    </div>
  );
}
