import React, { createContext, useContext } from 'react';

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartOverlay {
  orHigh?: number;
  orLow?: number;
  vwap?: number;
  ema?: number;
  entry?: number;
  stop?: number;
  target?: number;
}

export interface ChartProvider {
  name: string;
  licenseNote: string;
  renderChart: (props: {
    symbol: string;
    candles: ChartCandle[];
    overlays?: ChartOverlay;
    height?: number;
  }) => React.ReactNode;
}

const ChartCtx = createContext<ChartProvider | null>(null);

export function useChartProvider() {
  return useContext(ChartCtx);
}

export function ChartProviderHost({
  provider,
  children,
}: {
  provider: ChartProvider;
  children: React.ReactNode;
}) {
  return <ChartCtx.Provider value={provider}>{children}</ChartCtx.Provider>;
}
