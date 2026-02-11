import { getJiraUser, getJiraUsersBulk } from './atlassian-client';
import type { ClockworkReportTimersResponse } from './clockwork-report';
import { getCachedJiraUser, setCachedJiraUser } from './redis';
import type { ClockworkUser, Timer } from './types';

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
 * - Uses BULK API for efficiency
 * - Falls back gracefully: timers with unresolvable authors get empty email
 */
export async function resolveTimerAuthors(
  rawTimers: ClockworkReportTimersResponse['timers'],
): Promise<Timer[]> {
  // Collect unique accountIds from running_for
  const accountIds = [...new Set(rawTimers.map((t) => t.running_for).filter(Boolean))];

  // Resolve users efficiently
  const userMap = new Map<string, ClockworkUser | null>();
  const missingAccountIds: string[] = [];

  // 1. Check Cache
  await Promise.all(
    accountIds.map(async (accountId) => {
      const cached = await getCachedJiraUser(accountId);
      if (cached) {
        userMap.set(accountId, cached);
      } else {
        missingAccountIds.push(accountId);
      }
    })
  );

  // 2. Fetch Missing from Jira Bulk API
  if (missingAccountIds.length > 0) {
    try {
      console.log(`[resolveTimerAuthors] Bulk fetching ${missingAccountIds.length} users from Jira...`);
      const fetchedUsers = await getJiraUsersBulk(missingAccountIds);
      
      for (const user of fetchedUsers) {
        await setCachedJiraUser(user.accountId, user);
        userMap.set(user.accountId, user);
      }

      // Mark any still missing as null (so we don't retry immediately if we wanted to, but here just map)
    } catch (err) {
      console.error('[resolveTimerAuthors] Failed to bulk fetch users:', err);
    }
  }

  return rawTimers.map((t) => {
    // Use author from Clockwork response if it already has full info
    const clockworkAuthor = t.author;
    const resolvedUser = userMap.get(t.running_for) ?? null;

    // Prefer clockwork author if email is present; otherwise use resolved Jira user
    const author: ClockworkUser | undefined = clockworkAuthor?.emailAddress
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
