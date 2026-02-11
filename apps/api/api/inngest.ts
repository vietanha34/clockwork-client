import { serve } from 'inngest/node';
import { inngest } from '../src/inngest/client';
import { syncActiveTimers } from '../src/inngest/sync-active-timers';

export default serve({
  client: inngest,
  functions: [syncActiveTimers],
});
