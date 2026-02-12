import { fetchActiveTimers } from '../lib/clockwork-report';
import { acquireClockworkJwt } from '../lib/jira-jwt';
import { resolveTimerAuthors } from '../lib/jira-user-resolver';
import { setActiveTimers } from '../lib/redis';
import type { Timer } from '../lib/types';
import { inngest } from './client';

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
 *      - Group timers by runningFor (accountId)
 *      - Store per-user list in Redis (clockwork:timers:<accountId>)
 *      - Store global list in Redis (clockwork:timers:all)
 */
export const syncActiveTimers = inngest.createFunction(
  {
    id: 'sync-active-timers',
    name: 'Sync Active Clockwork Timers',
    retries: 2,
  },
  [{ event: 'clockwork/timers.sync.requested' }, { cron: '*/2 * * * *' }],
  async ({ event, step }) => {
    const eventData = (event as SyncTimersEvent).data;
    const eventDomain = eventData?.jiraDomain;

    const jiraDomain = eventDomain ?? getEnvRequired('JIRA_DOMAIN');

    // Single step: Sync logic (Acquire JWT -> Fetch -> Cache)
    const result = await step.run('sync-process', async () => {
      console.log(`[sync-process] Starting sync for domain: ${jiraDomain}`);

      // 1. Acquire JWT
      console.log('[sync-process] Acquiring Clockwork JWT...');
      const jiraFullCookie = getEnvRequired('JIRA_FULL_COOKIE');
      const jwt = await acquireClockworkJwt(jiraDomain, jiraFullCookie);
      console.log('[sync-process] JWT acquired successfully.');

      // 2. Fetch active timers
      console.log('[sync-process] Fetching active timers from Clockwork API...');
      const fetchResponse = await fetchActiveTimers(jwt, jiraDomain);
      const timers = fetchResponse.timers;
      const total = fetchResponse.total;
      console.log(`[sync-process] Fetched ${total} timers.`);

      // 3. Transform and Enrich with Jira user info
      console.log('[sync-process] Resolving timer authors via Jira user cache...');
      const allEntries = await resolveTimerAuthors(timers);
      console.log(`[sync-process] Author resolution complete for ${allEntries.length} timers.`);

      const byUser: Record<string, Timer[]> = {};
      for (const entry of allEntries) {
        // Group by runningFor (accountId)
        const accountId = entry.runningFor;
        if (accountId) {
          if (!byUser[accountId]) byUser[accountId] = [];
          byUser[accountId].push(entry);
        }
      }

      const usersCount = Object.keys(byUser).length;
      console.log(`[sync-process] Grouped timers into ${usersCount} users.`);

      // 4. Cache to Redis
      console.log('[sync-process] Caching to Redis...');
      // Cache for each user by accountId
      await Promise.all(
        Object.entries(byUser).map(([accountId, userTimers]) =>
          setActiveTimers(accountId, userTimers),
        ),
      );

      // Cache ALL timers (global view)
      await setActiveTimers('all', allEntries);
      console.log('[sync-process] Caching complete.');

      return {
        success: true,
        jiraDomain,
        timersCount: total,
        cachedUsers: usersCount,
      };
    });

    return result;
  },
);
