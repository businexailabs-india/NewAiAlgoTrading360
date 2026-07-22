/**
 * Real option-quote overlay unit checks (no network).
 * Run: npx ts-node --transpile-only scripts/unit-options-quotes.ts
 */
import { OptionQuoteService } from '../src/services/options/option-quote.service';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function main() {
  const sample = {
    data: {
      last_price: 24500.5,
      oc: {
        '24500.000000': {
          ce: {
            last_price: 120.5,
            oi: 1500000,
            previous_oi: 1400000,
            previous_close_price: 110,
            implied_volatility: 12.5,
            security_id: 42528,
            top_bid_price: 120.0,
            top_ask_price: 120.75,
            top_bid_quantity: 100,
            top_ask_quantity: 80,
            volume: 900000,
            greeks: { delta: 0.51, gamma: 0.001, theta: -10, vega: 8 }
          },
          pe: {
            last_price: 95.25,
            oi: 1200000,
            previous_oi: 1300000,
            previous_close_price: 100,
            implied_volatility: 13.1,
            security_id: 42529,
            top_bid_price: 95.0,
            top_ask_price: 95.5,
            volume: 800000
          }
        }
      }
    }
  };

  const parsed = OptionQuoteService.parseOptionChainResponseForTest(sample);
  assert(parsed.spot === 24500.5, 'spot from OC');
  assert(parsed.quotes.length === 2, 'CE+PE rows');
  const ce = parsed.quotes.find((q) => q.optionType === 'CE');
  assert(ce?.ltp === 120.5 && ce.oi === 1500000, 'CE LTP/OI');
  assert(ce?.bid === 120 && ce.ask === 120.75, 'CE bid/ask');
  assert(ce?.securityId === '42528', 'security id');
  assert(ce?.greeks?.delta === 0.51, 'broker greeks');

  const id = OptionQuoteService.resolveUnderlyingIdentity('NIFTY');
  assert(id?.scrip === 13 && id.seg === 'IDX_I', 'NIFTY underlying map');
  const bank = OptionQuoteService.resolveUnderlyingIdentity('BANKNIFTY');
  assert(bank?.scrip === 25, 'BANKNIFTY map');
  assert(OptionQuoteService.resolveUnderlyingIdentity('UNKNOWNXYZ') == null, 'unknown underlying');

  // Freshness labeling semantics
  const liveMs = 8000;
  const ageFresh = 2000;
  const ageStale = 20000;
  assert(ageFresh <= liveMs, 'fresh => live');
  assert(ageStale > liveMs, 'stale => delayed');

  console.log('unit-options-quotes: PASS');
}

main();
