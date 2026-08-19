import axios from 'axios';
import {
  BrokerInstrumentAdapter,
  BrokerInstrumentRow
} from './instrument-adapter';
import { logger } from '../../../utils/logger';
import { isIndexFoUnderlying, normalizeDhanUnderlying } from '../../../libs/trading/fo-index-catalog';

/** Public Dhan scrip master — strikes/expiries/lots come only from this feed. */
const DHAN_SCRIP_MASTER_URL =
  process.env.DHAN_SCRIP_MASTER_URL ||
  'https://images.dhan.co/api-data/api-scrip-master.csv';

const FO_INSTRUMENTS = new Set(['OPTIDX', 'OPTSTK', 'FUTIDX', 'FUTSTK']);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function parseExpiry(raw: string): Date | null {
  if (!raw) return null;
  // Dhan often uses YYYY-MM-DD or DD-MMM-YYYY / YYYYMMDD
  const iso = raw.includes('-') ? raw : null;
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const d = new Date(iso.slice(0, 10) + 'T00:00:00.000Z');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{8}$/.test(raw)) {
    const d = new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Maps Dhan compact/master CSV columns flexibly by header name.
 * Column names vary slightly across Dhan master versions.
 */
export class DhanInstrumentAdapter implements BrokerInstrumentAdapter {
  readonly brokerSource = 'dhan';

  get configured() {
    return true;
  }

  async fetchDerivativeInstruments(): Promise<BrokerInstrumentRow[]> {
    const res = await axios.get<string>(DHAN_SCRIP_MASTER_URL, {
      timeout: 120_000,
      responseType: 'text',
      transformResponse: [(d) => d]
    });
    const text = typeof res.data === 'string' ? res.data : String(res.data);
    return this.parseMasterCsv(text);
  }

  /** Exposed for unit tests — parse only, no network. */
  parseMasterCsv(text: string): BrokerInstrumentRow[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]).map((h) => h.toUpperCase().replace(/\s+/g, '_'));
    const idx = (candidates: string[]) => {
      for (const c of candidates) {
        const i = headers.indexOf(c);
        if (i >= 0) return i;
      }
      return -1;
    };

    const iExch = idx(['SEM_EXM_EXCH_ID', 'EXCH_ID', 'EXCHANGE']);
    const iSeg = idx(['SEM_SEGMENT', 'SEGMENT', 'SEM_EXCH_INSTRUMENT_TYPE']);
    const iInst = idx(['SEM_INSTRUMENT_NAME', 'INSTRUMENT', 'INSTRUMENT_TYPE']);
    const iTs = idx(['SEM_TRADING_SYMBOL', 'TRADING_SYMBOL', 'SYMBOL_NAME']);
    const iTok = idx(['SEM_SMST_SECURITY_ID', 'SECURITY_ID', 'INSTRUMENT_TOKEN', 'TOKEN']);
    const iCustom = idx(['SEM_CUSTOM_SYMBOL', 'CUSTOM_SYMBOL']);
    const iSmName = idx(['SM_SYMBOL_NAME', 'UNDERLYING_SYMBOL', 'UNDERLYING', 'SYM_NAME']);
    const iStrike = idx(['SEM_STRIKE_PRICE', 'STRIKE_PRICE', 'STRIKE']);
    const iExpiry = idx(['SEM_EXPIRY_DATE', 'EXPIRY_DATE', 'EXPIRY']);
    const iLot = idx(['SEM_LOT_UNITS', 'LOT_SIZE', 'SEM_LOT_SIZE']);
    const iFreeze = idx(['SEM_FREEZE_QTY', 'FREEZE_QTY', 'SEM_MAX_LOT_QTY']);
    const iOpt = idx(['SEM_OPTION_TYPE', 'OPTION_TYPE', 'OPT_TYPE']);
    const iTick = idx(['SEM_TICK_SIZE', 'TICK_SIZE']);

    const rows: BrokerInstrumentRow[] = [];
    let skipped = 0;

    for (let li = 1; li < lines.length; li++) {
      const cols = parseCsvLine(lines[li]);
      const get = (i: number) => (i >= 0 && i < cols.length ? cols[i] : '');

      const instrumentName = get(iInst).toUpperCase();
      if (!FO_INSTRUMENTS.has(instrumentName)) {
        skipped++;
        continue;
      }

      const exchRaw = get(iExch).toUpperCase();
      const exchange = exchRaw.includes('BSE') || exchRaw === 'B' ? 'BSE' : 'NSE';
      const segment = exchange === 'BSE' ? 'BFO' : 'NFO';

      const tradingSymbol = get(iTs);
      const token = get(iTok);
      if (!tradingSymbol || !token) {
        skipped++;
        continue;
      }

      const expiry = parseExpiry(get(iExpiry));
      if (!expiry) {
        skipped++;
        continue;
      }

      const isFut = instrumentName.startsWith('FUT');
      const optRaw = get(iOpt).toUpperCase();
      let optionType: 'CE' | 'PE' | null = null;
      let instrumentType: 'CE' | 'PE' | 'FUT' = 'FUT';
      if (!isFut) {
        if (optRaw.includes('CE') || optRaw === 'C' || optRaw === 'CALL') {
          optionType = 'CE';
          instrumentType = 'CE';
        } else if (optRaw.includes('PE') || optRaw === 'P' || optRaw === 'PUT') {
          optionType = 'PE';
          instrumentType = 'PE';
        } else if (tradingSymbol.endsWith('CE')) {
          optionType = 'CE';
          instrumentType = 'CE';
        } else if (tradingSymbol.endsWith('PE')) {
          optionType = 'PE';
          instrumentType = 'PE';
        } else {
          skipped++;
          continue;
        }
      }

      const strikeRaw = get(iStrike);
      const strike = isFut ? null : Number(strikeRaw);
      if (!isFut && !(Number.isFinite(strike) && (strike as number) >= 0)) {
        skipped++;
        continue;
      }

      const underlying = normalizeDhanUnderlying(tradingSymbol, get(iCustom), get(iSmName));
      if (!underlying) {
        skipped++;
        continue;
      }

      const lotSize = Math.max(1, Math.floor(Number(get(iLot)) || 1));
      const freezeQty = Number(get(iFreeze));
      const tickSize = Number(get(iTick));
      const instrumentKind: 'INDEX' | 'STOCK' =
        instrumentName.includes('IDX') || isIndexFoUnderlying(underlying) ? 'INDEX' : 'STOCK';

      rows.push({
        exchange,
        segment,
        tradingSymbol,
        instrumentToken: String(token),
        underlying,
        instrumentType,
        optionType,
        strike: isFut ? null : (strike as number),
        expiry,
        lotSize,
        freezeQty: Number.isFinite(freezeQty) && freezeQty > 0 ? freezeQty : null,
        tickSize: Number.isFinite(tickSize) && tickSize > 0 ? tickSize : null,
        instrumentKind,
        name: underlying,
        rawMeta: { instrumentName, exchRaw }
      });
    }

    logger.info(`Dhan master parse: ${rows.length} F&O rows (skipped non-FO/invalid=${skipped})`);
    return rows;
  }
}
