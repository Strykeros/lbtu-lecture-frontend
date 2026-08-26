import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSchedule, refreshSchedule } from '../services/scheduleApi';
import type { ScheduleResponse } from '../types/schedule';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface UseScheduleResult {
  data: ScheduleResponse | null;
  status: Status;
  error: string | null;
  stale: boolean;
  reload: (force?: boolean) => void;
}

export function useSchedule(): UseScheduleResult {
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<ScheduleResponse | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const load = useCallback(async (force = false) => {
    if (!dataRef.current) setStatus('loading');
    setError(null);

    const controller = new AbortController();
    try {
      const next = force
        ? await refreshSchedule(controller.signal)
        : await fetchSchedule(controller.signal);
      setData(next);
      setStatus('ready');
      if (next.stale) {
        setError(next.error ?? 'Neizdevās atjaunināt grafiku.');
      }
    } catch (err) {
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
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    data,
    status,
    error,
    stale: Boolean(data?.stale),
    reload: (force = true) => {
      void load(force);
    },
  };
}
