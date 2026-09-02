import type { ScheduleResponse } from '../src/types/schedule.js';
import {
  filterEventsByQuery,
  getLbtuSchedule,
  getLbtuScheduleMeta,
  getLbtuScheduleOptions,
  type ScheduleFetchScope,
  type ScheduleMetaResponse,
  type ScheduleOptionsResponse,
} from './services/lbtu/getSchedule.js';

interface MetaCacheEntry {
  data: ScheduleMetaResponse;
  fetchedAt: number;
}

let metaCache: MetaCacheEntry | null = null;
let metaInflight: Promise<ScheduleMetaResponse> | null = null;

interface OptionsCacheEntry {
  data: ScheduleOptionsResponse;
  fetchedAt: number;
}

let optionsCache: OptionsCacheEntry | null = null;
let optionsInflight: Promise<ScheduleOptionsResponse> | null = null;

const META_TTL_MS = 60 * 60 * 1000; // 1 hour — matches index/direction discovery cache
const OPTIONS_TTL_MS = 60 * 60 * 1000; // 1 hour — programme/semester list changes rarely

export async function getCachedScheduleMeta(options?: {
  force?: boolean;
}): Promise<ScheduleMetaResponse> {
  const now = Date.now();
  if (
    !options?.force &&
    metaCache &&
    now - metaCache.fetchedAt < META_TTL_MS
  ) {
    return metaCache.data;
  }

  if (metaInflight) {
    try {
      return await metaInflight;
    } catch {
      if (metaCache) return metaCache.data;
      throw new Error('Schedule metadata could not be loaded');
    }
  }

  metaInflight = (async () => {
    try {
      const data = await getLbtuScheduleMeta({ force: options?.force });
      metaCache = { data, fetchedAt: Date.now() };
      return data;
    } finally {
      metaInflight = null;
    }
  })();

  return metaInflight;
}

export async function getCachedScheduleOptions(options?: {
  force?: boolean;
}): Promise<ScheduleOptionsResponse> {
  const now = Date.now();
  if (
    !options?.force &&
    optionsCache &&
    now - optionsCache.fetchedAt < OPTIONS_TTL_MS
  ) {
    return optionsCache.data;
  }

  if (optionsInflight) {
    try {
      return await optionsInflight;
    } catch {
      if (optionsCache) return optionsCache.data;
      throw new Error('Schedule options could not be loaded');
    }
  }

  optionsInflight = (async () => {
    try {
      const data = await getLbtuScheduleOptions({ force: options?.force });
      optionsCache = { data, fetchedAt: Date.now() };
      return data;
    } finally {
      optionsInflight = null;
    }
  })();

  return optionsInflight;
}

export async function getCachedSchedule(
  scope: ScheduleFetchScope,
  options?: { force?: boolean },
): Promise<ScheduleResponse> {
  return getLbtuSchedule(scope, { force: options?.force });
}

export function applyScheduleFilters(
  data: ScheduleResponse,
  query: {
    from: string;
    to: string;
    program?: string | null;
    semester?: string | null;
    direction?: string | null;
  },
): ScheduleResponse {
  const events = filterEventsByQuery(data.events, query);
  return {
    ...data,
    from: query.from,
    to: query.to,
    count: events.length,
    events,
  };
}
