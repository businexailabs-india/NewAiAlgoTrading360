import React, { useEffect, useRef } from 'react';
import type { ChartCandle, ChartOverlay, ChartProvider } from './ChartProvider';

/**
 * Development fallback chart using canvas (no TradingView Advanced Charts license required).
 * Swap via ChartProvider when licensed Advanced Charts are available.
 * Data must come from broker/simulated market APIs — never scraped from TradingView.
 */
function SimpleCandleChart({
  symbol,
  candles,
  overlays,
  height = 320,
}: {
  symbol: string;
  candles: ChartCandle[];
  overlays?: ChartOverlay;
  height?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, w, h);
    if (!candles.length) {
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${symbol} — no market data (connect paper/simulated feed)`, 16, 24);
      return;
    }
    const lows = candles.map((c) => c.low);
    const highs = candles.map((c) => c.high);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const pad = (max - min) * 0.05 || 1;
    const y = (p: number) => h - ((p - (min - pad)) / (max - min + 2 * pad)) * (h - 40) - 20;
    const slot = w / Math.max(candles.length, 1);
    candles.forEach((c, i) => {
      const x = i * slot + slot / 2;
      const up = c.close >= c.open;
      ctx.strokeStyle = up ? '#14b8a6' : '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(x, y(c.high));
      ctx.lineTo(x, y(c.low));
      ctx.stroke();
      ctx.fillStyle = up ? '#14b8a6' : '#f43f5e';
      const top = y(Math.max(c.open, c.close));
      const bot = y(Math.min(c.open, c.close));
      ctx.fillRect(x - slot * 0.3, top, slot * 0.6, Math.max(1, bot - top));
    });
    const drawLine = (price: number | undefined, color: string) => {
      if (price == null) return;
      ctx.strokeStyle = color;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y(price));
      ctx.lineTo(w, y(price));
      ctx.stroke();
      ctx.setLineDash([]);
    };
    drawLine(overlays?.orHigh, '#f59e0b');
    drawLine(overlays?.orLow, '#f59e0b');
    drawLine(overlays?.vwap, '#eab308');
    drawLine(overlays?.ema, '#22d3ee');
    drawLine(overlays?.entry, '#22c55e');
    drawLine(overlays?.stop, '#ef4444');
    drawLine(overlays?.target, '#84cc16');
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`${symbol} · Lightweight fallback (not Advanced Charts)`, 12, 16);
  }, [symbol, candles, overlays, height]);

  return (
    <canvas
      ref={ref}
      width={900}
      height={height}
      className="w-full rounded-lg border border-slate-700/60"
      style={{ height }}
    />
  );
}

export const lightweightChartsProvider: ChartProvider = {
  name: 'LightweightChartsFallback',
  licenseNote:
    'TradingView Advanced Charts / Trading Platform require a commercial license. This canvas fallback is for development only.',
  renderChart: (props) => <SimpleCandleChart {...props} />,
};
