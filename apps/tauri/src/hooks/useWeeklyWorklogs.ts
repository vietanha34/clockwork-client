import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { fetchWorklogs, todayDate } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { useSettings } from '../lib/settings-context';
import { WORKLOGS_KEY } from './useWorklogs';

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

export interface WeekDay {
  date: string;
  dayOfWeek: string;
  isFuture: boolean;
  totalSeconds: number;
  isLoading: boolean;
}

export function getWeekDates(today = new Date()): Array<{
  date: string;
  dayOfWeek: string;
  isFuture: boolean;
}> {
  const monday = startOfCurrentWeekMonday(today);
  const todayStr = toLocalDateString(today);
  const result = [];

  for (let i = 0; i < 7; i++) {
    const cursor = new Date(monday);
    cursor.setDate(monday.getDate() + i);
    const dateStr = toLocalDateString(cursor);
    result.push({
      date: dateStr,
      dayOfWeek: weekdayFormatter.format(cursor),
      isFuture: dateStr > todayStr,
    });
  }

  return result;
}

export function useWeeklyWorklogs(): {
  weekData: WeekDay[];
  isLoading: boolean;
} {
  const { settings } = useSettings();
  const { jiraToken: accountId } = settings;
  const weekDates = useMemo(() => getWeekDates(), []);

  const worklogQueries = useQueries({
    queries: weekDates.map((day) => ({
      queryKey: [WORKLOGS_KEY, accountId, day.date],
      queryFn: () => fetchWorklogs(API_BASE_URL, accountId, day.date),
      enabled: Boolean(accountId) && !day.isFuture,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  const weekData = useMemo(
    () =>
      weekDates.map((day, index) => {
        const query = worklogQueries[index];
        return {
          ...day,
          totalSeconds: query?.data?.total ?? 0,
          isLoading: Boolean(query?.isLoading),
        };
      }),
    [weekDates, worklogQueries],
  );

  const isLoading = worklogQueries.some((q) => q.isLoading);

  return { weekData, isLoading };
}

export function useWeekStartDate(): string {
  return useMemo(() => {
    const dates = getWeekDates();
    return dates[0]?.date ?? todayDate();
  }, []);
}
