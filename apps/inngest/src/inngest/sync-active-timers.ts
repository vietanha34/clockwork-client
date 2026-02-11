import { fetchActiveTimers } from '../lib/clockwork-report.js';
import { acquireClockworkJwt } from '../lib/jira-jwt.js';
import { type CachedTimerEntry, cacheTimers } from '../lib/redis.js';
import { inngest } from './client.js';

interface SyncTimersEvent {
  data: {
    userEmail: string;
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
 * Triggered by event: "clockwork/timers.sync.requested"
 * Payload: { userEmail: string, jiraDomain?: string }
 *
 * Steps:
 *   1. acquire-jwt: Exchange Jira session cookie for Clockwork JWT
 *   2. fetch-timers: Fetch active timers from Clockwork Report API
 *   3. cache-timers: Store results in Upstash Redis
 */
export const syncActiveTimers = inngest.createFunction(
  {
    id: 'sync-active-timers',
    name: 'Sync Active Clockwork Timers',
    retries: 2,
  },
  { event: 'clockwork/timers.sync.requested' },
  async ({ event, step }) => {
    const { userEmail, jiraDomain: eventDomain } = (event as SyncTimersEvent).data;

    const jiraDomain = eventDomain ?? getEnvRequired('JIRA_DOMAIN');

    // Step 1: Acquire Clockwork JWT from Jira servlet
    const jwt = await step.run('acquire-jwt', async () => {
      const jiraFullCookie = getEnvRequired('JIRA_FULL_COOKIE');
      const token = await acquireClockworkJwt(jiraDomain, jiraFullCookie);
      return { jwt: token };
    });

    // Step 2: Fetch active timers from Clockwork Report API
    const fetchResult = await step.run('fetch-timers', async () => {
      const response = await fetchActiveTimers(jwt.jwt, jiraDomain);
      return {
        timers: response.timers,
        total: response.total,
      };
    });

    // Step 3: Transform and cache timers in Upstash Redis
    const cacheResult = await step.run('cache-timers', async () => {
      const entries: CachedTimerEntry[] = fetchResult.timers.map((t) => ({
        id: t.id,
        startedAt: t.started_at,
        finishedAt: t.finished_at,
        comment: t.comment,
        runningFor: t.running_for,
        tillNow: t.till_now,
        worklogCount: t.worklog_count,
        issue: { key: t.issue.key, id: t.issue.id },
      }));

      await cacheTimers(userEmail, entries);

      return { cached: true, count: entries.length };
    });

    return {
      success: true,
      userEmail,
      jiraDomain,
      timersCount: fetchResult.total,
      cached: cacheResult.cached,
    };
  },
);
