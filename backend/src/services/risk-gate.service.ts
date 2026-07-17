import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { isMarketOpen } from '../utils/helpers';
import { ResolvedExecutionTarget } from './execution-target.resolver';

export interface PreTradeCheckInput {
  userId: string;
  symbol: string;
  tradeType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  isPaper: boolean;
  source: string;
  idempotencyKey?: string;
  target: ResolvedExecutionTarget;
}

export interface PreTradeCheckResult {
  allowed: boolean;
  estimatedValue: number;
  warnings: string[];
  controls: {
    liveTradingEnabled: boolean;
    killSwitch: boolean;
    approvalState: string;
    maxOrderValue: number | null;
    maxDailyOrderValue: number | null;
  };
}

async function getEffectiveControls(userId: string, brokerConnectionId?: string | null) {
  const [globalCtrl, userCtrl, accountCtrl] = await Promise.all([
    prisma.tradingControl.findFirst({ where: { scope: 'GLOBAL', userId: null, brokerConnectionId: null } }),
    prisma.tradingControl.findFirst({ where: { scope: 'USER', userId } }),
    brokerConnectionId
      ? prisma.tradingControl.findFirst({ where: { scope: 'ACCOUNT', userId, brokerConnectionId } })
      : null
  ]);

  const envLive = process.env.LIVE_TRADING_ENABLED === 'true';
  return {
    liveTradingEnabled:
      envLive &&
      (globalCtrl?.liveTradingEnabled ?? false) &&
      (userCtrl?.liveTradingEnabled ?? true) &&
      (accountCtrl?.liveTradingEnabled ?? true),
    killSwitch:
      !!(globalCtrl?.killSwitch || userCtrl?.killSwitch || accountCtrl?.killSwitch),
    approvalState: accountCtrl?.approvalState || userCtrl?.approvalState || globalCtrl?.approvalState || 'NONE',
    maxOrderValue: Number(accountCtrl?.maxOrderValue ?? userCtrl?.maxOrderValue ?? globalCtrl?.maxOrderValue ?? 0) || null,
    maxDailyOrderValue:
      Number(accountCtrl?.maxDailyOrderValue ?? userCtrl?.maxDailyOrderValue ?? globalCtrl?.maxDailyOrderValue ?? 0) || null,
    maxDailyLoss: Number(accountCtrl?.maxDailyLoss ?? userCtrl?.maxDailyLoss ?? globalCtrl?.maxDailyLoss ?? 0) || null,
    requirePaperQualify: globalCtrl?.requirePaperQualify ?? true
  };
}

export class RiskGateService {
  static async ensureGlobalControl() {
    const existing = await prisma.tradingControl.findFirst({
      where: { scope: 'GLOBAL', userId: null, brokerConnectionId: null }
    });
    if (existing) return existing;
    return prisma.tradingControl.create({
      data: {
        scope: 'GLOBAL',
        liveTradingEnabled: false,
        killSwitch: false,
        approvalState: 'NONE',
        requirePaperQualify: true,
        maxOrderValue: 100000,
        maxDailyOrderValue: 500000,
        maxDailyLoss: 25000
      }
    });
  }

  static async preflight(input: PreTradeCheckInput): Promise<PreTradeCheckResult> {
    await this.ensureGlobalControl();
    const controls = await getEffectiveControls(input.userId, input.target.brokerConnectionId);
    const warnings: string[] = [];
    const estimatedValue = input.quantity * (input.price || 0);

    if (input.idempotencyKey) {
      const dup = await prisma.executionAttempt.findUnique({
        where: { userId_idempotencyKey: { userId: input.userId, idempotencyKey: input.idempotencyKey } }
      });
      if (dup) throw new AppError('Duplicate idempotency key — order already submitted', 409);
    }

    if (input.quantity <= 0) throw new AppError('Quantity must be positive', 400);
    if (!input.symbol?.trim()) throw new AppError('Symbol is required', 400);

    if (!input.isPaper) {
      if (controls.killSwitch) throw new AppError('Live trading kill switch is active', 403);
      if (!controls.liveTradingEnabled) {
        throw new AppError('Live trading is disabled. Keep paper mode or get admin approval.', 403);
      }
      if (controls.approvalState !== 'APPROVED') {
        throw new AppError('Live trading not approved for this account/user', 403);
      }
      if (!input.target.brokerConnectionId) {
        throw new AppError('Live order requires a selected active account', 400);
      }
      if (!isMarketOpen()) {
        warnings.push('Market appears closed (IST weekday window)');
      }
      if (controls.maxOrderValue && estimatedValue > controls.maxOrderValue) {
        throw new AppError(`Order value ${estimatedValue} exceeds max order value ${controls.maxOrderValue}`, 400);
      }
      if (controls.maxDailyOrderValue) {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const todays = await prisma.order.findMany({
          where: {
            userId: input.userId,
            isPaper: false,
            createdAt: { gte: start },
            status: { notIn: ['REJECTED', 'CANCELLED'] }
          }
        });
        const spent = todays.reduce((s, o) => s + o.quantity * Number(o.price || 0), 0);
        if (spent + estimatedValue > controls.maxDailyOrderValue) {
          throw new AppError('Daily order value limit exceeded', 400);
        }
      }

      // Optional funds check via adapter
      try {
        if (input.target.mcp) {
          await input.target.mcp.getFunds();
        } else if (input.target.direct) {
          await input.target.direct.getFunds();
        }
      } catch (err) {
        warnings.push(`Funds probe failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      allowed: true,
      estimatedValue,
      warnings,
      controls: {
        liveTradingEnabled: controls.liveTradingEnabled,
        killSwitch: controls.killSwitch,
        approvalState: controls.approvalState,
        maxOrderValue: controls.maxOrderValue,
        maxDailyOrderValue: controls.maxDailyOrderValue
      }
    };
  }
}
