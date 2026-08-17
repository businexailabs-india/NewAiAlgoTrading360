import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CandlestickChart, ChevronDown, Eye, LayoutDashboard, Sparkles } from 'lucide-react';
import { ALGOS_TABS, useAlgosNav } from '../contexts/AlgosNavContext';
import { useTradingMode } from '../contexts/TradingModeContext';

/** Algos / brand top menu height. */
export const TOP_MENU_H = 56;
/** Fixed header height (top menu only — section icons live in the left rail below). */
export const TOP_CHROME_H = TOP_MENU_H;

type TradeDest = {
  id: string;
  label: string;
  hint?: string;
};

const TRADE_DESTINATIONS: TradeDest[] = [
  { id: 'trading-terminal', label: 'Trading Terminal', hint: 'India FO · paper default' },
  { id: 'trade-us-stocks', label: 'US Stocks (IBKR)', hint: 'Paper / live profiles' },
  { id: 'basket-orders', label: 'Basket Orders', hint: 'Multi-leg paper baskets' },
  { id: 'trade-orders', label: 'Orders', hint: 'Order desk' },
  { id: 'trade-positions', label: 'Positions', hint: 'Open book' },
  { id: 'trade-paper-holdings', label: 'Paper Holdings', hint: 'Simulated holdings' },
  { id: 'trade-paper-positions', label: 'Paper Positions', hint: 'F&O paper book' },
  { id: 'portfolio', label: 'Portfolio', hint: 'SENSEX · multi-account' },
  { id: 'trade-live', label: 'Live Trading', hint: 'Requires live unlock' },
];

interface TopBarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onNavigateAlgos?: () => void;
  onOpenAdvisory?: () => void;
  onRequestModeSwitch?: () => void;
  children?: ReactNode;
}

export function TopBar({
  activeSection,
  onSectionChange,
  onNavigateAlgos,
  onOpenAdvisory,
  onRequestModeSwitch,
  children,
}: TopBarProps) {
  const { tab, setTab } = useAlgosNav();
  const { mode, liveLocked } = useTradingMode();
  const [tradeOpen, setTradeOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const tradeBtnRef = useRef<HTMLButtonElement>(null);
  const tradeMenuRef = useRef<HTMLDivElement>(null);
  const watchlistActive = activeSection === 'watchlist';
  const isLive = mode === 'live';
  const tradeActive = TRADE_DESTINATIONS.some((d) => d.id === activeSection);

  const updateMenuPos = useCallback(() => {
    const btn = tradeBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const width = 280;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setMenuPos({ top: r.bottom + 8, left });
  }, []);

  useLayoutEffect(() => {
    if (!tradeOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
  }, [tradeOpen, updateMenuPos]);

  useEffect(() => {
    if (!tradeOpen) return;
    const onResize = () => updateMenuPos();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [tradeOpen, updateMenuPos]);

  // Outside-close: defer attach so the opening click does not immediately close
  useEffect(() => {
    if (!tradeOpen) return;
    let remove: (() => void) | undefined;
    const id = window.setTimeout(() => {
      const onPointerDown = (e: PointerEvent) => {
        const t = e.target as Node;
        if (tradeBtnRef.current?.contains(t) || tradeMenuRef.current?.contains(t)) return;
        setTradeOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setTradeOpen(false);
      };
      document.addEventListener('pointerdown', onPointerDown, true);
      document.addEventListener('keydown', onKey);
      remove = () => {
        document.removeEventListener('pointerdown', onPointerDown, true);
        document.removeEventListener('keydown', onKey);
      };
    }, 10);
    return () => {
      window.clearTimeout(id);
      remove?.();
    };
  }, [tradeOpen]);

  const goTrade = (id: string) => {
    setTradeOpen(false);
    if (id === 'trade-live' && liveLocked) {
      onSectionChange('live-approval');
      return;
    }
    onSectionChange(id);
  };

  const menu =
    tradeOpen && menuPos
      ? createPortal(
          <div
            ref={tradeMenuRef}
            role="menu"
            aria-label="Trade destinations"
            style={{
              position: 'fixed',
              top: menuPos.top,
              left: menuPos.left,
              width: 280,
              maxHeight: 'min(70vh, 480px)',
              overflowY: 'auto',
              padding: 6,
              borderRadius: 10,
              border: '1px solid rgba(56,189,248,0.45)',
              background: 'rgba(15,23,42,0.99)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
              zIndex: 10050,
            }}
          >
            <div
              style={{
                padding: '6px 10px 8px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#64748b',
              }}
            >
              Trading desks
            </div>
            {TRADE_DESTINATIONS.map((d) => {
              const active = activeSection === d.id;
              const showLocked = d.id === 'trade-live' && liveLocked;
              return (
                <button
                  key={d.id}
                  type="button"
                  role="menuitem"
                  onClick={() => goTrade(d.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 2,
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: active ? '1px solid rgba(56,189,248,0.45)' : '1px solid transparent',
                    background: active ? 'rgba(14,165,233,0.15)' : 'transparent',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {d.label}
                    {showLocked ? (
                      <span style={{ marginLeft: 8, fontSize: 10, color: '#fbbf24' }}>LOCKED</span>
                    ) : null}
                  </span>
                  {d.hint ? <span style={{ fontSize: 11, color: '#94a3b8' }}>{d.hint}</span> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

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
        backdropFilter: 'blur(18px)',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          display: 'flex',
          height: TOP_MENU_H,
          alignItems: 'center',
          gap: 14,
          padding: '0 16px',
          minWidth: 0,
          overflow: 'visible',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
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
              boxShadow: '0 0 18px rgba(34,211,238,0.55)',
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
              whiteSpace: 'nowrap',
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
              marginLeft: 4,
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
            overflowX: 'auto',
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
                  border: active ? '1px solid rgba(52,211,153,0.55)' : '1px solid transparent',
                  background: active ? 'rgba(16,185,129,0.18)' : 'transparent',
                  color: active ? '#6ee7b7' : '#e2e8f0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Trade sits immediately before PAPER / LIVE mode */}
          <button
            ref={tradeBtnRef}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTradeOpen((o) => !o);
            }}
            aria-haspopup="menu"
            aria-expanded={tradeOpen}
            aria-label="Trade destinations"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 12px',
              fontSize: 12,
              fontWeight: tradeActive || tradeOpen ? 700 : 600,
              borderRadius: 999,
              border:
                tradeActive || tradeOpen
                  ? '1px solid rgba(56,189,248,0.7)'
                  : '1px solid rgba(148,163,184,0.35)',
              background:
                tradeActive || tradeOpen
                  ? 'rgba(14,165,233,0.22)'
                  : 'rgba(15,23,42,0.75)',
              color: tradeActive || tradeOpen ? '#7dd3fc' : '#e2e8f0',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <CandlestickChart style={{ height: 14, width: 14 }} />
            Trade
            <ChevronDown
              style={{
                height: 14,
                width: 14,
                opacity: 0.85,
                transform: tradeOpen ? 'rotate(180deg)' : undefined,
                transition: 'transform 120ms ease',
              }}
            />
          </button>

          <button
            type="button"
            onClick={() => onRequestModeSwitch?.()}
            title={isLive ? 'LIVE MODE — click to switch' : 'PAPER MODE — click to switch'}
            aria-label={isLive ? 'Live trading mode' : 'Paper trading mode'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 12px',
              borderRadius: 999,
              border: isLive
                ? '1px solid rgba(251,146,60,0.75)'
                : '1px solid rgba(56,189,248,0.65)',
              background: isLive
                ? 'linear-gradient(180deg, rgba(154,52,18,0.95) 0%, rgba(127,29,29,0.85) 100%)'
                : 'linear-gradient(180deg, rgba(7,89,133,0.95) 0%, rgba(12,74,110,0.85) 100%)',
              color: isLive ? '#ffedd5' : '#e0f2fe',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.08em',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: isLive
                ? '0 0 14px rgba(251,146,60,0.35)'
                : '0 0 14px rgba(56,189,248,0.28)',
            }}
          >
            {isLive ? 'LIVE MODE' : 'PAPER MODE'}
            {isLive && liveLocked ? ' · LOCKED' : ''}
          </button>
          <button
            type="button"
            onClick={() => onSectionChange('watchlist')}
            title="Stock Watchlist"
            aria-label="Open Stock Watchlist"
            aria-current={watchlistActive ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 34,
              minWidth: 34,
              padding: '0 12px',
              borderRadius: 999,
              border: watchlistActive
                ? '1px solid rgba(34,211,238,0.7)'
                : '1px solid rgba(148,163,184,0.35)',
              background: watchlistActive
                ? 'linear-gradient(180deg, rgba(8,47,73,0.98) 0%, rgba(14,116,144,0.45) 100%)'
                : 'rgba(15,23,42,0.75)',
              color: watchlistActive ? '#a5f3fc' : '#cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              boxShadow: watchlistActive ? '0 0 14px rgba(34,211,238,0.28)' : 'none',
            }}
          >
            <Eye style={{ height: 15, width: 15 }} />
            <span className="hidden sm:inline">Watchlist</span>
          </button>
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
                boxShadow: '0 0 14px rgba(34,211,238,0.2)',
              }}
            >
              <Sparkles style={{ height: 14, width: 14 }} />
              AI Advisory
            </button>
          )}
          {children}
        </div>
      </div>
      {menu}
      <span
        style={{
          pointerEvents: 'none',
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(34,211,238,0.85) 35%, rgba(52,211,153,0.7) 65%, transparent 100%)',
        }}
      />
    </header>
  );
}
