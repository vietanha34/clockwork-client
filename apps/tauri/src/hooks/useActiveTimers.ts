import { useQuery } from '@tanstack/react-query';
import { fetchActiveTimers } from '../lib/api-client';
import { useSettings } from '../lib/settings-context';
import type { ActiveTimersResponse } from '../lib/types';

export const ACTIVE_TIMERS_KEY = 'activeTimers';

export function useActiveTimers() {
  const { settings } = useSettings();
  const { userEmail, apiBaseUrl } = settings;
  const enabled = Boolean(userEmail && apiBaseUrl);

  return useQuery<ActiveTimersResponse, Error>({
    queryKey: [ACTIVE_TIMERS_KEY, userEmail],
    queryFn: () => fetchActiveTimers(apiBaseUrl, userEmail),
    enabled,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
}
