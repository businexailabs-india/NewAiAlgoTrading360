import { useMemo } from 'react';
import type { Candle } from './engine/market';
import type { Level } from './types';
import { ema, vwap } from './engine/market';
import { tradeos } from '@/components/tradeos/tokens';

export function BotChart({
  candles,
  levels,
  marks
}: {
  candles: Candle[];
  levels: Level[];
  marks?: { kind: string; index: number }[];
}) {
  const w = 920;
  const h = 280;
  const pad = 16;
  const closes = candles.map((c) => c.c);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const vw = vwap(candles);

  const { min, max } = useMemo(() => {
    const prices = [
      ...candles.flatMap((c) => [c.h, c.l]),
      ...levels.map((l) => l.price),
      vw,
      ...e20,
      ...e50
    ];
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }, [candles, e20, e50, levels, vw]);

  const x = (i: number) => pad + (i / Math.max(1, candles.length - 1)) * (w - pad * 2);
  const y = (p: number) => pad + ((max - p) / (max - min || 1)) * (h - pad * 2);
  const cw = Math.max(2, (w - pad * 2) / candles.length - 1.2);

  const poly = (arr: number[]) => arr.map((p, i) => `${x(i)},${y(p)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ background: 'rgba(15,23,42,0.55)', borderRadius: 12 }}>
      {levels.map((l) => (
        <g key={`${l.kind}-${l.method}-${l.price}`}>
          <line
            x1={pad}
            x2={w - pad}
            y1={y(l.price)}
            y2={y(l.price)}
            stroke={l.kind === 'resistance' ? tradeos.red : tradeos.green}
            strokeDasharray={l.rank === 'primary' ? '0' : '4 4'}
            strokeWidth={l.rank === 'primary' ? 1.4 : 1}
            opacity={0.75}
          />
          <text x={w - pad - 4} y={y(l.price) - 4} textAnchor="end" fill={l.kind === 'resistance' ? tradeos.red : tradeos.green} fontSize={9}>
            {l.rank === 'primary' ? (l.kind === 'resistance' ? 'R' : 'S') : ''} {l.price} · {l.confidence}%
          </text>
        </g>
      ))}
      <polyline fill="none" stroke={tradeos.amber} strokeWidth={1} points={`${x(0)},${y(vw)} ${x(candles.length - 1)},${y(vw)}`} />
      <polyline fill="none" stroke={tradeos.blue} strokeWidth={1.2} points={poly(e20)} />
      <polyline fill="none" stroke={tradeos.teal} strokeWidth={1.2} points={poly(e50)} />
      {candles.map((c, i) => {
        const up = c.c >= c.o;
        const col = up ? tradeos.green : tradeos.red;
        return (
          <g key={c.t}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} />
            <rect x={x(i) - cw / 2} y={y(Math.max(c.o, c.c))} width={cw} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} fill={col} />
          </g>
        );
      })}
      {(marks || []).map((m, i) => (
        <text key={i} x={x(m.index)} y={12} fill={tradeos.amber} fontSize={9} textAnchor="middle">
          {m.kind}
        </text>
      ))}
    </svg>
  );
}
