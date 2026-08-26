import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchScheduleMeta } from '../services/scheduleApi';
import type { ScheduleMetaResponse } from '../types/schedule';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function useScheduleMeta() {
  const [meta, setMeta] = useState<ScheduleMetaResponse | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const metaRef = useRef<ScheduleMetaResponse | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const load = useCallback(async (force = false) => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    if (!metaRef.current) setStatus('loading');
    setError(null);
    try {
      const next = await fetchScheduleMeta(controller.signal, force);
      if (requestId !== requestIdRef.current) return;
      setMeta(next);
      setStatus('ready');
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(
        err instanceof Error ? err.message : 'Metadatus neizdevās ielādēt.',
      );
      setStatus(metaRef.current ? 'ready' : 'error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    void (async () => {
      try {
        const next = await fetchScheduleMeta(controller.signal);
        if (requestId !== requestIdRef.current) return;
        setMeta(next);
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setError(
          err instanceof Error ? err.message : 'Metadatus neizdevās ielādēt.',
        );
        setStatus('error');
      }
    })();
    return () => controller.abort();
  }, []);

  return {
    meta,
    status,
    error,
    reload: (force = true) => {
      void load(force);
    },
  };
}
