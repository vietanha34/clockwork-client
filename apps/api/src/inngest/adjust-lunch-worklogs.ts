// apps/api/src/inngest/adjust-lunch-worklogs.ts
import { getUpdatedWorklogIds, getWorklogsByIds } from '../lib/jira-worklog-client';
import { adjustWorklogs } from '../lib/worklog-adjuster';
import { inngest } from './client';

/**
 * Inngest cron function: adjust-lunch-worklogs
 *
 * Runs at 17:17 VN time (10:10 UTC), Monday-Friday.
 * Scans worklogs updated today and yesterday, subtracts lunch break
 * overlap (12:00-13:30) from affected worklogs.
 *
 * Note: Processes worklogs for ALL users. To filter by specific user,
 * modify the accountId parameter in adjustWorklogs call.
 */
export const adjustLunchWorklogs = inngest.createFunction(
  {
    id: 'adjust-lunch-worklogs',
    name: 'Adjust Lunch Break Worklogs',
    retries: 2,
  },
  [{ cron: 'TZ=Asia/Ho_Chi_Minh 17 17 * * 1-5' }],
  async ({ step }) => {
    const result = await step.run('adjust-worklogs', async () => {
      // Set to specific accountId to filter by user, or null for all users
      const accountId: string | null = null; // null = all users

      // Calculate target dates (today + yesterday in VN timezone)
      const now = new Date();
      const vnNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const today = vnNow.toLocaleDateString('en-CA'); // YYYY-MM-DD

      const vnYesterday = new Date(vnNow);
      vnYesterday.setDate(vnYesterday.getDate() - 1);
      const yesterday = vnYesterday.toLocaleDateString('en-CA');

      const targetDates = [yesterday, today];
      console.log(`[adjust-lunch] Target dates: ${targetDates.join(', ')}`);

      // Calculate since = 00:00 yesterday in VN time → epoch ms
      const sinceDate = new Date(vnYesterday);
      sinceDate.setHours(0, 0, 0, 0);
      // Adjust to UTC: VN is UTC+7, so subtract 7 hours
      const sinceMs = sinceDate.getTime() - 7 * 60 * 60 * 1000;

      console.log(
        `[adjust-lunch] Fetching worklogs updated since ${new Date(sinceMs).toISOString()}`,
      );

      // 1. Get updated worklog IDs
      const worklogIds = await getUpdatedWorklogIds(sinceMs);
      if (worklogIds.length === 0) {
        console.log('[adjust-lunch] No updated worklogs found');
        return { adjusted: 0, skipped: 0, targetDates };
      }

      // 2. Get full worklog details
      const worklogs = await getWorklogsByIds(worklogIds);

      // 3. Adjust worklogs with lunch overlap
      const adjustResults = await adjustWorklogs(worklogs, accountId, targetDates);

      console.log(
        `[adjust-lunch] Done: ${adjustResults.length} adjusted, target dates: ${targetDates.join(', ')}`,
      );

      return {
        adjusted: adjustResults.length,
        details: adjustResults,
        targetDates,
        totalWorklogsScanned: worklogs.length,
      };
    });

    return result;
  },
);
