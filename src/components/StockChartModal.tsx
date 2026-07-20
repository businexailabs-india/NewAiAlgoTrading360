import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  TrendingUp,
  TrendingDown,
  Loader2,
  Sparkles,
  RefreshCw,
  Minus,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api';
import { tradingService } from '@/services/tradingService';
import { advisorService } from '@/services/advisorService';
import type { WatchlistItem } from '@/api/watchlist';

type BarPoint = {
  date: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ChartPoint = BarPoint & {
  sma20?: number | null;
  sma50?: number | null;
  ema20?: number | null;
  bbUpper?: number | null;
  bbMid?: number | null;
  bbLower?: number | null;
  vwap?: number | null;
  rsi?: number | null;
  macd?: number | null;
  macdSignal?: number | null;
  macdHist?: number | null;
};

type ChartType = 'candle' | 'ohlc' | 'line' | 'bar';

type ToolId =
  | 'crosshair'
  | 'sma20'
  | 'sma50'
  | 'ema20'
  | 'bb'
  | 'vwap'
  | 'pivots'
  | 'fib'
  | 'rsi'
  | 'macd';

const ANALYSIS_TOOLS: Array<{ id: ToolId; label: string; group: string }> = [
  { id: 'crosshair', label: 'Crosshair', group: 'Cursor' },
  { id: 'sma20', label: 'SMA 20', group: 'Overlays' },
  { id: 'sma50', label: 'SMA 50', group: 'Overlays' },
  { id: 'ema20', label: 'EMA 20', group: 'Overlays' },
  { id: 'bb', label: 'Bollinger', group: 'Overlays' },
  { id: 'vwap', label: 'VWAP', group: 'Overlays' },
  { id: 'pivots', label: 'Pivots', group: 'Levels' },
  { id: 'fib', label: 'Fibonacci', group: 'Levels' },
  { id: 'rsi', label: 'RSI', group: 'Oscillators' },
  { id: 'macd', label: 'MACD', group: 'Oscillators' },
];

const TOOL_COLORS: Record<string, string> = {
  crosshair: '#67e8f9',
  sma20: '#fbbf24',
  sma50: '#a78bfa',
  ema20: '#38bdf8',
  bb: '#94a3b8',
  vwap: '#f472b6',
  pivots: '#fcd34d',
  fib: '#c4b5fd',
  rsi: '#67e8f9',
  macd: '#38bdf8',
};

/** Candle / bar size */
const INTERVALS: Array<{ id: string; label: string }> = [
  { id: '1m', label: '1 minute' },
  { id: '2m', label: '2 minutes' },
  { id: '5m', label: '5 minutes' },
  { id: '15m', label: '15 minutes' },
  { id: '30m', label: '30 minutes' },
  { id: '1h', label: '1 hour' },
  { id: '2h', label: '2 hours' },
  { id: '4h', label: '4 hours' },
  { id: '1d', label: '1 day' },
  { id: '1wk', label: '1 week' },
  { id: '1mo', label: '1 month' },
];

/** Lookback window */
const RANGES: Array<{ id: string; label: string }> = [
  { id: '1d', label: '1 Day' },
  { id: '5d', label: '5 Days' },
  { id: '1mo', label: '1 Month' },
  { id: '3mo', label: '3 Months' },
  { id: '6mo', label: '6 Months' },
  { id: '1y', label: '1 Year' },
  { id: '2y', label: '2 Years' },
  { id: '5y', label: '5 Years' },
  { id: 'ytd', label: 'Year to date' },
  { id: 'max', label: 'All time (MAX)' },
];

function defaultRangeForInterval(interval: string): string {
  if (['1m', '2m'].includes(interval)) return '1d';
  if (['5m', '15m', '30m'].includes(interval)) return '5d';
  if (['1h', '2h', '4h'].includes(interval)) return '1mo';
  if (interval === '1d') return '3mo';
  if (interval === '1wk') return '2y';
  if (interval === '1mo') return 'max';
  return '5d';
}

async function fetchHistorical(
  symbol: string,
  range: string,
  interval: string
): Promise<BarPoint[]> {
  const token = localStorage.getItem('authToken');
  const qs = new URLSearchParams({ range, interval });
  const res = await fetch(
    `${API_BASE_URL}/market/historical/${encodeURIComponent(symbol)}?${qs.toString()}`,
    {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    }
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `Failed to load chart (${res.status})`);
  }
  const payload = json.data;
  const rows = (
    Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
  ) as Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  if (!rows.length) throw new Error('No historical bars returned for this symbol');
  return rows
    .filter((r) => r && Number(r.close) > 0)
    .map((r) => {
      const raw = String(r.date);
      // Intraday: "2026-07-20 09:15" → "09:15"; daily: "2026-07-20" → "07-20"
      const label = raw.includes(' ')
        ? raw.slice(11, 16)
        : raw.length >= 10
          ? raw.slice(5, 10)
          : raw;
      return {
        date: raw,
        label,
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume || 0),
      };
    });
}

function fmt(n?: number) {
  if (n == null || Number.isNaN(n)) return '—';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sma(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

function ema(values: number[], period: number): Array<number | null> {
  const out: Array<number | null> = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += values[j];
      prev = sum / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  const upper: Array<number | null> = [];
  const lower: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    if (mid[i] == null || i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - (mid[i] as number);
      sumSq += d * d;
    }
    const sd = Math.sqrt(sumSq / period);
    upper.push((mid[i] as number) + mult * sd);
    lower.push((mid[i] as number) - mult * sd);
  }
  return { mid, upper, lower };
}

function vwapSeries(bars: BarPoint[]): Array<number | null> {
  let cumPv = 0;
  let cumVol = 0;
  return bars.map((b) => {
    const typical = (b.high + b.low + b.close) / 3;
    cumPv += typical * b.volume;
    cumVol += b.volume;
    return cumVol > 0 ? cumPv / cumVol : null;
  });
}

function rsiSeries(closes: number[], period = 14): Array<number | null> {
  const out: Array<number | null> = Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    const g = ch > 0 ? ch : 0;
    const l = ch < 0 ? -ch : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function macdSeries(closes: number[]) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine: Array<number | null> = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null ? (ema12[i] as number) - (ema26[i] as number) : null
  );
  const macdNums = macdLine.map((v) => v ?? 0);
  const firstValid = macdLine.findIndex((v) => v != null);
  const signal: Array<number | null> = Array(closes.length).fill(null);
  if (firstValid >= 0) {
    const slice = macdNums.slice(firstValid);
    const sigSlice = ema(slice, 9);
    for (let i = 0; i < sigSlice.length; i++) {
      signal[firstValid + i] = sigSlice[i];
    }
  }
  const hist = macdLine.map((v, i) =>
    v != null && signal[i] != null ? v - (signal[i] as number) : null
  );
  return { macd: macdLine, signal, hist };
}

function enrichBars(bars: BarPoint[]): ChartPoint[] {
  const closes = bars.map((b) => b.close);
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const e20 = ema(closes, 20);
  const bb = bollinger(closes, 20, 2);
  const vw = vwapSeries(bars);
  const rsi = rsiSeries(closes, 14);
  const macd = macdSeries(closes);
  return bars.map((b, i) => ({
    ...b,
    sma20: s20[i],
    sma50: s50[i],
    ema20: e20[i],
    bbUpper: bb.upper[i],
    bbMid: bb.mid[i],
    bbLower: bb.lower[i],
    vwap: vw[i],
    rsi: rsi[i],
    macd: macd.macd[i],
    macdSignal: macd.signal[i],
    macdHist: macd.hist[i],
  }));
}

type ChartSuggestion = {
  bias: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  summary: string;
  reasons: string[];
};

function buildTechnicalSuggestion(data: ChartPoint[], symbol: string): ChartSuggestion | null {
  if (data.length < 5) return null;
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  let score = 0;
  const reasons: string[] = [];

  if (last.rsi != null) {
    if (last.rsi >= 70) {
      score -= 1.2;
      reasons.push(`RSI ${last.rsi.toFixed(0)} overbought`);
    } else if (last.rsi <= 30) {
      score += 1.2;
      reasons.push(`RSI ${last.rsi.toFixed(0)} oversold`);
    } else if (last.rsi >= 55) {
      score += 0.35;
      reasons.push(`RSI ${last.rsi.toFixed(0)} firm`);
    } else if (last.rsi <= 45) {
      score -= 0.35;
      reasons.push(`RSI ${last.rsi.toFixed(0)} soft`);
    }
  }

  if (last.macd != null && last.macdSignal != null && prev.macd != null && prev.macdSignal != null) {
    const bullCross = prev.macd <= prev.macdSignal && last.macd > last.macdSignal;
    const bearCross = prev.macd >= prev.macdSignal && last.macd < last.macdSignal;
    if (bullCross) {
      score += 1;
      reasons.push('MACD bullish cross');
    } else if (bearCross) {
      score -= 1;
      reasons.push('MACD bearish cross');
    } else if (last.macd > last.macdSignal) {
      score += 0.4;
      reasons.push('MACD above signal');
    } else {
      score -= 0.4;
      reasons.push('MACD below signal');
    }
  }

  if (last.sma20 != null && last.sma50 != null) {
    if (last.sma20 > last.sma50) {
      score += 0.6;
      reasons.push('SMA20 > SMA50');
    } else {
      score -= 0.6;
      reasons.push('SMA20 < SMA50');
    }
  }

  if (last.vwap != null) {
    if (last.close >= last.vwap) {
      score += 0.35;
      reasons.push('Price above VWAP');
    } else {
      score -= 0.35;
      reasons.push('Price below VWAP');
    }
  }

  if (last.bbUpper != null && last.bbLower != null) {
    if (last.close >= last.bbUpper) {
      score -= 0.5;
      reasons.push('Near upper Bollinger');
    } else if (last.close <= last.bbLower) {
      score += 0.5;
      reasons.push('Near lower Bollinger');
    }
  }

  const bias: ChartSuggestion['bias'] =
    score >= 1.1 ? 'BUY' : score <= -1.1 ? 'SELL' : 'HOLD';
  const confidence = Math.min(92, Math.max(42, Math.round(50 + Math.abs(score) * 14)));
  const summary =
    bias === 'BUY'
      ? `Technical bias on ${symbol} leans buy on the selected timeframe.`
      : bias === 'SELL'
        ? `Technical bias on ${symbol} leans sell / reduce on the selected timeframe.`
        : `Technical bias on ${symbol} is mixed — wait for a clearer setup.`;

  return { bias, confidence, summary, reasons: reasons.slice(0, 5) };
}

function linePath(
  values: Array<number | null | undefined>,
  xOf: (i: number) => number,
  yOf: (v: number) => number
) {
  let d = '';
  let started = false;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) {
      started = false;
      continue;
    }
    d += `${started ? 'L' : 'M'}${xOf(i).toFixed(2)},${yOf(v).toFixed(2)} `;
    started = true;
  }
  return d.trim();
}

function classicPivots(high: number, low: number, close: number) {
  const p = (high + low + close) / 3;
  const r1 = 2 * p - low;
  const s1 = 2 * p - high;
  const r2 = p + (high - low);
  const s2 = p - (high - low);
  return { p, r1, s1, r2, s2 };
}

/** Candlestick / OHLC bars drawn with SVG for crisp NSE price charts */
function OhlcSvgChart({
  data,
  width,
  height,
  mode,
  tools,
}: {
  data: ChartPoint[];
  width: number;
  height: number;
  mode: 'candle' | 'ohlc';
  tools: Set<ToolId>;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const pad = { top: 16, right: 12, bottom: 28, left: 56 };
  const innerW = Math.max(40, width - pad.left - pad.right);
  const innerH = Math.max(40, height - pad.top - pad.bottom);

  if (!data.length) {
    return (
      <div style={{ height, placeContent: 'center', textAlign: 'center', color: '#a1a1aa' }}>
        No chart data
      </div>
    );
  }

  const priceSamples = data.flatMap((d) => {
    const vals = [d.low, d.high];
    if (tools.has('bb')) {
      if (d.bbUpper != null) vals.push(d.bbUpper);
      if (d.bbLower != null) vals.push(d.bbLower);
    }
    if (tools.has('sma20') && d.sma20 != null) vals.push(d.sma20);
    if (tools.has('sma50') && d.sma50 != null) vals.push(d.sma50);
    if (tools.has('ema20') && d.ema20 != null) vals.push(d.ema20);
    if (tools.has('vwap') && d.vwap != null) vals.push(d.vwap);
    return vals;
  });
  let min = Math.min(...priceSamples);
  let max = Math.max(...priceSamples);

  const last = data[data.length - 1];
  const pivots =
    tools.has('pivots') && last
      ? classicPivots(
          Math.max(...data.map((d) => d.high)),
          Math.min(...data.map((d) => d.low)),
          last.close
        )
      : null;
  if (pivots) {
    min = Math.min(min, pivots.s2);
    max = Math.max(max, pivots.r2);
  }

  const fibHigh = Math.max(...data.map((d) => d.high));
  const fibLow = Math.min(...data.map((d) => d.low));
  const fibLevels = tools.has('fib')
    ? [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((r) => ({
        r,
        price: fibHigh - (fibHigh - fibLow) * r,
      }))
    : [];
  if (fibLevels.length) {
    min = Math.min(min, fibLow);
    max = Math.max(max, fibHigh);
  }

  const span = max - min || 1;
  const yOf = (v: number) => pad.top + ((max - v) / span) * innerH;
  const slot = innerW / Math.max(1, data.length);
  const xOf = (i: number) => pad.left + slot * i + slot / 2;
  const bodyW = Math.max(2.5, Math.min(14, slot * 0.62));
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  const onMove = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!tools.has('crosshair') || !data.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.min(data.length - 1, Math.max(0, Math.floor((x - pad.left) / slot)));
    setHoverIdx(Number.isFinite(idx) ? idx : null);
  };

  const hover = hoverIdx != null ? data[hoverIdx] : null;

  return (
    <div style={{ position: 'relative' }}>
      {tools.has('crosshair') && hover && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: pad.left,
            zIndex: 2,
            pointerEvents: 'none',
            fontSize: 11,
            color: '#e4e4e7',
            background: 'rgba(9,9,11,0.85)',
            border: '1px solid #3f3f46',
            borderRadius: 6,
            padding: '4px 8px',
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {hover.label} · O {hover.open.toFixed(2)} H {hover.high.toFixed(2)} L {hover.low.toFixed(2)} C{' '}
          {hover.close.toFixed(2)}
          {tools.has('rsi') && hover.rsi != null ? ` · RSI ${hover.rsi.toFixed(1)}` : ''}
        </div>
      )}
      <svg
        width={width}
        height={height}
        style={{ display: 'block', maxWidth: '100%' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {yTicks.map((v) => (
          <g key={`yt-${v}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yOf(v)}
              y2={yOf(v)}
              stroke="rgba(148,163,184,0.14)"
            />
            <text x={pad.left - 6} y={yOf(v) + 3} textAnchor="end" fill="#71717a" fontSize="10">
              {v.toFixed(0)}
            </text>
          </g>
        ))}

        {tools.has('bb') && (
          <>
            <path
              d={linePath(
                data.map((d) => d.bbUpper),
                xOf,
                yOf
              )}
              fill="none"
              stroke={TOOL_COLORS.bb}
              strokeWidth={1}
              strokeOpacity={0.7}
              strokeDasharray="4 3"
            />
            <path
              d={linePath(
                data.map((d) => d.bbMid),
                xOf,
                yOf
              )}
              fill="none"
              stroke={TOOL_COLORS.bb}
              strokeWidth={1}
              strokeOpacity={0.55}
            />
            <path
              d={linePath(
                data.map((d) => d.bbLower),
                xOf,
                yOf
              )}
              fill="none"
              stroke={TOOL_COLORS.bb}
              strokeWidth={1}
              strokeOpacity={0.7}
              strokeDasharray="4 3"
            />
          </>
        )}

        {fibLevels.map((lvl) => (
          <g key={`fib-${lvl.r}`}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yOf(lvl.price)}
              y2={yOf(lvl.price)}
              stroke={TOOL_COLORS.fib}
              strokeWidth={1}
              strokeOpacity={0.55}
              strokeDasharray="3 3"
            />
            <text
              x={width - pad.right - 2}
              y={yOf(lvl.price) - 2}
              textAnchor="end"
              fill={TOOL_COLORS.fib}
              fontSize="9"
            >
              {(lvl.r * 100).toFixed(1)}% {lvl.price.toFixed(1)}
            </text>
          </g>
        ))}

        {pivots &&
          (
            [
              ['P', pivots.p],
              ['R1', pivots.r1],
              ['R2', pivots.r2],
              ['S1', pivots.s1],
              ['S2', pivots.s2],
            ] as const
          ).map(([name, price]) => (
            <g key={name}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={yOf(price)}
                y2={yOf(price)}
                stroke={TOOL_COLORS.pivots}
                strokeWidth={name === 'P' ? 1.4 : 1}
                strokeOpacity={name === 'P' ? 0.85 : 0.45}
                strokeDasharray={name === 'P' ? undefined : '5 4'}
              />
              <text
                x={pad.left + 4}
                y={yOf(price) - 3}
                fill={TOOL_COLORS.pivots}
                fontSize="9"
              >
                {name} {price.toFixed(1)}
              </text>
            </g>
          ))}

        {data.map((d, i) => {
          const cx = xOf(i);
          const bull = d.close >= d.open;
          const color = bull ? '#34d399' : '#f87171';
          const openY = yOf(d.open);
          const closeY = yOf(d.close);
          const highY = yOf(d.high);
          const lowY = yOf(d.low);
          const bodyTop = Math.min(openY, closeY);
          const bodyH = Math.max(1.5, Math.abs(closeY - openY));

          return (
            <g key={`${d.date}-${i}`}>
              <line x1={cx} x2={cx} y1={highY} y2={lowY} stroke={color} strokeWidth={1.2} />
              {mode === 'candle' ? (
                <rect
                  x={cx - bodyW / 2}
                  y={bodyTop}
                  width={bodyW}
                  height={bodyH}
                  fill={bull ? 'rgba(52,211,153,0.9)' : 'rgba(248,113,113,0.9)'}
                  stroke={color}
                  strokeWidth={1}
                  rx={1}
                >
                  <title>{`${d.label} O:${d.open} H:${d.high} L:${d.low} C:${d.close}`}</title>
                </rect>
              ) : (
                <g stroke={color} strokeWidth={1.6}>
                  <line x1={cx - bodyW * 0.45} x2={cx} y1={openY} y2={openY} />
                  <line x1={cx} x2={cx + bodyW * 0.45} y1={closeY} y2={closeY} />
                  <title>{`${d.label} O:${d.open} H:${d.high} L:${d.low} C:${d.close}`}</title>
                </g>
              )}
              {i % labelEvery === 0 ? (
                <text x={cx} y={height - 8} textAnchor="middle" fill="#71717a" fontSize="10">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {tools.has('sma20') && (
          <path
            d={linePath(
              data.map((d) => d.sma20),
              xOf,
              yOf
            )}
            fill="none"
            stroke={TOOL_COLORS.sma20}
            strokeWidth={1.5}
          />
        )}
        {tools.has('sma50') && (
          <path
            d={linePath(
              data.map((d) => d.sma50),
              xOf,
              yOf
            )}
            fill="none"
            stroke={TOOL_COLORS.sma50}
            strokeWidth={1.5}
          />
        )}
        {tools.has('ema20') && (
          <path
            d={linePath(
              data.map((d) => d.ema20),
              xOf,
              yOf
            )}
            fill="none"
            stroke={TOOL_COLORS.ema20}
            strokeWidth={1.5}
          />
        )}
        {tools.has('vwap') && (
          <path
            d={linePath(
              data.map((d) => d.vwap),
              xOf,
              yOf
            )}
            fill="none"
            stroke={TOOL_COLORS.vwap}
            strokeWidth={1.5}
          />
        )}

        {tools.has('crosshair') && hoverIdx != null && (
          <g pointerEvents="none">
            <line
              x1={xOf(hoverIdx)}
              x2={xOf(hoverIdx)}
              y1={pad.top}
              y2={height - pad.bottom}
              stroke="rgba(226,232,240,0.45)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={yOf(data[hoverIdx].close)}
              y2={yOf(data[hoverIdx].close)}
              stroke="rgba(226,232,240,0.35)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={xOf(hoverIdx)}
              cy={yOf(data[hoverIdx].close)}
              r={3.5}
              fill="#67e8f9"
              stroke="#09090b"
              strokeWidth={1}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function OscillatorSvg({
  title,
  width,
  height,
  series,
  guideLines,
  hist,
}: {
  title: string;
  width: number;
  height: number;
  series: Array<{ key: string; color: string; values: Array<number | null | undefined> }>;
  guideLines?: Array<{ value: number; color: string }>;
  hist?: Array<number | null | undefined>;
}) {
  const pad = { top: 18, right: 12, bottom: 8, left: 56 };
  const innerW = Math.max(40, width - pad.left - pad.right);
  const innerH = Math.max(24, height - pad.top - pad.bottom);
  const all = [
    ...series.flatMap((s) => s.values.filter((v): v is number => v != null && Number.isFinite(v))),
    ...(hist || []).filter((v): v is number => v != null && Number.isFinite(v)),
    ...(guideLines || []).map((g) => g.value),
  ];
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const span = max - min || 1;
  const n = Math.max(1, series[0]?.values.length || hist?.length || 1);
  const slot = innerW / n;
  const xOf = (i: number) => pad.left + slot * i + slot / 2;
  const yOf = (v: number) => pad.top + ((max - v) / span) * innerH;
  const zeroY = yOf(0);

  return (
    <svg width={width} height={height} style={{ display: 'block', maxWidth: '100%' }}>
      <text x={pad.left} y={12} fill="#a1a1aa" fontSize="10">
        {title}
      </text>
      {(guideLines || []).map((g) => (
        <line
          key={`g-${g.value}`}
          x1={pad.left}
          x2={width - pad.right}
          y1={yOf(g.value)}
          y2={yOf(g.value)}
          stroke={g.color}
          strokeWidth={1}
          strokeOpacity={0.45}
          strokeDasharray="3 3"
        />
      ))}
      {hist?.map((v, i) => {
        if (v == null || !Number.isFinite(v)) return null;
        const y = yOf(v);
        const top = Math.min(y, zeroY);
        const h = Math.max(1, Math.abs(y - zeroY));
        return (
          <rect
            key={`h-${i}`}
            x={xOf(i) - Math.max(1, slot * 0.35) / 2}
            y={top}
            width={Math.max(1, slot * 0.35)}
            height={h}
            fill={v >= 0 ? 'rgba(52,211,153,0.55)' : 'rgba(248,113,113,0.55)'}
          />
        );
      })}
      {series.map((s) => (
        <path
          key={s.key}
          d={linePath(s.values, xOf, yOf)}
          fill="none"
          stroke={s.color}
          strokeWidth={1.4}
        />
      ))}
    </svg>
  );
}

function VolumeSvg({ data, width, height }: { data: BarPoint[]; width: number; height: number }) {
  const padL = 56;
  const padR = 12;
  const innerW = Math.max(40, width - padL - padR);
  const maxVol = Math.max(...data.map((d) => d.volume), 1);
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, slot * 0.55);

  return (
    <svg width={width} height={height} style={{ display: 'block', maxWidth: '100%' }}>
      <text x={padL - 6} y={12} textAnchor="end" fill="#71717a" fontSize="9">
        Vol
      </text>
      {data.map((d, i) => {
        const h = (d.volume / maxVol) * (height - 12);
        const x = padL + slot * i + (slot - barW) / 2;
        const bull = d.close >= d.open;
        return (
          <rect
            key={`v-${d.date}-${i}`}
            x={x}
            y={height - h}
            width={barW}
            height={Math.max(1, h)}
            rx={1}
            fill={bull ? 'rgba(52,211,153,0.55)' : 'rgba(248,113,113,0.55)'}
          >
            <title>{`${d.label} vol ${d.volume.toLocaleString('en-IN')}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function StockChartModal({
  stock,
  onClose,
}: {
  stock: WatchlistItem;
  onClose: () => void;
}) {
  const [chartInterval, setChartInterval] = useState<string>('15m');
  const [range, setRange] = useState<string>('5d');
  const [chartType, setChartType] = useState<ChartType>('candle');
  const [bars, setBars] = useState<BarPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelSize, setPanelSize] = useState(() => ({
    w: Math.min(960, Math.max(560, window.innerWidth - 64)),
    h: Math.min(820, Math.max(480, window.innerHeight - 64)),
  }));
  const panelRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{
    edge: 'e' | 's' | 'se';
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);

  const [qty, setQty] = useState('1');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');
  const [placingSide, setPlacingSide] = useState<'BUY' | 'SELL' | null>(null);
  const [activeTools, setActiveTools] = useState<Set<ToolId>>(
    () => new Set<ToolId>(['crosshair', 'sma20'])
  );
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiHelp, setShowAiHelp] = useState(false);
  const [winState, setWinState] = useState<'normal' | 'max' | 'min'>('normal');
  const aiReqRef = useRef(0);
  const savedSizeRef = useRef(panelSize);

  const chartWidth = Math.max(280, panelSize.w - 48);
  const chartHeight = Math.max(
    160,
    Math.min(winState === 'max' ? 520 : 420, Math.round(panelSize.h * (showAiHelp ? 0.32 : 0.4)))
  );

  function toggleTool(id: ToolId) {
    setActiveTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onIntervalChange(next: string) {
    setChartInterval(next);
    setRange(defaultRangeForInterval(next));
  }

  const clampPanel = useCallback((w: number, h: number) => {
    const maxW = Math.max(480, window.innerWidth - 24);
    const maxH = Math.max(360, window.innerHeight - 24);
    return {
      w: Math.min(maxW, Math.max(480, w)),
      h: Math.min(maxH, Math.max(420, h)),
    };
  }, []);

  const beginResize = useCallback(
    (edge: 'e' | 's' | 'se') => (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        edge,
        startX: e.clientX,
        startY: e.clientY,
        startW: panelSize.w,
        startH: panelSize.h,
      };
      document.body.style.cursor =
        edge === 'e' ? 'ew-resize' : edge === 's' ? 'ns-resize' : 'nwse-resize';
    },
    [panelSize.h, panelSize.w]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      const dw = e.clientX - r.startX;
      const dh = e.clientY - r.startY;
      let w = r.startW;
      let h = r.startH;
      if (r.edge === 'e' || r.edge === 'se') w = r.startW + dw;
      if (r.edge === 's' || r.edge === 'se') h = r.startH + dh;
      setPanelSize(clampPanel(w, h));
    };
    const onUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [clampPanel]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAiHelp) {
          setShowAiHelp(false);
          return;
        }
        if (winState === 'max') {
          setPanelSize(clampPanel(savedSizeRef.current.w, savedSizeRef.current.h));
          setWinState('normal');
          return;
        }
        onClose();
      }
    };
    const onWinResize = () => {
      if (winState === 'max') {
        setPanelSize(clampPanel(window.innerWidth - 24, window.innerHeight - 24));
      } else if (winState === 'normal') {
        setPanelSize((s) => clampPanel(s.w, s.h));
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onWinResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onWinResize);
    };
  }, [onClose, clampPanel, showAiHelp, winState]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHistorical(stock.symbol, range, chartInterval)
      .then((data) => {
        if (!cancelled) setBars(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Chart load failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stock.symbol, range, chartInterval]);

  const stats = useMemo(() => {
    if (!bars.length) {
      return {
        last: stock.price,
        high: stock.high,
        low: stock.low,
        change: stock.change,
        changePercent: stock.changePercent,
      };
    }
    const first = bars[0];
    const last = bars[bars.length - 1];
    const change = last.close - first.open;
    const changePercent = first.open ? (change / first.open) * 100 : 0;
    return {
      last: last.close,
      high: Math.max(...bars.map((b) => b.high)),
      low: Math.min(...bars.map((b) => b.low)),
      change,
      changePercent,
    };
  }, [bars, stock]);

  const chartData = useMemo(() => enrichBars(bars), [bars]);
  const technicalSuggestion = useMemo(
    () => buildTechnicalSuggestion(chartData, stock.symbol),
    [chartData, stock.symbol]
  );

  const fetchAiSuggestion = useCallback(async () => {
    if (!technicalSuggestion || !chartData.length) return;
    const last = chartData[chartData.length - 1];
    const reqId = ++aiReqRef.current;
    setAiLoading(true);
    setAiError(null);
    const prompt = [
      `Give a brief paper-trading suggestion for NSE stock ${stock.symbol}.`,
      `Interval=${chartInterval}, period=${range}.`,
      `LTP≈${last.close.toFixed(2)}, RSI=${last.rsi?.toFixed(1) ?? 'n/a'},`,
      `MACD=${last.macd?.toFixed(2) ?? 'n/a'}, signal=${last.macdSignal?.toFixed(2) ?? 'n/a'},`,
      `SMA20=${last.sma20?.toFixed(2) ?? 'n/a'}, SMA50=${last.sma50?.toFixed(2) ?? 'n/a'},`,
      `VWAP=${last.vwap?.toFixed(2) ?? 'n/a'}.`,
      `Local technical bias: ${technicalSuggestion.bias} (${technicalSuggestion.confidence}%).`,
      `Respond in 3-5 short sentences: bias, key levels, and risk note. Advisory only — do not place orders.`,
    ].join(' ');
    try {
      const result = await advisorService.chat(prompt, stock.symbol);
      if (aiReqRef.current !== reqId) return;
      setAiText(result.reply?.trim() || 'No AI narrative returned.');
      setAiProvider(result.provider || 'advisor');
    } catch (e) {
      if (aiReqRef.current !== reqId) return;
      setAiText(null);
      setAiError(e instanceof Error ? e.message : 'AI suggestion unavailable');
    } finally {
      if (aiReqRef.current === reqId) setAiLoading(false);
    }
  }, [chartData, chartInterval, range, stock.symbol, technicalSuggestion]);

  useEffect(() => {
    setAiText(null);
    setAiProvider(null);
    setAiError(null);
    setShowAiHelp(false);
  }, [stock.symbol]);

  function openAiHelp() {
    if (winState === 'min') {
      setPanelSize(clampPanel(savedSizeRef.current.w, savedSizeRef.current.h));
      setWinState('normal');
    }
    setShowAiHelp(true);
    if (!aiText && !aiLoading) void fetchAiSuggestion();
  }

  function toggleMaximize() {
    if (winState === 'max') {
      setPanelSize(clampPanel(savedSizeRef.current.w, savedSizeRef.current.h));
      setWinState('normal');
      return;
    }
    if (winState !== 'min') savedSizeRef.current = panelSize;
    setPanelSize(clampPanel(window.innerWidth - 24, window.innerHeight - 24));
    setWinState('max');
  }

  function minimizeWindow() {
    if (winState !== 'min') {
      if (winState === 'normal') savedSizeRef.current = panelSize;
      setWinState('min');
    }
  }

  function restoreWindow() {
    setPanelSize(clampPanel(savedSizeRef.current.w, savedSizeRef.current.h));
    setWinState('normal');
  }

  const up = (stats.change ?? 0) >= 0;
  const stroke = up ? '#34d399' : '#f87171';

  useEffect(() => {
    setQty('1');
    setOrderType('MARKET');
    setLimitPrice('');
    setPlacingSide(null);
  }, [stock.symbol]);

  useEffect(() => {
    if (stats.last != null && Number.isFinite(stats.last)) {
      setLimitPrice((prev) => (prev ? prev : String(Number(stats.last).toFixed(2))));
    }
  }, [stats.last, stock.symbol]);

  async function placeTrade(side: 'BUY' | 'SELL') {
    const quantity = Math.max(1, Math.floor(Number(qty) || 0));
    if (!Number.isFinite(quantity) || quantity < 1) {
      toast.error('Enter a valid quantity');
      return;
    }
    let price: number | undefined;
    if (orderType === 'LIMIT') {
      price = Number(limitPrice || stats.last || stock.price);
      if (!Number.isFinite(price) || price <= 0) {
        toast.error('Enter a valid limit price');
        return;
      }
    }
    setPlacingSide(side);
    try {
      const order = await tradingService.placeOrder({
        symbol: stock.symbol,
        tradeType: side,
        quantity,
        orderType,
        price,
        product: 'CNC',
        isPaper: true,
        source: 'CHART',
      });
      const fillHint =
        order?.brokerStatus || order?.status
          ? ` · ${order.brokerStatus || order.status}`
          : '';
      toast.success(
        `Paper ${side} ${quantity} ${stock.symbol}${orderType === 'LIMIT' ? ` @ ₹${price}` : ''}${fillHint}`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setPlacingSide(null);
    }
  }

  const typeButtons: Array<{ id: ChartType; label: string }> = [
    { id: 'candle', label: 'Candlestick' },
    { id: 'ohlc', label: 'OHLC bars' },
    { id: 'bar', label: 'Volume bars' },
    { id: 'line', label: 'Line' },
  ];


  if (winState === 'min') {
    const dock = (
      <div
        style={{
          position: 'fixed',
          left: 16,
          bottom: 16,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 12,
          border: '1px solid #3f3f46',
          background: '#09090b',
          color: '#e4e4e7',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          minWidth: 280,
        }}
      >
        <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, color: '#67e8f9' }}>
          {stock.symbol}
        </span>
        <span style={{ fontSize: 12, color: '#a1a1aa', flex: 1 }}>Chart minimized</span>
        <button
          type="button"
          onClick={openAiHelp}
          title="AI help"
          style={{
            height: 30,
            padding: '0 8px',
            borderRadius: 8,
            border: '1px solid #3f3f46',
            background: '#18181b',
            color: '#a5f3fc',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
          }}
        >
          <Sparkles size={12} />
          AI
        </button>
        <button
          type="button"
          onClick={restoreWindow}
          aria-label="Restore chart"
          title="Restore"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: '1px solid #3f3f46',
            background: '#18181b',
            color: '#e4e4e7',
            cursor: 'pointer',
          }}
        >
          <Maximize2 size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chart"
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            border: '1px solid #3f3f46',
            background: '#18181b',
            color: '#e4e4e7',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
        </button>
      </div>
    );
    return createPortal(dock, document.body);
  }

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${stock.symbol} chart`}
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0,0,0,0.82)',
        boxSizing: 'border-box',
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: panelSize.w,
          height: panelSize.h,
          maxWidth: 'calc(100vw - 24px)',
          maxHeight: 'calc(100vh - 24px)',
          overflow: 'hidden',
          borderRadius: 16,
          border: '1px solid #3f3f46',
          background: '#09090b',
          color: '#e4e4e7',
          boxShadow: '0 25px 50px rgba(0,0,0,0.65)',
          display: 'flex',
          flexDirection: 'column',
          resize: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            padding: '14px 20px',
            borderBottom: '1px solid #27272a',
            flexShrink: 0,
            cursor: 'default',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 24,
                  fontWeight: 700,
                  color: '#67e8f9',
                }}
              >
                {stock.symbol}
              </span>
              <span style={{ fontSize: 13, color: '#a1a1aa' }}>{stock.name || stock.exchange}</span>
            </div>
            <div
              style={{
                marginTop: 10,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, auto))',
                gap: '8px 16px',
                alignItems: 'center',
                fontSize: 13,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{fmt(stats.last)}</span>
              <span
                style={{
                  color: up ? '#34d399' : '#f87171',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {stats.change != null ? `${up ? '+' : ''}${stats.change.toFixed(2)}` : '—'}
                {stats.changePercent != null
                  ? ` (${up ? '+' : ''}${stats.changePercent.toFixed(2)}%)`
                  : ''}
              </span>
              <span style={{ color: '#a1a1aa' }}>
                High <b style={{ color: '#6ee7b7', fontWeight: 600 }}>{fmt(stats.high)}</b>
              </span>
              <span style={{ color: '#a1a1aa' }}>
                Low <b style={{ color: '#fca5a5', fontWeight: 600 }}>{fmt(stats.low)}</b>
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              onClick={openAiHelp}
              title="Need AI help?"
              style={{
                height: 36,
                padding: '0 10px',
                borderRadius: 8,
                border: showAiHelp
                  ? '1px solid rgba(34,211,238,0.55)'
                  : '1px solid #3f3f46',
                background: showAiHelp ? 'rgba(34,211,238,0.12)' : '#18181b',
                color: showAiHelp ? '#a5f3fc' : '#a1a1aa',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Sparkles size={14} />
              AI help
            </button>
            <button
              type="button"
              onClick={minimizeWindow}
              aria-label="Minimize chart"
              title="Minimize"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#e4e4e7',
                cursor: 'pointer',
              }}
            >
              <Minus size={16} />
            </button>
            <button
              type="button"
              onClick={toggleMaximize}
              aria-label={winState === 'max' ? 'Restore chart' : 'Maximize chart'}
              title={winState === 'max' ? 'Restore' : 'Maximize'}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#e4e4e7',
                cursor: 'pointer',
              }}
            >
              {winState === 'max' ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chart"
              title="Close"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#e4e4e7',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Buy / Sell ticket — paper only (top) */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 10,
            padding: '12px 20px 16px',
            borderBottom: '1px solid #27272a',
            background: 'linear-gradient(180deg, #0c0c0e 0%, #09090b 100%)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 72 }}>
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>Qty</span>
            <input
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              disabled={!!placingSide}
              style={{
                width: 80,
                height: 36,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#e4e4e7',
                padding: '0 10px',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 100 }}>
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>Order type</span>
            <select
              value={orderType}
              onChange={(e) => setOrderType(e.target.value as 'MARKET' | 'LIMIT')}
              disabled={!!placingSide}
              style={{
                height: 36,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#e4e4e7',
                padding: '0 10px',
                fontSize: 13,
              }}
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
            </select>
          </div>

          {orderType === 'LIMIT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110 }}>
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>Limit price</span>
              <input
                type="number"
                min={0.05}
                step={0.05}
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                disabled={!!placingSide}
                style={{
                  width: 120,
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid #3f3f46',
                  background: '#18181b',
                  color: '#e4e4e7',
                  padding: '0 10px',
                  fontSize: 13,
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 11,
                color: '#a5f3fc',
                border: '1px solid rgba(34,211,238,0.35)',
                background: 'rgba(34,211,238,0.08)',
                borderRadius: 999,
                padding: '4px 10px',
              }}
            >
              Paper
            </span>
            <button
              type="button"
              onClick={() => void placeTrade('BUY')}
              disabled={!!placingSide}
              style={{
                minWidth: 96,
                height: 36,
                borderRadius: 8,
                border: '1px solid rgba(52,211,153,0.55)',
                background: placingSide === 'BUY' ? 'rgba(52,211,153,0.35)' : 'rgba(52,211,153,0.18)',
                color: '#a7f3d0',
                fontSize: 13,
                fontWeight: 700,
                cursor: placingSide ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {placingSide === 'BUY' ? <Loader2 size={14} className="animate-spin" /> : null}
              Buy
            </button>
            <button
              type="button"
              onClick={() => void placeTrade('SELL')}
              disabled={!!placingSide}
              style={{
                minWidth: 96,
                height: 36,
                borderRadius: 8,
                border: '1px solid rgba(248,113,113,0.55)',
                background: placingSide === 'SELL' ? 'rgba(248,113,113,0.35)' : 'rgba(248,113,113,0.16)',
                color: '#fecaca',
                fontSize: 13,
                fontWeight: 700,
                cursor: placingSide ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {placingSide === 'SELL' ? <Loader2 size={14} className="animate-spin" /> : null}
              Sell
            </button>
          </div>
        </div>

        {/* Chart type + timeframe dropdowns */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            gap: 12,
            padding: '12px 20px',
            borderBottom: '1px solid #27272a',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: '1 1 auto' }}>
            {typeButtons.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChartType(t.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border:
                    chartType === t.id ? '1px solid rgba(52,211,153,0.55)' : '1px solid #3f3f46',
                  background: chartType === t.id ? 'rgba(52,211,153,0.14)' : '#18181b',
                  color: chartType === t.id ? '#a7f3d0' : '#a1a1aa',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#a1a1aa' }}>
            Interval
            <select
              value={chartInterval}
              onChange={(e) => onIntervalChange(e.target.value)}
              style={{
                minWidth: 140,
                height: 34,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#e4e4e7',
                padding: '0 10px',
                fontSize: 13,
              }}
            >
              <optgroup label="Intraday">
                {INTERVALS.filter((i) =>
                  ['1m', '2m', '5m', '15m', '30m', '1h', '2h', '4h'].includes(i.id)
                ).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Daily / longer">
                {INTERVALS.filter((i) => ['1d', '1wk', '1mo'].includes(i.id)).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#a1a1aa' }}>
            Period
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              style={{
                minWidth: 140,
                height: 34,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#e4e4e7',
                padding: '0 10px',
                fontSize: 13,
              }}
            >
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>


        {/* Analysis tools */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderBottom: '1px solid #27272a',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: '#71717a', marginRight: 4, letterSpacing: 0.3 }}>
            TOOLS
          </span>
          {ANALYSIS_TOOLS.map((tool) => {
            const on = activeTools.has(tool.id);
            return (
              <button
                key={tool.id}
                type="button"
                title={tool.group}
                onClick={() => toggleTool(tool.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: on
                    ? `1px solid ${TOOL_COLORS[tool.id] || 'rgba(34,211,238,0.55)'}`
                    : '1px solid #3f3f46',
                  background: on
                    ? `${TOOL_COLORS[tool.id] || 'rgba(34,211,238,1)'}22`
                    : '#18181b',
                  color: on ? TOOL_COLORS[tool.id] || '#a5f3fc' : '#a1a1aa',
                  fontSize: 11,
                  fontWeight: on ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                {tool.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setActiveTools(new Set())}
            style={{
              marginLeft: 'auto',
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid #3f3f46',
              background: 'transparent',
              color: '#71717a',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Clear tools
          </button>
        </div>

        <div style={{ padding: 16, flex: '1 1 auto', overflow: 'auto', minHeight: 0 }}>
          {loading ? (
            <div style={{ height: 360, displayContent: 'center', textAlign: 'center', color: '#a1a1aa' }}>
              Loading chart…
            </div>
          ) : error ? (
            <div style={{ height: 360, displayContent: 'center', textAlign: 'center', color: '#fca5a5' }}>
              {error}
            </div>
          ) : (
            <div>
              {(chartType === 'candle' || chartType === 'ohlc') && (
                <OhlcSvgChart
                  data={chartData}
                  width={chartWidth}
                  height={chartHeight}
                  mode={chartType}
                  tools={activeTools}
                />
              )}

              {chartType === 'line' && (
                <AreaChart
                  width={chartWidth}
                  height={chartHeight}
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="stockFillPortal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(63,63,70,0.5)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} minTickGap={28} />
                  <YAxis
                    domain={['auto', 'auto']}
                    width={64}
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    tickFormatter={(v) => `₹${Number(v).toFixed(0)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#09090b',
                      border: '1px solid #3f3f46',
                      borderRadius: 8,
                    }}
                    formatter={(value: number | string) => [fmt(Number(value)), 'Close']}
                  />
                  <Area
                    type="monotone"
                    dataKey="close"
                    stroke={stroke}
                    fill="url(#stockFillPortal)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="close"
                    stroke={stroke}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  {activeTools.has('sma20') && (
                    <Line
                      type="monotone"
                      dataKey="sma20"
                      stroke={TOOL_COLORS.sma20}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                      name="SMA 20"
                    />
                  )}
                  {activeTools.has('sma50') && (
                    <Line
                      type="monotone"
                      dataKey="sma50"
                      stroke={TOOL_COLORS.sma50}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                      name="SMA 50"
                    />
                  )}
                  {activeTools.has('ema20') && (
                    <Line
                      type="monotone"
                      dataKey="ema20"
                      stroke={TOOL_COLORS.ema20}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                      name="EMA 20"
                    />
                  )}
                  {activeTools.has('vwap') && (
                    <Line
                      type="monotone"
                      dataKey="vwap"
                      stroke={TOOL_COLORS.vwap}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                      name="VWAP"
                    />
                  )}
                  {activeTools.has('bb') && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="bbUpper"
                        stroke={TOOL_COLORS.bb}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                        name="BB Upper"
                      />
                      <Line
                        type="monotone"
                        dataKey="bbLower"
                        stroke={TOOL_COLORS.bb}
                        strokeWidth={1}
                        strokeDasharray="4 3"
                        dot={false}
                        connectNulls
                        isAnimationActive={false}
                        name="BB Lower"
                      />
                    </>
                  )}
                </AreaChart>
              )}

              {chartType === 'bar' && (
                <ComposedChart
                  width={chartWidth}
                  height={chartHeight}
                  data={chartData}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid stroke="rgba(63,63,70,0.45)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 11 }} minTickGap={28} />
                  <YAxis
                    yAxisId="price"
                    orientation="left"
                    width={64}
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    tickFormatter={(v) => `₹${Number(v).toFixed(0)}`}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="vol"
                    orientation="right"
                    width={48}
                    tick={{ fill: '#71717a', fontSize: 10 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}K`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#09090b',
                      border: '1px solid #3f3f46',
                      borderRadius: 8,
                    }}
                  />
                  <Bar
                    yAxisId="vol"
                    dataKey="volume"
                    fill="rgba(34,211,238,0.35)"
                    isAnimationActive={false}
                    name="Volume"
                  />
                  <Line
                    yAxisId="price"
                    type="monotone"
                    dataKey="close"
                    stroke="#67e8f9"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                    name="Close"
                  />
                </ComposedChart>
              )}

              {/* Always show volume strip under candle/ohlc/line */}
              {chartType !== 'bar' && (
                <div style={{ marginTop: 10 }}>
                  <VolumeSvg data={chartData} width={chartWidth} height={88} />
                </div>
              )}

              {activeTools.has('rsi') && (
                <div style={{ marginTop: 10, borderTop: '1px solid #27272a', paddingTop: 8 }}>
                  <OscillatorSvg
                    title="RSI (14)"
                    width={chartWidth}
                    height={110}
                    series={[
                      {
                        key: 'rsi',
                        color: '#67e8f9',
                        values: chartData.map((d) => d.rsi),
                      },
                    ]}
                    guideLines={[
                      { value: 70, color: '#f87171' },
                      { value: 50, color: '#71717a' },
                      { value: 30, color: '#34d399' },
                    ]}
                  />
                </div>
              )}

              {activeTools.has('macd') && (
                <div style={{ marginTop: 10, borderTop: '1px solid #27272a', paddingTop: 8 }}>
                  <OscillatorSvg
                    title="MACD (12,26,9)"
                    width={chartWidth}
                    height={120}
                    series={[
                      {
                        key: 'macd',
                        color: '#38bdf8',
                        values: chartData.map((d) => d.macd),
                      },
                      {
                        key: 'signal',
                        color: '#fbbf24',
                        values: chartData.map((d) => d.macdSignal),
                      },
                    ]}
                    hist={chartData.map((d) => d.macdHist)}
                    guideLines={[{ value: 0, color: '#71717a' }]}
                  />
                </div>
              )}
            </div>
          )}
        </div>


        {/* AI suggestion — opt-in, docked at bottom */}
        {showAiHelp ? (
        <div
          style={{
            padding: '10px 20px 12px',
            borderTop: '1px solid #27272a',
            background: 'linear-gradient(90deg, rgba(34,211,238,0.06), rgba(167,139,250,0.05))',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Sparkles size={14} color="#67e8f9" />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#a5f3fc', letterSpacing: 0.3 }}>
              AI SUGGESTION
            </span>
            {technicalSuggestion && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 999,
                  border:
                    technicalSuggestion.bias === 'BUY'
                      ? '1px solid rgba(52,211,153,0.55)'
                      : technicalSuggestion.bias === 'SELL'
                        ? '1px solid rgba(248,113,113,0.55)'
                        : '1px solid rgba(250,204,21,0.45)',
                  background:
                    technicalSuggestion.bias === 'BUY'
                      ? 'rgba(52,211,153,0.14)'
                      : technicalSuggestion.bias === 'SELL'
                        ? 'rgba(248,113,113,0.14)'
                        : 'rgba(250,204,21,0.12)',
                  color:
                    technicalSuggestion.bias === 'BUY'
                      ? '#a7f3d0'
                      : technicalSuggestion.bias === 'SELL'
                        ? '#fecaca'
                        : '#fde68a',
                }}
              >
                {technicalSuggestion.bias} · {technicalSuggestion.confidence}%
              </span>
            )}
            {aiProvider && (
              <span style={{ fontSize: 10, color: '#71717a' }}>via {aiProvider}</span>
            )}
            <button
              type="button"
              onClick={() => void fetchAiSuggestion()}
              disabled={aiLoading || !technicalSuggestion}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 28,
                padding: '0 10px',
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#a1a1aa',
                fontSize: 11,
                cursor: aiLoading ? 'wait' : 'pointer',
              }}
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh AI
            </button>
            <button
              type="button"
              onClick={() => setShowAiHelp(false)}
              aria-label="Close AI help"
              title="Close AI help"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: '1px solid #3f3f46',
                background: '#18181b',
                color: '#a1a1aa',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
            {technicalSuggestion && technicalSuggestion.bias !== 'HOLD' && (
              <button
                type="button"
                onClick={() => void placeTrade(technicalSuggestion.bias)}
                disabled={!!placingSide || aiLoading}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 8,
                  border:
                    technicalSuggestion.bias === 'BUY'
                      ? '1px solid rgba(52,211,153,0.5)'
                      : '1px solid rgba(248,113,113,0.5)',
                  background:
                    technicalSuggestion.bias === 'BUY'
                      ? 'rgba(52,211,153,0.12)'
                      : 'rgba(248,113,113,0.12)',
                  color: technicalSuggestion.bias === 'BUY' ? '#a7f3d0' : '#fecaca',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Paper {technicalSuggestion.bias}
              </button>
            )}
          </div>

          {technicalSuggestion ? (
            <>
              <p style={{ margin: 0, fontSize: 12, color: '#e4e4e7', lineHeight: 1.45 }}>
                {technicalSuggestion.summary}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {technicalSuggestion.reasons.map((r) => (
                  <span
                    key={r}
                    style={{
                      fontSize: 10,
                      color: '#a1a1aa',
                      border: '1px solid #3f3f46',
                      borderRadius: 999,
                      padding: '2px 8px',
                      background: '#18181b',
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: '#71717a' }}>
              Load chart bars to generate a suggestion.
            </p>
          )}

          <div
            style={{
              marginTop: 8,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid rgba(63,63,70,0.9)',
              background: 'rgba(9,9,11,0.55)',
              fontSize: 12,
              color: '#d4d4d8',
              lineHeight: 1.45,
              maxHeight: 96,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}
          >
            {aiLoading && !aiText
              ? 'Asking advisor…'
              : aiError
                ? `AI note unavailable: ${aiError}. Technical bias above still applies.`
                : aiText || 'AI narrative will appear here.'}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 10, color: '#71717a' }}>
            Advisory only — AI never executes. Chart Buy/Sell stays paper unless live is explicitly
            enabled.
          </p>
        </div>
        ) : null}

        {/* Resize handles */}
        {winState === 'normal' ? (
          <>
            <div
              onMouseDown={beginResize('e')}
              title="Drag to resize width"
              style={{
                position: 'absolute',
                top: 12,
                right: 0,
                width: 6,
                bottom: 18,
                cursor: 'ew-resize',
                zIndex: 5,
              }}
            />
            <div
              onMouseDown={beginResize('s')}
              title="Drag to resize height"
              style={{
                position: 'absolute',
                left: 12,
                right: 18,
                bottom: 0,
                height: 6,
                cursor: 'ns-resize',
                zIndex: 5,
              }}
            />
            <div
              onMouseDown={beginResize('se')}
              title="Drag to resize"
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                width: 16,
                height: 16,
                cursor: 'nwse-resize',
                zIndex: 6,
                borderRight: '2px solid #52525b',
                borderBottom: '2px solid #52525b',
                borderRadius: 2,
                opacity: 0.85,
              }}
            />
          </>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
