import type { CSSProperties, ReactNode } from 'react';
import { tradeos } from '@/components/tradeos/tokens';

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: tradeos.radius,
        background: tradeos.card,
        border: `1px solid ${tradeos.cardBorder}`,
        boxShadow: tradeos.shadow
      }}
    >
      <div style={{ fontSize: 11, color: tradeos.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: tradeos.text, marginTop: 6 }}>{value}</div>
      {sub ? <div style={{ fontSize: 11, color: tradeos.muted, marginTop: 4 }}>{sub}</div> : null}
    </div>
  );
}

export function Card({ title, children, extra }: { title?: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: tradeos.radius,
        background: tradeos.card,
        border: `1px solid ${tradeos.cardBorder}`
      }}
    >
      {(title || extra) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          {title ? <div style={{ fontWeight: 650, color: tradeos.text }}>{title}</div> : <span />}
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}

export function Btn({
  children,
  onClick,
  tone = 'default',
  disabled
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'primary' | 'danger' | 'ghost';
  disabled?: boolean;
}) {
  const bg =
    tone === 'primary' ? 'rgba(45,212,191,0.18)' : tone === 'danger' ? 'rgba(248,113,113,0.18)' : tone === 'ghost' ? 'transparent' : 'rgba(255,255,255,0.04)';
  const bd = tone === 'primary' ? tradeos.teal : tone === 'danger' ? tradeos.red : tradeos.cardBorder;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        fontSize: 11,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        background: bg,
        border: `1px solid ${bd}`,
        color: tone === 'danger' ? tradeos.red : tradeos.text
      }}
    >
      {children}
    </button>
  );
}

export function Badge({ text, color }: { text: string; color?: string }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.4,
        padding: '3px 8px',
        borderRadius: 999,
        color,
        background: `${color || tradeos.blue}22`,
        border: `1px solid ${color || tradeos.blue}55`
      }}
    >
      {text}
    </span>
  );
}

export function Grid({ n, children }: { n: number; children: ReactNode }) {
  const style: CSSProperties = { display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 10 };
  return <div style={style}>{children}</div>;
}

export function Table({ cols, rows }: { cols: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c} style={{ textAlign: 'left', color: tradeos.muted, fontWeight: 600, padding: '8px 6px', borderBottom: `1px solid ${tradeos.cardBorder}` }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} style={{ padding: '8px 6px', borderBottom: `1px solid rgba(148,163,184,0.08)`, color: tradeos.text }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
