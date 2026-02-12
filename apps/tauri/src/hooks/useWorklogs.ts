import { useQuery } from '@tanstack/react-query';
import { fetchWorklogs, todayDate } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { useSettings } from '../lib/settings-context';
import type { WorklogsResponse } from '../lib/types';

export function useWorklogs(date?: string) {
  const { settings } = useSettings();
  const { jiraToken: accountId } = settings;
  const enabled = Boolean(accountId);
  const targetDate = date ?? todayDate();

  return useQuery<WorklogsResponse, Error>({
    queryKey: ['worklogs', accountId, targetDate],
    queryFn: () => fetchWorklogs(API_BASE_URL, accountId, targetDate),
    enabled,
    staleTime: 30_000,
  });
}
