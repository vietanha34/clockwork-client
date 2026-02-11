import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serve } from 'inngest/node';
import { inngest } from '../src/inngest/client.js';
import { syncActiveTimers } from '../src/inngest/sync-active-timers.js';

const handler = serve({
  client: inngest,
  functions: [syncActiveTimers],
});

export default function (req: VercelRequest, res: VercelResponse) {
  return handler(req, res);
}
