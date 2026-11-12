// Minimal stale-while-revalidate data hook (TanStack Query style API surface).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const cache = new Map<string, any>();
let version = 0;
const subs = new Set<() => void>();
const subscribe = (fn: () => void) => { subs.add(fn); return () => subs.delete(fn); };

/** Mark all cached data stale; mounted queries refetch. */
export function invalidate() { version++; subs.forEach((f) => f()); }
export function clearCache() { cache.clear(); invalidate(); }

export function useQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const v = useSyncExternalStore(subscribe, () => version);
  const [data, setData] = useState<T | undefined>(key ? cache.get(key) : undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(!!key && !cache.has(key));
  const fetchRef = useRef(fetcher); fetchRef.current = fetcher;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!key) return;
    let live = true;
    if (cache.has(key)) setData(cache.get(key)); else { setData(undefined); setLoading(true); }
    fetchRef.current().then((d) => { if (!live) return; cache.set(key, d); setData(d); setError(null); setLoading(false); })
      .catch((e) => { if (!live) return; setError(e); setLoading(false); });
    return () => { live = false; };
  }, [key, v, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const mutate = useCallback((next: T) => { if (key) cache.set(key, next); setData(next); }, [key]);
  return { data, error, loading, refetch, mutate };
}
