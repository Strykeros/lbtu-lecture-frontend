import type {
  LectureEvent,
  ProgramInfo,
  ScheduleMetaResponse,
  ScheduleOptionsResponse,
  ScheduleResponse,
} from '../types/schedule';
import {
  readPersistedMeta,
  readPersistedOptions,
  readPersistedSchedule,
  writePersistedMeta,
  writePersistedOptions,
  writePersistedSchedule,
} from '../lib/scheduleClientCache';

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

const MEMORY_CACHE_TTL_MS = 10 * 60 * 1000;

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

function cacheSchedule(key: string, data: ScheduleResponse): ScheduleResponse {
  const normalized = normalizeSchedule(data);
  responseCache.set(key, { data: normalized, fetchedAt: Date.now() });
  writePersistedSchedule(key, normalized);
  return normalized;
}

/** Instant client-side cache (memory → localStorage). */
export function getCachedSchedule(query: ScheduleQuery): ScheduleResponse | null {
  const key = scheduleQueryKey(query);
  const mem = responseCache.get(key);
  if (mem && Date.now() - mem.fetchedAt < MEMORY_CACHE_TTL_MS) {
    return mem.data;
  }
  const persisted = readPersistedSchedule(key);
  if (persisted) {
    responseCache.set(key, { data: persisted, fetchedAt: Date.now() });
    return persisted;
  }
  return null;
}

export async function fetchSchedule(
  query: ScheduleQuery,
  signal?: AbortSignal,
): Promise<ScheduleResponse> {
  const key = scheduleQueryKey(query);

  if (query.refresh) {
    responseCache.delete(key);
  } else {
    const cached = getCachedSchedule(query);
    if (cached) return cached;

    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const request = (async () => {
    const res = await fetch(buildScheduleUrl(query), { signal });
    const data = (await res.json()) as ScheduleResponse & { error?: string };
    if (!res.ok && (!data.events || data.events.length === 0)) {
      throw new Error(data.error ?? 'Schedule could not be loaded');
    }
    return cacheSchedule(key, data);
  })();

  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

/** Soft prefetch — ignores abort and swallows errors. */
export function prefetchSchedule(query: ScheduleQuery): void {
  if (getCachedSchedule(query)) return;
  void fetchSchedule(query).catch(() => {
    /* ignore prefetch errors */
  });
}

export function getCachedMeta(): ScheduleMetaResponse | null {
  return readPersistedMeta();
}

export function getCachedOptions(): ScheduleOptionsResponse | null {
  return readPersistedOptions();
}

export async function fetchScheduleOptions(
  signal?: AbortSignal,
  refresh = false,
): Promise<ScheduleOptionsResponse> {
  if (!refresh) {
    const cached = getCachedOptions();
    if (cached) return cached;
  }

  const url = refresh
    ? '/api/schedule/options?refresh=1'
    : '/api/schedule/options';
  const res = await fetch(url, { signal });
  const data = (await res.json()) as ScheduleOptionsResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Studiju programmas neizdevās ielādēt');
  }
  writePersistedOptions(data);
  return data;
}

export async function fetchScheduleMeta(
  signal?: AbortSignal,
  refresh = false,
): Promise<ScheduleMetaResponse> {
  if (!refresh) {
    const cached = getCachedMeta();
    if (cached) return cached;
  }

  const url = refresh ? '/api/meta?refresh=1' : '/api/meta';
  const res = await fetch(url, { signal });
  const data = (await res.json()) as ScheduleMetaResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? 'Schedule metadata could not be loaded');
  }
  writePersistedMeta(data);
  return data;
}

export function clearScheduleClientCache(): void {
  responseCache.clear();
  inflight.clear();
}
