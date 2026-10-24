import type { BotConfig, SpreadProposal } from '../types';

export interface ChainRow {
  strike: number;
  callLtp: number;
  callIv: number;
  callDelta: number;
  callVol: number;
  callOi: number;
  callChgOi: number;
  putLtp: number;
  putIv: number;
  putDelta: number;
  putVol: number;
  putOi: number;
  putChgOi: number;
}

function roundStrike(spot: number, step = 50) {
  return Math.round(spot / step) * step;
}

export function buildOptionChain(spot: number, step = 50): ChainRow[] {
  const atm = roundStrike(spot, step);
  const rows: ChainRow[] = [];
  for (let i = -10; i <= 10; i++) {
    const strike = atm + i * step;
    const dte = 7;
    const m = (strike - spot) / spot;
    const callDelta = Math.max(0.02, Math.min(0.98, 0.5 - m * 8));
    const putDelta = -(1 - callDelta);
    const iv = 12 + Math.abs(i) * 0.35;
    const callLtp = Math.max(0.5, (callDelta * spot * 0.004 * dte) / 7);
    const putLtp = Math.max(0.5, (Math.abs(putDelta) * spot * 0.004 * dte) / 7);
    rows.push({
      strike,
      callLtp: +callLtp.toFixed(2),
      callIv: +iv.toFixed(1),
      callDelta: +callDelta.toFixed(3),
      callVol: 40_000 + Math.abs(8 - Math.abs(i)) * 12_000,
      callOi: 1_200_000 + (i === 2 || i === -1 ? 900_000 : 0),
      callChgOi: (3 - i) * 18_000,
      putLtp: +putLtp.toFixed(2),
      putIv: +(iv + 0.4).toFixed(1),
      putDelta: +putDelta.toFixed(3),
      putVol: 38_000 + Math.abs(7 - Math.abs(i)) * 11_000,
      putOi: 1_100_000 + (i === -2 || i === 1 ? 850_000 : 0),
      putChgOi: (i - 1) * 16_000
    });
  }
  return rows;
}

export function selectBullPut(spot: number, cfg: BotConfig, chain: ChainRow[]): SpreadProposal | null {
  const width = cfg.spreadWidth || 100;
  const puts = [...chain].sort((a, b) => Math.abs(Math.abs(a.putDelta) - 0.2) - Math.abs(Math.abs(b.putDelta) - 0.2));
  const short = puts.find((r) => r.putDelta <= -cfg.shortDeltaMin && r.putDelta >= -cfg.shortDeltaMax && r.strike < spot);
  if (!short) return null;
  const long = chain.find((r) => r.strike === short.strike - width);
  if (!long) return null;
  const credit = +(short.putLtp - long.putLtp).toFixed(2);
  if (credit <= 0) return null;
  const maxLoss = +(width - credit).toFixed(2);
  return {
    type: 'BULL_PUT',
    shortStrike: short.strike,
    longStrike: long.strike,
    expiry: nextWeekly(),
    netCredit: credit,
    maxProfit: credit,
    maxLoss,
    breakeven: +(short.strike - credit).toFixed(2),
    riskReward: +(credit / maxLoss).toFixed(2),
    delta: +(short.putDelta + long.putDelta * -0.4).toFixed(3),
    theta: +((credit * 0.12) / 7).toFixed(2),
    margin: +(maxLoss * 50).toFixed(0),
    probability: Math.round(62 + Math.abs(short.putDelta) * 40),
    explanation: `OTM put credit spread: SELL ${short.strike} PE + BUY ${long.strike} PE. Delta ${short.putDelta.toFixed(2)} within ${cfg.shortDeltaMin}–${cfg.shortDeltaMax}. Defined risk ${maxLoss} pts.`
  };
}

export function selectBearCall(spot: number, cfg: BotConfig, chain: ChainRow[]): SpreadProposal | null {
  const width = cfg.spreadWidth || 100;
  const calls = [...chain].sort((a, b) => Math.abs(a.callDelta - 0.2) - Math.abs(b.callDelta - 0.2));
  const short = calls.find((r) => r.callDelta >= cfg.shortDeltaMin && r.callDelta <= cfg.shortDeltaMax && r.strike > spot);
  if (!short) return null;
  const long = chain.find((r) => r.strike === short.strike + width);
  if (!long) return null;
  const credit = +(short.callLtp - long.callLtp).toFixed(2);
  if (credit <= 0) return null;
  const maxLoss = +(width - credit).toFixed(2);
  return {
    type: 'BEAR_CALL',
    shortStrike: short.strike,
    longStrike: long.strike,
    expiry: nextWeekly(),
    netCredit: credit,
    maxProfit: credit,
    maxLoss,
    breakeven: +(short.strike + credit).toFixed(2),
    riskReward: +(credit / maxLoss).toFixed(2),
    delta: +(short.callDelta - long.callDelta * 0.4).toFixed(3),
    theta: +((credit * 0.12) / 7).toFixed(2),
    margin: +(maxLoss * 50).toFixed(0),
    probability: Math.round(62 + short.callDelta * 40),
    explanation: `OTM call credit spread: SELL ${short.strike} CE + BUY ${long.strike} CE. Delta ${short.callDelta.toFixed(2)} within ${cfg.shortDeltaMin}–${cfg.shortDeltaMax}. Defined risk ${maxLoss} pts.`
  };
}

export function scoreCandidate(p: SpreadProposal, chain: ChainRow[]): number {
  const short = chain.find((r) => r.strike === p.shortStrike);
  if (!short) return 0;
  const liq = p.type === 'BULL_PUT' ? short.putOi + short.putVol : short.callOi + short.callVol;
  const rr = p.riskReward;
  return Math.round(Math.min(100, rr * 40 + Math.min(30, liq / 80_000) + (p.probability > 55 ? 15 : 0) + 10));
}

function nextWeekly() {
  const d = new Date();
  const day = d.getDay();
  const add = (4 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

export function lotSize(underlying: string) {
  if (underlying.includes('BANK')) return 15;
  if (underlying.includes('FIN')) return 25;
  return 25;
}

export function sizeQuantity(capital: number, riskPct: number, maxLossPts: number, lot: number) {
  const allowed = capital * (riskPct / 100);
  const lossPerLot = maxLossPts * lot;
  if (lossPerLot <= 0) return 0;
  const lots = Math.floor(allowed / lossPerLot);
  return Math.max(0, lots) * lot;
}
