import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchSchedule,
  getCachedSchedule,
  prefetchSchedule,
  scheduleQueryKey,
  type ScheduleQuery,
} from '../services/scheduleApi';
import type { ScheduleResponse } from '../types/schedule';
import { adjacentWeekRanges } from '../lib/scheduleRange';
import type { CalendarView } from './useCalendarNavigation';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface UseScheduleResult {
  data: ScheduleResponse | null;
  status: Status;
  refreshing: boolean;
  error: string | null;
  stale: boolean;
  reload: (force?: boolean) => void;
}

function prefetchAdjacentWeeks(query: ScheduleQuery): void {
  const { previous, next } = adjacentWeekRanges(query.from);
  const base = {
    program: query.program,
    semester: query.semester,
    direction: query.direction,
  };
  prefetchSchedule({ ...base, ...previous });
  prefetchSchedule({ ...base, ...next });
}

export function useSchedule(
  query: ScheduleQuery | null,
  options?: { view?: CalendarView },
): UseScheduleResult {
  const queryKey = query ? scheduleQueryKey(query) : null;
  const [data, setData] = useState<ScheduleResponse | null>(() =>
    query ? getCachedSchedule(query) : null,
  );
  const [status, setStatus] = useState<Status>(() =>
    query && getCachedSchedule(query) ? 'ready' : 'loading',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<ScheduleResponse | null>(data);
  const requestIdRef = useRef(0);
  const view = options?.view;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!query || !queryKey) return;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const cached = getCachedSchedule(query);

    if (cached) {
      setData(cached);
      setStatus('ready');
      setRefreshing(true);
    } else if (!dataRef.current) {
      setStatus('loading');
    } else {
      setRefreshing(true);
    }
    setError(null);

    void (async () => {
      try {
        const next = await fetchSchedule(query, controller.signal);
        if (requestId !== requestIdRef.current) return;
        setData(next);
        setStatus('ready');
        setRefreshing(false);
        if (next.stale) {
          setError(next.error ?? 'Neizdevās atjaunināt grafiku.');
        }
        if (view === 'week' || view === 'today') {
          prefetchAdjacentWeeks(query);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setRefreshing(false);

        if (dataRef.current) {
          setError(
            err instanceof Error ? err.message : 'Neizdevās atjaunināt grafiku.',
          );
          setStatus('ready');
        } else {
          setError(
            err instanceof Error ? err.message : 'Grafiku neizdevās ielādēt.',
          );
          setStatus('error');
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [query, queryKey, view]);

  const reload = useCallback(
    (force = true) => {
      if (!query) return;
      const controller = new AbortController();
      const requestId = ++requestIdRef.current;
      setError(null);
      setRefreshing(true);
      if (!dataRef.current) setStatus('loading');

      void (async () => {
        try {
          const next = await fetchSchedule(
            { ...query, refresh: force || undefined },
            controller.signal,
          );
          if (requestId !== requestIdRef.current) return;
          setData(next);
          setStatus('ready');
          setRefreshing(false);
          if (next.stale) {
            setError(next.error ?? 'Neizdevās atjaunināt grafiku.');
          }
        } catch (err) {
          if (requestId !== requestIdRef.current) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
          setRefreshing(false);
          if (dataRef.current) {
            setError(
              err instanceof Error
                ? err.message
                : 'Neizdevās atjaunināt grafiku.',
            );
            setStatus('ready');
          } else {
            setError(
              err instanceof Error
                ? err.message
                : 'Grafiku neizdevās ielādēt.',
            );
            setStatus('error');
          }
        }
      })();
    },
    [query],
  );

  return {
    data,
    status,
    refreshing,
    error,
    stale: Boolean(data?.stale),
    reload,
  };
}
