import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { errorMessage, get } from './api';

/**
 * Loads data when the screen is focused (so switching tabs shows fresh numbers) and whenever `deps` change.
 * Stale data stays on screen while a refetch is in flight; only the first load shows a spinner.
 */
export function useResource<T>(load: () => Promise<T>, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0); // ignore out-of-order responses
  const has = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(
    async (pull: boolean) => {
      const id = ++seq.current;
      if (pull) setRefreshing(true);
      else if (!has.current) setLoading(true);
      try {
        const d = await load();
        if (id !== seq.current) return;
        has.current = true;
        setData(d);
        setError(null);
      } catch (e) {
        if (id === seq.current) setError(errorMessage(e));
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    deps,
  );

  useFocusEffect(
    useCallback(() => {
      run(false);
    }, [run]),
  );

  return { data, error, loading, refreshing, reload: () => run(false), refresh: () => run(true) };
}

/** The value, but only after it has stopped changing for `ms` (so typing in a search box doesn't hit the server per key). */
export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Loads one page at a time from a paged endpoint ({content, page, totalPages, totalElements}). Reloads page 1 when the
 * screen is focused or `params` change; `loadMore` appends the next page. `initialLoading` is only true before the
 * first page ever arrived, so filters and tabs stay on screen while a new tab loads.
 */
export function usePaged<T>(path: string, params: Record<string, string | number | undefined>, size = 20) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const seq = useRef(0);
  const key = JSON.stringify(params);

  const fetchPage = useCallback(
    async (pageNo: number, mode: 'load' | 'more' | 'pull') => {
      const id = ++seq.current;
      if (mode === 'more') setLoadingMore(true);
      else if (mode === 'pull') setRefreshing(true);
      else setLoading(true);
      try {
        const q = Object.entries({ ...params, page: pageNo, size })
          .filter(([, v]) => v !== undefined && String(v) !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&');
        const res = await get<{ content: T[]; page: number; totalPages: number; totalElements: number }>(`${path}?${q}`);
        if (id !== seq.current) return;
        setItems((prev) => (pageNo === 0 ? res.content : [...prev, ...res.content]));
        setPage(res.page);
        setTotalPages(res.totalPages);
        setTotal(res.totalElements);
        setLoaded(true);
        setError(null);
      } catch (e) {
        if (id === seq.current) setError(errorMessage(e));
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, key, size],
  );

  useFocusEffect(
    useCallback(() => {
      fetchPage(0, 'load');
    }, [fetchPage]),
  );

  return {
    items,
    total,
    error,
    loading,
    initialLoading: loading && !loaded,
    loadingMore,
    refreshing,
    hasMore: page + 1 < totalPages,
    loadMore: () => {
      if (!loading && !loadingMore && page + 1 < totalPages) fetchPage(page + 1, 'more');
    },
    reload: () => fetchPage(0, 'load'),
    refresh: () => fetchPage(0, 'pull'),
  };
}

/** Runs a mutation; shows the server's message on failure. Resolves true on success. */
export async function attempt(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return true;
  } catch (e) {
    Alert.alert('Something went wrong', errorMessage(e));
    return false;
  }
}
