import type { ScheduleMetaResponse, ScheduleOptionsResponse, ScheduleResponse } from '../types/schedule';

const SCHEDULE_PREFIX = 'lbtu-schedule-v2:';
const META_KEY = 'lbtu-meta-v2';
const OPTIONS_KEY = 'lbtu-options-v2';
const SCHEDULE_TTL_MS = 15 * 60 * 1000;
const META_TTL_MS = 60 * 60 * 1000;
const OPTIONS_TTL_MS = 60 * 60 * 1000;

interface Stored<T> {
  fetchedAt: number;
  data: T;
}

function readStored<T>(key: string, ttlMs: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored<T>;
    if (!parsed?.data || Date.now() - parsed.fetchedAt > ttlMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeStored<T>(key: string, data: T): void {
  try {
    const payload: Stored<T> = { fetchedAt: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function readPersistedSchedule(key: string): ScheduleResponse | null {
  return readStored<ScheduleResponse>(`${SCHEDULE_PREFIX}${key}`, SCHEDULE_TTL_MS);
}

export function writePersistedSchedule(
  key: string,
  data: ScheduleResponse,
): void {
  writeStored(`${SCHEDULE_PREFIX}${key}`, data);
}

export function readPersistedMeta(): ScheduleMetaResponse | null {
  return readStored<ScheduleMetaResponse>(META_KEY, META_TTL_MS);
}

export function writePersistedMeta(data: ScheduleMetaResponse): void {
  writeStored(META_KEY, data);
}

export function readPersistedOptions(): ScheduleOptionsResponse | null {
  return readStored<ScheduleOptionsResponse>(OPTIONS_KEY, OPTIONS_TTL_MS);
}

export function writePersistedOptions(data: ScheduleOptionsResponse): void {
  writeStored(OPTIONS_KEY, data);
}
