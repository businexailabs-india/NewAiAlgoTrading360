/**
 * NSE/BSE index F&O expiry calendar (paper + master classification).
 *
 * SEBI expiry-day rationalisation (effective ~Sep 2025):
 * - NSE / Nifty weeklies + NSE monthlies: Tuesday
 * - BSE / Sensex weeklies + BSE monthlies: Thursday
 * Holiday rule: if expiry weekday is a market holiday, expiry advances to previous trading day.
 */

import {
  adjustExpiryForHoliday,
  exchangeForUnderlying,
  type MarketExchange
} from './market-holidays';

export type ExpiryKind = 'WEEKLY' | 'MONTHLY';

export type FoExpiryEntry = {
  date: string; // YYYY-MM-DD (holiday-adjusted settlement date)
  kind: ExpiryKind;
  label: string;
  weekday: string;
  scheduled?: string; // pre-holiday weekday when adjusted
  holiday_adjusted?: boolean;
  holiday_name?: string;
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Scheduled expiry weekday (0=Sun … 6=Sat) before holiday adjustment.
 * Nifty / NSE indices → Tuesday; Sensex / BSE → Thursday.
 */
export function expiryWeekday(underlying: string): number {
  const exchange = exchangeForUnderlying(underlying);
  // BSE Sensex (and Bankex): Thursday
  if (exchange === 'BSE') return 4;
  // NSE Nifty / Bank Nifty / Fin Nifty / Midcap Select / stock F&O: Tuesday
  return 2;
}

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

/** Last occurrence of `weekday` in the UTC month. */
export function lastWeekdayOfMonth(year: number, monthIndex: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const diff = (last.getUTCDay() - weekday + 7) % 7;
  last.setUTCDate(last.getUTCDate() - diff);
  return last;
}

function settleExpiry(scheduledYmd: string, underlying: string) {
  const exchange: MarketExchange = exchangeForUnderlying(underlying);
  return adjustExpiryForHoliday(scheduledYmd, exchange);
}

export function isMonthlyExpiry(dateYmd: string, underlying = 'NIFTY'): boolean {
  const wd = expiryWeekday(underlying);
  const d = parseYmd(dateYmd);
  // Compare against holiday-adjusted last weekday of the month (and neighbours if adj)
  for (const monthOffset of [-1, 0, 1]) {
    let year = d.getUTCFullYear();
    let month = d.getUTCMonth() + monthOffset;
    while (month < 0) {
      month += 12;
      year -= 1;
    }
    while (month > 11) {
      month -= 12;
      year += 1;
    }
    const scheduled = ymd(lastWeekdayOfMonth(year, month, wd));
    const settled = settleExpiry(scheduled, underlying).date;
    if (settled === dateYmd || scheduled === dateYmd) return true;
  }
  return false;
}

export function classifyExpiry(dateYmd: string, underlying = 'NIFTY'): ExpiryKind {
  return isMonthlyExpiry(dateYmd, underlying) ? 'MONTHLY' : 'WEEKLY';
}

function formatLabel(
  dateYmd: string,
  kind: ExpiryKind,
  adj?: { adjusted: boolean; holidayName?: string; scheduled?: string }
): string {
  const d = parseYmd(dateYmd);
  const day = d.getUTCDate();
  const mon = d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const year = d.getUTCFullYear();
  const base = `${kind === 'MONTHLY' ? 'Monthly' : 'Weekly'} - ${day} ${mon} ${year}`;
  if (adj?.adjusted && adj.holidayName) {
    return `${base} (was ${adj.scheduled}, ${adj.holidayName})`;
  }
  return base;
}

function toEntryFromScheduled(scheduledYmd: string, underlying: string, forceKind?: ExpiryKind): FoExpiryEntry {
  const settled = settleExpiry(scheduledYmd, underlying);
  const kind = forceKind || classifyExpiry(settled.date, underlying);
  const d = parseYmd(settled.date);
  return {
    date: settled.date,
    kind,
    label: formatLabel(settled.date, kind, {
      adjusted: settled.adjusted,
      holidayName: settled.holidayName,
      scheduled: settled.scheduled
    }),
    weekday: WEEKDAY[d.getUTCDay()],
    scheduled: settled.adjusted ? settled.scheduled : undefined,
    holiday_adjusted: settled.adjusted || undefined,
    holiday_name: settled.holidayName
  };
}

/** Next N weekly expiries (Nifty=Tue, Sensex=Thu), holiday-adjusted. */
export function generateWeeklyExpiries(underlying: string, count = 8, from = new Date()): FoExpiryEntry[] {
  const wd = expiryWeekday(underlying);
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  let d = start;
  const day = d.getUTCDay();
  let daysUntil = (wd - day + 7) % 7;
  if (daysUntil === 0 && from.getUTCHours() >= 12) {
    daysUntil = 7;
  }
  d = addDays(d, daysUntil);
  if (ymd(d) < ymd(start)) d = addDays(d, 7);

  const out: FoExpiryEntry[] = [];
  const seen = new Set<string>();
  // Generate extra raw weeks so holiday collapses still fill `count`
  for (let i = 0; i < count + 6 && out.length < count; i++) {
    const entry = toEntryFromScheduled(ymd(d), underlying);
    if (!seen.has(entry.date)) {
      seen.add(entry.date);
      // Only keep if still on/after today after adjustment
      if (entry.date >= ymd(start)) out.push(entry);
    }
    d = addDays(d, 7);
  }
  return out;
}

/** Next N monthly expiries (last Tue NSE / last Thu BSE), holiday-adjusted. */
export function generateMonthlyExpiries(underlying: string, count = 6, from = new Date()): FoExpiryEntry[] {
  const wd = expiryWeekday(underlying);
  const out: FoExpiryEntry[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  const today = ymd(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())));
  const seen = new Set<string>();

  while (out.length < count) {
    const scheduled = ymd(lastWeekdayOfMonth(year, month, wd));
    const entry = toEntryFromScheduled(scheduled, underlying, 'MONTHLY');
    if (entry.date >= today && !seen.has(entry.date)) {
      seen.add(entry.date);
      out.push(entry);
    }
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return out;
}

/** Merged upcoming weekly + monthly calendar (deduped by settlement date).
 * Rule: within each calendar month, the last expiry date is MONTHLY; earlier ones are WEEKLY.
 */
export function generateFoExpiryCalendar(
  underlying: string,
  opts?: { weeks?: number; months?: number; from?: Date }
): FoExpiryEntry[] {
  const weeks = generateWeeklyExpiries(underlying, opts?.weeks ?? 26, opts?.from);
  // Also ensure we have at least `months` months of last-expiry coverage beyond the weekly window
  const monthsNeeded = opts?.months ?? 8;
  const from = opts?.from || new Date();
  const today = ymd(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())));
  const wd = expiryWeekday(underlying);
  const map = new Map<string, FoExpiryEntry>();
  for (const e of weeks) map.set(e.date, { ...e, kind: 'WEEKLY' });

  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  for (let i = 0; i < monthsNeeded + 2; i++) {
    const scheduled = ymd(lastWeekdayOfMonth(year, month, wd));
    const entry = toEntryFromScheduled(scheduled, underlying);
    if (entry.date >= today) map.set(entry.date, { ...entry, kind: 'WEEKLY' });
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  return markLastExpiryOfMonthAsMonthly(sorted);
}

/** Last settlement date in each YYYY-MM is the monthly expiry. */
export function markLastExpiryOfMonthAsMonthly(entries: FoExpiryEntry[]): FoExpiryEntry[] {
  const byMonth = new Map<string, string>(); // YYYY-MM → last date
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    const prev = byMonth.get(key);
    if (!prev || e.date > prev) byMonth.set(key, e.date);
  }
  return entries.map((e) => {
    const last = byMonth.get(e.date.slice(0, 7));
    const kind: ExpiryKind = last === e.date ? 'MONTHLY' : 'WEEKLY';
    return {
      ...e,
      kind,
      label: formatLabel(e.date, kind, {
        adjusted: !!e.holiday_adjusted,
        holidayName: e.holiday_name,
        scheduled: e.scheduled
      })
    };
  });
}

/** Classify master-fed expiry dates: last date in each month = MONTHLY. */
export function classifyExpiryDates(underlying: string, dates: string[]): FoExpiryEntry[] {
  const uniq = Array.from(new Set(dates.filter(Boolean))).sort();
  const entries: FoExpiryEntry[] = uniq.map((d) => {
    const settled = settleExpiry(d, underlying);
    const day = parseYmd(d);
    return {
      date: d,
      kind: 'WEEKLY' as ExpiryKind,
      label: formatLabel(d, 'WEEKLY', {
        adjusted: settled.adjusted && settled.scheduled === d,
        holidayName: settled.holidayName,
        scheduled: settled.scheduled
      }),
      weekday: WEEKDAY[day.getUTCDay()],
      holiday_adjusted: settled.adjusted && settled.scheduled === d ? true : undefined,
      holiday_name: settled.adjusted && settled.scheduled === d ? settled.holidayName : undefined
    };
  });
  return markLastExpiryOfMonthAsMonthly(entries);
}

export function filterExpiriesByKind(
  entries: FoExpiryEntry[],
  kind: ExpiryKind | 'ALL'
): FoExpiryEntry[] {
  if (kind === 'ALL') return entries;
  return entries.filter((e) => e.kind === kind);
}
