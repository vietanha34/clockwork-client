import { useQuery } from "@tanstack/react-query";
import { fetchWorklogs, todayDate } from "../lib/api-client";
import { useSettings } from "../lib/settings-context";
import type { WorklogsResponse } from "../lib/types";

export function useWorklogs(date?: string) {
  const { settings } = useSettings();
  const { userEmail, apiBaseUrl } = settings;
  const enabled = Boolean(userEmail && apiBaseUrl);
  const targetDate = date ?? todayDate();

  return useQuery<WorklogsResponse, Error>({
    queryKey: ["worklogs", userEmail, targetDate],
    queryFn: () => fetchWorklogs(apiBaseUrl, userEmail, targetDate),
    enabled,
    staleTime: 30_000,
  });
}
