import { getJiraUser } from './atlassian-client';
import { getCachedJiraUser, setCachedJiraUser } from './redis';
import type { ClockworkUser, Timer } from './types';
import type { ClockworkReportTimersResponse } from './clockwork-report';

/**
 * Resolve a Jira user by accountId using a Redis cache-first strategy.
 * Returns null if the lookup fails (Jira API error, network issue, etc.).
 */
export async function resolveTimerAuthor(accountId: string): Promise<ClockworkUser | null> {
  // 1. Check cache
  const cached = await getCachedJiraUser(accountId);
  if (cached) {
    return cached;
  }

  // 2. Fetch from Jira API
  try {
    const user = await getJiraUser(accountId);
    await setCachedJiraUser(accountId, user);
    return user;
  } catch (err) {
    console.warn(`[resolveTimerAuthor] Failed to fetch Jira user for accountId=${accountId}:`, err);
    return null;
  }
}

/**
 * Enrich raw Clockwork timers with full Jira user info.
 *
 * - Deduplicates accountIds before fetching
 * - Uses cache-first resolution (2-day TTL)
 * - Falls back gracefully: timers with unresolvable authors get empty email
 */
export async function resolveTimerAuthors(
  rawTimers: ClockworkReportTimersResponse['timers'],
): Promise<Timer[]> {
  // Collect unique accountIds from running_for
  const accountIds = [...new Set(rawTimers.map((t) => t.running_for).filter(Boolean))];

  // Resolve all in parallel
  const resolved = await Promise.all(
    accountIds.map(async (accountId) => {
      const user = await resolveTimerAuthor(accountId);
      return [accountId, user] as [string, ClockworkUser | null];
    }),
  );

  const userMap = new Map<string, ClockworkUser | null>(resolved);

  return rawTimers.map((t) => {
    // Use author from Clockwork response if it already has full info
    const clockworkAuthor = t.author;
    const resolvedUser = userMap.get(t.running_for) ?? null;

    // Prefer clockwork author if email is present; otherwise use resolved Jira user
    const author: ClockworkUser | undefined =
      clockworkAuthor?.emailAddress
        ? {
            accountId: clockworkAuthor.accountId,
            emailAddress: clockworkAuthor.emailAddress,
            displayName: clockworkAuthor.displayName,
            avatarUrl: clockworkAuthor.avatarUrl,
          }
        : resolvedUser
          ? resolvedUser
          : clockworkAuthor
            ? {
                accountId: clockworkAuthor.accountId,
                emailAddress: '',
                displayName: clockworkAuthor.displayName,
                avatarUrl: clockworkAuthor.avatarUrl,
              }
            : undefined;

    if (!author?.emailAddress) {
      console.warn(
        `[resolveTimerAuthors] Could not resolve email for timer id=${t.id}, running_for=${t.running_for}`,
      );
    }

    return {
      id: t.id,
      startedAt: t.started_at,
      finishedAt: t.finished_at,
      comment: t.comment,
      runningFor: t.running_for,
      tillNow: t.till_now,
      worklogCount: t.worklog_count,
      issue: { key: t.issue.key, id: t.issue.id },
      author,
    };
  });
}
