import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { errorMessage } from './api';

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
