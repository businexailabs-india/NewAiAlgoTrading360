import { describe, it, expect } from 'vitest';
import {
  formatInrExact,
  formatInrLakhsCrores,
  aggregatePositions,
  convertMoney,
  sumPnl,
} from '../format';
import type { Position } from '../types';

function pos(partial: Partial<Position> & Pick<Position, 'id' | 'exchange' | 'canonicalInstrumentId' | 'netQty' | 'avgPrice'>): Position {
  return {
    brokerPositionId: null,
    accountId: 'acc-a',
    broker: 'dhan',
    segment: 'FO',
    brokerInstrumentId: null,
    symbol: 'TEST',
    productType: 'NRML',
    expiry: null,
    strike: null,
    optionType: null,
    strategyId: null,
    strategyName: null,
    buyQty: Math.max(0, partial.netQty),
    sellQty: Math.max(0, -partial.netQty),
    ltp: null,
    dayPnl: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    marketValue: 0,
    marginUsed: 0,
    delta: null,
    currency: 'INR',
    updatedAt: new Date().toISOString(),
    lastSyncAt: new Date().toISOString(),
    reconciliationStatus: 'MATCHED',
    correlationId: 'c',
    assetClass: 'INDEX_OPTIONS',
    dataFreshness: 'DEMO',
    ...partial,
  };
}

describe('formatInrExact', () => {
  it('uses Indian grouping', () => {
    expect(formatInrExact(1234567.89)).toBe('₹12,34,567.89');
    expect(formatInrExact(-1000)).toBe('-₹1,000.00');
  });
});

describe('formatInrLakhsCrores', () => {
  it('formats lakhs and crores', () => {
    expect(formatInrLakhsCrores(250_000)).toBe('₹2.50 lakh');
    expect(formatInrLakhsCrores(25_000_000)).toBe('₹2.50 crore');
  });
});

describe('aggregatePositions', () => {
  it('computes weighted average price by abs qty', () => {
    const rows = [
      pos({
        id: '1',
        exchange: 'BSE',
        canonicalInstrumentId: 'BSE:X',
        netQty: 20,
        avgPrice: 100,
        accountId: 'a',
      }),
      pos({
        id: '2',
        exchange: 'BSE',
        canonicalInstrumentId: 'BSE:X',
        netQty: 30,
        avgPrice: 200,
        accountId: 'b',
      }),
    ];
    const agg = aggregatePositions(rows);
    expect(agg).toHaveLength(1);
    expect(agg[0].netQty).toBe(50);
    expect(agg[0].weightedAvgPrice).toBeCloseTo(160, 5);
  });

  it('keeps BSE and NSE separate', () => {
    const rows = [
      pos({
        id: '1',
        exchange: 'BSE',
        canonicalInstrumentId: 'IDX:OPT',
        netQty: 10,
        avgPrice: 1,
        symbol: 'OPT BSE',
      }),
      pos({
        id: '2',
        exchange: 'NSE',
        canonicalInstrumentId: 'IDX:OPT',
        netQty: 10,
        avgPrice: 1,
        symbol: 'OPT NSE',
      }),
    ];
    const agg = aggregatePositions(rows);
    expect(agg).toHaveLength(2);
    expect(agg.map((a) => a.exchange).sort()).toEqual(['BSE', 'NSE']);
  });
});

describe('convertMoney', () => {
  it('returns NaN and warning without FX rate', () => {
    const result = convertMoney({ amount: 100, currency: 'USD' }, 'INR', []);
    expect(Number.isNaN(result.amount)).toBe(true);
    expect(result.warning).toMatch(/No FX rate/);
    expect(result.conversion).toBeNull();
  });
});

describe('sumPnl', () => {
  it('separates long and short exposure', () => {
    const rows = [
      pos({
        id: '1',
        exchange: 'NSE',
        canonicalInstrumentId: 'A',
        netQty: 10,
        avgPrice: 100,
        marketValue: 1000,
        dayPnl: 50,
      }),
      pos({
        id: '2',
        exchange: 'BSE',
        canonicalInstrumentId: 'B',
        netQty: -5,
        avgPrice: 200,
        marketValue: -800,
        dayPnl: -20,
      }),
    ];
    const s = sumPnl(rows);
    expect(s.day).toBe(30);
    expect(s.longExposure).toBe(1000);
    expect(s.shortExposure).toBe(800);
  });
});
