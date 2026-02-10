import express from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest/client.js";
import { syncActiveTimers } from "./inngest/sync-active-timers.js";

const app = express();
const port = process.env.PORT ?? 3001;

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [syncActiveTimers],
  })
);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Inngest server listening on port ${port}`);
  // eslint-disable-next-line no-console
  console.log(`Inngest endpoint: http://localhost:${port}/api/inngest`);
});
