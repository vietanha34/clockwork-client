import { type RedisClientType, createClient } from 'redis';
import { env } from './env';
import type { CachedTimerData, ClockworkUser, Issue, Timer } from './types';

const TIMER_CACHE_TTL_SECONDS = 600; // 1 minute
const TIMER_KEY_PREFIX = 'clockwork:timers:';
const ACTIVE_USERS_SET_KEY = 'clockwork:active_users';

const JIRA_USER_CACHE_TTL_SECONDS = 172_800; // 2 days
const JIRA_USER_KEY_PREFIX = 'jira:user:';
const JIRA_EMAIL_KEY_PREFIX = 'jira:email:';
const JIRA_ISSUE_CACHE_TTL_SECONDS = 86_400; // 1 day
const JIRA_ISSUE_KEY_PREFIX = 'jira:issue:';

let redisClient: RedisClientType | undefined;

async function getRedisClient(): Promise<RedisClientType> {
  if (redisClient?.isOpen) {
    return redisClient;
  }

  const url = env.REDIS_URL;

  redisClient = createClient({
    url,
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));

  await redisClient.connect();
  return redisClient;
}

function getTimerKey(userKey: string): string {
  return `${TIMER_KEY_PREFIX}${userKey}`;
}

export async function getActiveTimers(userKey: string): Promise<CachedTimerData | null> {
  try {
    const redis = await getRedisClient();
    const key = getTimerKey(userKey);
    const data = await redis.get(key);
    return data ? (JSON.parse(data) as CachedTimerData) : null;
  } catch (err) {
    console.error('Redis getActiveTimers error:', err);
    return null;
  }
}

export async function setActiveTimers(
  userKey: string,
  timers: Timer[],
  ttl = TIMER_CACHE_TTL_SECONDS,
): Promise<void> {
  console.log(`[setActiveTimers] Caching ${timers.length} timers for ${userKey}`);
  try {
    const redis = await getRedisClient();
    const key = getTimerKey(userKey);
    const payload: CachedTimerData = {
      timers,
      cachedAt: new Date().toISOString(),
      userKey,
    };
    await redis.set(key, JSON.stringify(payload), {
      EX: ttl,
    });
  } catch (err) {
    console.error('Redis setActiveTimers error:', err);
  }
}

export async function deleteActiveTimers(userKey: string): Promise<void> {
  console.log(`[deleteActiveTimers] Deleting cached timers for ${userKey}`);
  try {
    const redis = await getRedisClient();
    const key = getTimerKey(userKey);
    await redis.del(key);
  } catch (err) {
    console.error('Redis deleteActiveTimers error:', err);
  }
}

export async function getActiveUserIds(): Promise<string[]> {
  try {
    const redis = await getRedisClient();
    return await redis.sMembers(ACTIVE_USERS_SET_KEY);
  } catch (err) {
    console.error('Redis getActiveUserIds error:', err);
    return [];
  }
}

export async function setActiveUserIds(userIds: string[]): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.del(ACTIVE_USERS_SET_KEY);
    if (userIds.length > 0) {
      await redis.sAdd(ACTIVE_USERS_SET_KEY, userIds);
    }
  } catch (err) {
    console.error('Redis setActiveUserIds error:', err);
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

// ─── Email → accountId Cache ───────────────────────────────────────────────────

function getEmailKey(email: string): string {
  return `${JIRA_EMAIL_KEY_PREFIX}${email}`;
}

export async function getCachedEmailToAccountId(email: string): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(getEmailKey(email));
  } catch (err) {
    console.error('Redis getCachedEmailToAccountId error:', err);
    return null;
  }
}

export async function setCachedEmailToAccountId(email: string, accountId: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(getEmailKey(email), accountId, { EX: JIRA_USER_CACHE_TTL_SECONDS });
  } catch (err) {
    console.error('Redis setCachedEmailToAccountId error:', err);
  }
}

// ─── Issue Cache ──────────────────────────────────────────────────────────────

function getIssueKey(issueIdOrKey: string): string {
  return `${JIRA_ISSUE_KEY_PREFIX}${issueIdOrKey}`;
}

export async function getCachedIssue(issueIdOrKey: string): Promise<Issue | null> {
  try {
    const redis = await getRedisClient();
    const data = await redis.get(getIssueKey(issueIdOrKey));
    return data ? (JSON.parse(data) as Issue) : null;
  } catch (err) {
    console.error('Redis getCachedIssue error:', err);
    return null;
  }
}

export async function setCachedIssue(
  issueIdOrKey: string,
  issue: Issue,
  ttl = JIRA_ISSUE_CACHE_TTL_SECONDS,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.set(getIssueKey(issueIdOrKey), JSON.stringify(issue), { EX: ttl });
  } catch (err) {
    console.error('Redis setCachedIssue error:', err);
  }
}

// ─── Forge Context Token Cache ───────────────────────────────────────────────

const FORGE_CONTEXT_TOKEN_KEY = 'clockwork:forge:context-token';
const FORGE_CONTEXT_TOKEN_MAX_TTL_SECONDS = 840; // 14 minutes
const FORGE_CONTEXT_TOKEN_SAFETY_BUFFER_SECONDS = 60;

interface ForgeContextTokenScope {
  jiraDomain?: string;
  cloudId?: string;
  workspaceId?: string;
}

function buildForgeContextTokenKey(scope?: ForgeContextTokenScope): string {
  const jiraDomain = scope?.jiraDomain?.trim().toLowerCase();
  const cloudId = scope?.cloudId?.trim();
  const workspaceId = scope?.workspaceId?.trim();

  if (!jiraDomain || !cloudId || !workspaceId) {
    return FORGE_CONTEXT_TOKEN_KEY;
  }

  return `${FORGE_CONTEXT_TOKEN_KEY}:${jiraDomain}:${cloudId}:${workspaceId}`;
}

export function calculateForgeContextTokenTtl(
  expiresAt: string | number | undefined,
  options?: {
    nowMs?: number;
    maxTtlSeconds?: number;
    safetyBufferSeconds?: number;
  },
): number {
  const nowMs = options?.nowMs ?? Date.now();
  const maxTtlSeconds = options?.maxTtlSeconds ?? FORGE_CONTEXT_TOKEN_MAX_TTL_SECONDS;
  const safetyBufferSeconds =
    options?.safetyBufferSeconds ?? FORGE_CONTEXT_TOKEN_SAFETY_BUFFER_SECONDS;

  if (expiresAt === undefined || expiresAt === null) {
    return maxTtlSeconds;
  }

  let expiresAtMs: number;
  if (typeof expiresAt === 'number') {
    expiresAtMs = expiresAt;
  } else {
    const numericExpiresAt = Number(expiresAt);
    expiresAtMs = Number.isFinite(numericExpiresAt) ? numericExpiresAt : Date.parse(expiresAt);
  }

  if (!Number.isFinite(expiresAtMs)) {
    return maxTtlSeconds;
  }

  const secondsUntilExpiry = Math.floor((expiresAtMs - nowMs) / 1000) - safetyBufferSeconds;
  if (secondsUntilExpiry <= 0) {
    return 1;
  }

  return Math.min(secondsUntilExpiry, maxTtlSeconds);
}

export async function getCachedForgeContextToken(scope?: ForgeContextTokenScope): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(buildForgeContextTokenKey(scope));
  } catch (err) {
    console.error('Redis getCachedForgeContextToken error:', err);
    return null;
  }
}

export async function setCachedForgeContextToken(
  token: string,
  expiresAtMs?: string,
  scope?: ForgeContextTokenScope,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const ttl = calculateForgeContextTokenTtl(expiresAtMs);
    await redis.set(buildForgeContextTokenKey(scope), token, { EX: ttl });
  } catch (err) {
    console.error('Redis setCachedForgeContextToken error:', err);
  }
}

// ─── Clockwork JWT Cache ─────────────────────────────────────────────────────

const CLOCKWORK_JWT_KEY = 'clockwork:jwt';
const CLOCKWORK_JWT_MAX_TTL_SECONDS = 840; // 14 minutes

export async function getCachedClockworkJwt(): Promise<string | null> {
  try {
    const redis = await getRedisClient();
    return await redis.get(CLOCKWORK_JWT_KEY);
  } catch (err) {
    console.error('Redis getCachedClockworkJwt error:', err);
    return null;
  }
}

export async function setCachedClockworkJwt(
  token: string,
  expiresAt?: number,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    let ttl = CLOCKWORK_JWT_MAX_TTL_SECONDS;
    if (expiresAt) {
      const secondsUntilExpiry = Math.floor((expiresAt * 1000 - Date.now()) / 1000) - 60;
      if (secondsUntilExpiry > 0) {
        ttl = Math.min(secondsUntilExpiry, CLOCKWORK_JWT_MAX_TTL_SECONDS);
      }
    }
    await redis.set(CLOCKWORK_JWT_KEY, token, { EX: ttl });
  } catch (err) {
    console.error('Redis setCachedClockworkJwt error:', err);
  }
}

// ─── Adjusted Worklog Tracking ───────────────────────────────────────────────

const ADJUSTED_WORKLOGS_KEY = 'clockwork:adjusted-worklogs';
const ADJUSTED_WORKLOGS_TTL_SECONDS = 15 * 24 * 60 * 60; // 15 days

export async function isWorklogAdjusted(worklogId: number): Promise<boolean> {
  try {
    const redis = await getRedisClient();
    const result = await redis.sIsMember(ADJUSTED_WORKLOGS_KEY, String(worklogId));
    return Boolean(result);
  } catch (err) {
    console.error('Redis isWorklogAdjusted error:', err);
    return false;
  }
}

export async function markWorklogAdjusted(worklogId: number): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.sAdd(ADJUSTED_WORKLOGS_KEY, String(worklogId));
    // Refresh TTL on each addition
    await redis.expire(ADJUSTED_WORKLOGS_KEY, ADJUSTED_WORKLOGS_TTL_SECONDS);
  } catch (err) {
    console.error('Redis markWorklogAdjusted error:', err);
  }
}
