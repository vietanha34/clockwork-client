import { useEffect, useState } from "react";
import { AppShell } from "./components/AppShell";
import { SettingsProvider, useSettings } from "./lib/settings-context";
import { MainView } from "./views/MainView";
import { SettingsView } from "./views/SettingsView";

type View = "main" | "settings";

function AppContent() {
  const [view, setView] = useState<View>("main");
  const { settings, isLoaded } = useSettings();

  // On first load, if no email is configured, redirect to settings
  useEffect(() => {
    if (isLoaded && !settings.userEmail) {
      setView("settings");
    }
  }, [isLoaded, settings.userEmail]);

  return (
    <AppShell
      onSettingsClick={() => setView("settings")}
      showBackButton={view === "settings"}
      onBackClick={() => setView("main")}
    >
      {view === "main" && <MainView />}
      {view === "settings" && (
        <SettingsView onClose={() => setView("main")} />
      )}
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
