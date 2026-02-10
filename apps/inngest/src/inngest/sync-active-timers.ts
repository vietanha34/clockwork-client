import { inngest } from "./client.js";

/**
 * Placeholder function for syncing active Clockwork timers.
 * Will be implemented in the backend-api track.
 *
 * This function:
 * 1. Acquires a JWT from the Jira servlet endpoint (cookie -> JWT exchange)
 * 2. Fetches active timers from Clockwork Report API using the JWT
 * 3. Stores the results in Upstash Redis for fast client retrieval
 */
export const syncActiveTimers = inngest.createFunction(
  {
    id: "sync-active-timers",
    name: "Sync Active Clockwork Timers",
  },
  { event: "clockwork/timers.sync.requested" },
  async ({ event, step }) => {
    const { userEmail } = event.data as { userEmail: string };

    // Step 1: Acquire JWT (placeholder)
    const jwt = await step.run("acquire-jwt", async () => {
      // TODO: implement in backend-api track
      return { jwt: "placeholder", userEmail };
    });

    // Step 2: Fetch timers (placeholder)
    const timers = await step.run("fetch-timers", async () => {
      // TODO: implement in backend-api track
      return { timers: [], jwt: jwt.jwt };
    });

    // Step 3: Cache in Redis (placeholder)
    await step.run("cache-timers", async () => {
      // TODO: implement in backend-api track
      return { cached: true, count: timers.timers.length };
    });

    return { success: true, userEmail };
  }
);
