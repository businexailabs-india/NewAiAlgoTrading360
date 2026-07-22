/**
 * Product polish unit checks (no DB).
 * Run: npx ts-node --transpile-only scripts/unit-options-polish.ts
 */
import { RiskGateService } from '../src/services/risk-gate.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const positions = [
    {
      side: 'LONG',
      quantity: 25,
      avgPrice: 100,
      lastPrice: 110,
      optionType: 'CE',
      strike: 24000,
      expiry: new Date(Date.now() + 7 * 86400000)
    },
    {
      side: 'SHORT',
      quantity: 25,
      avgPrice: 40,
      lastPrice: 35,
      optionType: 'CE',
      strike: 24200,
      expiry: new Date(Date.now() + 7 * 86400000)
    }
  ];

  const exp = RiskGateService.estimatePortfolioExposure(positions);
  assert(exp.netNotional > 0, 'notional positive');
  assert(Number.isFinite(exp.netDelta), 'delta finite');
  assert(Number.isFinite(exp.netVega), 'vega finite');
  // Long ATM CE + short OTM CE → net delta should be positive-ish but finite
  assert(Math.abs(exp.netDelta) < 50, 'delta magnitude sane for 1-lot book');

  const g = RiskGateService.legGreeksEstimate({
    optionType: 'PE',
    strike: 24000,
    expiry: new Date(Date.now() + 14 * 86400000),
    side: 'SHORT',
    quantity: 50,
    lastPrice: 80
  });
  assert(g.delta > 0, 'short put contributes positive delta');

  console.log('unit-options-polish: PASS', {
    netNotional: exp.netNotional,
    netDelta: exp.netDelta,
    netVega: exp.netVega
  });
}

main();
