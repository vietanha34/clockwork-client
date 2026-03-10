import { env } from '../lib/env';
import {
  deleteWorklog,
  getUpdatedWorklogIds,
  getWorklogsByIds,
  type JiraWorklogDetail,
} from '../lib/jira-worklog-client';
import {
  getStartOfVnDayEpochMs,
  getVnDateString,
  isInVnTimeWindow,
  parseClockTimeToMinutes,
  shouldRunOffSaturdayCleanup,
} from '../lib/off-saturday-policy';
import { inngest } from './client';

interface DeleteResult {
  worklogId: number;
  issueId: string;
  status: 'deleted' | 'failed';
  error?: string;
}

function shouldDeleteWorklogForWindow(
  worklog: JiraWorklogDetail,
  targetDate: string,
  startMinutes: number,
  endMinutes: number,
): boolean {
  return (
    getVnDateString(worklog.started) === targetDate &&
    isInVnTimeWindow(worklog.started, startMinutes, endMinutes)
  );
}

/**
 * Inngest cron function: cleanup-off-saturday-worklogs
 *
 * Runs every Saturday at 12:10 VN, but does real cleanup only when:
 * - SATURDAY_OFF_CLEANUP_ENABLED=true
 * - current ISO week parity matches SATURDAY_OFF_WEEK_PARITY
 *
 * Scope: ALL users, delete worklogs started in configured VN time window.
 */
export const cleanupOffSaturdayWorklogs = inngest.createFunction(
  {
    id: 'cleanup-off-saturday-worklogs',
    name: 'Cleanup Off Saturday Worklogs',
    retries: 1,
  },
  [{ cron: 'TZ=Asia/Ho_Chi_Minh 10 12 * * 6' }],
  async ({ step }) => {
    return step.run('cleanup-off-saturday', async () => {
      if (!env.SATURDAY_OFF_CLEANUP_ENABLED) {
        console.log('[off-saturday-cleanup] Skipped: feature is disabled');
        return { skipped: true, reason: 'disabled' };
      }

      const now = new Date();
      const decision = shouldRunOffSaturdayCleanup(now, env.SATURDAY_OFF_WEEK_PARITY);

      if (!decision.isSaturday) {
        console.log('[off-saturday-cleanup] Skipped: not Saturday in Asia/Ho_Chi_Minh');
        return { skipped: true, reason: 'not_saturday', ...decision };
      }

      if (!decision.isOffSaturday) {
        console.log(
          `[off-saturday-cleanup] Skipped: ISO week ${decision.isoWeek} is working Saturday by policy`,
        );
        return { skipped: true, reason: 'working_saturday', ...decision };
      }

      const startMinutes = parseClockTimeToMinutes(env.SATURDAY_OFF_CLEANUP_TIME_START);
      const endMinutes = parseClockTimeToMinutes(env.SATURDAY_OFF_CLEANUP_TIME_END);
      const sinceMs = getStartOfVnDayEpochMs(now);

      console.log(
        `[off-saturday-cleanup] Running cleanup for ${decision.vnDate}, window ${env.SATURDAY_OFF_CLEANUP_TIME_START}-${env.SATURDAY_OFF_CLEANUP_TIME_END}, updated since ${new Date(sinceMs).toISOString()}`,
      );

      const worklogIds = await getUpdatedWorklogIds(sinceMs);
      if (worklogIds.length === 0) {
        return {
          skipped: false,
          isoWeek: decision.isoWeek,
          vnDate: decision.vnDate,
          scanned: 0,
          candidates: 0,
          deleted: 0,
          failed: 0,
          details: [] as DeleteResult[],
        };
      }

      const worklogs = await getWorklogsByIds(worklogIds);
      const candidates = worklogs.filter((worklog) =>
        shouldDeleteWorklogForWindow(worklog, decision.vnDate, startMinutes, endMinutes),
      );

      const details: DeleteResult[] = [];

      for (const worklog of candidates) {
        const worklogId = Number(worklog.id);
        try {
          await deleteWorklog(worklog.issueId, worklogId);
          details.push({ worklogId, issueId: worklog.issueId, status: 'deleted' });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(
            `[off-saturday-cleanup] Failed deleting worklog ${worklogId} (issue ${worklog.issueId}): ${message}`,
          );
          details.push({
            worklogId,
            issueId: worklog.issueId,
            status: 'failed',
            error: message,
          });
        }
      }

      const deleted = details.filter((d) => d.status === 'deleted').length;
      const failed = details.filter((d) => d.status === 'failed').length;

      console.log(
        `[off-saturday-cleanup] Done: scanned=${worklogs.length}, candidates=${candidates.length}, deleted=${deleted}, failed=${failed}`,
      );

      return {
        skipped: false,
        isoWeek: decision.isoWeek,
        vnDate: decision.vnDate,
        scanned: worklogs.length,
        candidates: candidates.length,
        deleted,
        failed,
        details,
      };
    });
  },
);
