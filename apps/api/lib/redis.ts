import { Redis } from "@upstash/redis";
import { env } from "./env.js";
import type { CachedTimerData, Timer } from "./types.js";

const TIMER_CACHE_TTL_SECONDS = 60; // 1 minute
const TIMER_KEY_PREFIX = "clockwork:timers:";

function getTimerKey(userEmail: string): string {
  return `${TIMER_KEY_PREFIX}${userEmail}`;
}

function getRedisClient(): Redis {
  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

export async function getActiveTimers(
  userEmail: string
): Promise<CachedTimerData | null> {
  const redis = getRedisClient();
  const key = getTimerKey(userEmail);
  const data = await redis.get<CachedTimerData>(key);
  return data;
}

export async function setActiveTimers(
  userEmail: string,
  timers: Timer[],
  ttl = TIMER_CACHE_TTL_SECONDS
): Promise<void> {
  const redis = getRedisClient();
  const key = getTimerKey(userEmail);
  const payload: CachedTimerData = {
    timers,
    cachedAt: new Date().toISOString(),
    userEmail,
  };
  await redis.setex(key, ttl, payload);
}

export async function deleteActiveTimers(userEmail: string): Promise<void> {
  const redis = getRedisClient();
  const key = getTimerKey(userEmail);
  await redis.del(key);
}
