import { useQuery } from '@tanstack/react-query';
import { fetchActiveTimers } from '../lib/api-client';
import { useSettings } from '../lib/settings-context';
import type { ActiveTimersResponse } from '../lib/types';

export const ACTIVE_TIMERS_KEY = 'activeTimers';

export function useActiveTimers() {
  const { settings, isLoaded } = useSettings();
  const { userAccountId, apiBaseUrl } = settings;
  const enabled = Boolean(userAccountId && apiBaseUrl);
  const needsAccountId = isLoaded && Boolean(apiBaseUrl) && !userAccountId;

  const query = useQuery<ActiveTimersResponse, Error>({
    queryKey: [ACTIVE_TIMERS_KEY, userAccountId],
    queryFn: () => fetchActiveTimers(apiBaseUrl, userAccountId),
    enabled,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });

  return { ...query, needsAccountId };
}
