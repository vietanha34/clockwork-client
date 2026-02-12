import { useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { useActiveTimers } from './hooks/useActiveTimers';
import { useTrayTimer } from './hooks/useTrayTimer';
import { useWorklogs } from './hooks/useWorklogs';
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

  // Calculate current elapsed time in seconds to add to daily total
  const currentSessionDuration = activeTimer ? activeTimer.tillNow + Math.floor((Date.now() - new Date(data?.cachedAt ?? new Date().toISOString()).getTime()) / 1000) : 0;

  const effectiveStartedAt = activeTimer
    ? new Date(
        new Date(data?.cachedAt ?? new Date().toISOString()).getTime() - activeTimer.tillNow * 1000,
      ).toISOString()
    : undefined;

  // Add current active timer duration to total worklogs
  const totalSeconds = (worklogs?.total ?? 0) + currentSessionDuration;
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
