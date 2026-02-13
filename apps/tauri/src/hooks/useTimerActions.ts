import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { startTimer, stopTimer, todayDate } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { useSettings } from '../lib/settings-context';
import type { ActiveTimersResponse } from '../lib/types';
import { activateFastPolling, ACTIVE_TIMERS_KEY } from './useActiveTimers';
import { WORKLOGS_KEY } from './useWorklogs';

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const clockworkApiToken = settings.clockworkApiToken;

  return useMutation({
    mutationFn: ({
      issueKey,
      comment,
    }: {
      issueKey: string;
      comment?: string;
    }) => startTimer(API_BASE_URL, issueKey, comment, clockworkApiToken),
    onSuccess: () => {
      activateFastPolling();
      void queryClient.invalidateQueries({ queryKey: [ACTIVE_TIMERS_KEY] });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const accountId = settings.jiraToken;
  const clockworkApiToken = settings.clockworkApiToken;
  const delayedWorklogsRefreshRef = useRef<number | null>(null);

  return useMutation({
    mutationFn: ({ issueKey, timerId }: { issueKey: string; timerId?: number }) =>
      stopTimer(API_BASE_URL, issueKey, accountId, timerId, clockworkApiToken),

    onMutate: async () => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await queryClient.cancelQueries({ queryKey: [ACTIVE_TIMERS_KEY] });

      // Snapshot for rollback
      const previous = queryClient.getQueryData<ActiveTimersResponse>([
        ACTIVE_TIMERS_KEY,
        accountId,
      ]);

      // Optimistically clear the timer immediately
      queryClient.setQueryData<ActiveTimersResponse>([ACTIVE_TIMERS_KEY, accountId], (old) => ({
        timers: [],
        cachedAt: old?.cachedAt ?? null,
        accountId: old?.accountId ?? accountId,
      }));

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Rollback to snapshot on failure
      queryClient.setQueryData([ACTIVE_TIMERS_KEY, accountId], context?.previous);
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [ACTIVE_TIMERS_KEY] });

      if (delayedWorklogsRefreshRef.current !== null) {
        window.clearTimeout(delayedWorklogsRefreshRef.current);
      }

      delayedWorklogsRefreshRef.current = window.setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: [WORKLOGS_KEY, accountId, todayDate()],
        });
      }, 10_000);
    },
  });
}
