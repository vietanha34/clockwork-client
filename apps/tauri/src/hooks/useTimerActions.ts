import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startTimer, stopTimer } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
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

  return useMutation({
    mutationFn: ({ timerId }: { timerId: number }) => stopTimer(API_BASE_URL, timerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ACTIVE_TIMERS_KEY] });
    },
  });
}
