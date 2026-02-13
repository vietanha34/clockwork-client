import { useQuery } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { fetchActiveTimers } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { useSettings } from '../lib/settings-context';
import type { ActiveTimersResponse } from '../lib/types';

export const ACTIVE_TIMERS_KEY = 'activeTimers';
const DEFAULT_REFETCH_INTERVAL_MS = 10_000;
const FAST_REFETCH_INTERVAL_MS = 2_000;
const FAST_POLLING_WINDOW_MS = 30_000;

let fastPollingUntil = 0;
const fastPollingSubscribers = new Set<() => void>();

function notifyFastPollingSubscribers(): void {
  for (const subscriber of fastPollingSubscribers) {
    subscriber();
  }
}

function subscribeFastPolling(subscriber: () => void): () => void {
  fastPollingSubscribers.add(subscriber);
  return () => {
    fastPollingSubscribers.delete(subscriber);
  };
}

function isFastPollingActive(): boolean {
  return Date.now() < fastPollingUntil;
}

export function activateFastPolling(durationMs = FAST_POLLING_WINDOW_MS): void {
  fastPollingUntil = Date.now() + durationMs;
  notifyFastPollingSubscribers();
}

export function useActiveTimers() {
  const { settings, isLoaded } = useSettings();
  const { jiraToken } = settings;
  const enabled = Boolean(jiraToken);
  const needsAccountId = isLoaded && !jiraToken;
  const fastPolling = useSyncExternalStore(
    subscribeFastPolling,
    isFastPollingActive,
    isFastPollingActive,
  );

  useEffect(() => {
    if (!fastPolling) return;

    const timeoutMs = Math.max(0, fastPollingUntil - Date.now());
    const timeoutId = window.setTimeout(() => {
      notifyFastPollingSubscribers();
    }, timeoutMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [fastPolling]);

  const query = useQuery<ActiveTimersResponse, Error>({
    queryKey: [ACTIVE_TIMERS_KEY, jiraToken],
    queryFn: () => fetchActiveTimers(API_BASE_URL, jiraToken),
    enabled,
    networkMode: 'always',
    refetchInterval: fastPolling ? FAST_REFETCH_INTERVAL_MS : DEFAULT_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });

  return { ...query, needsAccountId, fastPolling };
}
