import { prisma } from '../../config/database';
import { AppError } from '../../middleware/error.middleware';
import {
  ALGO_CATALOG,
  ALLOWED_ALGOS_1L,
  LOCKED_ALGOS_1L,
  ONE_LAKH,
  ONE_LAKH_DEFAULT_POLICY,
  PAPER_TEST_RULES,
  midDailyTarget,
  todayDateOnly,
  type CatalogAlgo
} from './constants';

export type OnboardingInput = {
  capitalAmount?: number;
  experienceLevel?: string;
  riskTolerance?: string;
  tradingType?: string;
  preferredAlgos?: string[];
  maxAcceptableDailyLoss?: number;
  maxAcceptableMonthlyLoss?: number;
  language?: string;
};

function normalizeCapital(amount?: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return ONE_LAKH;
  return Math.round(n);
}

function policyForCapital(capital: number, experience: string) {
  const scale = capital / ONE_LAKH;
  const beginner = /beginner|moderate/i.test(experience);
  return {
    capitalAmount: capital,
    dailyProfitTargetMin: Math.round(ONE_LAKH_DEFAULT_POLICY.daily_profit_target_min * scale),
    dailyProfitTargetMax: Math.round(ONE_LAKH_DEFAULT_POLICY.daily_profit_target_max * scale),
    maxDailyLoss: Math.round(ONE_LAKH_DEFAULT_POLICY.max_daily_loss * scale),
    maxRiskPerTrade: Math.round(ONE_LAKH_DEFAULT_POLICY.max_risk_per_trade * scale),
    maxTradesPerDay: ONE_LAKH_DEFAULT_POLICY.max_trades_per_day,
    stopAfterConsecutiveLosses: ONE_LAKH_DEFAULT_POLICY.stop_after_consecutive_losses,
    allowedAlgoTypes: [...ALLOWED_ALGOS_1L],
    lockedAlgoTypes: [...LOCKED_ALGOS_1L],
    liveTradingEnabled: false,
    paperTradingEnabled: true,
    optionsSellingEnabled: beginner ? false : ONE_LAKH_DEFAULT_POLICY.options_selling_enabled,
    nakedOptionsBlocked: true,
    leverageLimited: true,
    killSwitchEnabled: true,
    killSwitchActive: false,
    noTradeMode: false
  };
}

export class RiskJourneyService {
  static async upsertRiskProfile(userId: string, body: OnboardingInput) {
    const capital = normalizeCapital(body.capitalAmount);
    const experience = body.experienceLevel || 'beginner';
    const riskTolerance = body.riskTolerance || 'moderate';
    const tradingType = body.tradingType || 'intraday';
    const maxDaily =
      body.maxAcceptableDailyLoss ?? Math.round(ONE_LAKH_DEFAULT_POLICY.max_daily_loss * (capital / ONE_LAKH));
    const maxMonthly = body.maxAcceptableMonthlyLoss ?? maxDaily * 10;

    const profile = await prisma.userRiskProfile.upsert({
      where: { userId },
      create: {
        userId,
        capitalAmount: capital,
        experienceLevel: experience,
        riskTolerance,
        tradingType,
        preferredAlgos: body.preferredAlgos || [],
        maxAcceptableDailyLoss: maxDaily,
        maxAcceptableMonthlyLoss: maxMonthly,
        language: body.language || 'en',
        completed: true
      },
      update: {
        capitalAmount: capital,
        experienceLevel: experience,
        riskTolerance,
        tradingType,
        preferredAlgos: body.preferredAlgos || [],
        maxAcceptableDailyLoss: maxDaily,
        maxAcceptableMonthlyLoss: maxMonthly,
        language: body.language || 'en',
        completed: true
      }
    });

    await prisma.riskProfile.upsert({
      where: { userId },
      create: { userId, maxDailyLoss: maxDaily, blockNakedShort: true },
      update: { maxDailyLoss: maxDaily, blockNakedShort: true }
    });

    const policy = await this.createCapitalProfile(userId, { capitalAmount: capital, experienceLevel: experience });
    const budget = await this.ensureDailyBudget(userId);
    return { profile, policy, budget };
  }

  static async getRiskProfile(userId: string) {
    const profile = await prisma.userRiskProfile.findUnique({ where: { userId } });
    if (!profile) throw new AppError('Risk profile not found — complete onboarding', 404);
    return profile;
  }

  static async createCapitalProfile(
    userId: string,
    opts?: { capitalAmount?: number; experienceLevel?: string }
  ) {
    let experience = opts?.experienceLevel;
    let capital = opts?.capitalAmount;
    if (capital == null || !experience) {
      const p = await prisma.userRiskProfile.findUnique({ where: { userId } });
      capital = capital ?? p?.capitalAmount ?? ONE_LAKH;
      experience = experience ?? p?.experienceLevel ?? 'beginner';
    }
    const data = policyForCapital(normalizeCapital(capital), experience!);
    return prisma.capitalRiskPolicy.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data }
    });
  }

  static async getCapitalPolicy(userId: string) {
    let policy = await prisma.capitalRiskPolicy.findUnique({ where: { userId } });
    if (!policy) policy = await this.createCapitalProfile(userId);
    return policy;
  }

  static async ensureDailyBudget(userId: string, tradingDate = todayDateOnly()) {
    const policy = await this.getCapitalPolicy(userId);
    const target = midDailyTarget(policy.dailyProfitTargetMin, policy.dailyProfitTargetMax);
    return prisma.dailyRiskBudget.upsert({
      where: { userId_tradingDate: { userId, tradingDate } },
      create: {
        userId,
        tradingDate,
        openingCapital: policy.capitalAmount,
        dailyTarget: target,
        maxDailyLoss: policy.maxDailyLoss,
        status: policy.killSwitchActive ? 'KILL_SWITCH' : policy.noTradeMode ? 'NO_TRADE' : 'ACTIVE'
      },
      update: {
        openingCapital: policy.capitalAmount,
        dailyTarget: target,
        maxDailyLoss: policy.maxDailyLoss
      }
    });
  }

  static async getTodayBudget(userId: string) {
    return this.ensureDailyBudget(userId);
  }

  static async refreshBudgetFromOrders(userId: string) {
    const budget = await this.ensureDailyBudget(userId);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const orders = await prisma.order.findMany({
      where: { userId, createdAt: { gte: start }, status: { notIn: ['REJECTED', 'CANCELLED'] } },
      orderBy: { createdAt: 'asc' }
    });

    let pnl = 0;
    let wins = 0;
    let losses = 0;
    let consec = 0;
    let riskUsed = 0;
    for (const o of orders) {
      const meta = (o.meta as { realizedPnl?: number; riskAmount?: number } | null) || {};
      const tradePnl = Number(meta.realizedPnl ?? 0);
      const risk = Number(meta.riskAmount ?? o.quantity * Number(o.price || 0) * 0.01);
      riskUsed += Math.max(0, risk);
      if (tradePnl > 0) {
        wins += 1;
        consec = 0;
        pnl += tradePnl;
      } else if (tradePnl < 0) {
        losses += 1;
        consec += 1;
        pnl += tradePnl;
      }
    }

    const policy = await this.getCapitalPolicy(userId);
    let status = budget.status;
    if (policy.killSwitchActive) status = 'KILL_SWITCH';
    else if (policy.noTradeMode) status = 'NO_TRADE';
    else if (pnl <= -policy.maxDailyLoss) status = 'LOSS_LIMIT';
    else if (consec >= policy.stopAfterConsecutiveLosses) status = 'STOPPED';
    else if (pnl >= budget.dailyTarget) status = 'TARGET_HIT';
    else status = 'ACTIVE';

    return prisma.dailyRiskBudget.update({
      where: { id: budget.id },
      data: {
        tradesTaken: orders.length,
        winningTrades: wins,
        losingTrades: losses,
        consecutiveLosses: consec,
        currentPnl: pnl,
        riskUsed,
        status
      }
    });
  }

  static scoreAlgo(
    algo: CatalogAlgo,
    opts: {
      capital: number;
      experience: string;
      riskTolerance: string;
      paperScore?: number;
      marketFit?: number;
    }
  ) {
    const lockedNames = new Set(LOCKED_ALGOS_1L.map((x) => x.toLowerCase()));
    const allowedNames = new Set(ALLOWED_ALGOS_1L.map((x) => x.toLowerCase()));
    const beginner = /beginner|moderate/i.test(opts.experience);

    let recommendationStatus: 'RECOMMENDED' | 'CAUTION' | 'LOCKED' = 'RECOMMENDED';
    const reasons: string[] = [];

    if (
      lockedNames.has(algo.name.toLowerCase()) ||
      algo.martingale ||
      (beginner && (algo.optionsSelling || algo.naked || algo.leverageHeavy))
    ) {
      recommendationStatus = 'LOCKED';
      reasons.push('Blocked for 1L beginner/moderate risk policy');
    } else if (!allowedNames.has(algo.name.toLowerCase()) && algo.riskLevel > 0.6) {
      recommendationStatus = 'CAUTION';
      reasons.push('Elevated risk vs capital tier');
    }

    const capitalFit = Math.min(1, opts.capital / Math.max(algo.capitalMin, 1));
    const riskFit = Math.max(0, 1 - algo.riskLevel * (/aggressive/i.test(opts.riskTolerance) ? 0.7 : 1));
    const marketConditionFit = opts.marketFit ?? 0.7;
    const complexityScore = Math.max(0, 1 - algo.complexity);
    const paperTestScore = opts.paperScore ?? 0.5;
    const finalScore =
      recommendationStatus === 'LOCKED'
        ? 0
        : Number(
            (
              capitalFit * 0.25 +
              riskFit * 0.3 +
              marketConditionFit * 0.15 +
              complexityScore * 0.15 +
              paperTestScore * 0.15
            ).toFixed(3)
          );

    if (recommendationStatus !== 'LOCKED' && finalScore < 0.45) {
      recommendationStatus = 'CAUTION';
      reasons.push('Low composite suitability score');
    }
    if (!reasons.length) reasons.push('Fits 1L capital and risk budget');

    return {
      algoId: algo.id,
      name: algo.name,
      capitalFit: Number(capitalFit.toFixed(3)),
      riskFit: Number(riskFit.toFixed(3)),
      marketConditionFit,
      complexityScore: Number(complexityScore.toFixed(3)),
      paperTestScore,
      finalScore,
      recommendationStatus,
      reason: reasons.join('; ')
    };
  }

  static async recommendAlgos(userId: string) {
    const profile = await prisma.userRiskProfile.findUnique({ where: { userId } });
    const policy = await this.getCapitalPolicy(userId);
    const paper = await this.evaluatePaperTest(userId);
    const scores = ALGO_CATALOG.map((algo) =>
      this.scoreAlgo(algo, {
        capital: policy.capitalAmount,
        experience: profile?.experienceLevel || 'beginner',
        riskTolerance: profile?.riskTolerance || 'moderate',
        paperScore: paper.passed ? 0.85 : 0.4
      })
    );

    await Promise.all(
      scores.map((s) =>
        prisma.algoSuitabilityScore.upsert({
          where: { userId_algoId: { userId, algoId: s.algoId } },
          create: {
            userId,
            algoId: s.algoId,
            capitalFit: s.capitalFit,
            riskFit: s.riskFit,
            marketConditionFit: s.marketConditionFit,
            complexityScore: s.complexityScore,
            paperTestScore: s.paperTestScore,
            finalScore: s.finalScore,
            recommendationStatus: s.recommendationStatus,
            reason: s.reason
          },
          update: {
            capitalFit: s.capitalFit,
            riskFit: s.riskFit,
            marketConditionFit: s.marketConditionFit,
            complexityScore: s.complexityScore,
            paperTestScore: s.paperTestScore,
            finalScore: s.finalScore,
            recommendationStatus: s.recommendationStatus,
            reason: s.reason
          }
        })
      )
    );

    return {
      capital: policy.capitalAmount,
      recommended: scores.filter((s) => s.recommendationStatus === 'RECOMMENDED'),
      caution: scores.filter((s) => s.recommendationStatus === 'CAUTION'),
      locked: scores.filter((s) => s.recommendationStatus === 'LOCKED'),
      all: scores
    };
  }

  static async scoreAlgoForUser(userId: string, algoId: string) {
    const algo = ALGO_CATALOG.find((a) => a.id === algoId || a.name === algoId);
    if (!algo) throw new AppError(`Unknown algo: ${algoId}`, 404);
    const profile = await prisma.userRiskProfile.findUnique({ where: { userId } });
    const policy = await this.getCapitalPolicy(userId);
    const paper = await this.evaluatePaperTest(userId);
    const scored = this.scoreAlgo(algo, {
      capital: policy.capitalAmount,
      experience: profile?.experienceLevel || 'beginner',
      riskTolerance: profile?.riskTolerance || 'moderate',
      paperScore: paper.passed ? 0.85 : 0.4
    });
    await prisma.algoSuitabilityScore.upsert({
      where: { userId_algoId: { userId, algoId: scored.algoId } },
      create: {
        userId,
        algoId: scored.algoId,
        capitalFit: scored.capitalFit,
        riskFit: scored.riskFit,
        marketConditionFit: scored.marketConditionFit,
        complexityScore: scored.complexityScore,
        paperTestScore: scored.paperTestScore,
        finalScore: scored.finalScore,
        recommendationStatus: scored.recommendationStatus,
        reason: scored.reason
      },
      update: {
        capitalFit: scored.capitalFit,
        riskFit: scored.riskFit,
        marketConditionFit: scored.marketConditionFit,
        complexityScore: scored.complexityScore,
        paperTestScore: scored.paperTestScore,
        finalScore: scored.finalScore,
        recommendationStatus: scored.recommendationStatus,
        reason: scored.reason
      }
    });
    return scored;
  }

  static async evaluatePaperTest(userId: string) {
    const startWindow = new Date();
    startWindow.setDate(startWindow.getDate() - 90);
    const paperOrders = await prisma.order.findMany({
      where: {
        userId,
        isPaper: true,
        createdAt: { gte: startWindow },
        status: { notIn: ['REJECTED', 'CANCELLED'] }
      },
      orderBy: { createdAt: 'asc' }
    });
    const days = new Set(paperOrders.map((o) => o.createdAt.toISOString().slice(0, 10)));
    const policy = await this.getCapitalPolicy(userId);
    const profile = await prisma.userRiskProfile.findUnique({ where: { userId } });

    let equity = policy.capitalAmount;
    let peak = equity;
    let maxDd = 0;
    for (const o of paperOrders) {
      const pnl = Number(((o.meta as { realizedPnl?: number } | null) || {}).realizedPnl || 0);
      equity += pnl;
      peak = Math.max(peak, equity);
      if (peak > 0) maxDd = Math.max(maxDd, ((peak - equity) / peak) * 100);
    }

    const stopLossPresent = true;
    const riskRulesPresent = !!profile?.completed && !!policy;
    const blockers: string[] = [];
    if (paperOrders.length < PAPER_TEST_RULES.minPaperTrades) {
      blockers.push(`Need ${PAPER_TEST_RULES.minPaperTrades} paper trades (have ${paperOrders.length})`);
    }
    if (days.size < PAPER_TEST_RULES.minPaperDays) {
      blockers.push(`Need ${PAPER_TEST_RULES.minPaperDays} paper trading days (have ${days.size})`);
    }
    if (maxDd > PAPER_TEST_RULES.maxDrawdownPctForUnlock) {
      blockers.push(`Max drawdown ${maxDd.toFixed(2)}% exceeds ${PAPER_TEST_RULES.maxDrawdownPctForUnlock}%`);
    }
    if (!stopLossPresent) blockers.push('Stop-loss missing');
    if (!riskRulesPresent) blockers.push('Risk rules / profile incomplete');

    return {
      paperTradesCount: paperOrders.length,
      paperTradingDays: days.size,
      maxDrawdownPct: Number(maxDd.toFixed(2)),
      stopLossPresent,
      riskRulesPresent,
      passed: blockers.length === 0,
      blockers
    };
  }

  static async requestLiveUnlock(userId: string, body?: { userApproval?: boolean }) {
    const paper = await this.evaluatePaperTest(userId);
    const profile = await prisma.userRiskProfile.findUnique({ where: { userId } });
    const blockers = [...paper.blockers];
    if (!profile?.completed) blockers.push('User risk profile incomplete');
    if (!body?.userApproval) blockers.push('User approval missing');

    const status = blockers.length ? 'LOCKED' : 'PENDING';
    const row = await prisma.liveUnlockRequest.upsert({
      where: { userId },
      create: {
        userId,
        status,
        paperTradesCount: paper.paperTradesCount,
        paperTradingDays: paper.paperTradingDays,
        maxDrawdownPct: paper.maxDrawdownPct,
        stopLossPresent: paper.stopLossPresent,
        riskRulesPresent: paper.riskRulesPresent,
        userApproval: !!body?.userApproval,
        blockers,
        reason: blockers.length ? blockers.join('; ') : 'Awaiting admin RMS approval',
        requestedAt: new Date()
      },
      update: {
        status,
        paperTradesCount: paper.paperTradesCount,
        paperTradingDays: paper.paperTradingDays,
        maxDrawdownPct: paper.maxDrawdownPct,
        stopLossPresent: paper.stopLossPresent,
        riskRulesPresent: paper.riskRulesPresent,
        userApproval: !!body?.userApproval,
        blockers,
        reason: blockers.length ? blockers.join('; ') : 'Awaiting admin RMS approval',
        requestedAt: new Date()
      }
    });

    await prisma.capitalRiskPolicy.updateMany({
      where: { userId },
      data: { liveTradingEnabled: false }
    });

    return row;
  }

  static async getLiveUnlockStatus(userId: string) {
    let row = await prisma.liveUnlockRequest.findUnique({ where: { userId } });
    if (!row) {
      const paper = await this.evaluatePaperTest(userId);
      row = await prisma.liveUnlockRequest.create({
        data: {
          userId,
          status: 'LOCKED',
          paperTradesCount: paper.paperTradesCount,
          paperTradingDays: paper.paperTradingDays,
          maxDrawdownPct: paper.maxDrawdownPct,
          stopLossPresent: paper.stopLossPresent,
          riskRulesPresent: paper.riskRulesPresent,
          blockers: ['Live trading locked until paper testing, risk profile, and approval are complete'],
          reason: 'Default locked for 1L capital journey'
        }
      });
    }
    const policy = await this.getCapitalPolicy(userId);
    return {
      ...row,
      liveTradingEnabled: policy.liveTradingEnabled,
      paperTradingEnabled: policy.paperTradingEnabled
    };
  }

  static async triggerKillSwitch(userId: string, reason = 'Manual kill switch') {
    const policy = await prisma.capitalRiskPolicy.upsert({
      where: { userId },
      create: { userId, ...policyForCapital(ONE_LAKH, 'beginner'), killSwitchActive: true, noTradeMode: true },
      update: { killSwitchActive: true, noTradeMode: true }
    });
    const existingCtrl = await prisma.tradingControl.findFirst({ where: { scope: 'USER', userId } });
    if (existingCtrl) {
      await prisma.tradingControl.update({
        where: { id: existingCtrl.id },
        data: { killSwitch: true, liveTradingEnabled: false }
      });
    } else {
      await prisma.tradingControl.create({
        data: {
          scope: 'USER',
          userId,
          killSwitch: true,
          liveTradingEnabled: false,
          approvalState: 'NONE'
        }
      });
    }
    await prisma.riskEvent.create({
      data: {
        userId,
        kind: 'KILL_SWITCH',
        severity: 'CRITICAL',
        reason,
        corrective: 'Review control room before re-enable'
      }
    });
    const budget = await this.ensureDailyBudget(userId);
    await prisma.dailyRiskBudget.update({
      where: { id: budget.id },
      data: { status: 'KILL_SWITCH' }
    });
    return { policy, message: 'Kill switch active — all trading halted' };
  }

  static async enableNoTradeMode(userId: string, reason = 'No-trade advisory') {
    const policy = await prisma.capitalRiskPolicy.upsert({
      where: { userId },
      create: { userId, ...policyForCapital(ONE_LAKH, 'beginner'), noTradeMode: true },
      update: { noTradeMode: true }
    });
    await prisma.riskEvent.create({
      data: {
        userId,
        kind: 'NO_TRADE_MODE',
        severity: 'WARN',
        reason,
        corrective: 'Resume only after risk review'
      }
    });
    const budget = await this.ensureDailyBudget(userId);
    await prisma.dailyRiskBudget.update({
      where: { id: budget.id },
      data: { status: 'NO_TRADE' }
    });
    return { policy, message: 'No-trade mode enabled' };
  }

  static async controlRoomStatus(userId: string) {
    const policy = await this.getCapitalPolicy(userId);
    const budget = await this.refreshBudgetFromOrders(userId);
    const unlock = await this.getLiveUnlockStatus(userId);
    const agents = await prisma.tradingAgent.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, mode: true }
    });
    const riskUsedPercent =
      budget.maxDailyLoss > 0
        ? Number(
            (Math.min(100, (Math.abs(Math.min(0, budget.currentPnl)) / budget.maxDailyLoss) * 100)).toFixed(1)
          )
        : 0;

    let recommendation = 'Trade within Rs 300-700 daily target. Stop at Rs 1,000 max loss.';
    if (policy.killSwitchActive) recommendation = 'Kill switch ON — do not trade.';
    else if (policy.noTradeMode) recommendation = 'No-trade mode — review risk before resuming.';
    else if (budget.status === 'LOSS_LIMIT') recommendation = 'Daily loss limit hit — stop for today.';
    else if (budget.consecutiveLosses >= policy.stopAfterConsecutiveLosses) {
      recommendation = 'Two consecutive losses — stop trading today.';
    } else if (!unlock.liveTradingEnabled) {
      recommendation = 'Paper-first. Live locked until paper test + approval.';
    }

    return {
      user_id: userId,
      capital: policy.capitalAmount,
      today_pnl: budget.currentPnl,
      daily_target: budget.dailyTarget,
      daily_target_range: {
        min: policy.dailyProfitTargetMin,
        max: policy.dailyProfitTargetMax
      },
      max_daily_loss: budget.maxDailyLoss,
      max_risk_per_trade: policy.maxRiskPerTrade,
      risk_used: budget.riskUsed,
      risk_used_percent: riskUsedPercent,
      trades_taken: budget.tradesTaken,
      max_trades: policy.maxTradesPerDay,
      consecutive_losses: budget.consecutiveLosses,
      stop_after_consecutive_losses: policy.stopAfterConsecutiveLosses,
      active_algos: agents,
      mode: policy.liveTradingEnabled ? 'LIVE' : 'PAPER',
      kill_switch_status: policy.killSwitchActive ? 'ACTIVE' : 'OFF',
      no_trade_mode: policy.noTradeMode,
      budget_status: budget.status,
      live_unlock: unlock.status,
      recommendation
    };
  }

  static async assertTradeAllowed(input: {
    userId: string;
    isPaper: boolean;
    estimatedValue: number;
    tradeType: 'BUY' | 'SELL';
    instrumentType?: string;
    optionsSelling?: boolean;
    nakedOption?: boolean;
    stopLossMissing?: boolean;
    brokerConnected?: boolean;
    marketDataStale?: boolean;
    algoName?: string;
    riskAmount?: number;
  }): Promise<{ allowed: boolean; blockers: string[] }> {
    const blockers: string[] = [];
    const profile = await prisma.userRiskProfile.findUnique({ where: { userId: input.userId } });
    if (!profile?.completed) blockers.push('User risk profile incomplete');

    const policy = await this.getCapitalPolicy(input.userId);
    const budget = await this.refreshBudgetFromOrders(input.userId);

    if (policy.killSwitchEnabled && policy.killSwitchActive) blockers.push('Kill switch active');
    if (policy.noTradeMode) blockers.push('No-trade mode enabled');
    if (!input.isPaper && !policy.liveTradingEnabled) blockers.push('Live trading disabled');
    if (!input.isPaper) {
      const unlock = await this.getLiveUnlockStatus(input.userId);
      if (unlock.status !== 'APPROVED') {
        blockers.push('Live trading locked — paper test / approval incomplete');
      }
    }
    if (!policy.paperTradingEnabled && input.isPaper) blockers.push('Paper trading disabled');

    if (budget.status === 'LOSS_LIMIT' || budget.currentPnl <= -policy.maxDailyLoss) {
      blockers.push('Daily loss limit hit');
    }
    if (budget.consecutiveLosses >= policy.stopAfterConsecutiveLosses) {
      blockers.push(`${policy.stopAfterConsecutiveLosses} consecutive losses hit`);
    }
    if (budget.tradesTaken >= policy.maxTradesPerDay) blockers.push('Max trades per day exceeded');

    const proxyRisk = input.riskAmount ?? input.estimatedValue * 0.02;
    if (proxyRisk > policy.maxRiskPerTrade) {
      blockers.push(`Order exceeds max risk per trade (Rs ${policy.maxRiskPerTrade})`);
    }

    if (input.stopLossMissing) blockers.push('Stop-loss missing');
    if (input.brokerConnected === false && !input.isPaper) blockers.push('Broker disconnected');
    if (input.marketDataStale) blockers.push('Market data stale');

    if (input.optionsSelling || input.nakedOption) {
      if (!policy.optionsSellingEnabled) blockers.push('Options selling disabled for this capital tier');
      if (policy.nakedOptionsBlocked && input.nakedOption) blockers.push('Naked options blocked');
      if (profile && /beginner/i.test(profile.experienceLevel) && input.optionsSelling) {
        blockers.push('Options selling attempted by beginner');
      }
    }

    if (input.algoName) {
      const locked = (policy.lockedAlgoTypes as string[]).map((x) => x.toLowerCase());
      if (locked.includes(input.algoName.toLowerCase())) {
        blockers.push(`Algo locked: ${input.algoName}`);
      }
    }

    return { allowed: blockers.length === 0, blockers };
  }

  static dhanLaxmiRiskReply(message: string, language = 'hinglish'): {
    blocked: boolean;
    reply: string;
    language: string;
  } {
    const hinglishProfit =
      'With Rs 1 lakh capital, a realistic target is Rs 300-700/day with Rs 500-1,000 max daily risk. Profit is not guaranteed.';
    const odiaProfit =
      'With Rs 1 lakh capital, realistic daily target is Rs 300-700 with max daily risk Rs 500-1000. Profit is not guaranteed. (Odia)';
    const hinglishDouble =
      'This is blocked because it violates risk policy and may increase losses.';
    const odiaDouble =
      'This is blocked because it violates risk policy and may increase losses. (Odia)';
    const hinglishLive =
      'Live trading is locked until paper testing, risk profile, and approval are complete.';
    const odiaLive =
      'Live trading is locked until paper testing, risk profile, and approval are complete. (Odia)';

    const useOdia = language === 'odia' || /odia/i.test(message);

    if (/kitna profit|expect.*profit|profit expect|how much profit/i.test(message)) {
      return {
        blocked: false,
        reply: useOdia ? odiaProfit : hinglishProfit,
        language: useOdia ? 'odia' : 'hinglish'
      };
    }
    if (/double quantity|double after loss|loss recover|martingale/i.test(message)) {
      return {
        blocked: true,
        reply: useOdia ? odiaDouble : hinglishDouble,
        language: useOdia ? 'odia' : 'hinglish'
      };
    }
    if (/start live|live trading|enable live/i.test(message)) {
      return {
        blocked: true,
        reply: useOdia ? odiaLive : hinglishLive,
        language: useOdia ? 'odia' : 'hinglish'
      };
    }
    return {
      blocked: false,
      reply: useOdia
        ? 'Rs 1 lakh journey: paper-first, target Rs 300-700/day, max loss Rs 1,000. (Odia)'
        : 'Rs 1 lakh journey: paper-first, target Rs 300-700/day, max loss Rs 1,000. Ask about profit, live unlock, or risk.',
      language: useOdia ? 'odia' : 'hinglish'
    };
  }
}
