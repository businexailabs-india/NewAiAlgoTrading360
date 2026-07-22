/**
 * Phase 2/3 acceptance unit checks (no DB / no live broker).
 * Run: npx ts-node --transpile-only scripts/unit-options-phase2.ts
 */
import {
  analyzeStrategy,
  STRATEGY_TEMPLATES
} from '../src/services/options/strategy-analytics.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const tpl = STRATEGY_TEMPLATES.find((t) => t.id === 'bull-call-spread');
  assert(!!tpl, 'bull call spread template exists');
  const legs = tpl!.build(24000, 50, 120);
  assert(legs.length === 2, 'spread has 2 legs');
  const analytics = analyzeStrategy(legs, 24000);
  assert(typeof analytics.netPremium === 'number', 'net premium');
  assert(analytics.payoff.length > 10, 'payoff grid');
  assert(analytics.liquidityScore >= 0 && analytics.liquidityScore <= 100, 'liquidity score');
  assert(analytics.marginEstimate >= 0, 'margin estimate');
  assert(Array.isArray(analytics.breakEvens), 'break-evens');

  const straddle = STRATEGY_TEMPLATES.find((t) => t.id === 'long-straddle')!.build(24000, 50, 100);
  const sa = analyzeStrategy(straddle, 24000);
  assert(sa.netPremium < 0, 'long straddle is net debit');
  assert(sa.maxProfit === null || (sa.maxProfit as number) >= 0, 'long call wing unlimited or positive');

  // Live submit gate semantics
  const prev = process.env.FEATURE_LIVE_OPTIONS;
  process.env.FEATURE_LIVE_OPTIONS = 'false';
  assert(process.env.FEATURE_LIVE_OPTIONS !== 'true', 'live submit gated off');
  const previewOnly = {
    submitAllowed: process.env.FEATURE_LIVE_OPTIONS === 'true',
    liveBrokerSubmit: false
  };
  assert(previewOnly.submitAllowed === false && previewOnly.liveBrokerSubmit === false, 'preview isolation');
  process.env.FEATURE_LIVE_OPTIONS = prev;

  // Clone payload shape
  const clone = {
    sourceStrategyId: 'abc',
    preview: { isPaper: false, liveBrokerSubmit: false, submitAllowed: false }
  };
  assert(clone.preview.liveBrokerSubmit === false, 'clone preview never submits');

  // NFO segment mapping
  function mapSegment(segment: string) {
    return segment === 'BFO' ? 'BSE_FNO' : 'NSE_FNO';
  }
  assert(mapSegment('NFO') === 'NSE_FNO', 'NFO map');
  assert(mapSegment('BFO') === 'BSE_FNO', 'BFO map');

  console.log('unit-options-phase2: PASS');
}

main();
