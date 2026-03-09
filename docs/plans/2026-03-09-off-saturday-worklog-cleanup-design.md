# Off-Saturday Worklog Cleanup Design

Date: 2026-03-09

## Context
Clockwork Pro currently allows Saturday configuration continuously, while the company operates every other Saturday.
This causes extra worklogs to be created on alternating off Saturdays.

## Requirements
- Use ISO week parity to determine off Saturday.
- Initial policy: `even` weeks are off, `odd` weeks are working.
- On off Saturday, delete worklogs for all users in the time window `08:00-12:00` (Asia/Ho_Chi_Minh).
- Default behavior must be disabled unless explicitly enabled via environment variable.

## Proposed Solution
Add a new Inngest cron function that runs every Saturday at 12:10 VN time.
The function performs a strict gate before deletion:
1. Feature toggle enabled.
2. Current day is Saturday in VN timezone.
3. Current ISO week parity matches configured off-week parity.

If all checks pass:
1. Fetch updated worklog IDs since 00:00 VN of the same day.
2. Fetch full worklog details.
3. Filter worklogs whose `started` timestamp in VN falls within `08:00-12:00`.
4. Delete each matched worklog through Jira REST API.

## Configuration
- `SATURDAY_OFF_CLEANUP_ENABLED` (`false` by default)
- `SATURDAY_OFF_WEEK_PARITY` (`even` by default; accepted: `even|odd`)
- `SATURDAY_OFF_CLEANUP_TIME_START` (`08:00` default)
- `SATURDAY_OFF_CLEANUP_TIME_END` (`12:00` default)

## Error Handling
- Any per-worklog deletion error is logged and counted; job continues processing remaining items.
- Job returns structured result with `deleted`, `failed`, `skipped` and policy metadata.
- If global prerequisite checks fail, return early with reason and no deletion.

## Testing Strategy
- Unit test ISO-week and parity decision helper using fixed VN Saturday dates.
- Verify inclusive/exclusive time-window filter behavior.
- Run type-check/build for `apps/api`.

## Risks
- Deleting by time window can remove legitimate manual logs. This is accepted by user request.
- Worklogs created but not updated after midnight window may be missed. Using `worklog/updated` from 00:00 VN minimizes misses for same-day creations.
