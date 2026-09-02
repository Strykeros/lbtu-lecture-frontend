/** Lightweight per-request timing for logs and Server-Timing headers. */

export interface RequestTiming {
  start: (label: string) => void;
  end: (label: string) => void;
  header: () => string;
  log: (prefix: string) => void;
}

export function createRequestTiming(): RequestTiming {
  const marks = new Map<string, number>();
  const durations = new Map<string, number>();

  return {
    start(label) {
      marks.set(label, performance.now());
    },
    end(label) {
      const start = marks.get(label);
      if (start == null) return;
      durations.set(label, Math.round(performance.now() - start));
    },
    header() {
      return [...durations.entries()]
        .map(([name, dur]) => `${name};dur=${dur}`)
        .join(', ');
    },
    log(prefix) {
      const parts = [...durations.entries()]
        .map(([name, dur]) => `${name}=${dur}ms`)
        .join(' ');
      console.log(`${prefix} ${parts || 'total=0ms'}`);
    },
  };
}

/** CDN-friendly cache headers for public schedule responses. */
export function scheduleCacheControl(forceRefresh: boolean): string {
  if (forceRefresh) {
    return 'no-cache, no-store, must-revalidate';
  }
  return 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400';
}

export function metaCacheControl(forceRefresh: boolean): string {
  if (forceRefresh) {
    return 'no-cache, no-store, must-revalidate';
  }
  return 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
}

export function optionsCacheControl(forceRefresh: boolean): string {
  if (forceRefresh) {
    return 'no-cache, no-store, must-revalidate';
  }
  return 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';
}
