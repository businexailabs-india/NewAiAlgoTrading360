import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useMarketData } from '../../contexts/MarketDataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { chrome } from '../../theme/chrome';
import { UserProfileHeader } from '../UserProfileHeader';
import { TOP_CHROME_H } from '../TopBar';
import { API_BASE_URL } from '../../lib/api';
import { StockChartModal } from '../StockChartModal';
import type { WatchlistItem } from '../../api/watchlist';

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

const INDEX_TICKER_H = 48;
const COMMODITY_TICKER_H = 36;
/** Index strip + MCX commodity strip under the top menu. */
export const MARKET_TICKER_H = INDEX_TICKER_H + COMMODITY_TICKER_H;

type CommodityTick = {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
};

const COMMODITY_FALLBACK: CommodityTick[] = [
  { symbol: 'GOLD', name: 'GOLD', value: 125000, change: 0, changePercent: 0 },
  { symbol: 'SILVER', name: 'SILVER', value: 155000, change: 0, changePercent: 0 },
  { symbol: 'CRUDEOIL', name: 'CRUDE', value: 5800, change: 0, changePercent: 0 },
  { symbol: 'NATURALGAS', name: 'NG', value: 320, change: 0, changePercent: 0 },
  { symbol: 'COPPER', name: 'COPPER', value: 850, change: 0, changePercent: 0 },
  { symbol: 'ZINC', name: 'ZINC', value: 280, change: 0, changePercent: 0 },
  { symbol: 'ALUMINIUM', name: 'ALUM', value: 245, change: 0, changePercent: 0 }
];

function isMcxOpenIst(now = new Date()): boolean {
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
  return mins >= 9 * 60 && mins <= 23 * 60 + 30;
}

function chartItemFromTicker(
  rawName: string,
  explicitSymbol?: string,
  quote?: { value: number; change?: number; changePercent?: number }
): WatchlistItem {
  const key = (explicitSymbol || rawName).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const table: Record<string, { symbol: string; name: string; exchange: string }> = {
    NIFTY50: { symbol: 'NIFTY', name: 'Nifty 50', exchange: 'INDEX' },
    N50: { symbol: 'NIFTY', name: 'Nifty 50', exchange: 'INDEX' },
    NIFTY: { symbol: 'NIFTY', name: 'Nifty 50', exchange: 'INDEX' },
    NIFTYBANK: { symbol: 'BANKNIFTY', name: 'Nifty Bank', exchange: 'INDEX' },
    NBANK: { symbol: 'BANKNIFTY', name: 'Nifty Bank', exchange: 'INDEX' },
    BANKNIFTY: { symbol: 'BANKNIFTY', name: 'Nifty Bank', exchange: 'INDEX' },
    FINNIFTY: { symbol: 'FINNIFTY', name: 'Fin Nifty', exchange: 'INDEX' },
    NIFTYFINSERVICE: { symbol: 'FINNIFTY', name: 'Fin Nifty', exchange: 'INDEX' },
    MIDCPNIFTY: { symbol: 'MIDCPNIFTY', name: 'Nifty Midcap Select', exchange: 'INDEX' },
    NIFTYMIDCAP100: { symbol: 'MIDCPNIFTY', name: 'Nifty Midcap Select', exchange: 'INDEX' },
    NIFTYMIDCAP: { symbol: 'MIDCPNIFTY', name: 'Nifty Midcap Select', exchange: 'INDEX' },
    NIFTYNXT50: { symbol: 'NIFTYNXT50', name: 'Nifty Next 50', exchange: 'INDEX' },
    NIFTYNEXT50: { symbol: 'NIFTYNXT50', name: 'Nifty Next 50', exchange: 'INDEX' },
    SENSEX: { symbol: 'SENSEX', name: 'Sensex', exchange: 'INDEX' },
    BANKEX: { symbol: 'BANKEX', name: 'Bankex', exchange: 'INDEX' },
    INDIAVIX: { symbol: 'INDIAVIX', name: 'India VIX', exchange: 'INDEX' },
    GOLD: { symbol: 'GOLD', name: 'Gold', exchange: 'MCX' },
    SILVER: { symbol: 'SILVER', name: 'Silver', exchange: 'MCX' },
    CRUDEOIL: { symbol: 'CRUDEOIL', name: 'Crude Oil', exchange: 'MCX' },
    CRUDE: { symbol: 'CRUDEOIL', name: 'Crude Oil', exchange: 'MCX' },
    NATURALGAS: { symbol: 'NATURALGAS', name: 'Natural Gas', exchange: 'MCX' },
    NG: { symbol: 'NATURALGAS', name: 'Natural Gas', exchange: 'MCX' },
    NATGAS: { symbol: 'NATURALGAS', name: 'Natural Gas', exchange: 'MCX' },
    COPPER: { symbol: 'COPPER', name: 'Copper', exchange: 'MCX' },
    ZINC: { symbol: 'ZINC', name: 'Zinc', exchange: 'MCX' },
    ALUMINIUM: { symbol: 'ALUMINIUM', name: 'Aluminium', exchange: 'MCX' },
    ALUM: { symbol: 'ALUMINIUM', name: 'Aluminium', exchange: 'MCX' }
  };
  const hit = table[key] || {
    symbol: explicitSymbol || rawName.replace(/\s+/g, '').toUpperCase() || 'NIFTY',
    name: rawName,
    exchange: 'INDEX'
  };
  return {
    id: `ticker-${hit.symbol}`,
    symbol: hit.symbol,
    exchange: hit.exchange,
    sortOrder: 0,
    name: hit.name,
    price: quote?.value,
    change: quote?.change,
    changePercent: quote?.changePercent
  };
}

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
  const { theme } = useTheme();
  const light = theme === 'light';
  const c = chrome(light);
  const open = isMarketOpenIst();
  const mcxOpen = isMcxOpenIst();
  const showProfile = Boolean(onPortfolioChange && onManageAccounts && onSettings);
  const [commodities, setCommodities] = useState<CommodityTick[]>(COMMODITY_FALLBACK);
  const [tapeIndices, setTapeIndices] = useState<typeof indices>([]);
  const [chartStock, setChartStock] = useState<WatchlistItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [cRes, iRes] = await Promise.all([
          fetch(`${API_BASE_URL}/market/commodities`),
          fetch(`${API_BASE_URL}/market/indices`)
        ]);
        const cJson = await cRes.json().catch(() => ({}));
        const iJson = await iRes.json().catch(() => ({}));
        const cRows = (cJson.data || []) as CommodityTick[];
        const iRows = (iJson.data || []) as typeof indices;
        if (!cancelled && Array.isArray(cRows) && cRows.length) setCommodities(cRows);
        if (!cancelled && Array.isArray(iRows) && iRows.length) setTapeIndices(iRows);
      } catch {
        /* keep last / fallback prints */
      }
    };
    void load();
    const t = window.setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  const sourceIndices = indices.length ? indices : tapeIndices;

  const rows = useMemo(() => {
    if (!sourceIndices.length) return [];
    const preferred = PREFERRED.map((name) =>
      sourceIndices.find(
        (i) =>
          i.name.toUpperCase() === name.toUpperCase() ||
          i.name.toUpperCase().includes(name.toUpperCase())
      )
    ).filter(Boolean) as typeof sourceIndices;
    const uniq = new Map<string, (typeof sourceIndices)[0]>();
    [...preferred, ...sourceIndices].forEach((i) => {
      if (!uniq.has(i.name)) uniq.set(i.name, i);
    });
    return [...uniq.values()].slice(0, 8);
  }, [sourceIndices]);

  const tickCell = (
    name: string,
    value: number,
    pct: number,
    i: number,
    digits = 0,
    onOpen?: () => void
  ) => {
    const flat = Math.abs(pct) < 0.005;
    const up = pct > 0;
    const color = flat ? '#64748b' : up ? '#047857' : '#b91c1c';
    return (
      <button
        key={name}
        type="button"
        onClick={onOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          paddingLeft: i === 0 ? 0 : 10,
          border: 'none',
          borderLeft: i === 0 ? 'none' : '1px solid rgba(148,163,184,0.18)',
          background: 'transparent',
          cursor: onOpen ? 'pointer' : 'default',
          color: 'inherit'
        }}
        title={`${name}: ${value.toLocaleString()} (${pct.toFixed(2)}%) · Open chart`}
      >
        <span style={{ fontSize: 10, color: c.muted, whiteSpace: 'nowrap' }}>{name}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: c.fg,
            whiteSpace: 'nowrap'
          }}
        >
          {value.toLocaleString(undefined, { maximumFractionDigits: digits })}
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
          {flat ? null : up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {flat ? '' : up ? '+' : ''}
          {pct.toFixed(2)}%
        </span>
      </button>
    );
  };

  return (
    <>
    <div
      style={{
        position: 'fixed',
        top: TOP_CHROME_H,
        left: 80,
        right: 0,
        height: MARKET_TICKER_H,
        zIndex: 485,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        background: c.barBg,
        borderBottom: `1px solid ${c.barBorder}`,
        boxShadow: light ? '0 2px 8px rgba(15,23,42,0.06)' : '0 4px 12px rgba(0,0,0,0.28)'
      }}
    >
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minWidth: 0,
        height: INDEX_TICKER_H,
        padding: '0 12px 0 16px'
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
            color: c.muted,
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
          <span style={{ whiteSpace: 'nowrap' }}>
            {open ? 'NSE Open' : 'NSE Closed · EOD'}
          </span>
          {isLive && open ? (
            <span style={{ color: light ? '#0e7490' : '#67e8f9' }}>· Live</span>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <span style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
            {open ? 'Loading live indices…' : 'Loading today’s close…'}
          </span>
        ) : (
          rows.map((idx, i) =>
            tickCell(
              idx.name.replace('NIFTY ', 'N').replace('Nifty ', 'N'),
              idx.value,
              Number(idx.changePercent) || 0,
              i,
              0,
              () =>
                setChartStock(
                  chartItemFromTicker(idx.name, idx.name, {
                    value: idx.value,
                    change: Number(idx.change) || 0,
                    changePercent: Number(idx.changePercent) || 0
                  })
                )
            )
          )
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

    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        height: COMMODITY_TICKER_H,
        padding: '0 12px 0 16px',
        borderTop: '1px solid rgba(148,163,184,0.18)'
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
          color: c.muted,
          paddingRight: 10,
          borderRight: '1px solid rgba(148,163,184,0.25)'
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: mcxOpen ? '#f59e0b' : '#64748b',
            boxShadow: mcxOpen ? '0 0 8px rgba(245,158,11,0.7)' : 'none'
          }}
        />
        <span style={{ whiteSpace: 'nowrap', fontWeight: 700, color: '#c2410c' }}>MCX</span>
        <span style={{ whiteSpace: 'nowrap' }}>{mcxOpen ? 'Open' : 'Closed'}</span>
      </div>
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
        {commodities.map((row, i) =>
          tickCell(
            row.name,
            row.value,
            Number(row.changePercent) || 0,
            i,
            row.value < 1000 ? 1 : 0,
            () =>
              setChartStock(
                chartItemFromTicker(row.name, row.symbol, {
                  value: row.value,
                  change: row.change,
                  changePercent: row.changePercent
                })
              )
          )
        )}
      </div>
    </div>
    </div>
    {chartStock ? (
      <StockChartModal stock={chartStock} onClose={() => setChartStock(null)} />
    ) : null}
    </>
  );
}

/** @deprecated use MARKET_TICKER_H */
export const MARKET_TICKER_OFFSET = MARKET_TICKER_H;
