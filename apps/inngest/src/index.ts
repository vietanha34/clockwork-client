import express from 'express';
import { serve } from 'inngest/express';
import { inngest } from './inngest/client';
import { syncActiveTimers } from './inngest/sync-active-timers';
import { getEnvRequired } from './lib/redis';

const app = express();
app.use(express.json());
const port = process.env.PORT ?? 3001;

app.use(
  '/api/inngest',
  serve({
    client: inngest,
    functions: [syncActiveTimers],
  }),
);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Inngest server listening on port ${port} with JIRA domain ${getEnvRequired('JIRA_DOMAIN')}`);
  // eslint-disable-next-line no-console
  console.log(`Inngest endpoint: http://localhost:${port}/api/inngest`);
});
