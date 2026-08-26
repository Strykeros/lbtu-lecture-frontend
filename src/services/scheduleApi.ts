import type {
  LectureEvent,
  ProgramInfo,
  ScheduleMetaResponse,
  ScheduleResponse,
} from '../types/schedule';

export interface ScheduleQuery {
  from: string;
  to: string;
  program?: string;
  semester?: string;
  direction?: string;
  refresh?: boolean;
}

export function scheduleQueryKey(query: ScheduleQuery): string {
  return JSON.stringify({
    from: query.from,
    to: query.to,
    program: query.program ?? 'all',
    semester: query.semester ?? 'all',
    direction: query.direction ?? 'all',
  });
}

const CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  data: ScheduleResponse;
  fetchedAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<ScheduleResponse>>();

function buildScheduleUrl(query: ScheduleQuery): string {
  const params = new URLSearchParams();
  params.set('from', query.from);
  params.set('to', query.to);
  if (query.program) params.set('program', query.program);
  if (query.semester) params.set('semester', query.semester);
  if (query.direction) params.set('direction', query.direction);
  if (query.refresh) params.set('refresh', '1');
  return `/api/schedule?${params.toString()}`;
}

export async function fetchSchedule(
  query: ScheduleQuery,
  signal?: AbortSignal,
): Promise<ScheduleResponse> {
  const key = scheduleQueryKey(query);

  if (query.refresh) {
    responseCache.delete(key);
  }

  if (!query.refresh) {
    const cached = responseCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CLIENT_CACHE_TTL_MS) {
      return cached.data;
    }
    // Only dedupe identical in-flight requests that cannot be aborted independently
    if (!signal) {
      const pending = inflight.get(key);
      if (pending) return pending;
    }
  }

  const request = (async () => {
    const res = await fetch(buildScheduleUrl(query), { signal });
    const data = (await res.json()) as ScheduleResponse & { error?: string };
    if (!res.ok && (!data.events || data.events.length === 0)) {
      throw new Error(data.error ?? 'Schedule could not be loaded');
    }
    const normalized = normalizeSchedule(data);
    responseCache.set(key, { data: normalized, fetchedAt: Date.now() });
    return normalized;
  })();

  if (!query.refresh && !signal) {
    inflight.set(key, request);
  }

  try {
    return await request;
  } finally {
    if (!signal) inflight.delete(key);
  }
}

/** Soft prefetch — ignores abort and swallows errors. */
export function prefetchSchedule(query: ScheduleQuery): void {
  void fetchSchedule(query).catch(() => {
    /* ignore prefetch errors */
  });
}

export async function fetchScheduleMeta(
  signal?: AbortSignal,
  refresh = false,
): Promise<ScheduleMetaResponse> {
  const url = refresh ? '/api/schedule/meta?refresh=1' : '/api/schedule/meta';
  const res = await fetch(url, { signal });
  const data = (await res.json()) as ScheduleMetaResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Schedule metadata could not be loaded');
  }
  return data;
}

function normalizeSchedule(data: ScheduleResponse): ScheduleResponse {
  return {
    ...data,
    count: data.count ?? data.events?.length ?? 0,
    directions: data.directions ?? [],
    programs: (data.programs ?? []).map(
      (p): ProgramInfo => ({
        ...p,
        subprograms: p.subprograms ?? [],
      }),
    ),
    events: (data.events ?? []).map(
      (e): LectureEvent => ({
        ...e,
        directionCode: e.directionCode ?? null,
        directionName: e.directionName ?? null,
      }),
    ),
  };
}

export function clearScheduleClientCache(): void {
  responseCache.clear();
  inflight.clear();
}
