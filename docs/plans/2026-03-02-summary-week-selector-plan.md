# Summary Week Selector Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a toggle to the Summary tab allowing users to switch between current week and last week's worklog chart.

**Architecture:** Add `weekOffset` parameter to `getWeekDates()` and `useWeeklyWorklogs()`. Create a `WeekSelector` toggle component styled like `WorklogTabs`. Wire state in `MainView` — Summary tab only, List tab unchanged.

**Tech Stack:** React, TypeScript, Tailwind CSS, React Query (TanStack Query)

---

### Task 1: Add `weekOffset` parameter to `getWeekDates()`

**Files:**
- Modify: `apps/tauri/src/hooks/useWeeklyWorklogs.ts:35-56`

**Step 1: Add `weekOffset` parameter to `getWeekDates`**

Change the function signature and compute a reference date offset by `weekOffset * 7` days:

```ts
export function getWeekDates(
  today = new Date(),
  weekOffset: 0 | -1 = 0,
): Array<{
  date: string;
  dayOfWeek: string;
  isFuture: boolean;
}> {
  const ref = new Date(today);
  ref.setDate(ref.getDate() + weekOffset * 7);
  const monday = startOfCurrentWeekMonday(ref);
  const todayStr = toLocalDateString(today);
  const result = [];

  for (let i = 0; i < 7; i++) {
    const cursor = new Date(monday);
    cursor.setDate(monday.getDate() + i);
    const dateStr = toLocalDateString(cursor);
    result.push({
      date: dateStr,
      dayOfWeek: weekdayFormatter.format(cursor),
      isFuture: dateStr > todayStr,
    });
  }

  return result;
}
```

Key detail: `isFuture` still compares against real `today`, not the reference date. When `weekOffset = -1`, all 7 days are in the past so all `isFuture` will be `false`.

**Step 2: Verify no other callers break**

`getWeekDates()` is also called in `useWeekStartDate()` at line 96-101. Since `weekOffset` defaults to `0`, existing callers are unaffected. No changes needed.

**Step 3: Commit**

```bash
git add apps/tauri/src/hooks/useWeeklyWorklogs.ts
git commit -m "feat: add weekOffset parameter to getWeekDates"
```

---

### Task 2: Add `weekOffset` parameter to `useWeeklyWorklogs()`

**Files:**
- Modify: `apps/tauri/src/hooks/useWeeklyWorklogs.ts:58-94`

**Step 1: Update hook signature and pass offset through**

```ts
export function useWeeklyWorklogs(weekOffset: 0 | -1 = 0): {
  weekData: WeekDay[];
  isLoading: boolean;
} {
  const { settings } = useSettings();
  const { jiraToken: accountId } = settings;
  const today = useToday();
  const weekDates = useMemo(() => getWeekDates(new Date(), weekOffset), [today, weekOffset]);

  // ... rest unchanged
}
```

Only change: `getWeekDates()` → `getWeekDates(new Date(), weekOffset)` and add `weekOffset` to the `useMemo` dependency array.

**Step 2: Verify build**

Run: `cd apps/tauri && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/tauri/src/hooks/useWeeklyWorklogs.ts
git commit -m "feat: add weekOffset parameter to useWeeklyWorklogs hook"
```

---

### Task 3: Create `WeekSelector` component

**Files:**
- Create: `apps/tauri/src/components/WeekSelector.tsx`

**Step 1: Create the component**

Reference `WorklogTabs` at `apps/tauri/src/components/WorklogTabs.tsx` for exact styling. The component is a toggle with 2 buttons: "Last week" (left) and "This week" (right).

```tsx
interface WeekSelectorProps {
  weekOffset: 0 | -1;
  onOffsetChange: (offset: 0 | -1) => void;
}

export function WeekSelector({ weekOffset, onOffsetChange }: WeekSelectorProps) {
  const options: Array<{ label: string; value: 0 | -1 }> = [
    { label: 'Last week', value: -1 },
    { label: 'This week', value: 0 },
  ];

  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onOffsetChange(opt.value)}
          className={`flex-1 text-xs font-medium py-1 rounded-md transition-colors ${
            weekOffset === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

This is identical styling to `WorklogTabs` — same classes, same pattern.

**Step 2: Verify build**

Run: `cd apps/tauri && npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/tauri/src/components/WeekSelector.tsx
git commit -m "feat: create WeekSelector toggle component"
```

---

### Task 4: Wire everything in `MainView`

**Files:**
- Modify: `apps/tauri/src/views/MainView.tsx`

**Step 1: Add import for `WeekSelector`**

Add to the imports at the top of the file (after line 7):

```ts
import { WeekSelector } from '../components/WeekSelector';
```

**Step 2: Add `summaryWeekOffset` state**

Add after `activeTab` state (after line 34):

```ts
const [summaryWeekOffset, setSummaryWeekOffset] = useState<0 | -1>(0);
```

**Step 3: Pass offset to `useWeeklyWorklogs`**

Change line 49 from:

```ts
const { weekData } = useWeeklyWorklogs();
```

to:

```ts
const { weekData } = useWeeklyWorklogs(summaryWeekOffset);
```

**Step 4: Replace the summary-tab date strip area**

Change the block at lines 113-121 from:

```tsx
{activeTab === 'list' ? (
  <DateStrip
    weekData={weekData}
    selectedDate={selectedDate}
    onSelectDate={setSelectedDate}
  />
) : (
  <p className="text-xs text-center text-gray-400">{weekRange}</p>
)}
```

to:

```tsx
{activeTab === 'list' ? (
  <DateStrip
    weekData={weekData}
    selectedDate={selectedDate}
    onSelectDate={setSelectedDate}
  />
) : (
  <>
    <WeekSelector weekOffset={summaryWeekOffset} onOffsetChange={setSummaryWeekOffset} />
    <p className="text-xs text-center text-gray-400">{weekRange}</p>
  </>
)}
```

**Step 5: Verify build**

Run: `cd apps/tauri && npx tsc --noEmit`
Expected: No type errors

**Step 6: Commit**

```bash
git add apps/tauri/src/views/MainView.tsx
git commit -m "feat: integrate week selector in summary tab"
```

---

### Task 5: Manual verification

**Step 1: Run the dev server**

Run: `cd apps/tauri && pnpm tauri dev`

**Step 2: Verify Summary tab**

1. Open the app → go to Summary tab
2. Confirm "This week" is selected by default (right button active)
3. Confirm week range shows current week dates (e.g., "Mar 2 – Mar 8")
4. Confirm chart shows current week data

**Step 3: Verify Last week toggle**

1. Click "Last week" button (left)
2. Confirm week range updates to previous week dates (e.g., "Feb 24 – Mar 2")
3. Confirm chart shows previous week data (bars should all be non-future)
4. Click "This week" to switch back — verify it returns to current week

**Step 4: Verify List tab unaffected**

1. Switch to List tab
2. Confirm DateStrip still shows current week only
3. Confirm no week selector toggle appears
4. Switch back to Summary — verify week selection persists

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
