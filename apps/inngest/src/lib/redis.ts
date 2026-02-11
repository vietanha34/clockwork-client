import { Redis } from '@upstash/redis';

// function getEnvRequired(name: string): string {
//   const value = process.env[name];
//   if (!value) throw new Error(`Missing required env var: ${name}`);
//   return value;
// }

const TIMER_KEY_PREFIX = 'clockwork:timers:';
const TIMER_CACHE_TTL_SECONDS = 60;

export interface CachedTimerEntry {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  comment: string | null;
  runningFor: string;
  tillNow: number;
  worklogCount: number;
  issue: { key: string; id: number };
  author?: {
    accountId: string;
    displayName: string;
    emailAddress?: string;
    avatarUrl?: string;
  };
}

export interface CachedTimerData {
  timers: CachedTimerEntry[];
  cachedAt: string;
  userEmail: string;
}

function getRedisClient(): Redis {
  return Redis.fromEnv();
}

export async function cacheTimers(
  userEmail: string,
  timers: CachedTimerEntry[],
  ttl = TIMER_CACHE_TTL_SECONDS,
): Promise<void> {
  const redis = getRedisClient();
  const key = `${TIMER_KEY_PREFIX}${userEmail}`;
  const payload: CachedTimerData = {
    timers,
    cachedAt: new Date().toISOString(),
    userEmail,
  };
  await redis.setex(key, ttl, payload);
}
