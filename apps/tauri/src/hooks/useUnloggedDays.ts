import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchWorklogs } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { useSettings } from '../lib/settings-context';
import type { UnloggedDay } from '../lib/types';
import { WORKLOGS_KEY } from './useWorklogs';

const REQUIRED_SECONDS = 8 * 3600;
const weekdayFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfCurrentWeekMonday(today: Date): Date {
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);

  const dayOfWeek = monday.getDay();
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(monday.getDate() + offset);

  return monday;
}

export function getWeekdaysUntilYesterday(today = new Date()): Array<{
  date: string;
  dayOfWeek: string;
}> {
  const monday = startOfCurrentWeekMonday(today);
  const yesterday = new Date(today);
  yesterday.setHours(0, 0, 0, 0);
  yesterday.setDate(yesterday.getDate() - 1);

  if (yesterday < monday) {
    return [];
  }

  const weekdays: Array<{ date: string; dayOfWeek: string }> = [];

  for (const cursor = new Date(monday); cursor <= yesterday; cursor.setDate(cursor.getDate() + 1)) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      continue;
    }

    weekdays.push({
      date: toLocalDateString(cursor),
      dayOfWeek: weekdayFormatter.format(cursor),
    });
  }

  return weekdays;
}

export function useUnloggedDays(): {
  unloggedDays: UnloggedDay[];
  isLoading: boolean;
} {
  const { settings } = useSettings();
  const { jiraToken: accountId } = settings;
  const weekdays = useMemo(() => getWeekdaysUntilYesterday(), []);

  const worklogQueries = useQueries({
    queries: weekdays.map((day) => ({
      queryKey: [WORKLOGS_KEY, accountId, day.date],
      queryFn: () => fetchWorklogs(API_BASE_URL, accountId, day.date),
      enabled: Boolean(accountId),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  const unloggedDays = useMemo(
    () =>
      weekdays.reduce<UnloggedDay[]>((result, day, index) => {
        const query = worklogQueries[index];
        const total = query?.data?.total ?? 0;

        if (total < REQUIRED_SECONDS) {
          result.push({
            date: day.date,
            dayOfWeek: day.dayOfWeek,
            loggedSeconds: total,
            requiredSeconds: REQUIRED_SECONDS,
          });
        }

        return result;
      }, []),
    [weekdays, worklogQueries],
  );

  const isLoading = worklogQueries.some((query) => query.isLoading);

  return { unloggedDays, isLoading };
}
