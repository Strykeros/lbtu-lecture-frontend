/**
 * Date/time helpers for LBTU timetable parsing.
 * All calendar dates are treated as civil dates in Europe/Riga — never via Date.parse of DD.MM.YYYY.
 */

const DATE_RE = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const TIME_RANGE_RE = /^(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})$/;
const DATE_RANGE_RE =
  /^(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–—]\s*(\d{1,2}\.\d{1,2}\.\d{4})$/;

export function parseLbtuDate(value: string): string | null {
  const m = value.trim().match(DATE_RE);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!isValidYmd(year, month, day)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseLbtuTimeRange(
  value: string,
): { startTime: string; endTime: string } | null {
  const m = value.trim().match(TIME_RANGE_RE);
  if (!m) return null;
  const sh = Number(m[1]);
  const sm = Number(m[2]);
  const eh = Number(m[3]);
  const em = Number(m[4]);
  if (
    sh < 0 ||
    sh > 23 ||
    eh < 0 ||
    eh > 23 ||
    sm < 0 ||
    sm > 59 ||
    em < 0 ||
    em > 59
  ) {
    return null;
  }
  return {
    startTime: `${pad(sh)}:${pad(sm)}`,
    endTime: `${pad(eh)}:${pad(em)}`,
  };
}

export function parseDateRange(
  value: string,
): { start: string; end: string } | null {
  const m = value.trim().match(DATE_RANGE_RE);
  if (!m) return null;
  const start = parseLbtuDate(m[1]);
  const end = parseLbtuDate(m[2]);
  if (!start || !end) return null;
  return { start, end };
}

/**
 * Expand a date range onto a specific weekday (Mon=0 … Sun=6).
 * Inclusive of both ends. Does NOT invent dates outside the range.
 */
export function expandWeekdayDates(
  startIso: string,
  endIso: string,
  weekdayIndex: number,
): string[] {
  const start = ymdToParts(startIso);
  const end = ymdToParts(endIso);
  if (!start || !end) return [];

  const dates: string[] = [];
  let y = start.y;
  let m = start.m;
  let d = start.d;

  while (compareYmd(y, m, d, end.y, end.m, end.d) <= 0) {
    const dow = dayOfWeekMon0(y, m, d);
    if (dow === weekdayIndex) {
      dates.push(`${y}-${pad(m)}-${pad(d)}`);
    }
    ({ y, m, d } = addDays(y, m, d, 1));
  }
  return dates;
}

/**
 * Filter alternating weeks: 1.ned. = 1st, 3rd, 5th… occurrence; 2.ned. = 2nd, 4th…
 */
export function filterWeekPattern(
  dates: string[],
  pattern: string | null,
): string[] {
  if (!pattern) return dates;
  const n = pattern.replace(/\s+/g, '').toLowerCase();
  if (n.startsWith('1.ned')) {
    return dates.filter((_, i) => i % 2 === 0);
  }
  if (n.startsWith('2.ned')) {
    return dates.filter((_, i) => i % 2 === 1);
  }
  return dates;
}

export function isValidYmd(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dim = daysInMonth(year, month);
  return day <= dim;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ymdToParts(
  iso: string,
): { y: number; m: number; d: number } | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function compareYmd(
  y1: number,
  m1: number,
  d1: number,
  y2: number,
  m2: number,
  d2: number,
): number {
  if (y1 !== y2) return y1 - y2;
  if (m1 !== m2) return m1 - m2;
  return d1 - d2;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    month - 1
  ]!;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Sakamoto algorithm, returns Monday=0 … Sunday=6 */
export function dayOfWeekMon0(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  const sun0 = (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1]! + d) % 7;
  return (sun0 + 6) % 7; // convert Sunday=0 → Monday=0
}

function addDays(
  y: number,
  m: number,
  d: number,
  days: number,
): { y: number; m: number; d: number } {
  let nd = d + days;
  let nm = m;
  let ny = y;
  while (nd > daysInMonth(ny, nm)) {
    nd -= daysInMonth(ny, nm);
    nm += 1;
    if (nm > 12) {
      nm = 1;
      ny += 1;
    }
  }
  while (nd < 1) {
    nm -= 1;
    if (nm < 1) {
      nm = 12;
      ny -= 1;
    }
    nd += daysInMonth(ny, nm);
  }
  return { y: ny, m: nm, d: nd };
}

export function weekdayFromIsoDate(iso: string): string {
  const p = ymdToParts(iso);
  if (!p) return '';
  const names = [
    'Pirmdiena',
    'Otrdiena',
    'Trešdiena',
    'Ceturtdiena',
    'Piektdiena',
    'Sestdiena',
    'Svētdiena',
  ];
  return names[dayOfWeekMon0(p.y, p.m, p.d)] ?? '';
}
