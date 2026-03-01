import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { TimerSkeleton, WorklogSkeleton } from './components/Skeleton';
import { UnifiedWarning } from './components/UnifiedWarning';
import { useActiveTimers } from './hooks/useActiveTimers';
import { useToday } from './hooks/useToday';
import { useTrayTimer } from './hooks/useTrayTimer';
import { useUnloggedDays } from './hooks/useUnloggedDays';
import { useWorklogNotification } from './hooks/useWorklogNotification';
import { useWorklogs } from './hooks/useWorklogs';
import { totalWorklogSeconds } from './lib/api-client';
import { isSquareTrayPlatform } from './lib/platform';
import { SettingsProvider, useSettings } from './lib/settings-context';
import { MainView } from './views/MainView';
import { SettingsView } from './views/SettingsView';

type View = 'main' | 'settings';

function AppContent() {
  const [view, setView] = useState<View>('main');
  const { settings, isLoaded } = useSettings();
  const { data } = useActiveTimers();
  const today = useToday();
  const { data: worklogs, isSuccess: worklogsLoaded } = useWorklogs(today);
  const { unloggedDays } = useUnloggedDays();
  const activeTimer = data?.timers[0];

  useEffect(() => {
    if (isSquareTrayPlatform()) {
      document.documentElement.classList.add('platform-desktop');
    }
  }, []);

  // Count only today's running overlap from 08:00 local time.
  const currentSessionDuration = (() => {
    if (!activeTimer?.startedAt) return 0;

    const startedMs = new Date(activeTimer.startedAt).getTime();
    if (Number.isNaN(startedMs)) return 0;

    const nowMs = Date.now();
    const dayStart = new Date();
    dayStart.setHours(8, 0, 0, 0);

    const effectiveStartMs = Math.max(startedMs, dayStart.getTime());
    if (effectiveStartMs >= nowMs) return 0;

    return Math.floor((nowMs - effectiveStartMs) / 1000);
  })();
  const effectiveStartedAt = activeTimer
    ? new Date(new Date().getTime() - activeTimer.tillNow * 1000).toISOString()
    : undefined;

  // Always compute from worklog items so progress still works even when API `total` is stale/missing.
  const loggedSeconds = totalWorklogSeconds(worklogs?.worklogs ?? []);
  const totalSeconds = loggedSeconds + currentSessionDuration;
  const dailyProgress = totalSeconds / (8 * 3600);
  const hasUnloggedDays = unloggedDays.length > 0;
  const { showBanner, deficit, target, logged } = useWorklogNotification({
    totalLoggedSeconds: totalSeconds,
    isDataReady: worklogsLoaded,
  });

  useTrayTimer(
    effectiveStartedAt,
    activeTimer?.issue.key,
    dailyProgress,
    hasUnloggedDays,
    activeTimer?.withinWorkingHours,
  );

  // On first load, if no email is configured, redirect to settings
  useEffect(() => {
    if (isLoaded && (!settings.jiraToken || !settings.clockworkApiToken)) {
      setView('settings');
    }
  }, [isLoaded, settings.jiraToken, settings.clockworkApiToken]);

  // Show skeleton while settings are loading to avoid flash of main view
  if (!isLoaded) {
    return (
      <AppShell onSettingsClick={() => {}} showBackButton={false} onBackClick={() => {}}>
        <div className="divide-y divide-gray-100">
          <TimerSkeleton />
          <WorklogSkeleton />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      onSettingsClick={() => setView('settings')}
      showBackButton={view === 'settings'}
      onBackClick={() => setView('main')}
      userDisplayName={view === 'main' ? settings.jiraUser?.displayName : undefined}
    >
      <UnifiedWarning
        unloggedDays={unloggedDays}
        showToday={showBanner}
        todayLogged={logged}
        todayTarget={target}
        todayDeficit={deficit}
      />
      {view === 'main' && <MainView todayProgressSeconds={totalSeconds} />}
      {view === 'settings' && <SettingsView onClose={() => setView('main')} />}
    </AppShell>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}
