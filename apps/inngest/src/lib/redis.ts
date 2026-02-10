import { Redis } from "@upstash/redis";

function getEnvRequired(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

const TIMER_KEY_PREFIX = "clockwork:timers:";
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
}

export interface CachedTimerData {
  timers: CachedTimerEntry[];
  cachedAt: string;
  userEmail: string;
}

function getRedisClient(): Redis {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    getEnvRequired("UPSTASH_REDIS_REST_URL");
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    getEnvRequired("UPSTASH_REDIS_REST_TOKEN");

  return new Redis({
    url,
    token,
  });
}

export async function cacheTimers(
  userEmail: string,
  timers: CachedTimerEntry[],
  ttl = TIMER_CACHE_TTL_SECONDS
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
