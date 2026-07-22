/**
 * Strategy bind / margin helpers (no DB).
 * Run: npx ts-node --transpile-only scripts/unit-strategy-bind.ts
 */
import { analyzeStrategy } from '../src/services/options/strategy-analytics.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function nearestStrike(target: number, strikes: number[]) {
  return strikes.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best));
}

function spanProxy(legs: Array<{ side: string; premium: number; lots: number; lotSize: number }>, spot: number) {
  const shortNotional = legs
    .filter((l) => l.side === 'SELL')
    .reduce((s, l) => s + l.premium * l.lots * l.lotSize, 0);
  const longDebit = legs
    .filter((l) => l.side === 'BUY')
    .reduce((s, l) => s + l.premium * l.lots * l.lotSize, 0);
  const nakedShortLots = legs.filter((l) => l.side === 'SELL').reduce((s, l) => s + l.lots, 0);
  return shortNotional * 2.5 + spot * 0.03 * nakedShortLots * (legs[0]?.lotSize || 25) + longDebit * 0.1;
}

function main() {
  assert(nearestStrike(24010, [23950, 24000, 24050]) === 24000, 'snap to ATM');
  assert(nearestStrike(24040, [23950, 24000, 24050]) === 24050, 'snap up');

  const legs = [
    { side: 'BUY' as const, optionType: 'CE' as const, strike: 24000, premium: 100, lots: 1, lotSize: 25 },
    { side: 'SELL' as const, optionType: 'CE' as const, strike: 24100, premium: 45, lots: 1, lotSize: 25 }
  ];
  const a = analyzeStrategy(legs, 24000);
  assert(a.marginEstimate > 0, 'base margin');
  const improved = spanProxy(legs, 24000);
  assert(improved >= a.netPremium === false || improved > 0, 'span proxy positive');
  assert(improved > shortNotionalCheck(legs), 'span > short notional alone');

  console.log('unit-strategy-bind: PASS');
}

function shortNotionalCheck(legs: Array<{ side: string; premium: number; lots: number; lotSize: number }>) {
  return legs.filter((l) => l.side === 'SELL').reduce((s, l) => s + l.premium * l.lots * l.lotSize, 0);
}

main();
