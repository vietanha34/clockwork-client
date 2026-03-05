// apps/api/src/lib/worklog-adjuster.ts
import { env } from './env';
import { getClockworkJwt } from './clockwork-jwt';
import { isWorklogAdjusted, markWorklogAdjusted } from './redis';
import type { JiraWorklogDetail } from './jira-worklog-client';

const LUNCH_START_HOUR = 12;
const LUNCH_START_MINUTE = 0;
const LUNCH_END_HOUR = 13;
const LUNCH_END_MINUTE = 30;
const LUNCH_DURATION_SECONDS = 90 * 60; // 1.5h
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

interface AdjustResult {
  worklogId: number;
  issueId: string;
  originalSeconds: number;
  overlapSeconds: number;
  adjustedSeconds: number;
}

/**
 * Calculate the overlap in seconds between a worklog's time range and lunch break.
 */
export function calculateLunchOverlap(started: string, timeSpentSeconds: number): number {
  // Parse started as a Date
  const startDate = new Date(started);

  // Get the date components in VN timezone
  const vnDate = new Date(startDate.toLocaleString('en-US', { timeZone: VN_TIMEZONE }));
  const year = vnDate.getFullYear();
  const month = vnDate.getMonth();
  const day = vnDate.getDate();

  // Build lunch start/end as timestamps in VN time
  // We use the same calendar day as the worklog start
  const lunchStartLocal = new Date(year, month, day, LUNCH_START_HOUR, LUNCH_START_MINUTE);
  const lunchEndLocal = new Date(year, month, day, LUNCH_END_HOUR, LUNCH_END_MINUTE);

  // Convert lunch times to UTC timestamps using the offset from the started timestamp
  // The offset between vnDate and startDate gives us the VN→UTC offset
  const vnToUtcOffsetMs = startDate.getTime() - vnDate.getTime();
  const lunchStartUtc = new Date(lunchStartLocal.getTime() + vnToUtcOffsetMs);
  const lunchEndUtc = new Date(lunchEndLocal.getTime() + vnToUtcOffsetMs);

  const worklogStart = startDate;
  const worklogEnd = new Date(startDate.getTime() + timeSpentSeconds * 1000);

  const overlapStart = Math.max(worklogStart.getTime(), lunchStartUtc.getTime());
  const overlapEnd = Math.min(worklogEnd.getTime(), lunchEndUtc.getTime());

  const overlapMs = Math.max(0, overlapEnd - overlapStart);
  return Math.floor(overlapMs / 1000);
}

/**
 * Extract plain text from Jira ADF comment structure.
 */
function extractCommentText(comment?: JiraWorklogDetail['comment']): string {
  if (!comment?.content) return '';
  return comment.content
    .flatMap((block) => block.content ?? [])
    .map((inline) => inline.text ?? '')
    .join('');
}

/**
 * Update a worklog's timeSpent via Clockwork Pro API.
 */
async function updateWorklogTime(
  worklogId: number,
  issueId: string,
  adjustedSeconds: number,
  started: string,
  comment: string,
): Promise<void> {
  // Need issue context for JWT - use a default project context
  // The JWT servlet needs an issue context, we use the worklog's issueId
  const jwt = await getClockworkJwt({
    issueId,
    issueKey: 'TL-1', // Placeholder - servlet only needs valid issueId
    projectId: '10545',
    projectKey: 'TL',
  });

  const adjustedMinutes = Math.max(1, Math.round(adjustedSeconds / 60));
  const timeSpent = `${adjustedMinutes}m`;

  const url = `https://app.clockwork.report/worklogs/${worklogId}.json?xdm_e=https://${env.JIRA_DOMAIN}`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `JWT ${jwt}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Origin': 'https://app.clockwork.report',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
    body: JSON.stringify({
      adjust_estimate: 'new',
      new_estimate: '1m',
      expand: 'properties',
      issueId,
      timeSpent,
      comment,
      started,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clockwork update worklog ${worklogId} failed ${res.status}: ${text}`);
  }

  console.log(`[worklog-adjuster] Updated worklog ${worklogId}: ${timeSpent}`);
}

/**
 * Process a list of worklogs: filter by accountId and date range,
 * calculate lunch overlap, and adjust via Clockwork API.
 */
export async function adjustWorklogs(
  worklogs: JiraWorklogDetail[],
  accountId: string,
  targetDates: string[], // YYYY-MM-DD array
): Promise<AdjustResult[]> {
  const results: AdjustResult[] = [];

  // Filter worklogs for target user and dates
  const candidates = worklogs.filter((w) => {
    if (w.author.accountId !== accountId) return false;

    // Extract date in VN timezone
    const startDate = new Date(w.started);
    const vnDateStr = startDate.toLocaleDateString('en-CA', { timeZone: VN_TIMEZONE }); // YYYY-MM-DD
    return targetDates.includes(vnDateStr);
  });

  console.log(`[worklog-adjuster] Found ${candidates.length} candidate worklogs for ${accountId}`);

  for (const worklog of candidates) {
    const worklogId = Number(worklog.id);

    // Skip already adjusted
    if (await isWorklogAdjusted(worklogId)) {
      console.log(`[worklog-adjuster] Skipping already adjusted worklog ${worklogId}`);
      continue;
    }

    const overlap = calculateLunchOverlap(worklog.started, worklog.timeSpentSeconds);
    if (overlap <= 0) {
      console.log(`[worklog-adjuster] No lunch overlap for worklog ${worklogId}`);
      continue;
    }

    const adjustedSeconds = worklog.timeSpentSeconds - overlap;
    if (adjustedSeconds <= 0) {
      console.log(`[worklog-adjuster] Worklog ${worklogId} entirely within lunch, skipping`);
      continue;
    }

    console.log(
      `[worklog-adjuster] Adjusting worklog ${worklogId}: ${worklog.timeSpentSeconds}s - ${overlap}s = ${adjustedSeconds}s`,
    );

    await updateWorklogTime(
      worklogId,
      worklog.issueId,
      adjustedSeconds,
      worklog.started,
      extractCommentText(worklog.comment),
    );

    await markWorklogAdjusted(worklogId);

    results.push({
      worklogId,
      issueId: worklog.issueId,
      originalSeconds: worklog.timeSpentSeconds,
      overlapSeconds: overlap,
      adjustedSeconds,
    });
  }

  return results;
}
