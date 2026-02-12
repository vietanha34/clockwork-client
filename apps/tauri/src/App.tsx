import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { useActiveTimers } from './hooks/useActiveTimers';
import { useTrayTimer } from './hooks/useTrayTimer';
import { useWorklogs } from './hooks/useWorklogs';
import { totalWorklogSeconds } from './lib/api-client';
import { SettingsProvider, useSettings } from './lib/settings-context';
import { MainView } from './views/MainView';
import { SettingsView } from './views/SettingsView';

type View = 'main' | 'settings';

function AppContent() {
  const [view, setView] = useState<View>('main');
  const { settings, isLoaded } = useSettings();
  const { data } = useActiveTimers();
  const { data: worklogs } = useWorklogs();
  const activeTimer = data?.timers[0];

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
    ? new Date(
        (new Date()).getTime() - activeTimer.tillNow * 1000,
      ).toISOString()
    : undefined;

  // Always compute from worklog items so progress still works even when API `total` is stale/missing.
  const loggedSeconds = totalWorklogSeconds(worklogs?.worklogs ?? []);
  const totalSeconds = loggedSeconds + currentSessionDuration;
  const dailyProgress = totalSeconds / (8 * 3600);

  useTrayTimer(effectiveStartedAt, activeTimer?.issue.key, dailyProgress);

  // On first load, if no email is configured, redirect to settings
  useEffect(() => {
    if (isLoaded && !settings.jiraToken) {
      setView('settings');
    }
  }, [isLoaded, settings.jiraToken]);

  return (
    <AppShell
      onSettingsClick={() => setView('settings')}
      showBackButton={view === 'settings'}
      onBackClick={() => setView('main')}
    >
      {view === 'main' && <MainView />}
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
