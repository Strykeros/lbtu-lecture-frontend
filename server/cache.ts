import type { ScheduleResponse } from '../src/types/schedule.js';
import { CACHE_TTL_MS } from './services/lbtu/constants.js';
import { getLbtuSchedule } from './services/lbtu/getSchedule.js';

interface CacheEntry {
  data: ScheduleResponse;
  fetchedAt: number;
}

let cache: CacheEntry | null = null;
let inflight: Promise<ScheduleResponse> | null = null;

export async function getCachedSchedule(options?: {
  force?: boolean;
}): Promise<ScheduleResponse> {
  const now = Date.now();
  const fresh = cache && now - cache.fetchedAt < CACHE_TTL_MS;

  if (!options?.force && fresh && cache) {
    return cache.data;
  }

  if (inflight) {
    try {
      return await inflight;
    } catch {
      if (cache) {
        return { ...cache.data, stale: true };
      }
      throw new Error('Schedule could not be loaded');
    }
  }

  inflight = (async () => {
    try {
      const data = await getLbtuSchedule();
      cache = { data, fetchedAt: Date.now() };
      return data;
    } catch (err) {
      if (cache) {
        return {
          ...cache.data,
          stale: true,
          error:
            err instanceof Error
              ? err.message
              : 'Could not refresh schedule',
        };
      }
      throw err;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function getCacheMeta(): { ageMs: number | null; hasCache: boolean } {
  if (!cache) return { ageMs: null, hasCache: false };
  return { ageMs: Date.now() - cache.fetchedAt, hasCache: true };
}
