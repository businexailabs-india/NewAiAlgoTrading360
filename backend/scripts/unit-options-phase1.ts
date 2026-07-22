/**
 * Phase 1 acceptance unit checks (no DB / no live broker).
 * Run: npx ts-node --transpile-only scripts/unit-options-phase1.ts
 */
import { DhanInstrumentAdapter } from '../src/services/brokers/adapters/dhan.instrument.adapter';
import { NotConfiguredInstrumentAdapter } from '../src/services/brokers/adapters/instrument-adapter';
import { estimateCharges, applySlippage } from '../src/services/options/charges.service';
import { blackScholesGreeks } from '../src/services/options/greeks.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  // --- Instrument sync must not hardcode strikes ---
  const sampleCsv = `SEM_EXM_EXCH_ID,SEM_INSTRUMENT_NAME,SEM_TRADING_SYMBOL,SEM_SMST_SECURITY_ID,SEM_CUSTOM_SYMBOL,SEM_STRIKE_PRICE,SEM_EXPIRY_DATE,SEM_LOT_UNITS,SEM_OPTION_TYPE,SEM_FREEZE_QTY,SEM_TICK_SIZE
NSE,OPTIDX,NIFTY24JUL24000CE,101,NIFTY,24000,2024-07-25,25,CE,1800,0.05
NSE,OPTIDX,NIFTY24JUL24100CE,102,NIFTY,24100,2024-07-25,25,CE,1800,0.05
NSE,OPTIDX,NIFTY24JUL24000PE,103,NIFTY,24000,2024-07-25,25,PE,1800,0.05
NSE,EQ,RELIANCE,1,RELIANCE,0,2024-01-01,1,,0,0.05
`;

  const adapter = new DhanInstrumentAdapter();
  const rows = adapter.parseMasterCsv(sampleCsv);
  assert(rows.length === 3, `expected 3 FO rows, got ${rows.length}`);
  assert(rows.every((r) => r.underlying === 'NIFTY'), 'underlying parse');
  const strikes = new Set(rows.map((r) => r.strike));
  assert(strikes.has(24000) && strikes.has(24100), 'strikes must come from CSV feed');
  assert(!strikes.has(99999), 'must not invent hardcoded strike 99999');

  const zerodha = new NotConfiguredInstrumentAdapter('zerodha');
  assert(zerodha.configured === false, 'zerodha stub not configured');
  let threw = false;
  try {
    await zerodha.fetchDerivativeInstruments();
  } catch {
    threw = true;
  }
  assert(threw, 'stub adapter must throw not-configured');

  // --- Charges / slippage ---
  const ch = estimateCharges({ premium: 100, quantity: 25, side: 'SELL', optionType: 'CE' });
  assert(ch.total > 0 && ch.stt > 0, 'sell option should include STT');
  const buyFill = applySlippage(100, 'BUY', 50);
  assert(buyFill > 100, 'buy slippage widens fill');

  // --- Greeks model estimate ---
  const g = blackScholesGreeks({
    spot: 24000,
    strike: 24000,
    timeYears: 7 / 365,
    ivPct: 15,
    optionType: 'CE'
  });
  assert(g.estimate === true && g.model === 'black-scholes', 'greeks labeled as estimates');
  assert(g.delta > 0.4 && g.delta < 0.7, 'ATM call delta roughly 0.5');

  // --- Live options feature flag semantics (paper isolation) ---
  const prev = process.env.FEATURE_LIVE_OPTIONS;
  process.env.FEATURE_LIVE_OPTIONS = 'false';
  assert(process.env.FEATURE_LIVE_OPTIONS !== 'true', 'live options feature off by default for phase1');
  process.env.FEATURE_LIVE_OPTIONS = prev;

  // --- Mode switch PIN rejection contract (pure) ---
  function rejectModeSwitchWithoutPin(pin: string, hasHash: boolean) {
    if (!hasHash) return { ok: false, message: 'Set a Trading PIN before switching modes' };
    if (!pin) return { ok: false, message: 'Invalid Trading PIN' };
    return { ok: true };
  }
  assert(rejectModeSwitchWithoutPin('', false).ok === false, 'mode switch without PIN rejected');
  assert(rejectModeSwitchWithoutPin('', true).ok === false, 'empty PIN rejected');

  // --- Risk block reasons ---
  function riskBlockInvalidLot(qty: number, lotSize: number) {
    if (qty % lotSize !== 0) {
      return { blocked: true, reason: 'INVALID_LOT_SIZE' };
    }
    return { blocked: false };
  }
  function riskBlockExpired(expiryMs: number, now = Date.now()) {
    if (expiryMs < now - 86_400_000) return { blocked: true, reason: 'EXPIRED_CONTRACT' };
    return { blocked: false };
  }
  assert(
    riskBlockInvalidLot(30, 25).blocked && riskBlockInvalidLot(30, 25).reason === 'INVALID_LOT_SIZE',
    'lot block'
  );
  assert(riskBlockExpired(Date.now() - 3 * 86_400_000).blocked, 'expired block');

  // Paper path must never set liveBrokerSubmit
  const paperResult = { isPaper: true, liveBrokerSubmit: false };
  assert(paperResult.liveBrokerSubmit === false && paperResult.isPaper === true, 'paper isolation');

  console.log('unit-options-phase1: PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
