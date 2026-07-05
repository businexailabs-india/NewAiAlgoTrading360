import { OHLCVBar } from './historical-data.service';
import { PredictionSignals } from './prediction-signals';

export type RuleOperator = '<' | '<=' | '>' | '>=' | '==' | 'between';
export type RuleAction = 'BUY' | 'SELL' | 'HOLD';

export interface StrategyRule {
  indicator: 'rsi' | 'macd_hist' | 'momentum' | 'bollinger_pct_b' | 'volume_ratio' | 'mean_reversion' | 'price_above_sma';
  op: RuleOperator;
  value: number;
  value2?: number;
  action: RuleAction;
  weight?: number;
  period?: number;
}

export interface RuleEvalResult {
  symbol: string;
  direction: RuleAction;
  confidence: number;
  matchedRules: Array<{ rule: StrategyRule; indicatorValue: number }>;
  indicators: Record<string, number>;
}

export class StrategyRulesService {
  static evaluateRules(symbol: string, bars: OHLCVBar[], rules: StrategyRule[]): RuleEvalResult {
    if (!bars.length || !rules.length) {
      return { symbol, direction: 'HOLD', confidence: 0, matchedRules: [], indicators: {} };
    }

    const closes = bars.map(b => b.close);
    const volumes = bars.map(b => b.volume);
    const ind = PredictionSignals.computeIndicators(bars);
    const period = 20;

    const values: Record<string, number> = {
      rsi: ind.rsi,
      macd_hist: ind.macdHist,
      momentum: ind.momentum,
      bollinger_pct_b: ind.bollingerPctB,
      volume_ratio: ind.volumeRatio,
      mean_reversion: ind.meanReversion,
      price_above_sma: this.priceAboveSma(closes, period)
    };

    let buyScore = 0;
    let sellScore = 0;
    const matchedRules: RuleEvalResult['matchedRules'] = [];

    for (const rule of rules) {
      const val = values[rule.indicator];
      if (val === undefined) continue;
      if (!this.testCondition(val, rule)) continue;

      matchedRules.push({ rule, indicatorValue: val });
      const w = rule.weight ?? 1;
      if (rule.action === 'BUY') buyScore += w;
      else if (rule.action === 'SELL') sellScore += w;
    }

    let direction: RuleAction = 'HOLD';
    if (buyScore > sellScore && buyScore > 0) direction = 'BUY';
    else if (sellScore > buyScore && sellScore > 0) direction = 'SELL';

    const total = buyScore + sellScore;
    const confidence = total > 0
      ? Number(Math.min(95, 50 + (Math.max(buyScore, sellScore) / total) * 45).toFixed(1))
      : 0;

    return { symbol, direction, confidence, matchedRules, indicators: values };
  }

  static evaluateUniverse(
    symbols: string[],
    barsBySymbol: Map<string, OHLCVBar[]>,
    rules: StrategyRule[]
  ): RuleEvalResult[] {
    return symbols
      .map(symbol => this.evaluateRules(symbol, barsBySymbol.get(symbol) || [], rules))
      .filter(r => r.direction !== 'HOLD')
      .sort((a, b) => b.confidence - a.confidence);
  }

  private static testCondition(val: number, rule: StrategyRule): boolean {
    switch (rule.op) {
      case '<': return val < rule.value;
      case '<=': return val <= rule.value;
      case '>': return val > rule.value;
      case '>=': return val >= rule.value;
      case '==': return Math.abs(val - rule.value) < 0.0001;
      case 'between': return val >= rule.value && val <= (rule.value2 ?? rule.value);
      default: return false;
    }
  }

  private static priceAboveSma(closes: number[], period: number): number {
    if (closes.length < period) return 0;
    const sma = closes.slice(-period).reduce((a, b) => a + b, 0) / period;
    const price = closes[closes.length - 1];
    return sma ? (price - sma) / sma : 0;
  }

  /** Preset strategies users can clone */
  static presets(): Array<{ name: string; category: string; rules: StrategyRule[] }> {
    return [
      {
        name: 'RSI Oversold Bounce',
        category: 'mean-reversion',
        rules: [
          { indicator: 'rsi', op: '<', value: 30, action: 'BUY', weight: 2 },
          { indicator: 'rsi', op: '>', value: 70, action: 'SELL', weight: 2 },
          { indicator: 'volume_ratio', op: '>', value: 1.1, action: 'BUY', weight: 1 }
        ]
      },
      {
        name: 'MACD Momentum',
        category: 'momentum',
        rules: [
          { indicator: 'macd_hist', op: '>', value: 0, action: 'BUY', weight: 2 },
          { indicator: 'macd_hist', op: '<', value: 0, action: 'SELL', weight: 2 },
          { indicator: 'momentum', op: '>', value: 0.02, action: 'BUY', weight: 1 }
        ]
      },
      {
        name: 'Bollinger Mean Reversion',
        category: 'mean-reversion',
        rules: [
          { indicator: 'bollinger_pct_b', op: '<', value: 0.15, action: 'BUY', weight: 2 },
          { indicator: 'bollinger_pct_b', op: '>', value: 0.85, action: 'SELL', weight: 2 }
        ]
      }
    ];
  }
}
