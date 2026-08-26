import type { ProgramCode } from '../../../src/types/schedule.js';

export const LBTU_ORIGIN = 'https://lais.lbtu.lv';
export const LBTU_INDEX_URL = `${LBTU_ORIGIN}/luis/lsarG.html`;
export const LBTU_ALLOWED_HOST = 'lais.lbtu.lv';

export const TARGET_PROGRAMS: Record<
  ProgramCode,
  { code: ProgramCode; name: string; nameMatchers: string[] }
> = {
  G0108: {
    code: 'G0108',
    name: 'Ekonomika Maģistra',
    nameMatchers: ['Ekonomika Maģistra', 'Ekonomika Magistra'],
  },
  G0405: {
    code: 'G0405',
    name: 'Lauksaimniecības inženierzinātne Maģistra',
    nameMatchers: [
      'Lauksaimniecības inženierzinātne Maģistra',
      'Lauksaimniecibas inzenierzinatne Magistra',
    ],
  },
};

export const USER_AGENT =
  'LBTU-Lecture-Calendar/1.0 (+educational timetable viewer; contact: local-app)';

export const FETCH_TIMEOUT_MS = 20_000;
export const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const WEEKDAY_NAMES_LV = [
  'Pirmdiena',
  'Otrdiena',
  'Trešdiena',
  'Ceturtdiena',
  'Piektdiena',
  'Sestdiena',
  'Svētdiena',
] as const;

/** Maps LBTU weekday header text (possibly without diacritics) to Monday=0..Sunday=6 */
export function weekdayIndexFromHeader(header: string): number | null {
  const n = header
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

  const map: Record<string, number> = {
    pirmdiena: 0,
    otrdiena: 1,
    tresdiena: 2,
    ceturtdiena: 3,
    piektdiena: 4,
    sestdiena: 5,
    svetdiena: 6,
  };

  return map[n] ?? null;
}

export function weekdayNameFromIndex(index: number): string {
  return WEEKDAY_NAMES_LV[index] ?? '';
}
