import { env } from '../lib/env';
import { fetchTimersViaForge } from '../lib/forge-client';
import { resolveTimerAuthors } from '../lib/jira-user-resolver';
import {
  deleteActiveTimers,
  getActiveUserIds,
  getCachedForgeContextToken,
  setActiveTimers,
  setActiveUserIds,
  setCachedForgeContextToken,
} from '../lib/redis';
import type { Timer } from '../lib/types';
import { inngest } from './client';

interface SyncTimersEvent {
  data: {
    userEmail?: string;
    jiraDomain?: string;
  };
}

/**
 * Inngest function: sync-active-timers
 *
 * Triggered by:
 *  - event: "clockwork/timers.sync.requested"
 *  - cron: every minute 7:00-19:59 Mon-Sat (VN time)
 *
 * Steps:
 *   1. Fetch active timers via Atlassian Forge GraphQL Gateway
 *   2. Resolve timer authors via Jira user cache
 *   3. Cache per-user and global timers to Redis
 */
export const syncActiveTimers = inngest.createFunction(
  {
    id: 'sync-active-timers',
    name: 'Sync Active Clockwork Timers',
    retries: 2,
  },
  [
    { event: 'clockwork/timers.sync.requested' },
    { cron: 'TZ=Asia/Ho_Chi_Minh * 7-19 * * 1-6' },
  ],
  async ({ event, step }) => {
    const eventData = (event as SyncTimersEvent).data;
    const jiraDomain = eventData?.jiraDomain ?? env.JIRA_DOMAIN;

    const result = await step.run('sync-process', async () => {
      console.log(`[sync-process] Starting sync for domain: ${jiraDomain}`);

      // 1. Fetch timers via Forge GraphQL Gateway
      console.log('[sync-process] Fetching timers via Forge GraphQL Gateway...');
      const cachedContextToken = await getCachedForgeContextToken() ?? undefined;
      const forgeResult = await fetchTimersViaForge(
        env.ATLASSIAN_SESSION_TOKEN,
        jiraDomain,
        env.JIRA_CLOUD_ID,
        env.JIRA_WORKSPACE_ID,
        env.FORGE_EXTENSION_ID,
        cachedContextToken,
      );

      // Cache the new context token for next run
      if (forgeResult.contextToken) {
        await setCachedForgeContextToken(
          forgeResult.contextToken,
          forgeResult.contextTokenExpiresAt ?? undefined,
        );
      }

      const timers = forgeResult.timers;
      console.log(`[sync-process] Fetched ${timers.length} active timers.`);

      // 2. Resolve timer authors via Jira user cache
      console.log('[sync-process] Resolving timer authors via Jira user cache...');
      const allEntries = await resolveTimerAuthors(timers);
      console.log(`[sync-process] Author resolution complete for ${allEntries.length} timers.`);

      // 3. Group by user
      const byUser: Record<string, Timer[]> = {};
      for (const entry of allEntries) {
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

      const oldActiveUsers = await getActiveUserIds();
      const currentActiveUsers = Object.keys(byUser);

      const usersToClear = oldActiveUsers.filter(
        (userId) => !currentActiveUsers.includes(userId),
      );

      if (usersToClear.length > 0) {
        console.log(
          `[sync-process] Clearing cache for ${usersToClear.length} users with stopped timers...`,
        );
        await Promise.all(
          usersToClear.map((userId) => deleteActiveTimers(userId)),
        );
      }

      await setActiveUserIds(currentActiveUsers);

      await Promise.all(
        Object.entries(byUser).map(([accountId, userTimers]) =>
          setActiveTimers(accountId, userTimers),
        ),
      );

      await setActiveTimers('all', allEntries);
      console.log('[sync-process] Caching complete.');

      return {
        success: true,
        jiraDomain,
        timersCount: timers.length,
        cachedUsers: usersCount,
      };
    });

    return result;
  },
);
