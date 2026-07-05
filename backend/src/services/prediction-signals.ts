import { OHLCVBar } from './historical-data.service';

export interface IndicatorSnapshot {
  momentum: number;
  meanReversion: number;
  regression: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHist: number;
  bollingerPctB: number;
  volumeRatio: number;
}

export interface SignalWeights {
  momentum?: number;
  meanReversion?: number;
  regression?: number;
  rsi?: number;
  macd?: number;
  bollinger?: number;
  volume?: number;
}

const DEFAULT_WEIGHTS: Required<SignalWeights> = {
  momentum: 0.2,
  meanReversion: 0.15,
  regression: 0.1,
  rsi: 0.2,
  macd: 0.15,
  bollinger: 0.1,
  volume: 0.1
};

export class PredictionSignals {
  static computeIndicators(bars: OHLCVBar[]): IndicatorSnapshot {
    const closes = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);
    const period = Math.min(14, closes.length - 1);

    return {
      momentum: this.momentum(closes, period),
      meanReversion: this.meanReversion(closes, Math.min(20, closes.length)),
      regression: this.regression(closes),
      rsi: this.rsi(closes, 14),
      ...this.macd(closes),
      bollingerPctB: this.bollingerPctB(closes, 20),
      volumeRatio: this.volumeRatio(volumes, 20)
    };
  }

  static scoreFromIndicators(
    ind: IndicatorSnapshot,
    weights: SignalWeights = {}
  ): { score: number; signals: Record<string, number> } {
    const w = { ...DEFAULT_WEIGHTS, ...weights };
    const signals: Record<string, number> = {
      momentum: ind.momentum,
      meanReversion: ind.meanReversion,
      regression: ind.regression,
      rsi: ind.rsi < 30 ? 0.03 : ind.rsi > 70 ? -0.03 : (50 - ind.rsi) / 1000,
      macd: ind.macdHist / (Math.abs(ind.macd) + 1),
      bollinger: ind.bollingerPctB < 0.2 ? 0.025 : ind.bollingerPctB > 0.8 ? -0.025 : 0,
      volume: ind.volumeRatio > 1.2 ? Math.sign(ind.momentum) * 0.01 : 0
    };

    let score = 0;
    for (const [key, val] of Object.entries(signals)) {
      const weight = w[key as keyof SignalWeights] ?? 0;
      score += val * weight;
    }
    return { score, signals };
  }

  static momentum(closes: number[], period: number): number {
    if (closes.length < period + 1) return 0;
    const recent = closes[closes.length - 1];
    const past = closes[closes.length - period - 1];
    return past ? (recent - past) / past : 0;
  }

  static meanReversion(closes: number[], period: number): number {
    if (closes.length < period) return 0;
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const current = closes[closes.length - 1];
    return mean ? -(current - mean) / mean : 0;
  }

  static regression(closes: number[]): number {
    if (closes.length < 5) return 0;
    const n = closes.length;
    const xMean = (n - 1) / 2;
    const yMean = closes.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - xMean) * (closes[i] - yMean);
      den += (i - xMean) ** 2;
    }
    const slope = den ? num / den : 0;
    return yMean ? slope / yMean : 0;
  }

  static rsi(closes: number[], period = 14): number {
    if (closes.length < period + 1) return 50;
    let gains = 0;
    let losses = 0;
    for (let i = closes.length - period; i < closes.length; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  static macd(closes: number[]): { macd: number; macdSignal: number; macdHist: number } {
    if (closes.length < 26) return { macd: 0, macdSignal: 0, macdHist: 0 };
    const ema12 = this.ema(closes, 12);
    const ema26 = this.ema(closes, 26);
    const macd = ema12 - ema26;
    const series = this.macdSeries(closes);
    const macdSignal = series.length ? series[series.length - 1].signal : 0;
    return { macd, macdSignal, macdHist: macd - macdSignal };
  }

  private static macdSeries(closes: number[]) {
    const result: Array<{ macd: number; signal: number }> = [];
    const macdLine: number[] = [];
    for (let i = 26; i <= closes.length; i++) {
      const slice = closes.slice(0, i);
      macdLine.push(this.ema(slice, 12) - this.ema(slice, 26));
    }
    for (let i = 0; i < macdLine.length; i++) {
      const signalSlice = macdLine.slice(0, i + 1);
      const signal = signalSlice.length >= 9 ? this.ema(signalSlice, 9) : macdLine[i];
      result.push({ macd: macdLine[i], signal });
    }
    return result;
  }

  static ema(values: number[], period: number): number {
    if (!values.length) return 0;
    const k = 2 / (period + 1);
    let ema = values[0];
    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }
    return ema;
  }

  static bollingerPctB(closes: number[], period = 20): number {
    if (closes.length < period) return 0.5;
    const slice = closes.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((s, c) => s + (c - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance) || 1;
    const upper = mean + 2 * std;
    const lower = mean - 2 * std;
    const price = closes[closes.length - 1];
    return (price - lower) / (upper - lower);
  }

  static volumeRatio(volumes: number[], period = 20): number {
    if (volumes.length < period + 1) return 1;
    const recent = volumes[volumes.length - 1];
    const avg = volumes.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period;
    return avg ? recent / avg : 1;
  }

  /** Grid-search weights on train bars; returns best weights by directional accuracy */
  static tuneWeights(
    bars: OHLCVBar[],
    horizonDays: number,
    threshold: number
  ): SignalWeights {
    const presets: SignalWeights[] = [
      DEFAULT_WEIGHTS,
      { momentum: 0.3, meanReversion: 0.1, regression: 0.1, rsi: 0.2, macd: 0.2, bollinger: 0.05, volume: 0.05 },
      { momentum: 0.15, meanReversion: 0.25, regression: 0.1, rsi: 0.25, macd: 0.1, bollinger: 0.1, volume: 0.05 },
      { momentum: 0.1, meanReversion: 0.1, regression: 0.05, rsi: 0.3, macd: 0.25, bollinger: 0.15, volume: 0.05 }
    ];

    let best: SignalWeights = { ...DEFAULT_WEIGHTS };
    let bestAcc = 0;

    for (const weights of presets) {
      const acc = this.backtestAccuracy(bars, weights, horizonDays, threshold);
      if (acc > bestAcc) {
        bestAcc = acc;
        best = weights;
      }
    }
    return best;
  }

  static backtestAccuracy(
    bars: OHLCVBar[],
    weights: SignalWeights,
    horizonDays: number,
    threshold: number
  ): number {
    let correct = 0;
    let total = 0;
    const minBars = 30;

    for (let i = minBars; i < bars.length - horizonDays; i++) {
      const slice = bars.slice(0, i + 1);
      const ind = this.computeIndicators(slice);
      const { score, signals } = this.scoreFromIndicators(ind, weights);
      const direction = score > threshold ? 'BUY' : score < -threshold ? 'SELL' : 'HOLD';
      if (direction === 'HOLD') continue;

      const future = bars[i + horizonDays].close;
      const current = bars[i].close;
      const actual = future > current ? 'BUY' : 'SELL';
      if (direction === actual) correct++;
      total++;
    }
    return total ? (correct / total) * 100 : 0;
  }

  static signalAgreement(signals: Record<string, number>, score: number): number {
    const sign = Math.sign(score);
    if (sign === 0) return 0;
    const values = Object.values(signals).filter(v => Math.abs(v) > 0.0001);
    if (!values.length) return 0.5;
    const agreeing = values.filter(v => Math.sign(v) === sign).length;
    return agreeing / values.length;
  }

  static calibratedConfidence(
    score: number,
    testAccuracy: number,
    agreement: number,
    minAccuracy = 50
  ): number {
    if (testAccuracy < minAccuracy) return Math.min(55, testAccuracy * 0.5);
    const strength = Math.min(1, Math.abs(score) / 0.05);
    const raw = (testAccuracy / 100) * (0.5 + agreement * 0.5) * (0.6 + strength * 0.4) * 100;
    return Number(Math.min(95, Math.max(35, raw)).toFixed(1));
  }
}
