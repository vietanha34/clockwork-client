import { type RedisClientType, createClient } from 'redis';
import type { CachedTimerData, ClockworkUser, Timer } from './types';

const TIMER_CACHE_TTL_SECONDS = 600; // 1 minute
const TIMER_KEY_PREFIX = 'clockwork:timers:';

const JIRA_USER_CACHE_TTL_SECONDS = 172_800; // 2 days
const JIRA_USER_KEY_PREFIX = 'jira:user:';

let redisClient: RedisClientType | undefined;

async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error('Missing REDIS_URL env var');
  }

  redisClient = createClient({
    url,
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));

  await redisClient.connect();
  return redisClient;
}

function getTimerKey(userEmail: string): string {
  return `${TIMER_KEY_PREFIX}${userEmail}`;
}

export async function getActiveTimers(userEmail: string): Promise<CachedTimerData | null> {
  try {
    const redis = await getRedisClient();
    const key = getTimerKey(userEmail);
    const data = await redis.get(key);
    return data ? (JSON.parse(data) as CachedTimerData) : null;
  } catch (err) {
    console.error('Redis getActiveTimers error:', err);
    return null;
  }
}

export async function setActiveTimers(
  userEmail: string,
  timers: Timer[],
  ttl = TIMER_CACHE_TTL_SECONDS,
): Promise<void> {
  console.log(`[setActiveTimers] Caching ${timers.length} timers for ${userEmail}`);
  try {
    const redis = await getRedisClient();
    const key = getTimerKey(userEmail);
    const payload: CachedTimerData = {
      timers,
      cachedAt: new Date().toISOString(),
      userEmail,
    };
    await redis.set(key, JSON.stringify(payload), {
      EX: ttl,
    });
  } catch (err) {
    console.error('Redis setActiveTimers error:', err);
  } 
}

export async function deleteActiveTimers(userEmail: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    const key = getTimerKey(userEmail);
    await redis.del(key);
  } catch (err) {
    console.error('Redis deleteActiveTimers error:', err);
  }
}

// ─── Jira User Cache ──────────────────────────────────────────────────────────

function getJiraUserKey(accountId: string): string {
  return `${JIRA_USER_KEY_PREFIX}${accountId}`;
}

export async function getCachedJiraUser(accountId: string): Promise<ClockworkUser | null> {
  try {
    const redis = await getRedisClient();
    const data = await redis.get(getJiraUserKey(accountId));
    return data ? (JSON.parse(data) as ClockworkUser) : null;
  } catch (err) {
    console.error('Redis getCachedJiraUser error:', err);
    return null;
  }
}

export async function setCachedJiraUser(
  accountId: string,
  user: ClockworkUser,
  ttl = JIRA_USER_CACHE_TTL_SECONDS,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(getJiraUserKey(accountId), JSON.stringify(user), { EX: ttl });
  } catch (err) {
    console.error('Redis setCachedJiraUser error:', err);
  }
}
