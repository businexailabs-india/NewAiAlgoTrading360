/**
 * NSE / BSE equity & equity-derivatives trading holidays.
 * Sources: exchange holiday circulars (2025–2027). Muhurat-only Sundays are NOT full trading days.
 * If an expiry weekday falls on a holiday, exchanges typically advance expiry to the previous trading day.
 */

export type MarketExchange = 'NSE' | 'BSE';

type Holiday = { date: string; name: string; exchanges?: MarketExchange[] };

/** Full-day trading holidays (equity + equity derivatives). Weekend-only observances omitted. */
const HOLIDAYS: Holiday[] = [
  // 2025 (NSE/BSE common set — used if calendar spans prior year)
  { date: '2025-02-26', name: 'Mahashivratri' },
  { date: '2025-03-14', name: 'Holi' },
  { date: '2025-03-31', name: 'Id-Ul-Fitr' },
  { date: '2025-04-10', name: 'Mahavir Jayanti' },
  { date: '2025-04-14', name: 'Dr Ambedkar Jayanti' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-05-01', name: 'Maharashtra Day' },
  { date: '2025-08-15', name: 'Independence Day' },
  { date: '2025-08-27', name: 'Ganesh Chaturthi' },
  { date: '2025-10-02', name: 'Mahatma Gandhi Jayanti' },
  { date: '2025-10-21', name: 'Dussehra' },
  { date: '2025-10-22', name: 'Diwali Laxmi Pujan' },
  { date: '2025-11-05', name: 'Guru Nanak Jayanti' },
  { date: '2025-12-25', name: 'Christmas' },

  // 2026 (NSE circular / published holiday list)
  { date: '2026-01-15', name: 'Municipal Corporation Election - Maharashtra' },
  { date: '2026-01-26', name: 'Republic Day' },
  { date: '2026-03-03', name: 'Holi' },
  { date: '2026-03-26', name: 'Shri Ram Navami' },
  { date: '2026-03-31', name: 'Shri Mahavir Jayanti' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-14', name: 'Dr Baba Saheb Ambedkar Jayanti' },
  { date: '2026-05-01', name: 'Maharashtra Day' },
  { date: '2026-05-28', name: 'Bakri Id' },
  { date: '2026-06-26', name: 'Muharram' },
  { date: '2026-09-14', name: 'Ganesh Chaturthi' },
  { date: '2026-10-02', name: 'Mahatma Gandhi Jayanti' },
  { date: '2026-10-20', name: 'Dussehra' },
  { date: '2026-11-10', name: 'Diwali-Balipratipada' },
  { date: '2026-11-24', name: 'Guru Nanak Jayanti' },
  { date: '2026-12-25', name: 'Christmas' },

  // 2027 (provisional common set — update when circular published)
  { date: '2027-01-26', name: 'Republic Day' },
  { date: '2027-03-08', name: 'Holi' },
  { date: '2027-03-26', name: 'Good Friday' },
  { date: '2027-04-14', name: 'Dr Ambedkar Jayanti' },
  { date: '2027-05-01', name: 'Maharashtra Day' },
  { date: '2027-08-15', name: 'Independence Day' },
  { date: '2027-10-02', name: 'Mahatma Gandhi Jayanti' },
  { date: '2027-12-25', name: 'Christmas' }
];

const HOLIDAY_SET = new Map(HOLIDAYS.map((h) => [h.date, h]));

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function exchangeForUnderlying(underlying: string): MarketExchange {
  const u = (underlying || '').toUpperCase();
  if (u === 'SENSEX' || u === 'BANKEX' || u === 'SENSEX50' || u === 'FOCIT') return 'BSE';
  return 'NSE';
}

export function isWeekend(dateYmd: string): boolean {
  const day = parseYmd(dateYmd).getUTCDay();
  return day === 0 || day === 6;
}

export function getHoliday(dateYmd: string): Holiday | undefined {
  return HOLIDAY_SET.get(dateYmd);
}

export function isMarketHoliday(dateYmd: string, exchange: MarketExchange = 'NSE'): boolean {
  if (isWeekend(dateYmd)) return true;
  const h = HOLIDAY_SET.get(dateYmd);
  if (!h) return false;
  if (!h.exchanges || h.exchanges.length === 0) return true;
  return h.exchanges.includes(exchange);
}

export function isTradingDay(dateYmd: string, exchange: MarketExchange = 'NSE'): boolean {
  return !isMarketHoliday(dateYmd, exchange);
}

/** Previous calendar trading day (skips weekends + holidays). */
export function previousTradingDay(dateYmd: string, exchange: MarketExchange = 'NSE'): string {
  let d = addDays(parseYmd(dateYmd), -1);
  for (let i = 0; i < 14; i++) {
    const s = ymd(d);
    if (isTradingDay(s, exchange)) return s;
    d = addDays(d, -1);
  }
  return ymd(d);
}

/**
 * If the scheduled expiry weekday is a holiday/weekend, move to the previous trading day.
 * Returns adjusted date + optional holiday name when shifted.
 */
export function adjustExpiryForHoliday(
  scheduledYmd: string,
  exchange: MarketExchange = 'NSE'
): { date: string; adjusted: boolean; holidayName?: string; scheduled: string } {
  if (isTradingDay(scheduledYmd, exchange)) {
    return { date: scheduledYmd, adjusted: false, scheduled: scheduledYmd };
  }
  const holidayName = getHoliday(scheduledYmd)?.name || (isWeekend(scheduledYmd) ? 'Weekend' : 'Holiday');
  return {
    date: previousTradingDay(scheduledYmd, exchange),
    adjusted: true,
    holidayName,
    scheduled: scheduledYmd
  };
}

export function listHolidays(year?: number): Holiday[] {
  if (year == null) return [...HOLIDAYS];
  const prefix = `${year}-`;
  return HOLIDAYS.filter((h) => h.date.startsWith(prefix));
}
