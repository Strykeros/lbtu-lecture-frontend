import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchSchedule,
  prefetchSchedule,
  type ScheduleQuery,
} from '../services/scheduleApi';
import type { ScheduleResponse } from '../types/schedule';
import { adjacentWeekRanges } from '../lib/scheduleRange';
import type { CalendarView } from './useCalendarNavigation';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface UseScheduleResult {
  data: ScheduleResponse | null;
  status: Status;
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
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<ScheduleResponse | null>(null);
  const requestIdRef = useRef(0);
  const view = options?.view;

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!query) return;

    const controller = new AbortController();
    const requestId = ++requestIdRef.current;

    setStatus('loading');
    setError(null);

    void (async () => {
      try {
        const next = await fetchSchedule(query, controller.signal);
        if (requestId !== requestIdRef.current) return;
        setData(next);
        setStatus('ready');
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
  }, [query, view]);

  const reload = useCallback(
    (force = true) => {
      if (!query) return;
      const controller = new AbortController();
      const requestId = ++requestIdRef.current;
      setError(null);
      setStatus('loading');

      void (async () => {
        try {
          const next = await fetchSchedule(
            { ...query, refresh: force || undefined },
            controller.signal,
          );
          if (requestId !== requestIdRef.current) return;
          setData(next);
          setStatus('ready');
          if (next.stale) {
            setError(next.error ?? 'Neizdevās atjaunināt grafiku.');
          }
        } catch (err) {
          if (requestId !== requestIdRef.current) return;
          if (err instanceof DOMException && err.name === 'AbortError') return;
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
    error,
    stale: Boolean(data?.stale),
    reload,
  };
}
