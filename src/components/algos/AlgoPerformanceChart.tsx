import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { pctColor } from './algosCatalog';

export type CandleBar = {
  t: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trade?: 'buy' | 'sell' | null;
};

type ChartMode = 'candle' | 'ohlc' | 'line' | 'volume';

/** Build OHLC + volume series from cumulative sparkline / return window. */
export function buildCandleSeries(
  sparkline: number[],
  windowReturn: number,
  bars = 36,
  tradeMarks?: Array<{ side: string; indexHint?: number }>
): CandleBar[] {
  const src =
    sparkline.length >= 4
      ? sparkline
      : Array.from({ length: bars }, (_, i) => 100 + Math.sin(i * 0.45) * 4 + i * (windowReturn / bars) * 0.15);

  const step = Math.max(1, Math.floor(src.length / bars));
  const sampled: number[] = [];
  for (let i = 0; i < src.length && sampled.length < bars; i += step) sampled.push(src[i]);
  while (sampled.length < bars) sampled.push(sampled[sampled.length - 1] ?? 100);

  const base = sampled[0] || 100;
  const target = base * (1 + windowReturn / 100);
  const drift = (target - sampled[sampled.length - 1]) / Math.max(1, sampled.length - 1);

  const out: CandleBar[] = [];
  for (let i = 0; i < sampled.length; i++) {
    const close = sampled[i] + drift * i;
    const prev = i === 0 ? close * (1 - windowReturn / 800) : out[i - 1].close;
    const open = prev;
    const body = Math.abs(close - open);
    const wick = Math.max(body * 0.55, Math.abs(close) * 0.004) + (Math.sin(i * 1.7) + 1.2) * 0.35;
    const high = Math.max(open, close) + wick;
    const low = Math.min(open, close) - wick * 0.85;
    const volume = Math.round(80 + body * 18 + Math.abs(Math.sin(i * 0.9)) * 120 + (i % 5) * 14);
    out.push({
      t: `B${i + 1}`,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
      trade: null
    });
  }

  (tradeMarks || []).slice(0, 8).forEach((m, idx) => {
    const i = Math.min(out.length - 1, m.indexHint ?? Math.floor((idx + 1) * (out.length / 9)));
    out[i] = {
      ...out[i],
      trade: m.side.toUpperCase().includes('SELL') ? 'sell' : 'buy'
    };
  });

  return out;
}

function CandlePane({ data, mode }: { data: CandleBar[]; mode: 'candle' | 'ohlc' }) {
  const pad = { top: 16, right: 12, bottom: 22, left: 48 };
  const W = 720;
  const H = 220;
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const min = Math.min(...data.map((d) => d.low));
  const max = Math.max(...data.map((d) => d.high));
  const span = max - min || 1;
  const yOf = (v: number) => pad.top + ((max - v) / span) * innerH;
  const slot = innerW / Math.max(1, data.length);
  const bodyW = Math.max(3, slot * 0.55);

  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => min + (span * i) / ticks);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {yTicks.map((v) => (
        <g key={v}>
          <line
            x1={pad.left}
            x2={W - pad.right}
            y1={yOf(v)}
            y2={yOf(v)}
            stroke="rgba(148,163,184,0.12)"
          />
          <text x={pad.left - 6} y={yOf(v) + 3} textAnchor="end" fill="#64748b" fontSize="10">
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = pad.left + slot * i + slot / 2;
        const up = d.close >= d.open;
        const color = up ? '#34d399' : '#f87171';
        const openY = yOf(d.open);
        const closeY = yOf(d.close);
        const highY = yOf(d.high);
        const lowY = yOf(d.low);
        const bodyTop = Math.min(openY, closeY);
        const bodyH = Math.max(1.5, Math.abs(closeY - openY));

        return (
          <g key={d.t}>
            <line x1={cx} x2={cx} y1={highY} y2={lowY} stroke={color} strokeWidth={1.25} />
            {mode === 'candle' ? (
              <rect
                x={cx - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={up ? 'rgba(52,211,153,0.85)' : 'rgba(248,113,113,0.85)'}
                stroke={color}
                strokeWidth={1}
                rx={1}
              >
                <title>
                  {`${d.t} O:${d.open} H:${d.high} L:${d.low} C:${d.close} Vol:${d.volume}`}
                </title>
              </rect>
            ) : (
              <g stroke={color} strokeWidth={1.5}>
                <line x1={cx - bodyW * 0.45} x2={cx} y1={openY} y2={openY} />
                <line x1={cx} x2={cx + bodyW * 0.45} y1={closeY} y2={closeY} />
                <title>{`${d.t} O:${d.open} H:${d.high} L:${d.low} C:${d.close}`}</title>
              </g>
            )}
            {d.trade === 'buy' && (
              <polygon
                points={`${cx},${highY - 9} ${cx - 4.5},${highY - 2} ${cx + 4.5},${highY - 2}`}
                fill="#38bdf8"
              />
            )}
            {d.trade === 'sell' && (
              <polygon
                points={`${cx},${lowY + 9} ${cx - 4.5},${lowY + 2} ${cx + 4.5},${lowY + 2}`}
                fill="#fbbf24"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function VolumePane({ data }: { data: CandleBar[] }) {
  const maxVol = Math.max(...data.map((d) => d.volume), 1);
  const W = 720;
  const H = 72;
  const padL = 48;
  const padR = 12;
  const innerW = W - padL - padR;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, slot * 0.55);

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <text x={padL - 6} y={14} textAnchor="end" fill="#64748b" fontSize="9">
        Vol
      </text>
      {data.map((d, i) => {
        const h = (d.volume / maxVol) * (H - 10);
        const x = padL + slot * i + (slot - barW) / 2;
        const up = d.close >= d.open;
        return (
          <rect
            key={d.t}
            x={x}
            y={H - h}
            width={barW}
            height={h}
            rx={1}
            fill={up ? 'rgba(52,211,153,0.55)' : 'rgba(248,113,113,0.55)'}
          >
            <title>{`${d.t} volume ${d.volume}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export function AlgoPerformanceChart({
  sparkline,
  windowReturn,
  windowLabel,
  liveNote,
  tradeSides
}: {
  sparkline: number[];
  windowReturn: number;
  windowLabel: string;
  liveNote?: string;
  tradeSides?: Array<{ side: string }>;
}) {
  const [mode, setMode] = useState<ChartMode>('candle');

  const data = useMemo(
    () =>
      buildCandleSeries(
        sparkline || [],
        Number.isFinite(windowReturn) ? windowReturn : 0,
        windowLabel === '1m' ? 24 : windowLabel === '1y' || windowLabel === 'all' ? 48 : 36,
        tradeSides
      ),
    [sparkline, windowReturn, windowLabel, tradeSides]
  );

  const last = data[data.length - 1];
  const first = data[0];
  const change = last && first ? ((last.close - first.open) / first.open) * 100 : windowReturn;

  return (
    <div
      style={{
        borderRadius: 12,
        border: '1px solid rgba(34,211,238,0.18)',
        background: 'rgba(2,6,23,0.5)',
        padding: 12
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 8
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>Cumulative performance</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {liveNote ? `${liveNote} · ` : ''}
            Selected window {windowLabel.toUpperCase()} ·{' '}
            <span style={{ color: pctColor(change), fontWeight: 600 }}>
              {change >= 0 ? '+' : ''}
              {change.toFixed(2)}%
            </span>
            {' · '}basis max allocation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(
            [
              ['candle', 'Candles'],
              ['ohlc', 'OHLC'],
              ['line', 'Line'],
              ['volume', 'Volume']
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 11,
                border: mode === id ? '1px solid rgba(34,211,238,0.55)' : '1px solid rgba(148,163,184,0.2)',
                background: mode === id ? 'rgba(34,211,238,0.12)' : 'transparent',
                color: mode === id ? '#67e8f9' : '#94a3b8',
                cursor: 'pointer'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {(mode === 'candle' || mode === 'ohlc') && (
        <>
          <CandlePane data={data} mode={mode} />
          <VolumePane data={data} />
          <div style={{ display: 'flex', gap: 14, marginTop: 6, fontSize: 10, color: '#64748b', flexWrap: 'wrap' }}>
            <span>
              <span style={{ color: '#34d399' }}>■</span> Up
            </span>
            <span>
              <span style={{ color: '#f87171' }}>■</span> Down
            </span>
            <span>
              <span style={{ color: '#38bdf8' }}>▲</span> Buy trade
            </span>
            <span>
              <span style={{ color: '#fbbf24' }}>▼</span> Sell trade
            </span>
            <span>Lower pane = trade volume bars</span>
          </div>
        </>
      )}

      {mode === 'line' && (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(34,211,238,0.35)',
                  borderRadius: 8,
                  fontSize: 11
                }}
              />
              <Line type="monotone" dataKey="close" stroke="#34d399" strokeWidth={2.2} dot={false} name="Close" />
              <Line type="monotone" dataKey="high" stroke="rgba(52,211,153,0.3)" strokeWidth={1} dot={false} name="High" />
              <Line type="monotone" dataKey="low" stroke="rgba(248,113,113,0.3)" strokeWidth={1} dot={false} name="Low" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {mode === 'volume' && (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="vol" orientation="left" tick={{ fill: '#64748b', fontSize: 10 }} width={40} />
              <YAxis
                yAxisId="px"
                orientation="right"
                tick={{ fill: '#64748b', fontSize: 10 }}
                width={40}
                domain={['dataMin - 1', 'dataMax + 1']}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f172a',
                  border: '1px solid rgba(34,211,238,0.35)',
                  borderRadius: 8,
                  fontSize: 11
                }}
              />
              <Bar yAxisId="vol" dataKey="volume" maxBarSize={12} radius={[2, 2, 0, 0]} name="Volume">
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.close >= d.open ? 'rgba(52,211,153,0.65)' : 'rgba(248,113,113,0.65)'}
                  />
                ))}
              </Bar>
              <Line yAxisId="px" type="monotone" dataKey="close" stroke="#67e8f9" strokeWidth={1.75} dot={false} name="Close" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {last && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            marginTop: 10,
            fontSize: 11,
            color: '#94a3b8'
          }}
        >
          <span>
            O <strong style={{ color: '#e2e8f0' }}>{last.open.toFixed(2)}</strong>
          </span>
          <span>
            H <strong style={{ color: '#6ee7b7' }}>{last.high.toFixed(2)}</strong>
          </span>
          <span>
            L <strong style={{ color: '#fca5a5' }}>{last.low.toFixed(2)}</strong>
          </span>
          <span>
            C <strong style={{ color: '#e2e8f0' }}>{last.close.toFixed(2)}</strong>
          </span>
          <span>
            Vol <strong style={{ color: '#e2e8f0' }}>{last.volume}</strong>
          </span>
        </div>
      )}
    </div>
  );
}
