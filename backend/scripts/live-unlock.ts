/**
 * Controlled Live Options Unlock (readiness + optional preview)
 *
 * Default: NEVER places a live broker order.
 *
 * Typical:
 *   set APPLY_CONTROLS=true
 *   npm run test:unlock:live
 *
 * Optional real submit (dangerous):
 *   LIVE_UNLOCK_SUBMIT=true
 *   LIVE_UNLOCK_I_UNDERSTAND_REAL_MONEY=YES
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/config/database';
import { RiskGateService } from '../src/services/risk-gate.service';
import { TradingModeService } from '../src/services/trading-mode.service';
import { LiveOptionsService } from '../src/services/options/live-options.service';
import { ExecutionTargetResolver } from '../src/services/execution-target.resolver';
import { InstrumentMasterService } from '../src/services/options/instrument-master.service';
import { IntegrationService } from '../src/services/integration.service';
import { DhanService } from '../src/services/dhan.service';

type Check = { id: string; title: string; pass: boolean; detail: string };

const checks: Check[] = [];
const PIN = process.env.UNLOCK_PIN || '2468';
const APPLY = process.env.APPLY_CONTROLS === 'true';
const WANT_SUBMIT =
  process.env.LIVE_UNLOCK_SUBMIT === 'true' &&
  process.env.LIVE_UNLOCK_I_UNDERSTAND_REAL_MONEY === 'YES';

function record(id: string, title: string, pass: boolean, detail: string) {
  checks.push({ id, title, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${id} — ${title}${detail ? `: ${detail}` : ''}`);
}

function isRealDhanConn(c: {
  broker: string;
  displayName: string | null;
  providerType: string;
}) {
  const name = `${c.broker} ${c.displayName || ''}`.toLowerCase();
  if (name.includes('paper')) return false;
  return c.broker.toLowerCase().includes('dhan') || c.providerType === 'DIRECT' || c.providerType === 'MCP';
}

async function upsertControl(scope: 'GLOBAL' | 'USER', userId: string | null) {
  const where =
    scope === 'GLOBAL'
      ? { scope: 'GLOBAL' as const, userId: null, brokerConnectionId: null }
      : { scope: 'USER' as const, userId: userId!, brokerConnectionId: null };
  const existing = await prisma.tradingControl.findFirst({ where });
  const data = {
    liveTradingEnabled: true,
    killSwitch: false,
    approvalState: 'APPROVED' as const,
    requirePaperQualify: true,
    maxOrderValue: 50000,
    maxDailyOrderValue: 100000,
    maxDailyLoss: 10000,
    maxOpenExposure: 75000,
    notes: 'Controlled live unlock via scripts/live-unlock.ts',
    approvedAt: new Date(),
    approvedBy: userId
  };
  if (existing) {
    return prisma.tradingControl.update({ where: { id: existing.id }, data });
  }
  return prisma.tradingControl.create({
    data: {
      scope,
      userId,
      brokerConnectionId: null,
      ...data
    }
  });
}

async function resolveUnlockUser() {
  const email = process.env.UNLOCK_EMAIL;
  if (email) {
    const u = await prisma.user.findUnique({ where: { email } });
    if (!u) throw new Error(`UNLOCK_EMAIL user not found: ${email}`);
    return u;
  }
  const withBroker = await prisma.brokerConnection.findMany({
    where: { isActive: true, isEnabled: true, status: { notIn: ['ERROR', 'EXPIRED'] } },
    include: { user: true },
    orderBy: { updatedAt: 'desc' }
  });
  const dhan = withBroker.find((c) => isRealDhanConn(c) && c.user);
  if (dhan?.user) return dhan.user;

  const any = await prisma.user.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!any) throw new Error('No users in DB — log into the desk first');
  return any;
}

async function ensureRealDhanConnection(userId: string) {
  // Refresh DIRECT credentials from backend/.env when present (tokens expire often).
  if (DhanService.isConfigured()) {
    try {
      const boot = await IntegrationService.bootstrapEnvDhanAndSync(userId);
      return boot.account;
    } catch (err) {
      console.warn(
        `Env Dhan sync failed (${err instanceof Error ? err.message : String(err)}) — upserting credentials only`
      );
      try {
        return await IntegrationService.upsertDhanAccount(userId, {
          displayName: process.env.DHAN_APP_NAME || 'Dhan Env Account',
          clientId: process.env.DHAN_CLIENT_ID || '',
          accessToken: process.env.DHAN_ACCESS_TOKEN || '',
          providerType: 'DIRECT',
          externalAccountId: process.env.DHAN_CLIENT_ID || undefined
        });
      } catch (err2) {
        console.warn(`Credential upsert failed: ${err2 instanceof Error ? err2.message : String(err2)}`);
      }
    }
  }

  const existing = await prisma.brokerConnection.findMany({
    where: {
      userId,
      isActive: true,
      isEnabled: true
    },
    orderBy: { updatedAt: 'desc' }
  });
  return existing.find(isRealDhanConn) || null;
}

async function ensurePinAndLive(userId: string) {
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const json = (settings?.settings as { tradingPinHash?: string }) || {};
  if (!json.tradingPinHash) {
    await TradingModeService.setTradingPin(userId, PIN);
  }
  const cur = (await prisma.userSettings.findUnique({ where: { userId } }))?.settings as Record<
    string,
    unknown
  >;
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, settings: { ...(cur || {}), liveModeSwitchedAt: null } },
    update: { settings: { ...(cur || {}), liveModeSwitchedAt: null } }
  });

  const mode = await TradingModeService.getMode(userId);
  if (mode.mode !== 'live') {
    try {
      await TradingModeService.switchMode(userId, { mode: 'live', pin: PIN, confirmLive: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Could not switch to LIVE (PIN must be UNLOCK_PIN=${PIN} if already set): ${msg}`
      );
    }
  }
}

async function pickOneLotLeg() {
  const underlyings = await InstrumentMasterService.listUnderlyings();
  const nifty = underlyings.find((u) => u.symbol === 'NIFTY') || underlyings[0];
  if (!nifty) throw new Error('No underlyings — sync instrument master first (Options → Sync)');
  const expiries = await InstrumentMasterService.listExpiries(nifty.symbol);
  if (!expiries.length) throw new Error(`No expiries for ${nifty.symbol}`);
  const expiry = expiries[0];
  const { contracts } = await InstrumentMasterService.getContracts(nifty.symbol, expiry);
  const ces = contracts
    .filter(
      (c) =>
        c.tradable &&
        c.optionType === 'CE' &&
        c.strike != null &&
        !c.tradingSymbol.includes('ACC')
    )
    .sort((a, b) => Number(a.strike) - Number(b.strike));
  const pool =
    ces.length > 0
      ? ces
      : contracts
          .filter((c) => c.tradable && c.optionType === 'CE' && c.strike != null)
          .sort((a, b) => Number(a.strike) - Number(b.strike));
  if (!pool.length) throw new Error('No CE contracts — run instrument master sync');
  const atm = pool[Math.floor(pool.length / 2)];
  return {
    instrumentId: atm.id,
    tradingSymbol: atm.tradingSymbol,
    side: 'BUY' as const,
    lots: 1,
    optionType: 'CE' as const,
    premium: 50,
    strategyTag: 'live-unlock-dry-run'
  };
}

async function main() {
  console.log('=== Controlled Live Options Unlock ===\n');

  const featureOn = process.env.FEATURE_LIVE_OPTIONS === 'true';
  const liveEnv = process.env.LIVE_TRADING_ENABLED === 'true';
  record('L1', 'FEATURE_LIVE_OPTIONS=true', featureOn, `value=${process.env.FEATURE_LIVE_OPTIONS}`);
  record('L2', 'LIVE_TRADING_ENABLED=true', liveEnv, `value=${process.env.LIVE_TRADING_ENABLED}`);

  await RiskGateService.ensureGlobalControl();
  const user = await resolveUnlockUser();
  record('L3', 'Unlock user resolved', true, `${user.email} (${user.id.slice(0, 8)}…)`);

  if (APPLY) {
    await upsertControl('GLOBAL', null);
    await upsertControl('USER', user.id);
    record('L4', 'TradingControl approved (GLOBAL+USER)', true, 'liveTradingEnabled + APPROVED, killSwitch=false');
  } else {
    const g = await prisma.tradingControl.findFirst({ where: { scope: 'GLOBAL', userId: null } });
    const u = await prisma.tradingControl.findFirst({ where: { scope: 'USER', userId: user.id } });
    const ok = !!(g?.liveTradingEnabled && g.approvalState === 'APPROVED' && !g.killSwitch);
    record(
      'L4',
      'TradingControl ready (or set APPLY_CONTROLS=true)',
      ok,
      `global=${g?.liveTradingEnabled}/${g?.approvalState} kill=${g?.killSwitch} user=${u?.liveTradingEnabled}/${u?.approvalState}`
    );
  }

  let conn = null as Awaited<ReturnType<typeof ensureRealDhanConnection>>;
  try {
    conn = await ensureRealDhanConnection(user.id);
    record(
      'L5',
      'Active Dhan broker connection',
      !!conn,
      conn
        ? `${conn.broker} ${conn.displayName || conn.id.slice(0, 8)} (${conn.providerType})`
        : 'No Dhan account — set DHAN_CLIENT_ID/TOKEN in .env or connect in Integrations'
    );
  } catch (err) {
    record('L5', 'Active Dhan broker connection', false, err instanceof Error ? err.message : String(err));
  }

  if (conn) {
    await ExecutionTargetResolver.setContext(user.id, {
      activeBrokerConnectionId: conn.id,
      executionMode: 'LIVE'
    });
  }

  try {
    await ensurePinAndLive(user.id);
    const mode = await TradingModeService.getMode(user.id);
    const modeOk = mode.mode === 'live' && mode.liveEnabled && !mode.brokers.killSwitch;
    record(
      'L6',
      'Desk in LIVE mode + liveEnabled',
      modeOk,
      `mode=${mode.mode} liveEnabled=${mode.liveEnabled} kill=${mode.brokers.killSwitch} featureOpts=${mode.brokers.featureLiveOptions}`
    );
  } catch (err) {
    record('L6', 'Desk in LIVE mode + liveEnabled', false, err instanceof Error ? err.message : String(err));
  }

  if (conn) {
    try {
      const target = await ExecutionTargetResolver.resolve(user.id, { requireLive: true });
      const funds = target.direct
        ? await target.direct.getFunds()
        : target.mcp
          ? await target.mcp.getFunds()
          : null;
      record('L7', 'Broker funds probe', !!funds, funds ? 'OK (credentials usable)' : 'No adapter');
    } catch (err) {
      record('L7', 'Broker funds probe', false, err instanceof Error ? err.message : String(err));
    }
  } else {
    record('L7', 'Broker funds probe', false, 'Skipped — no Dhan connection');
  }

  let previewOk = false;
  let leg: Awaited<ReturnType<typeof pickOneLotLeg>> | null = null;
  try {
    leg = await pickOneLotLeg();
    const preview = await LiveOptionsService.preview(user.id, [leg]);
    previewOk =
      preview.submitAllowed === true &&
      preview.liveBrokerSubmit === false &&
      preview.legs.length === 1 &&
      !!preview.legs[0].instrumentToken;
    record(
      'L8',
      'Live preview 1-lot (no broker submit)',
      previewOk,
      `${preview.legs[0].tradingSymbol} token=${preview.legs[0].instrumentToken} submitAllowed=${preview.submitAllowed}`
    );
  } catch (err) {
    record('L8', 'Live preview 1-lot (no broker submit)', false, err instanceof Error ? err.message : String(err));
  }

  if (WANT_SUBMIT && leg && previewOk) {
    try {
      const result = await LiveOptionsService.submit(user.id, [leg], { pin: PIN, confirmLive: true });
      record(
        'L9',
        'LIVE SUBMIT executed (REAL MONEY)',
        !!result.liveBrokerSubmit && (result.orders?.length || 0) > 0,
        `orders=${result.orders?.length}`
      );
    } catch (err) {
      record('L9', 'LIVE SUBMIT executed (REAL MONEY)', false, err instanceof Error ? err.message : String(err));
    }
  } else {
    record(
      'L9',
      'Live submit skipped (safe default)',
      true,
      'Set LIVE_UNLOCK_SUBMIT=true and LIVE_UNLOCK_I_UNDERSTAND_REAL_MONEY=YES to place 1 lot'
    );
  }

  const ready = checks.filter((c) => c.id !== 'L9').every((c) => c.pass) && featureOn && liveEnv;

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'live-unlock-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        readyForManualOneLot: ready,
        wantSubmit: WANT_SUBMIT,
        user: { id: user.id, email: user.email },
        checks,
        next: [
          'Restart backend so it reloads FEATURE_LIVE_OPTIONS / LIVE_TRADING_ENABLED',
          'TopBar → LIVE (PIN)',
          'Sync instrument master if preview used ACC seed symbols',
          'Live Options Terminal → 1 lot liquid NIFTY CE — submit only if intentional',
          'Keep Integrations Kill Switch ready'
        ]
      },
      null,
      2
    )
  );

  console.log('\n--- Unlock summary ---');
  console.log(`READY_FOR_MANUAL_ONE_LOT=${ready ? 'YES' : 'NO'}`);
  console.log(`Report: ${reportPath}`);

  await prisma.$disconnect();
  process.exit(ready ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
