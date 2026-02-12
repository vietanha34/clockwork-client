import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startTimer, stopTimer } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import { useSettings } from '../lib/settings-context';
import type { ActiveTimersResponse } from '../lib/types';
import { ACTIVE_TIMERS_KEY } from './useActiveTimers';

export function useStartTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      issueKey,
      comment,
    }: {
      issueKey: string;
      comment?: string;
    }) => startTimer(API_BASE_URL, issueKey, comment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ACTIVE_TIMERS_KEY] });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const accountId = settings.jiraToken;

  return useMutation({
    mutationFn: ({ issueKey }: { issueKey: string }) =>
      stopTimer(API_BASE_URL, issueKey, accountId),

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
    },
  });
}
