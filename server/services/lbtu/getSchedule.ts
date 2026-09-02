import type {
  LectureEvent,
  ProgramCode,
  ProgramInfo,
  ScheduleResponse,
  StudyDirection,
} from '../../../src/types/schedule.js';
import { CACHE_TTL_MS, INDEX_CACHE_TTL_MS, LBTU_FETCH_CONCURRENCY, LBTU_INDEX_URL, TARGET_PROGRAMS } from './constants.js';
import { deduplicateEvents } from './deduplicate.js';
import { fetchLbtu } from './fetch.js';
import { lectureContentKey } from './normalize.js';
import { mapPool } from './concurrency.js';
import {
  parseIndex,
  type DiscoveredSemesterLink,
} from './parseIndex.js';
import { parseSchedulePage } from './parseSchedule.js';
import { parseDirectionsFromSchedulePage } from './parseSubprograms.js';

export interface ScheduleFetchScope {
  /** Restrict to these programs; omit/empty = both targets. */
  programs?: ProgramCode[];
  /** Restrict to one semester number; omit = all. */
  semester?: string | null;
  /**
   * Specific novirziens code, or null/`all` for every direction
   * (or the Visas page when a semester has none).
   */
  direction?: string | null;
}

export interface ScheduleMetaSemester {
  semester: string;
  directions: Array<{ code: string; name: string }>;
}

export interface ScheduleMetaProgram {
  code: ProgramCode;
  name: string;
  semesters: ScheduleMetaSemester[];
}

export interface ScheduleMetaResponse {
  updatedAt: string;
  source: string;
  programs: ScheduleMetaProgram[];
}

export interface ScheduleOptionsProgram {
  code: ProgramCode;
  name: string;
  semesters: string[];
}

export interface ScheduleOptionsResponse {
  updatedAt: string;
  source: string;
  programs: ScheduleOptionsProgram[];
}

interface DirectionMetaEntry {
  directions: StudyDirection[];
  fetchedAt: number;
}

interface EventsEntry {
  events: LectureEvent[];
  fetchedAt: number;
}

interface IndexEntry {
  links: DiscoveredSemesterLink[];
  fetchedAt: number;
}

const indexCache: { current: IndexEntry | null } = { current: null };
const directionMetaCache = new Map<string, DirectionMetaEntry>();
const eventsCache = new Map<string, EventsEntry>();
const scopeResultCache = new Map<string, { data: ScheduleResponse; fetchedAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

function isIndexFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < INDEX_CACHE_TTL_MS;
}

function scopeCacheKey(
  programs: ProgramCode[],
  semester: string | null,
  direction: string | null,
): string {
  return `${programs.join('+')}:${semester ?? 'all'}:${direction ?? 'all'}`;
}

async function withInflight<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, promise);
  return promise;
}

export async function getIndexLinks(force = false): Promise<DiscoveredSemesterLink[]> {
  if (!force && indexCache.current && isIndexFresh(indexCache.current.fetchedAt)) {
    return indexCache.current.links;
  }
  return withInflight('index', async () => {
    if (!force && indexCache.current && isIndexFresh(indexCache.current.fetchedAt)) {
      return indexCache.current.links;
    }
    console.log('[schedule] fetching LBTU index');
    const html = await fetchLbtu(LBTU_INDEX_URL);
    const links = parseIndex(html, ['G0108', 'G0405']);
    console.log(`[schedule] found ${links.length} schedule pages`);
    indexCache.current = { links, fetchedAt: Date.now() };
    return links;
  });
}

function dirMetaKey(program: ProgramCode, semester: string): string {
  return `dirmeta:${program}:${semester}`;
}

function eventsKey(
  program: ProgramCode,
  semester: string,
  directionCode: string | null,
): string {
  return `events:${program}:${semester}:${directionCode ?? '_none_'}`;
}

async function getDirectionsForLink(
  link: DiscoveredSemesterLink,
  force = false,
): Promise<StudyDirection[]> {
  const key = dirMetaKey(link.programCode, link.semester);
  const cached = directionMetaCache.get(key);
  if (!force && cached && isFresh(cached.fetchedAt)) {
    return cached.directions;
  }

  return withInflight(key, async () => {
    const again = directionMetaCache.get(key);
    if (!force && again && isFresh(again.fetchedAt)) {
      return again.directions;
    }
    const html = await fetchLbtu(link.url);
    const directions = parseDirectionsFromSchedulePage(
      html,
      link.programCode,
      link.semester,
    );
    directionMetaCache.set(key, { directions, fetchedAt: Date.now() });

    // Semesters without novirzieni: parse events from the same HTML once
    if (directions.length === 0) {
      const evKey = eventsKey(link.programCode, link.semester, null);
      if (force || !eventsCache.get(evKey) || !isFresh(eventsCache.get(evKey)!.fetchedAt)) {
        const events = parseSchedulePage(html, {
          programCode: link.programCode,
          programName: TARGET_PROGRAMS[link.programCode].name,
          semester: link.semester,
          sourceUrl: link.url,
          directionCode: null,
          directionName: null,
        });
        eventsCache.set(evKey, { events, fetchedAt: Date.now() });
      }
    }

    return directions;
  });
}

async function getEventsForSource(
  link: DiscoveredSemesterLink,
  direction: StudyDirection | null,
  force = false,
): Promise<LectureEvent[]> {
  const key = eventsKey(link.programCode, link.semester, direction?.code ?? null);
  const cached = eventsCache.get(key);
  if (!force && cached && isFresh(cached.fetchedAt)) {
    return cached.events;
  }

  return withInflight(key, async () => {
    const again = eventsCache.get(key);
    if (!force && again && isFresh(again.fetchedAt)) {
      return again.events;
    }

    const sourceUrl = direction?.sourceUrl ?? link.url;
    console.log(
      `[schedule] fetching events ${link.programCode} sem${link.semester} ${direction?.code ?? 'Visas'}`,
    );
    const html = await fetchLbtu(sourceUrl);
    const events = parseSchedulePage(html, {
      programCode: link.programCode,
      programName: TARGET_PROGRAMS[link.programCode].name,
      semester: link.semester,
      sourceUrl,
      directionCode: direction?.code ?? null,
      directionName: direction?.name ?? null,
    });
    eventsCache.set(key, { events, fetchedAt: Date.now() });
    return events;
  });
}

function resolvePrograms(scope: ScheduleFetchScope): ProgramCode[] {
  if (scope.programs && scope.programs.length > 0) {
    return scope.programs;
  }
  return ['G0108', 'G0405'];
}

function normalizeDirectionFilter(direction?: string | null): string | null {
  if (!direction || direction === 'all') return null;
  return direction;
}

/**
 * Fetch/parse only the LBTU sources needed for the given filter scope.
 * Results are cached per program/semester/direction source.
 */
export async function getLbtuSchedule(
  scope: ScheduleFetchScope = {},
  options?: { force?: boolean },
): Promise<ScheduleResponse> {
  const force = Boolean(options?.force);
  const programs = resolvePrograms(scope);
  const semesterFilter = scope.semester?.replace(/\D/g, '') || null;
  const directionFilter = normalizeDirectionFilter(scope.direction);
  const cacheKey = scopeCacheKey(programs, semesterFilter, directionFilter);

  if (force) {
    invalidateScopeCache(scope);
  }

  if (!force) {
    const cached = scopeResultCache.get(cacheKey);
    if (cached && isFresh(cached.fetchedAt)) {
      console.log(`[schedule] scope cache hit ${cacheKey}`);
      return cached.data;
    }
  }

  return withInflight(`scope:${cacheKey}:${force}`, async () => {
    if (!force) {
      const again = scopeResultCache.get(cacheKey);
      if (again && isFresh(again.fetchedAt)) {
        return again.data;
      }
    }

    const links = (await getIndexLinks(false)).filter((link) => {
      if (!programs.includes(link.programCode)) return false;
      if (semesterFilter && link.semester !== semesterFilter) return false;
      return true;
    });

    if (links.length === 0) {
      throw new Error('No schedule links found for the selected program/semester');
    }

    const linkResults = await mapPool(links, LBTU_FETCH_CONCURRENCY, async (link) => {
      const allDirections: StudyDirection[] = [];
      const allEvents: LectureEvent[] = [];
      const errors: string[] = [];

      try {
        const directions = await getDirectionsForLink(link, force);
        allDirections.push(...directions);

        if (directions.length === 0) {
          if (directionFilter) {
            return { allDirections, allEvents, errors };
          }
          const events = await getEventsForSource(link, null, force);
          allEvents.push(...events);
          return { allDirections, allEvents, errors };
        }

        const wanted = directionFilter
          ? directions.filter((d) => d.code === directionFilter)
          : directions;

        if (directionFilter && wanted.length === 0) {
          errors.push(
            `${link.programCode} ${link.semester}-sem: novirziens "${directionFilter}" nav atrasts`,
          );
          return { allDirections, allEvents, errors };
        }

        const results = await Promise.all(
          wanted.map(async (dir) => {
            try {
              const events = await getEventsForSource(link, dir, force);
              return { events, error: null as string | null };
            } catch (err) {
              return {
                events: [] as LectureEvent[],
                error: err instanceof Error ? err.message : String(err),
              };
            }
          }),
        );

        for (const result of results) {
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

      return { allDirections, allEvents, errors };
    });

    const allDirections: StudyDirection[] = [];
    const allEvents: LectureEvent[] = [];
    const errors: string[] = [];
    for (const result of linkResults) {
      allDirections.push(...result.allDirections);
      allEvents.push(...result.allEvents);
      errors.push(...result.errors);
    }

    const events = deduplicateEvents(allEvents);

    if (events.length === 0 && errors.length > 0 && allDirections.length === 0) {
      throw new Error(`Failed to fetch schedules: ${errors.join('; ')}`);
    }

    const uniqueDirections = dedupeDirections(allDirections);
    const programInfos: ProgramInfo[] = programs.map((code) => ({
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

    console.log(
      `[schedule] parsed ${events.length} events for scope programs=${programs.join(',')} semester=${semesterFilter ?? 'all'} direction=${directionFilter ?? 'all'}`,
    );

    const response: ScheduleResponse = {
      updatedAt: formatRigaIso(new Date()),
      source: LBTU_INDEX_URL,
      programs: programInfos,
      directions: uniqueDirections,
      events,
      ...(errors.length > 0
        ? { error: `Daļēji neizdevās ielādēt: ${errors.join('; ')}` }
        : {}),
    };

    scopeResultCache.set(cacheKey, { data: response, fetchedAt: Date.now() });
    return response;
  });
}

/** Index-only programme/semester list — no semester page fetches, no events. */
export async function getLbtuScheduleOptions(
  options?: { force?: boolean },
): Promise<ScheduleOptionsResponse> {
  const force = Boolean(options?.force);
  const links = await getIndexLinks(force);
  const semestersByProgram = new Map<ProgramCode, Set<string>>();

  for (const code of ['G0108', 'G0405'] as const) {
    semestersByProgram.set(code, new Set());
  }

  for (const link of links) {
    semestersByProgram.get(link.programCode)?.add(link.semester);
  }

  return {
    updatedAt: formatRigaIso(new Date()),
    source: LBTU_INDEX_URL,
    programs: (['G0108', 'G0405'] as const).map((code) => ({
      code,
      name: TARGET_PROGRAMS[code].name,
      semesters: [...(semestersByProgram.get(code) ?? [])].sort(
        (a, b) => Number(a) - Number(b),
      ),
    })),
  };
}

/**
 * Drop cached scrape results for one programme/semester/direction scope.
 * Used by manual refresh so unrelated programmes stay cached.
 */
export function invalidateScopeCache(scope: ScheduleFetchScope): void {
  const programs = resolvePrograms(scope);
  const semesterFilter = scope.semester?.replace(/\D/g, '') || null;
  const directionFilter = normalizeDirectionFilter(scope.direction);
  const cacheKey = scopeCacheKey(programs, semesterFilter, directionFilter);
  scopeResultCache.delete(cacheKey);

  for (const program of programs) {
    if (!semesterFilter) continue;
    directionMetaCache.delete(dirMetaKey(program, semesterFilter));

    if (directionFilter) {
      eventsCache.delete(eventsKey(program, semesterFilter, directionFilter));
    } else {
      for (const key of [...eventsCache.keys()]) {
        if (key.startsWith(`events:${program}:${semesterFilter}:`)) {
          eventsCache.delete(key);
        }
      }
    }
  }
}

/** Lightweight filter metadata — does not parse lecture grids. */
export async function getLbtuScheduleMeta(
  options?: { force?: boolean },
): Promise<ScheduleMetaResponse> {
  const force = Boolean(options?.force);
  const links = await getIndexLinks(force);
  const byProgram = new Map<ProgramCode, ScheduleMetaProgram>();

  for (const code of ['G0108', 'G0405'] as const) {
    byProgram.set(code, {
      code,
      name: TARGET_PROGRAMS[code].name,
      semesters: [],
    });
  }

  const rows = await mapPool(links, LBTU_FETCH_CONCURRENCY, async (link) => {
    const directions = await getDirectionsForLink(link, force);
    return { link, directions };
  });

  for (const { link, directions } of rows) {
    const prog = byProgram.get(link.programCode);
    if (!prog) continue;
    prog.semesters.push({
      semester: link.semester,
      directions: directions.map((d) => ({ code: d.code, name: d.name })),
    });
  }

  for (const prog of byProgram.values()) {
    prog.semesters.sort((a, b) => Number(a.semester) - Number(b.semester));
  }

  return {
    updatedAt: formatRigaIso(new Date()),
    source: LBTU_INDEX_URL,
    programs: [...byProgram.values()],
  };
}

export function filterEventsByQuery(
  events: LectureEvent[],
  options: {
    from: string;
    to: string;
    program?: string | null;
    semester?: string | null;
    direction?: string | null;
  },
): LectureEvent[] {
  let result = events.filter(
    (e) => e.date >= options.from && e.date <= options.to,
  );

  if (options.program === 'G0108' || options.program === 'G0405') {
    result = result.filter((e) => e.programCode === options.program);
  }
  if (options.semester) {
    result = result.filter((e) => e.semester === options.semester);
  }

  const direction = normalizeDirectionFilter(options.direction);
  if (direction) {
    result = result.filter((e) => e.directionCode === direction);
  } else {
    // Visi novirzieni: one card per real lecture
    const map = new Map<string, LectureEvent>();
    for (const e of result) {
      const key = lectureContentKey(e);
      if (!map.has(key)) map.set(key, e);
    }
    result = [...map.values()];
  }

  return result.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.startTime.localeCompare(b.startTime) ||
      a.courseName.localeCompare(b.courseName, 'lv'),
  );
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

/** Test/helper: clear in-memory scraper caches. */
export function clearScheduleCaches(): void {
  indexCache.current = null;
  directionMetaCache.clear();
  eventsCache.clear();
  scopeResultCache.clear();
  inflight.clear();
}
