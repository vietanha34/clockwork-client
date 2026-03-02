# Summary Week Selector Design

## Problem

The Summary tab (WeeklyChart) always shows the current week with no way to view previous weeks. Users want to review last week's worklog summary.

## Requirements

- Add week selection to Summary tab only (List tab unchanged)
- Allow viewing current week and previous week only (2 options)
- Default to current week
- UI: toggle buttons styled like existing WorklogTabs

## Design

### Data Flow

Refactor `useWeeklyWorklogs` to accept an optional `weekOffset` parameter (0 or -1):

- `weekOffset = 0`: current week (existing behavior)
- `weekOffset = -1`: previous week

`getWeekDates()` receives a `referenceDate` computed as `today - (weekOffset * 7 days)`. When viewing last week, all 7 days are in the past so `isFuture` is false for all — all days get fetched.

Cache key remains `['worklogs', accountId, 'YYYY-MM-DD']` — shared with `useWorklogs` and unchanged.

### UI: WeekSelector Component

A toggle with 2 buttons matching `WorklogTabs` styling:

```
[Last week] [This week ✓]
      Feb 24 – Mar 2
```

- Same styling pattern as WorklogTabs: bg-gray-100 container, active button has bg-white + shadow + font-medium, inactive has text-gray-500
- Replaces the plain `weekRange` text currently shown in Summary tab
- Week range label displayed below the toggle, computed from `weekData[0].date` and `weekData[6].date`

### Integration in MainView

New state in MainView:

```tsx
const [summaryWeekOffset, setSummaryWeekOffset] = useState<0 | -1>(0);
```

Pass offset to `useWeeklyWorklogs(summaryWeekOffset)`. When `activeTab === 'summary'`, render `WeekSelector` + `WeeklyChart`. List tab remains unaffected — uses its own `selectedDate` state.

Week selection persists when switching between tabs within the same session.

## Files to Modify

1. `apps/tauri/src/hooks/useWeeklyWorklogs.ts` — add `weekOffset` parameter to `getWeekDates()` and `useWeeklyWorklogs()`
2. `apps/tauri/src/components/WeekSelector.tsx` — new toggle component
3. `apps/tauri/src/views/MainView.tsx` — add `summaryWeekOffset` state, wire up components

## Out of Scope

- Week navigation for List tab
- Viewing more than 1 week back
- Keyboard shortcuts for week switching
