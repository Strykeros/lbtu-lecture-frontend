import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchScheduleOptions,
  getCachedOptions,
} from '../services/scheduleApi';
import type { ScheduleOptionsResponse } from '../types/schedule';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function useScheduleOptions() {
  const [options, setOptions] = useState<ScheduleOptionsResponse | null>(() =>
    getCachedOptions(),
  );
  const [status, setStatus] = useState<Status>(() =>
    getCachedOptions() ? 'ready' : 'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef<ScheduleOptionsResponse | null>(options);
  const requestIdRef = useRef(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const load = useCallback(async (force = false) => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    if (!optionsRef.current) setStatus('loading');
    setError(null);

    try {
      const next = await fetchScheduleOptions(controller.signal, force);
      if (requestId !== requestIdRef.current) return;
      setOptions(next);
      setStatus('ready');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof Error
          ? err.message
          : 'Neizdevās ielādēt studiju programmas.',
      );
      setStatus(optionsRef.current ? 'ready' : 'error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const cached = getCachedOptions();
    if (cached) {
      setOptions(cached);
      setStatus('ready');
    }

    void (async () => {
      try {
        const next = await fetchScheduleOptions(controller.signal);
        if (requestId !== requestIdRef.current) return;
        setOptions(next);
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        if (optionsRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : 'Neizdevās ielādēt studiju programmas.',
          );
          setStatus('ready');
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'Neizdevās ielādēt studiju programmas.',
          );
          setStatus('error');
        }
      }
    })();

    return () => controller.abort();
  }, []);

  return {
    options,
    status,
    error,
    reload: (force = true) => {
      void load(force);
    },
  };
}
