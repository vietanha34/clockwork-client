import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { searchIssues } from '../lib/api-client';
import { API_BASE_URL } from '../lib/constants';
import type { Issue } from '../lib/types';

const ISSUE_SEARCH_KEY = 'issueSearch';
const DEBOUNCE_MS = 300;

export function useIssueSearch(query: string, accountId: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [query]);

  return useQuery<Issue[], Error>({
    queryKey: [ISSUE_SEARCH_KEY, accountId, debouncedQuery.trim()],
    queryFn: () => searchIssues(API_BASE_URL, debouncedQuery, accountId),
    enabled: Boolean(accountId),
    staleTime: 30_000,
    networkMode: 'always',
  });
}
