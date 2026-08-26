import type { ScheduleResponse } from '../src/types/schedule.js';
import {
  filterEventsByQuery,
  getLbtuSchedule,
  getLbtuScheduleMeta,
  type ScheduleFetchScope,
  type ScheduleMetaResponse,
} from './services/lbtu/getSchedule.js';

interface MetaCacheEntry {
  data: ScheduleMetaResponse;
  fetchedAt: number;
}

let metaCache: MetaCacheEntry | null = null;
let metaInflight: Promise<ScheduleMetaResponse> | null = null;

const META_TTL_MS = 15 * 60 * 1000;

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
