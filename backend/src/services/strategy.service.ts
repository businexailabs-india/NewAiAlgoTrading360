import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { HistoricalDataService, OHLCVBar } from './historical-data.service';
import { PredictionSignals, SignalWeights } from './prediction-signals';
import { StrategyRulesService, StrategyRule } from './strategy-rules.service';

export interface StrategyParameters {
  symbols?: string[];
  rules?: StrategyRule[];
}

export class StrategyService {
  static async listStrategies(userId: string) {
    return prisma.strategy.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  static async getStrategy(userId: string, id: string) {
    const strategy = await prisma.strategy.findFirst({ where: { id, userId } });
    if (!strategy) throw new AppError('Strategy not found', 404);
    return strategy;
  }

  static async createStrategy(userId: string, data: {
    name: string;
    description?: string;
    category?: string;
    symbols: string[];
    rules: StrategyRule[];
  }) {
    const params: StrategyParameters = { symbols: data.symbols, rules: data.rules };
    return prisma.strategy.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        category: data.category || 'custom',
        code: JSON.stringify(data.rules),
        parameters: params as object,
        isActive: true
      }
    });
  }

  static async updateStrategy(userId: string, id: string, updates: {
    name?: string;
    description?: string;
    symbols?: string[];
    rules?: StrategyRule[];
    isActive?: boolean;
  }) {
    const existing = await this.getStrategy(userId, id);
    const params = existing.parameters as StrategyParameters;
    const newParams: StrategyParameters = {
      symbols: updates.symbols ?? params.symbols ?? [],
      rules: updates.rules ?? params.rules ?? []
    };
    return prisma.strategy.update({
      where: { id },
      data: {
        ...(updates.name && { name: updates.name }),
        ...(updates.description !== undefined && { description: updates.description }),
        ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        parameters: newParams as object,
        ...(updates.rules && { code: JSON.stringify(updates.rules) })
      }
    });
  }

  static async deleteStrategy(userId: string, id: string) {
    await this.getStrategy(userId, id);
    await prisma.strategy.delete({ where: { id } });
    return { message: 'Strategy deleted' };
  }

  static getPresets() {
    return StrategyRulesService.presets();
  }

  static async evaluateStrategy(userId: string, id: string) {
    const strategy = await this.getStrategy(userId, id);
    const params = strategy.parameters as StrategyParameters;
    const symbols = params.symbols || [];
    const rules = params.rules || JSON.parse(strategy.code || '[]') as StrategyRule[];

    const results = [];
    for (const symbol of symbols) {
      const bars = await HistoricalDataService.getBarsForSymbol(symbol, 60);
      if (bars.length < 30) continue;
      results.push(StrategyRulesService.evaluateRules(symbol, bars, rules));
    }
    return results.sort((a, b) => b.confidence - a.confidence);
  }

  static async backtestStrategy(userId: string, id: string, horizonDays = 5) {
    const strategy = await this.getStrategy(userId, id);
    const params = strategy.parameters as StrategyParameters;
    const symbols = params.symbols || [];
    const rules = params.rules || JSON.parse(strategy.code || '[]') as StrategyRule[];

    const symbolResults: Record<string, { accuracy: number; signals: number }> = {};
    let totalAcc = 0;
    let count = 0;

    for (const symbol of symbols) {
      const bars = await HistoricalDataService.getBarsForSymbol(symbol, 252);
      if (bars.length < 50) continue;

      let correct = 0;
      let total = 0;
      for (let i = 30; i < bars.length - horizonDays; i++) {
        const slice = bars.slice(0, i + 1);
        const eval_ = StrategyRulesService.evaluateRules(symbol, slice, rules);
        if (eval_.direction === 'HOLD') continue;
        const actual = bars[i + horizonDays].close > bars[i].close ? 'BUY' : 'SELL';
        if (eval_.direction === actual) correct++;
        total++;
      }
      const accuracy = total ? (correct / total) * 100 : 0;
      symbolResults[symbol] = { accuracy: Number(accuracy.toFixed(2)), signals: total };
      totalAcc += accuracy;
      count++;
    }

    const avgAccuracy = count ? totalAcc / count : 0;
    await prisma.strategy.update({
      where: { id },
      data: {
        backtestResults: {
          horizonDays,
          avgAccuracy: Number(avgAccuracy.toFixed(2)),
          symbolResults,
          testedAt: new Date().toISOString()
        } as object
      }
    });

    return { avgAccuracy: Number(avgAccuracy.toFixed(2)), symbolResults };
  }

  static async evaluateForAgent(userId: string, strategyId: string) {
    const strategy = await this.getStrategy(userId, strategyId);
    if (!strategy.isActive) return [];

    const params = strategy.parameters as StrategyParameters;
    const symbols = params.symbols || [];
    const rules = params.rules || JSON.parse(strategy.code || '[]') as StrategyRule[];

    const signals: Array<{ symbol: string; direction: string; confidence: number; source: string }> = [];
    for (const symbol of symbols) {
      const bars = await HistoricalDataService.getBarsForSymbol(symbol, 60);
      if (bars.length < 30) continue;
      const result = StrategyRulesService.evaluateRules(symbol, bars, rules);
      if (result.direction !== 'HOLD') {
        signals.push({
          symbol: result.symbol,
          direction: result.direction,
          confidence: result.confidence,
          source: `strategy:${strategy.name}`
        });
      }
    }
    return signals;
  }
}
