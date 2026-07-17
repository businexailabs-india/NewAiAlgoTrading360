import { pctColor } from './algosCatalog';

export function Sparkline({
  data,
  width = 88,
  height = 28
}: {
  data: number[];
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / Math.max(1, data.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(' ');
  const up = data[data.length - 1] >= data[0];
  const color = pctColor(up ? 1 : -1);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={points} />
    </svg>
  );
}
