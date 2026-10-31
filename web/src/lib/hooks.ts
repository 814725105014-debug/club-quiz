import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      setData(null);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get<T>(path, undefined, controller.signal)
      .then((result) => {
        if (mounted.current) setData(result);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (!mounted.current) return;
        setError(err instanceof ApiError ? err.message : 'Could not load this data.');
      })
      .finally(() => {
        if (mounted.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, error, loading, reload, setData };
}

export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const saved = useRef(callback);
  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => saved.current(), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, enabled]);
}

export function useCountdown(target?: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  if (!target) return 0;
  const diff = new Date(target).getTime() - now;
  return Number.isFinite(diff) ? Math.max(0, Math.floor(diff / 1000)) : 0;
}
