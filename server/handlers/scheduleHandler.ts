import type { ProgramCode, ScheduleResponse } from '../../src/types/schedule.js';
import {
  applyScheduleFilters,
  getCachedSchedule,
  getCachedScheduleMeta,
  getCachedScheduleOptions,
} from '../cache.js';
import type { RequestTiming } from '../lib/timing.js';
import type {
  ScheduleMetaResponse,
  ScheduleOptionsResponse,
} from '../services/lbtu/getSchedule.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_SCHEDULE_RANGE_DAYS = 60;

export class ScheduleQueryError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ScheduleQueryError';
    this.status = status;
  }
}

function queryString(
  value: string | string[] | undefined,
): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return null;
}

function daysBetweenInclusive(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((b - a) / 86_400_000) + 1;
}

function todayInRiga(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Riga',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const utc = Date.UTC(y!, m! - 1, d! + days);
  const dt = new Date(utc);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function startOfWeekMonday(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const utc = Date.UTC(y!, m! - 1, d!);
  const sun0 = new Date(utc).getUTCDay();
  const mondayOffset = (sun0 + 6) % 7;
  return addDaysIso(iso, -mondayOffset);
}

/** Default visible window when clients omit from/to (current week, Europe/Riga). */
export function defaultScheduleRange(now = todayInRiga()): {
  from: string;
  to: string;
} {
  const from = startOfWeekMonday(now);
  return { from, to: addDaysIso(from, 6) };
}

export interface ParsedScheduleQuery {
  force: boolean;
  from: string;
  to: string;
  program: ProgramCode | null;
  semester: string | null;
  direction: string | null;
}

export function parseScheduleQuery(
  query: Record<string, string | string[] | undefined>,
): ParsedScheduleQuery {
  const refresh = queryString(query.refresh);
  let from = queryString(query.from);
  let to = queryString(query.to);
  const programRaw = queryString(query.program);
  const semesterRaw = queryString(query.semester);
  const directionRaw = queryString(query.direction);

  // Older PWA builds / bare /api/schedule hits — fall back to the current week
  if (!from && !to) {
    const fallback = defaultScheduleRange();
    from = fallback.from;
    to = fallback.to;
    console.log(
      `[schedule] missing from/to — defaulting to current week ${from}…${to}`,
    );
  }

  if (!from || !to) {
    throw new ScheduleQueryError(
      'Query parameters "from" and "to" are required (YYYY-MM-DD)',
    );
  }
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    throw new ScheduleQueryError('Dates must use YYYY-MM-DD format');
  }
  if (from > to) {
    throw new ScheduleQueryError('"from" must be on or before "to"');
  }
  const span = daysBetweenInclusive(from, to);
  if (span > MAX_SCHEDULE_RANGE_DAYS) {
    throw new ScheduleQueryError(
      `Date range too large (${span} days). Maximum is ${MAX_SCHEDULE_RANGE_DAYS} days.`,
    );
  }

  let program: ProgramCode | null = null;
  if (programRaw === 'G0108' || programRaw === 'G0405') {
    program = programRaw;
  } else if (programRaw && programRaw !== 'all') {
    throw new ScheduleQueryError('Invalid program. Use G0108, G0405, or omit.');
  }

  const semester = semesterRaw ? semesterRaw.replace(/\D/g, '') : null;
  if (semesterRaw && semesterRaw !== 'all' && !semester) {
    throw new ScheduleQueryError('Invalid semester');
  }

  let direction: string | null = null;
  if (directionRaw && directionRaw !== 'all') {
    if (!/^[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9_-]{1,32}$/u.test(directionRaw)) {
      throw new ScheduleQueryError('Invalid direction code');
    }
    direction = directionRaw;
  }

  return {
    force: refresh === '1' || refresh === 'true',
    from,
    to,
    program,
    semester: semester || null,
    direction,
  };
}

/**
 * Shared schedule payload for Express (local) and Vercel serverless (production).
 */
export async function loadScheduleResponse(
  query: ParsedScheduleQuery,
  timing?: RequestTiming,
): Promise<ScheduleResponse> {
  timing?.start('total');
  console.log(
    `[schedule] request start from=${query.from} to=${query.to} program=${query.program ?? 'all'} semester=${query.semester ?? 'all'} direction=${query.direction ?? 'all'} force=${query.force}`,
  );

  timing?.start('source');
  const data = await getCachedSchedule(
    {
      programs: query.program ? [query.program] : undefined,
      semester: query.semester,
      direction: query.direction,
    },
    { force: query.force },
  );
  timing?.end('source');

  timing?.start('filter');
  const filtered = applyScheduleFilters(data, {
    from: query.from,
    to: query.to,
    program: query.program,
    semester: query.semester,
    direction: query.direction,
  });
  timing?.end('filter');
  timing?.end('total');

  timing?.log('[schedule]');
  console.log(
    `[schedule] request complete count=${filtered.count ?? filtered.events.length} updatedAt=${filtered.updatedAt}`,
  );

  return filtered;
}

export async function loadScheduleMetaResponse(options?: {
  force?: boolean;
}): Promise<ScheduleMetaResponse> {
  console.log('[schedule] meta request start');
  const meta = await getCachedScheduleMeta(options);
  console.log(
    `[schedule] meta request complete programs=${meta.programs.length}`,
  );
  return meta;
}

export async function loadScheduleOptionsResponse(options?: {
  force?: boolean;
}): Promise<ScheduleOptionsResponse> {
  console.log('[schedule] options request start');
  const data = await getCachedScheduleOptions(options);
  console.log(
    `[schedule] options request complete programs=${data.programs.length}`,
  );
  return data;
}

export function scheduleErrorPayload(err: unknown): ScheduleResponse {
  return {
    updatedAt: new Date().toISOString(),
    source: 'https://lais.lbtu.lv/luis/lsarG.html',
    programs: [
      { code: 'G0108', name: 'Ekonomika Maģistra' },
      { code: 'G0405', name: 'Lauksaimniecības inženierzinātne Maģistra' },
    ],
    directions: [],
    events: [],
    count: 0,
    error: err instanceof Error ? err.message : 'Schedule could not be loaded',
  };
}
