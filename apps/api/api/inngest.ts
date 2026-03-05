import { serve } from 'inngest/node';
import { inngest } from '../src/inngest/client';
import { adjustLunchWorklogs } from '../src/inngest/adjust-lunch-worklogs';
import { syncActiveTimers } from '../src/inngest/sync-active-timers';

export default serve({
  client: inngest,
  functions: [syncActiveTimers, adjustLunchWorklogs],
});
