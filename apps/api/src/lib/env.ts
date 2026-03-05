/**
 * Typed environment variable accessors.
 * All vars are read at call time (not module load) so they work with
 * Vercel's per-request environment injection.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Upstash Redis (or any Redis with REST API)
  get UPSTASH_REDIS_REST_URL(): string {
    return (
      process.env.UPSTASH_REDIS_REST_URL ||
      process.env.KV_REST_API_URL ||
      required('UPSTASH_REDIS_REST_URL')
    );
  },
  get UPSTASH_REDIS_REST_TOKEN(): string {
    return (
      process.env.UPSTASH_REDIS_REST_TOKEN ||
      process.env.KV_REST_API_TOKEN ||
      required('UPSTASH_REDIS_REST_TOKEN')
    );
  },

  // Standard Redis (redis:// protocol) - used by redis client
  get REDIS_URL(): string {
    return process.env.REDIS_URL || required('REDIS_URL');
  },

  // Clockwork Pro API
  get CLOCKWORK_API_BASE_URL(): string {
    return optional('CLOCKWORK_API_BASE_URL', 'https://api.clockwork.report/v1');
  },
  get CLOCKWORK_API_TOKEN(): string {
    return required('CLOCKWORK_API_TOKEN');
  },

  // Atlassian / Jira
  get ATLASSIAN_EMAIL(): string {
    return required('ATLASSIAN_EMAIL');
  },
  get ATLASSIAN_API_TOKEN(): string {
    return required('ATLASSIAN_API_TOKEN');
  },
  get JIRA_DOMAIN(): string {
    return required('JIRA_DOMAIN');
  },
  // Atlassian / Jira
  get JIRA_TENANT_SESSION_TOKEN(): string {
    return required('JIRA_TENANT_SESSION_TOKEN');
  },

  // Atlassian Forge Gateway
  get FORGE_EXTENSION_ID(): string {
    return optional(
      'FORGE_EXTENSION_ID',
      'ari:cloud:ecosystem::extension/2f4dbb6a-b1b8-4824-94b1-42a64e507a09/725dad32-d2c5-4b58-a141-a093d70c8d34/static/global-pages',
    );
  },
  get JIRA_CLOUD_ID(): string {
    return required('JIRA_CLOUD_ID');
  },
  get JIRA_WORKSPACE_ID(): string {
    return required('JIRA_WORKSPACE_ID');
  },
  get JIRA_ACCOUNT_ID(): string {
    return required('JIRA_ACCOUNT_ID');
  },
} as const;
