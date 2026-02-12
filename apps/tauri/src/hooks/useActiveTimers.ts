import { useQuery } from '@tanstack/react-query';
import { fetchActiveTimers } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { useSettings } from '../lib/settings-context';
import type { ActiveTimersResponse } from '../lib/types';

export const ACTIVE_TIMERS_KEY = 'activeTimers';

export function useActiveTimers() {
  const { settings, isLoaded } = useSettings();
  const { jiraToken } = settings;
  const enabled = Boolean(jiraToken);
  const needsAccountId = isLoaded && !jiraToken;

  const query = useQuery<ActiveTimersResponse, Error>({
    queryKey: [ACTIVE_TIMERS_KEY, jiraToken],
    queryFn: () => fetchActiveTimers(API_BASE_URL, jiraToken),
    enabled,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  return { ...query, needsAccountId };
}
