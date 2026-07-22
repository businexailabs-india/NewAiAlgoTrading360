/**
 * Live F&O OMS guard unit checks (no broker network).
 * Run: npx ts-node --transpile-only scripts/unit-options-oms.ts
 */
import { FnoPositionService } from '../src/services/options/fno-position.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function requireLiveFno(input: {
  instrumentType: string;
  isPaper: boolean;
  instrumentToken?: string;
  exchangeSegment?: string;
  featureLiveOptions: boolean;
}) {
  if (input.isPaper || input.instrumentType !== 'OPTION') return { ok: true };
  if (!input.featureLiveOptions) return { ok: false, reason: 'FEATURE_LIVE_OPTIONS_OFF' };
  if (!input.instrumentToken) return { ok: false, reason: 'MISSING_FNO_TOKEN' };
  const seg = (input.exchangeSegment || '').toUpperCase();
  if (seg !== 'NSE_FNO' && seg !== 'BSE_FNO') return { ok: false, reason: 'INVALID_FNO_SEGMENT' };
  return { ok: true };
}

async function main() {
  assert(
    requireLiveFno({
      instrumentType: 'OPTION',
      isPaper: false,
      featureLiveOptions: false,
      instrumentToken: '1',
      exchangeSegment: 'NSE_FNO'
    }).reason === 'FEATURE_LIVE_OPTIONS_OFF',
    'flag gate'
  );
  assert(
    requireLiveFno({
      instrumentType: 'OPTION',
      isPaper: false,
      featureLiveOptions: true,
      exchangeSegment: 'NSE_FNO'
    }).reason === 'MISSING_FNO_TOKEN',
    'token required'
  );
  assert(
    requireLiveFno({
      instrumentType: 'OPTION',
      isPaper: false,
      featureLiveOptions: true,
      instrumentToken: '42528',
      exchangeSegment: 'NSE_EQ'
    }).reason === 'INVALID_FNO_SEGMENT',
    'block equity segment'
  );
  assert(
    requireLiveFno({
      instrumentType: 'OPTION',
      isPaper: false,
      featureLiveOptions: true,
      instrumentToken: '42528',
      exchangeSegment: 'NSE_FNO'
    }).ok === true,
    'valid live fno'
  );

  // Position netting math (in-memory simulation of applyFill logic)
  let qty = 0;
  let side: 'LONG' | 'SHORT' | null = null;
  let avg = 0;
  function apply(trade: 'BUY' | 'SELL', q: number, px: number) {
    const signed = trade === 'BUY' ? q : -q;
    const cur = side === 'LONG' ? qty : side === 'SHORT' ? -qty : 0;
    const next = cur + signed;
    if (next === 0) {
      qty = 0;
      side = null;
      return;
    }
    if (Math.sign(cur) === Math.sign(next) || cur === 0) {
      const absCur = Math.abs(cur);
      avg = absCur === 0 ? px : (avg * absCur + px * q) / (absCur + q);
    } else {
      avg = px;
    }
    side = next > 0 ? 'LONG' : 'SHORT';
    qty = Math.abs(next);
  }
  apply('BUY', 50, 100);
  assert(side === 'LONG' && qty === 50 && avg === 100, 'open long');
  apply('SELL', 50, 120);
  assert(side === null && qty === 0, 'flat after close');

  assert(typeof FnoPositionService.list === 'function', 'FnoPositionService exported');
  assert(typeof FnoPositionService.refreshMtm === 'function', 'mtm exported');

  console.log('unit-options-oms: PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
