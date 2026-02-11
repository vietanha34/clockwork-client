import { fetchActiveTimers } from '../lib/clockwork-report.js';
import { acquireClockworkJwt } from '../lib/jira-jwt.js';
import { type CachedTimerEntry, cacheTimers } from '../lib/redis.js';
import { inngest } from './client.js';

interface SyncTimersEvent {
  data: {
    userEmail?: string;
    jiraDomain?: string;
  };
}

function getEnvRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * Inngest function: sync-active-timers
 *
 * Triggered by:
 *  - event: "clockwork/timers.sync.requested"
 *  - cron: "every 5 minutes"
 *
 * Steps:
 *   1. acquire-jwt: Exchange Jira session cookie for Clockwork JWT (admin/service account)
 *   2. fetch-timers: Fetch ALL active timers from Clockwork Report API
 *   3. cache-timers:
 *      - Group timers by author.emailAddress
 *      - Store per-user list in Redis (clockwork:timers:<email>)
 *      - Store global list in Redis (clockwork:timers:all)
 */
export const syncActiveTimers = inngest.createFunction(
  {
    id: 'sync-active-timers',
    name: 'Sync Active Clockwork Timers',
    retries: 2,
  },
  [{ event: 'clockwork/timers.sync.requested' }, { cron: '*/5 * * * *' }],
  async ({ event, step }) => {
    const eventData = (event as SyncTimersEvent).data;
    const eventDomain = eventData?.jiraDomain;

    const jiraDomain = eventDomain ?? getEnvRequired('JIRA_DOMAIN');

    // Step 1: Acquire Clockwork JWT from Jira servlet
    const jwt = await step.run('acquire-jwt', async () => {
      const jiraFullCookie = getEnvRequired('JIRA_FULL_COOKIE');
      const token = await acquireClockworkJwt(jiraDomain, jiraFullCookie);
      return { jwt: token };
    });

    // Step 2: Fetch ALL active timers from Clockwork Report API
    const fetchResult = await step.run('fetch-timers', async () => {
      const response = await fetchActiveTimers(jwt.jwt, jiraDomain);
      return {
        timers: response.timers,
        total: response.total,
      };
    });

    // Step 3: Transform and cache timers in Upstash Redis
    const cacheResult = await step.run('cache-timers', async () => {
      const allEntries: CachedTimerEntry[] = fetchResult.timers.map((t) => ({
        id: t.id,
        startedAt: t.started_at,
        finishedAt: t.finished_at,
        comment: t.comment,
        runningFor: t.running_for,
        tillNow: t.till_now,
        worklogCount: t.worklog_count,
        issue: { key: t.issue.key, id: t.issue.id },
        author: t.author,
      }));

      // Group by user email
      const byUser: Record<string, CachedTimerEntry[]> = {};

      for (const entry of allEntries) {
        if (entry.author?.emailAddress) {
          const email = entry.author.emailAddress;
          if (!byUser[email]) byUser[email] = [];
          byUser[email].push(entry);
        }
      }

      // Cache for each user
      await Promise.all(
        Object.entries(byUser).map(([email, timers]) => cacheTimers(email, timers)),
      );

      // Cache ALL timers (global view)
      await cacheTimers('all', allEntries);

      return {
        cached: true,
        totalCount: allEntries.length,
        usersCount: Object.keys(byUser).length,
      };
    });

    return {
      success: true,
      jiraDomain,
      timersCount: fetchResult.total,
      cachedUsers: cacheResult.usersCount,
    };
  },
);
