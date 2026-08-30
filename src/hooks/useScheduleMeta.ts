import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchScheduleMeta,
  getCachedMeta,
} from '../services/scheduleApi';
import type { ScheduleMetaResponse } from '../types/schedule';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function useScheduleMeta() {
  const [meta, setMeta] = useState<ScheduleMetaResponse | null>(() =>
    getCachedMeta(),
  );
  const [status, setStatus] = useState<Status>(() =>
    getCachedMeta() ? 'ready' : 'loading',
  );
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const metaRef = useRef<ScheduleMetaResponse | null>(meta);
  const requestIdRef = useRef(0);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  const load = useCallback(async (force = false) => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    if (!metaRef.current) setStatus('loading');
    setError(null);
    try {
      const next = await fetchScheduleMeta(controller.signal, force);
      if (requestId !== requestIdRef.current) return;
      setMeta(next);
      setStatus('ready');
      setRefreshing(false);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setRefreshing(false);
      setError(
        err instanceof Error ? err.message : 'Metadatus neizdevās ielādēt.',
      );
      setStatus(metaRef.current ? 'ready' : 'error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++requestIdRef.current;
    const cached = getCachedMeta();
    if (cached) {
      setMeta(cached);
      setStatus('ready');
      setRefreshing(true);
    }

    void (async () => {
      try {
        const next = await fetchScheduleMeta(controller.signal);
        if (requestId !== requestIdRef.current) return;
        setMeta(next);
        setStatus('ready');
        setRefreshing(false);
      } catch (err) {
        if (controller.signal.aborted) return;
        if (requestId !== requestIdRef.current) return;
        setRefreshing(false);
        if (metaRef.current) {
          setError(
            err instanceof Error ? err.message : 'Metadatus neizdevās ielādēt.',
          );
          setStatus('ready');
        } else {
          setError(
            err instanceof Error ? err.message : 'Metadatus neizdevās ielādēt.',
          );
          setStatus('error');
        }
      }
    })();

    return () => controller.abort();
  }, []);

  return {
    meta,
    status,
    refreshing,
    error,
    reload: (force = true) => {
      void load(force);
    },
  };
}
