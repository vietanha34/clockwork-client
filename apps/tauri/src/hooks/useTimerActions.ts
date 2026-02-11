import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startTimer, stopTimer } from '../lib/api-client';
import { useSettings } from '../lib/settings-context';
import { ACTIVE_TIMERS_KEY } from './useActiveTimers';

export function useStartTimer() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  return useMutation({
    mutationFn: ({
      issueKey,
      comment,
    }: {
      issueKey: string;
      comment?: string;
    }) => startTimer(settings.apiBaseUrl, issueKey, comment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ACTIVE_TIMERS_KEY] });
    },
  });
}

export function useStopTimer() {
  const queryClient = useQueryClient();
  const { settings } = useSettings();

  return useMutation({
    mutationFn: ({ timerId }: { timerId: number }) => stopTimer(settings.apiBaseUrl, timerId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [ACTIVE_TIMERS_KEY] });
    },
  });
}
