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

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Upstash Redis
  get UPSTASH_REDIS_REST_URL(): string {
    return required("UPSTASH_REDIS_REST_URL");
  },
  get UPSTASH_REDIS_REST_TOKEN(): string {
    return required("UPSTASH_REDIS_REST_TOKEN");
  },

  // Clockwork Pro API
  get CLOCKWORK_API_BASE_URL(): string {
    return optional(
      "CLOCKWORK_API_BASE_URL",
      "https://api.clockwork.report/v1"
    );
  },
  get CLOCKWORK_API_TOKEN(): string {
    return required("CLOCKWORK_API_TOKEN");
  },

  // Atlassian / Jira
  get ATLASSIAN_EMAIL(): string {
    return required("ATLASSIAN_EMAIL");
  },
  get ATLASSIAN_API_TOKEN(): string {
    return required("ATLASSIAN_API_TOKEN");
  },
  get JIRA_DOMAIN(): string {
    return required("JIRA_DOMAIN");
  },
} as const;
