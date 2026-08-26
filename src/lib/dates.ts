/** Client-side date helpers using Europe/Riga civil dates. */

export const TIMEZONE = 'Europe/Riga';

const MONTHS_LV = [
  'janvāris',
  'februāris',
  'marts',
  'aprīlis',
  'maijs',
  'jūnijs',
  'jūlijs',
  'augusts',
  'septembris',
  'oktobris',
  'novembris',
  'decembris',
];

const MONTHS_SHORT_LV = [
  'jan',
  'feb',
  'mar',
  'apr',
  'mai',
  'jūn',
  'jūl',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

const WEEKDAYS_SHORT_LV = ['Pir', 'Otr', 'Tre', 'Cet', 'Pie', 'Ses', 'Svē'];
const WEEKDAYS_LONG_LV = [
  'Pirmdiena',
  'Otrdiena',
  'Trešdiena',
  'Ceturtdiena',
  'Piektdiena',
  'Sestdiena',
  'Svētdiena',
];

export function nowInRiga(): { date: string; time: string; weekdayIndex: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const time = `${get('hour')}:${get('minute')}`;
  return { date, time, weekdayIndex: weekdayIndexFromIso(date) };
}

export function todayIso(): string {
  return nowInRiga().date;
}

export function parseIsoDate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}

export function formatIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function addDaysIso(iso: string, days: number): string {
  const { y, m, d } = parseIsoDate(iso);
  const utc = Date.UTC(y, m - 1, d + days);
  const dt = new Date(utc);
  return formatIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function startOfWeekMonday(iso: string): string {
  const idx = weekdayIndexFromIso(iso);
  return addDaysIso(iso, -idx);
}

export function weekdayIndexFromIso(iso: string): number {
  const { y, m, d } = parseIsoDate(iso);
  const utc = Date.UTC(y, m - 1, d);
  const sun0 = new Date(utc).getUTCDay(); // 0=Sun
  return (sun0 + 6) % 7;
}

export function formatDayHeading(iso: string): string {
  const { m, d } = parseIsoDate(iso);
  const wd = WEEKDAYS_LONG_LV[weekdayIndexFromIso(iso)]!;
  return `${wd}, ${d}. ${MONTHS_LV[m - 1]}`;
}

export function formatMonthYear(iso: string): string {
  const { y, m } = parseIsoDate(iso);
  const name = MONTHS_LV[m - 1]!;
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

export function formatWeekRange(weekStart: string): string {
  const end = addDaysIso(weekStart, 6);
  const a = parseIsoDate(weekStart);
  const b = parseIsoDate(end);
  if (a.m === b.m) {
    return `${MONTHS_LV[a.m - 1]!.toUpperCase()} ${a.d}–${b.d}`;
  }
  return `${a.d}. ${MONTHS_SHORT_LV[a.m - 1]} – ${b.d}. ${MONTHS_SHORT_LV[b.m - 1]}`;
}

export function formatDayShort(iso: string): { weekday: string; day: number } {
  return {
    weekday: WEEKDAYS_SHORT_LV[weekdayIndexFromIso(iso)]!,
    day: parseIsoDate(iso).d,
  };
}

export function formatUpdatedAt(isoWithOffset: string): string {
  try {
    const d = new Date(isoWithOffset);
    return new Intl.DateTimeFormat('lv-LV', {
      timeZone: TIMEZONE,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d);
  } catch {
    return isoWithOffset;
  }
}

export function minutesBetween(startHm: string, endHm: string): number {
  const [sh, sm] = startHm.split(':').map(Number);
  const [eh, em] = endHm.split(':').map(Number);
  return eh! * 60 + em! - (sh! * 60 + sm!);
}

export function timeToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h! * 60 + m!;
}

export function formatStartsIn(fromHm: string, toHm: string): string {
  const diff = timeToMinutes(toHm) - timeToMinutes(fromHm);
  if (diff <= 0) return 'Sākas tagad';
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `Sākas pēc ${m} min`;
  if (m === 0) return `Sākas pēc ${h} h`;
  return `Sākas pēc ${h} h ${m} min`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export { WEEKDAYS_SHORT_LV, WEEKDAYS_LONG_LV, MONTHS_LV };
