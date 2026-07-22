import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { RiskGateService } from './risk-gate.service';
import { ExecutionTargetResolver } from './execution-target.resolver';

export type TradingMode = 'paper' | 'live';

const COOLDOWN_MS = 60_000;

type ModeSettings = {
  tradingMode?: TradingMode;
  tradingPinHash?: string;
  liveModeSwitchedAt?: string;
  modeAudit?: Array<{ at: string; from: string; to: string }>;
};

async function getSettingsJson(userId: string): Promise<ModeSettings> {
  const row = await prisma.userSettings.findUnique({ where: { userId } });
  const settings = (row?.settings as ModeSettings) || {};
  return settings && typeof settings === 'object' ? settings : {};
}

async function saveSettingsJson(userId: string, next: ModeSettings) {
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, settings: next as object },
    update: { settings: next as object }
  });
}

export class TradingModeService {
  static async getMode(userId: string) {
    const settings = await getSettingsJson(userId);
    const brokers = await this.getBrokersStatus(userId);
    const mode: TradingMode = settings.tradingMode === 'live' ? 'live' : 'paper';
    // Self-heal: executionMode must match TradingMode (TopBar / PIN is canonical).
    await this.syncExecutionMode(userId).catch(() => undefined);
    return {
      mode,
      executionMode: mode === 'live' ? 'LIVE' : 'PAPER',
      hasTradingPin: !!settings.tradingPinHash,
      liveLocked: !brokers.hasConnectedBroker,
      liveEnabled: brokers.liveTradingEnabled && brokers.hasConnectedBroker,
      cooldownUntil: settings.liveModeSwitchedAt
        ? new Date(new Date(settings.liveModeSwitchedAt).getTime() + COOLDOWN_MS).toISOString()
        : null,
      brokers
    };
  }

  static async getBrokersStatus(userId: string) {
    const connections = await prisma.brokerConnection.findMany({
      where: { userId, isActive: true },
      select: {
        id: true,
        broker: true,
        displayName: true,
        status: true,
        expiresAt: true,
        lastValidatedAt: true,
        lastError: true,
        isEnabled: true
      }
    });
    await RiskGateService.ensureGlobalControl();
    const globalCtrl = await prisma.tradingControl.findFirst({
      where: { scope: 'GLOBAL', userId: null, brokerConnectionId: null }
    });
    const userCtrl = await prisma.tradingControl.findFirst({ where: { scope: 'USER', userId } });
    const envLive = process.env.LIVE_TRADING_ENABLED === 'true';
    const featureLiveOptions = process.env.FEATURE_LIVE_OPTIONS === 'true';
    const liveTradingEnabled =
      envLive &&
      (globalCtrl?.liveTradingEnabled ?? false) &&
      (userCtrl?.liveTradingEnabled ?? true);

    return {
      hasConnectedBroker: connections.length > 0,
      connections: connections.map((c) => ({
        id: c.id,
        broker: c.broker,
        displayName: c.displayName,
        status: c.status,
        isEnabled: c.isEnabled,
        tokenExpiresAt: c.expiresAt,
        lastValidatedAt: c.lastValidatedAt,
        lastError: c.lastError,
        tokenExpired: c.expiresAt ? c.expiresAt.getTime() < Date.now() : false
      })),
      liveTradingEnabled,
      featureLiveOptions,
      killSwitch: !!(globalCtrl?.killSwitch || userCtrl?.killSwitch),
      approvalState: userCtrl?.approvalState || globalCtrl?.approvalState || 'NONE'
    };
  }

  static async setTradingPin(userId: string, pin: string, currentPin?: string) {
    if (!/^\d{4,8}$/.test(pin)) {
      throw new AppError('Trading PIN must be 4–8 digits', 400);
    }
    const settings = await getSettingsJson(userId);
    if (settings.tradingPinHash) {
      if (!currentPin || !(await bcrypt.compare(String(currentPin), settings.tradingPinHash))) {
        throw new AppError('Current Trading PIN is incorrect', 403);
      }
    }
    const tradingPinHash = await bcrypt.hash(pin, 10);
    await saveSettingsJson(userId, { ...settings, tradingPinHash });
    return { hasTradingPin: true };
  }

  static async switchMode(
    userId: string,
    input: { mode: string; pin: string; confirmLive?: boolean }
  ) {
    const next = String(input.mode || '').toLowerCase() as TradingMode;
    if (next !== 'paper' && next !== 'live') {
      throw new AppError('mode must be paper or live', 400);
    }

    const settings = await getSettingsJson(userId);
    const current: TradingMode = settings.tradingMode === 'live' ? 'live' : 'paper';
    if (current === next) {
      return this.getMode(userId);
    }

    if (!settings.tradingPinHash) {
      throw new AppError('Set a Trading PIN before switching modes', 400);
    }
    if (!input.pin || !(await bcrypt.compare(input.pin, settings.tradingPinHash))) {
      throw new AppError('Invalid Trading PIN', 403);
    }

    if (settings.liveModeSwitchedAt) {
      const until = new Date(settings.liveModeSwitchedAt).getTime() + COOLDOWN_MS;
      if (Date.now() < until) {
        throw new AppError(`Mode switch cooldown active until ${new Date(until).toISOString()}`, 429);
      }
    }

    if (next === 'live') {
      if (!input.confirmLive) {
        throw new AppError('confirmLive is required to enter LIVE MODE', 400);
      }
      const brokers = await this.getBrokersStatus(userId);
      if (!brokers.hasConnectedBroker) {
        throw new AppError('Connect a broker before entering LIVE MODE', 403);
      }
      if (!brokers.liveTradingEnabled) {
        throw new AppError('Live trading is not enabled for this account', 403);
      }
      if (brokers.killSwitch) {
        throw new AppError('Kill switch is active — live trading blocked', 403);
      }
    }

    const audit = Array.isArray(settings.modeAudit) ? settings.modeAudit.slice(-49) : [];
    audit.push({ at: new Date().toISOString(), from: current, to: next });

    await saveSettingsJson(userId, {
      ...settings,
      tradingMode: next,
      liveModeSwitchedAt: new Date().toISOString(),
      modeAudit: audit
    });

    // Keep UserExecutionContext.executionMode in lockstep with TradingMode (single source of truth).
    await ExecutionTargetResolver.setContext(userId, {
      executionMode: next === 'live' ? 'LIVE' : 'PAPER'
    });

    return this.getMode(userId);
  }

  /** Align executionMode column with TradingMode settings (self-heal drift). */
  static async syncExecutionMode(userId: string) {
    const settings = await getSettingsJson(userId);
    const mode: TradingMode = settings.tradingMode === 'live' ? 'live' : 'paper';
    const ctx = await ExecutionTargetResolver.getOrCreateContext(userId);
    const want = mode === 'live' ? 'LIVE' : 'PAPER';
    if (ctx.executionMode !== want) {
      await ExecutionTargetResolver.setContext(userId, { executionMode: want });
    }
    return { tradingMode: mode, executionMode: want };
  }
}
