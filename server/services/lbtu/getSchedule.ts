import type {
  LectureEvent,
  ProgramInfo,
  ScheduleResponse,
  StudyDirection,
} from '../../../src/types/schedule.js';
import { LBTU_INDEX_URL, TARGET_PROGRAMS } from './constants.js';
import { deduplicateEvents } from './deduplicate.js';
import { fetchLbtu } from './fetch.js';
import { parseIndex } from './parseIndex.js';
import { parseSchedulePage } from './parseSchedule.js';
import { parseDirectionsFromSchedulePage } from './parseSubprograms.js';

export async function getLbtuSchedule(): Promise<ScheduleResponse> {
  const indexHtml = await fetchLbtu(LBTU_INDEX_URL);
  const links = parseIndex(indexHtml, ['G0108', 'G0405']);

  if (links.length === 0) {
    throw new Error('No schedule links found for G0108 / G0405 on LBTU index page');
  }

  const allDirections: StudyDirection[] = [];
  const allEvents: LectureEvent[] = [];
  const errors: string[] = [];

  // 1) Fetch each semester "Visas" page to discover novirzieni (or use it as the only schedule).
  for (const link of links) {
    try {
      const html = await fetchLbtu(link.url);
      const directions = parseDirectionsFromSchedulePage(
        html,
        link.programCode,
        link.semester,
      );

      if (directions.length === 0) {
        // No novirzieni — use this semester page as-is.
        const events = parseSchedulePage(html, {
          programCode: link.programCode,
          programName: TARGET_PROGRAMS[link.programCode].name,
          semester: link.semester,
          sourceUrl: link.url,
          directionCode: null,
          directionName: null,
        });
        allEvents.push(...events);
        continue;
      }

      allDirections.push(...directions);

      // 2) Fetch each novirziens page individually — do NOT also parse Visas events.
      const directionResults = await Promise.all(
        directions.map(async (dir) => {
          try {
            const dirHtml = await fetchLbtu(dir.sourceUrl);
            const events = parseSchedulePage(dirHtml, {
              programCode: dir.programCode,
              programName: TARGET_PROGRAMS[dir.programCode].name,
              semester: dir.semester,
              sourceUrl: dir.sourceUrl,
              directionCode: dir.code,
              directionName: dir.name,
            });
            return { events, error: null as string | null };
          } catch (err) {
            return {
              events: [] as LectureEvent[],
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }),
      );

      for (const result of directionResults) {
        allEvents.push(...result.events);
        if (result.error) {
          errors.push(`${link.programCode} ${link.semester}-sem: ${result.error}`);
        }
      }
    } catch (err) {
      errors.push(
        `${link.programCode} ${link.semester}-sem: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  const events = deduplicateEvents(allEvents);

  if (events.length === 0 && errors.length > 0) {
    throw new Error(`Failed to fetch schedules: ${errors.join('; ')}`);
  }

  const uniqueDirections = dedupeDirections(allDirections);

  const programs: ProgramInfo[] = (['G0108', 'G0405'] as const).map((code) => ({
    code,
    name: TARGET_PROGRAMS[code].name,
    subprograms: uniqueDirections
      .filter((d) => d.programCode === code)
      .map((d) => ({
        code: d.code,
        name: d.name,
        programCode: d.programCode,
      })),
  }));

  return {
    updatedAt: formatRigaIso(new Date()),
    source: LBTU_INDEX_URL,
    programs,
    directions: uniqueDirections,
    events,
    ...(errors.length > 0 ? { error: `Daļēji neizdevās ielādēt: ${errors.join('; ')}` } : {}),
  };
}

function dedupeDirections(dirs: StudyDirection[]): StudyDirection[] {
  const map = new Map<string, StudyDirection>();
  for (const d of dirs) {
    const key = `${d.programCode}|${d.semester}|${d.code}`;
    if (!map.has(key)) map.set(key, d);
  }
  return [...map.values()].sort((a, b) => {
    const byProg = a.programCode.localeCompare(b.programCode);
    if (byProg !== 0) return byProg;
    const bySem = Number(a.semester) - Number(b.semester);
    if (bySem !== 0) return bySem;
    return a.code.localeCompare(b.code, 'lv');
  });
}

export function formatRigaIso(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Riga',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const local = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;

  const offsetMinutes = getTimeZoneOffsetMinutes(date, 'Europe/Riga');
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, '0');
  const om = String(abs % 60).padStart(2, '0');
  return `${local}${sign}${oh}:${om}`;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second'),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}
