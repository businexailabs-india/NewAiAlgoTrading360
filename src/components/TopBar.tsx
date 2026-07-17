import { ReactNode } from 'react';
import { LayoutDashboard, Sparkles } from 'lucide-react';
import { ALGOS_TABS, useAlgosNav } from '../contexts/AlgosNavContext';

/** Algos / brand top menu height. */
export const TOP_MENU_H = 56;
/** Fixed header height (top menu only — section icons live in the left rail below). */
export const TOP_CHROME_H = TOP_MENU_H;

interface TopBarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNavigateAlgos?: () => void;
  onOpenAdvisory?: () => void;
  children?: ReactNode;
}

export function TopBar({
  onNavigateAlgos,
  onOpenAdvisory,
  children
}: TopBarProps) {
  const { tab, setTab } = useAlgosNav();

  return (
    <header
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        height: TOP_CHROME_H,
        zIndex: 500,
        display: 'flex',
        flexDirection: 'column',
        background:
          'linear-gradient(180deg, rgba(8,47,73,0.98) 0%, rgba(15,23,42,0.99) 55%, rgba(2,6,23,1) 100%)',
        borderBottom: '1px solid rgba(34,211,238,0.35)',
        boxShadow:
          '0 10px 28px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(34,211,238,0.2), 0 0 24px rgba(34,211,238,0.12)',
        backdropFilter: 'blur(18px)'
      }}
    >
      <div
        style={{
          display: 'flex',
          height: TOP_MENU_H,
          alignItems: 'center',
          gap: 14,
          padding: '0 16px',
          minWidth: 0
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0
          }}
        >
          <span
            style={{
              display: 'flex',
              height: 34,
              width: 34,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 10,
              color: '#fff',
              background: 'linear-gradient(135deg, #06b6d4 0%, #059669 100%)',
              boxShadow: '0 0 18px rgba(34,211,238,0.55)'
            }}
          >
            <LayoutDashboard style={{ height: 16, width: 16 }} />
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 650,
              letterSpacing: '0.02em',
              color: '#ecfeff',
              whiteSpace: 'nowrap'
            }}
          >
            AlgoTradingV360
            <sup style={{ fontSize: 9, marginLeft: 2, color: '#67e8f9' }}>™</sup>
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#64748b',
              marginLeft: 4
            }}
          >
            Algos
          </span>
        </div>

        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flex: '1 1 auto',
            minWidth: 0,
            overflowX: 'auto'
          }}
          className="no-scrollbar"
          aria-label="Algos sections"
        >
          {ALGOS_TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTab(t.id);
                  onNavigateAlgos?.();
                }}
                style={{
                  flexShrink: 0,
                  padding: '7px 14px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  borderRadius: 8,
                  border: active
                    ? '1px solid rgba(52,211,153,0.55)'
                    : '1px solid transparent',
                  background: active ? 'rgba(16,185,129,0.18)' : 'transparent',
                  color: active ? '#6ee7b7' : '#e2e8f0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {onOpenAdvisory && (
            <button
              type="button"
              onClick={onOpenAdvisory}
              title="AI Algo Trade Advisory"
              aria-label="Open AI Algo Trade Advisory"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 34,
                padding: '0 12px',
                borderRadius: 999,
                border: '1px solid rgba(34,211,238,0.45)',
                background:
                  'linear-gradient(180deg, rgba(8,47,73,0.95) 0%, rgba(15,23,42,0.98) 100%)',
                color: '#a5f3fc',
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: '0 0 14px rgba(34,211,238,0.2)'
              }}
            >
              <Sparkles style={{ height: 14, width: 14 }} />
              AI Advisory
            </button>
          )}
          {children}
        </div>
      </div>
      <span
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.85) 35%, rgba(52,211,153,0.7) 65%, transparent 100%)'
        }}
      />
    </header>
  );
}
