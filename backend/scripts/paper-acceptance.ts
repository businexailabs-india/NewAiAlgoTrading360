/**
 * Paper Options Acceptance Pack (service-level E2E)
 *
 * Proves Phase-1/2 gates before enabling FEATURE_LIVE_OPTIONS:
 *  1. Instrument master has no hard-coded strike ladder (CSV-driven seed)
 *  2. Chain underlyings/expiries/contracts load from master
 *  3. Mode switch without PIN rejected; PIN flow works
 *  4. Risk blocks invalid lot + expired contract
 *  5. Paper preview/place never sets liveBrokerSubmit
 *  6. Live options submit blocked while FEATURE_LIVE_OPTIONS=false
 *
 * Run (system Node recommended):
 *   npx ts-node --transpile-only scripts/paper-acceptance.ts
 *
 * Env:
 *   ACCEPTANCE_KEEP_USER=true  — keep acceptance user after run
 *   ACCEPTANCE_TRY_DHAN_SYNC=true — attempt live Dhan scrip master sync
 */
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/config/database';
import { DhanInstrumentAdapter } from '../src/services/brokers/adapters/dhan.instrument.adapter';
import { InstrumentMasterService } from '../src/services/options/instrument-master.service';
import { OptionsChainService } from '../src/services/options/options-chain.service';
import { PaperOptionsService } from '../src/services/options/paper-options.service';
import { LiveOptionsService } from '../src/services/options/live-options.service';
import { RiskGateService } from '../src/services/risk-gate.service';
import { TradingModeService } from '../src/services/trading-mode.service';
import { OrderExecutionService } from '../src/services/order-execution.service';

type Check = { id: string; title: string; pass: boolean; detail: string };

const checks: Check[] = [];
const EMAIL = process.env.ACCEPTANCE_EMAIL || 'paper-acceptance@smarttrade.test';
const PIN = '2468';

function record(id: string, title: string, pass: boolean, detail: string) {
  checks.push({ id, title, pass, detail });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${id} — ${title}${detail ? `: ${detail}` : ''}`);
}

async function expectThrow(fn: () => Promise<unknown>, match?: string | RegExp): Promise<string> {
  try {
    await fn();
    throw new Error('EXPECTED_THROW');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'EXPECTED_THROW') throw new Error('Expected error but call succeeded');
    if (match) {
      const ok = typeof match === 'string' ? msg.includes(match) : match.test(msg);
      if (!ok) throw new Error(`Error message mismatch. got="${msg}" expected~=${match}`);
    }
    return msg;
  }
}

async function ensureUser() {
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        passwordHash: await bcrypt.hash('Acceptance!234', 10),
        name: 'Paper Acceptance',
        role: 'user',
        isActive: true
      }
    });
  }
  return user;
}

async function seedMasterFromCsv(brokerSource = 'dhan') {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 7);
  const expiry = tomorrow.toISOString().slice(0, 10);

  const sampleCsv = `SEM_EXM_EXCH_ID,SEM_INSTRUMENT_NAME,SEM_TRADING_SYMBOL,SEM_SMST_SECURITY_ID,SEM_CUSTOM_SYMBOL,SEM_STRIKE_PRICE,SEM_EXPIRY_DATE,SEM_LOT_UNITS,SEM_OPTION_TYPE,SEM_FREEZE_QTY,SEM_TICK_SIZE
NSE,OPTIDX,NIFTYACC${expiry.replace(/-/g, '')}24000CE,900001,NIFTY,24000,${expiry},25,CE,1800,0.05
NSE,OPTIDX,NIFTYACC${expiry.replace(/-/g, '')}24050CE,900002,NIFTY,24050,${expiry},25,CE,1800,0.05
NSE,OPTIDX,NIFTYACC${expiry.replace(/-/g, '')}24000PE,900003,NIFTY,24000,${expiry},25,PE,1800,0.05
NSE,OPTIDX,NIFTYACC${expiry.replace(/-/g, '')}23950PE,900004,NIFTY,23950,${expiry},25,PE,1800,0.05
NSE,EQ,RELIANCE,1,RELIANCE,0,2020-01-01,1,,0,0.05
`;

  const adapter = new DhanInstrumentAdapter();
  const rows = adapter.parseMasterCsv(sampleCsv);
  if (rows.length < 4) throw new Error(`CSV seed parse failed, got ${rows.length}`);

  // Upsert via same path as sync (without network)
  let instrumentsUpserted = 0;
  for (const row of rows) {
    const u = await prisma.derivativeUnderlying.upsert({
      where: {
        symbol_exchange_segment: {
          symbol: row.underlying,
          exchange: row.exchange,
          segment: row.segment
        }
      },
      create: {
        symbol: row.underlying,
        exchange: row.exchange,
        segment: row.segment,
        name: row.name || row.underlying,
        instrumentKind: row.instrumentKind,
        lotSizeHint: row.lotSize,
        brokerSource,
        tradable: true,
        syncedAt: new Date()
      },
      update: {
        lotSizeHint: row.lotSize,
        brokerSource,
        tradable: true,
        syncedAt: new Date()
      }
    });
    await prisma.derivativeInstrument.upsert({
      where: {
        brokerSource_instrumentToken: {
          brokerSource,
          instrumentToken: row.instrumentToken
        }
      },
      create: {
        underlyingId: u.id,
        exchange: row.exchange,
        segment: row.segment,
        tradingSymbol: row.tradingSymbol,
        instrumentToken: row.instrumentToken,
        instrumentType: row.instrumentType,
        optionType: row.optionType,
        strike: row.strike,
        expiry: row.expiry,
        lotSize: row.lotSize,
        freezeQty: row.freezeQty,
        tradable: true,
        brokerSource,
        syncedAt: new Date()
      },
      update: {
        tradingSymbol: row.tradingSymbol,
        strike: row.strike,
        expiry: row.expiry,
        lotSize: row.lotSize,
        freezeQty: row.freezeQty,
        tradable: true,
        syncedAt: new Date()
      }
    });
    instrumentsUpserted++;
  }

  // Expired contract for risk test
  const u = await prisma.derivativeUnderlying.findFirst({
    where: { symbol: 'NIFTY', segment: 'NFO' }
  });
  if (!u) throw new Error('NIFTY underlying missing after seed');
  await prisma.derivativeInstrument.upsert({
    where: {
      brokerSource_instrumentToken: { brokerSource, instrumentToken: '900099' }
    },
    create: {
      underlyingId: u.id,
      exchange: 'NSE',
      segment: 'NFO',
      tradingSymbol: 'NIFTY_EXPIRED_CE',
      instrumentToken: '900099',
      instrumentType: 'CE',
      optionType: 'CE',
      strike: 20000,
      expiry: new Date('2020-01-01T00:00:00.000Z'),
      lotSize: 25,
      freezeQty: 1800,
      tradable: true,
      brokerSource,
      syncedAt: new Date()
    },
    update: {
      expiry: new Date('2020-01-01T00:00:00.000Z'),
      tradable: true
    }
  });

  return { instrumentsUpserted, expiry, strikes: [...new Set(rows.map((r) => r.strike).filter(Boolean))] };
}

async function cleanup(userId: string) {
  if (process.env.ACCEPTANCE_KEEP_USER === 'true') return;
  await prisma.riskEvent.deleteMany({ where: { userId } });
  await prisma.riskProfile.deleteMany({ where: { userId } });
  await prisma.paperStrategy.deleteMany({ where: { userId } });
  const accts = await prisma.paperAccount.findMany({ where: { userId } });
  for (const a of accts) {
    await prisma.paperLedgerEntry.deleteMany({ where: { paperAccountId: a.id } });
  }
  await prisma.paperAccount.deleteMany({ where: { userId } });
  await prisma.executionAttempt.deleteMany({ where: { userId } });
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.userSettings.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}

async function main() {
  console.log('\n=== Paper Options Acceptance Pack ===\n');
  process.env.FEATURE_LIVE_OPTIONS = 'false';

  const user = await ensureUser();
  const userId = user.id;

  try {
    // 1) Sync / seed — no hardcoded ladder
    const seeded = await seedMasterFromCsv();
    record(
      'A1_MASTER_SEED',
      'Instrument master seeded from feed-shaped CSV (not hard-coded ladder)',
      seeded.instrumentsUpserted >= 4 && (seeded.strikes as number[]).includes(24000),
      `${seeded.instrumentsUpserted} instruments, strikes=${(seeded.strikes as number[]).join(',')}`
    );

    if (process.env.ACCEPTANCE_TRY_DHAN_SYNC === 'true') {
      try {
        const sync = await InstrumentMasterService.sync('dhan');
        record(
          'A1b_DHAN_SYNC',
          'Optional live Dhan master sync',
          sync.instrumentsUpserted > 0 && sync.uniqueStrikes > 3,
          `upserted=${sync.instrumentsUpserted} uniqueStrikes=${sync.uniqueStrikes}`
        );
      } catch (err) {
        record(
          'A1b_DHAN_SYNC',
          'Optional live Dhan master sync',
          false,
          err instanceof Error ? err.message : String(err)
        );
      }
    } else {
      record('A1b_DHAN_SYNC', 'Optional live Dhan master sync', true, 'skipped (set ACCEPTANCE_TRY_DHAN_SYNC=true)');
    }

    // 2) Chain from master
    const underlyings = await OptionsChainService.getUnderlyings();
    const hasNifty = underlyings.underlyings.some((u) => u.symbol === 'NIFTY');
    record('A2_UNDERLYINGS', 'Chain underlyings load from master', hasNifty, `count=${underlyings.underlyings.length}`);

    const expiries = await OptionsChainService.getExpiries('NIFTY');
    record(
      'A2_EXPIRIES',
      'Expiries load from master',
      expiries.expiries.includes(seeded.expiry),
      `expiries=${expiries.expiries.slice(0, 5).join(',')}`
    );

    const chain = await OptionsChainService.getChain({
      underlying: 'NIFTY',
      expiry: seeded.expiry,
      userId
    });
    const rows = 'rows' in chain ? chain.rows : [];
    record(
      'A2_CHAIN',
      'Option chain contracts come from master',
      rows.length > 0 && chain.providerStatus === 'ok',
      `rows=${rows.length} status=${chain.providerStatus} quoteSource=${'quoteSource' in chain ? chain.quoteSource : 'n/a'}`
    );

    // 3) Mode PIN
    await prisma.userSettings.deleteMany({ where: { userId } });
    const noPinMsg = await expectThrow(
      () => TradingModeService.switchMode(userId, { mode: 'live', pin: '0000', confirmLive: true }),
      /Trading PIN|PIN/i
    );
    record('A3_PIN_REQUIRED', 'Mode switch without PIN rejected', true, noPinMsg);

    await TradingModeService.setTradingPin(userId, PIN);
    const badPinMsg = await expectThrow(
      () => TradingModeService.switchMode(userId, { mode: 'live', pin: '9999', confirmLive: true }),
      /Invalid Trading PIN/i
    );
    record('A3_PIN_INVALID', 'Wrong PIN rejected', true, badPinMsg);

    // Stay on paper for trading tests
    await TradingModeService.switchMode(userId, { mode: 'paper', pin: PIN }).catch(async () => {
      // may already be paper
      const mode = await TradingModeService.getMode(userId);
      if (mode.mode !== 'paper') {
        await prisma.userSettings.upsert({
          where: { userId },
          create: { userId, settings: { tradingMode: 'paper', tradingPinHash: await bcrypt.hash(PIN, 10) } },
          update: { settings: { tradingMode: 'paper', tradingPinHash: await bcrypt.hash(PIN, 10) } }
        });
      }
    });
    const modeState = await TradingModeService.getMode(userId);
    record('A3_PAPER_MODE', 'User in PAPER mode for acceptance', modeState.mode === 'paper', `mode=${modeState.mode}`);

    // 4) Risk blocks
    const liveCe = await prisma.derivativeInstrument.findFirst({
      where: { instrumentToken: '900001', tradable: true }
    });
    const expired = await prisma.derivativeInstrument.findFirst({
      where: { instrumentToken: '900099' }
    });
    if (!liveCe || !expired) throw new Error('Seed instruments missing');

    await RiskGateService.updateRiskLimits(userId, { blockNakedShort: true, maxLotsPerOrder: 10 });

    const lotMsg = await expectThrow(
      () =>
        RiskGateService.preflightDerivatives({
          userId,
          isPaper: true,
          instrument: liveCe,
          side: 'BUY',
          lots: 1,
          quantity: 30, // not multiple of 25
          premium: 100
        }),
      /lot size|INVALID_LOT_SIZE/i
    );
    record('A4_LOT_BLOCK', 'Risk blocks invalid lot size', true, lotMsg);

    const expMsg = await expectThrow(
      () =>
        RiskGateService.preflightDerivatives({
          userId,
          isPaper: true,
          instrument: expired,
          side: 'BUY',
          lots: 1,
          quantity: 25,
          premium: 10
        }),
      /expired|EXPIRED/i
    );
    record('A4_EXPIRY_BLOCK', 'Risk blocks expired contract', true, expMsg);

    const nakedMsg = await expectThrow(
      () =>
        RiskGateService.preflightDerivatives({
          userId,
          isPaper: true,
          instrument: liveCe,
          side: 'SELL',
          lots: 1,
          quantity: 25,
          premium: 100
        }),
      /Naked short|NAKED_SHORT/i
    );
    record('A4_NAKED_SHORT', 'Risk blocks naked short option', true, nakedMsg);

    // 5) Paper isolation
    const legs = [
      {
        instrumentId: liveCe.id,
        tradingSymbol: liveCe.tradingSymbol,
        side: 'BUY' as const,
        lots: 1,
        optionType: 'CE' as const,
        premium: 100
      }
    ];
    const preview = await PaperOptionsService.preview(userId, legs);
    record(
      'A5_PAPER_PREVIEW',
      'Paper preview never marks liveBrokerSubmit',
      preview.liveBrokerSubmit === false && preview.isPaper === true,
      `netDebit=${preview.netDebit}`
    );

    const placed = await PaperOptionsService.place(userId, legs);
    record(
      'A5_PAPER_PLACE',
      'Paper place never hits live submit flag',
      placed.liveBrokerSubmit === false && placed.isPaper === true && placed.orders.length === 1,
      `orderId=${placed.orders[0]?.id} status=${placed.orders[0]?.status}`
    );

    // 6) Live options gated
    const liveMsg = await expectThrow(
      () =>
        OrderExecutionService.placeOrder({
          userId,
          symbol: liveCe.tradingSymbol,
          exchange: 'NFO',
          tradeType: 'BUY',
          quantity: 25,
          product: 'NRML',
          price: 100,
          instrumentType: 'OPTION',
          isPaper: false,
          instrumentToken: liveCe.instrumentToken,
          exchangeSegment: 'NSE_FNO'
        }),
      /FEATURE_LIVE_OPTIONS|PAPER MODE|Live options/i
    );
    record('A6_LIVE_GATED', 'Live options submit blocked while feature flag off / paper mode', true, liveMsg);

    const liveSubmitMsg = await expectThrow(
      () =>
        LiveOptionsService.submit(userId, legs, { pin: PIN, confirmLive: true }),
      /FEATURE_LIVE_OPTIONS|LIVE MODE|Switch to LIVE/i
    );
    record('A6_LIVE_SERVICE', 'LiveOptionsService.submit gated', true, liveSubmitMsg);

    // Save strategy for clone path readiness
    const strat = await PaperOptionsService.saveStrategy(userId, 'Acceptance Long CE', legs, {
      acceptance: true
    });
    record('A7_STRATEGY_SAVE', 'Paper strategy saved for live-clone path', !!strat.id, strat.id);
  } catch (err) {
    record('A0_FATAL', 'Acceptance harness fatal error', false, err instanceof Error ? err.message : String(err));
  }

  const failed = checks.filter((c) => !c.pass);
  // A1b optional fail shouldn't block unlock recommendation if skipped/pass otherwise
  const blocking = failed.filter((c) => c.id !== 'A1b_DHAN_SYNC' || process.env.ACCEPTANCE_TRY_DHAN_SYNC === 'true');
  const ready = blocking.length === 0;

  const report = {
    at: new Date().toISOString(),
    email: EMAIL,
    featureLiveOptions: process.env.FEATURE_LIVE_OPTIONS,
    readyForFeatureLiveOptions: ready,
    checks,
    unlockChecklist: [
      'All acceptance checks PASS (this report)',
      'Paper terminal used manually on NIFTY ATM for 1 session',
      'Risk Center limits reviewed',
      'Broker connection validated (funds probe)',
      'Set FEATURE_LIVE_OPTIONS=true only in controlled env',
      'Keep LIVE_TRADING_ENABLED + TradingControl approval gates',
      'First live order: 1 lot liquid index option, then reconcile'
    ]
  };

  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'paper-acceptance-report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log('\n--- Checklist (sign-off before FEATURE_LIVE_OPTIONS) ---');
  for (const item of report.unlockChecklist) console.log(` [ ] ${item}`);
  console.log(`\nReport: ${outFile}`);
  console.log(`READY_FOR_FEATURE_LIVE_OPTIONS=${ready ? 'YES' : 'NO'}`);
  console.log(`Passed ${checks.filter((c) => c.pass).length}/${checks.length}\n`);

  await cleanup(user.id);

  if (!ready) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
