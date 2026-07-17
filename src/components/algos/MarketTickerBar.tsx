import { useMemo, type ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMarketData } from '../../contexts/MarketDataContext';
import { UserProfileHeader } from '../UserProfileHeader';
import { TOP_CHROME_H } from '../TopBar';

const PREFERRED = [
  'Nifty 50',
  'NIFTY 50',
  'Nifty Bank',
  'NIFTY BANK',
  'Fin Nifty',
  'FIN NIFTY',
  'India VIX',
  'INDIA VIX',
  'Nifty Midcap',
  'NIFTY MIDCAP 100',
  'SENSEX'
];

/** Fixed height of the live market ticker + profile strip under the top menu. */
export const MARKET_TICKER_H = 48;

function isMarketOpenIst(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
  if (['Sat', 'Sun'].includes(weekday)) return false;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const mins = hour * 60 + minute;
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

/** Live indices (left) + portfolio / accounts / avatar (right). */
export function MarketTickerBar({
  onPortfolioChange,
  onManageAccounts,
  onSettings,
  trailing
}: {
  onPortfolioChange?: (portfolioId: string) => void;
  onManageAccounts?: () => void;
  onSettings?: () => void;
  trailing?: ReactNode;
}) {
  const { indices, isLive } = useMarketData();
  const open = isMarketOpenIst();
  const showProfile = Boolean(onPortfolioChange && onManageAccounts && onSettings);

  const rows = useMemo(() => {
    if (!indices.length) return [];
    const preferred = PREFERRED.map((name) =>
      indices.find(
        (i) =>
          i.name.toUpperCase() === name.toUpperCase() ||
          i.name.toUpperCase().includes(name.toUpperCase())
      )
    ).filter(Boolean) as typeof indices;
    const uniq = new Map<string, (typeof indices)[0]>();
    [...preferred, ...indices].forEach((i) => {
      if (!uniq.has(i.name)) uniq.set(i.name, i);
    });
    return [...uniq.values()].slice(0, 8);
  }, [indices]);

  return (
    <div
      style={{
        position: 'fixed',
        top: TOP_CHROME_H,
        left: 80,
        right: 0,
        height: MARKET_TICKER_H,
        zIndex: 485,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
        padding: '0 12px 0 16px',
        background:
          'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(2,6,23,0.96) 100%)',
        borderBottom: '1px solid rgba(34,211,238,0.2)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.28)'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
          flex: '1 1 auto',
          overflowX: 'auto'
        }}
        className="no-scrollbar"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            fontSize: 10,
            color: '#94a3b8',
            paddingRight: 10,
            borderRight: '1px solid rgba(148,163,184,0.25)'
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: open ? '#34d399' : '#64748b',
              boxShadow: open ? '0 0 8px rgba(52,211,153,0.7)' : 'none'
            }}
          />
          <span style={{ whiteSpace: 'nowrap' }}>{open ? 'Market Open' : 'Market Closed'}</span>
          {isLive && <span style={{ color: '#67e8f9' }}>· Live</span>}
        </div>

        {rows.length === 0 ? (
          <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
            Loading live indices…
          </span>
        ) : (
          rows.map((idx, i) => {
            const up = idx.changePercent >= 0;
            const color = up ? '#34d399' : '#f87171';
            return (
              <div
                key={idx.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 0,
                  paddingLeft: i === 0 ? 0 : 10,
                  borderLeft: i === 0 ? 'none' : '1px solid rgba(148,163,184,0.18)'
                }}
                title={`${idx.name}: ${idx.value.toLocaleString()} (${idx.changePercent.toFixed(2)}%)`}
              >
                <span style={{ fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                  {idx.name.replace('NIFTY ', 'N').replace('Nifty ', 'N')}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#f1f5f9',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {idx.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {up ? '+' : ''}
                  {idx.changePercent.toFixed(2)}%
                </span>
              </div>
            );
          })
        )}
      </div>

      {showProfile && (
        <>
          <div
            style={{
              width: 1,
              alignSelf: 'stretch',
              margin: '8px 0',
              background: 'rgba(148,163,184,0.25)',
              flexShrink: 0
            }}
          />
          <UserProfileHeader
            compact
            onPortfolioChange={onPortfolioChange!}
            onManageAccounts={onManageAccounts!}
            onSettings={onSettings!}
          />
        </>
      )}
      {trailing}
    </div>
  );
}

/** @deprecated use MARKET_TICKER_H */
export const MARKET_TICKER_OFFSET = MARKET_TICKER_H;
