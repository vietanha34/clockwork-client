import { invoke } from '@tauri-apps/api/core';
import type { ReactNode } from 'react';
import settingsIcon from '../assets/settings.png';
import shutdownIcon from '../assets/shutdown.png';

interface AppShellProps {
  children: ReactNode;
  onSettingsClick: () => void;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export function AppShell({
  children,
  onSettingsClick,
  showBackButton,
  onBackClick,
}: AppShellProps) {
  return (
    <div className="menubar-popover-frame h-full w-full p-2 pt-2">
      <div className="menubar-popover h-full w-full">
        <div className="menubar-popover-content flex h-full w-full flex-col bg-gray-50/96 text-gray-900">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 shrink-0 bg-white/70">
            <div className="flex items-center gap-2">
              {showBackButton && (
                <button
                  type="button"
                  onClick={onBackClick}
                  className="text-gray-500 hover:text-gray-900 p-1 rounded"
                  aria-label="Back"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 3L5 8l5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              )}
              <span className="font-semibold text-sm text-gray-900">Clockwork</span>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={onSettingsClick}
                className="text-gray-500 hover:text-gray-900 p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Settings"
              >
                <img src={settingsIcon} alt="Settings" className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void invoke('exit_app')}
                className="text-gray-400 hover:text-red-500 p-1 rounded opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Quit app"
              >
                <img src={shutdownIcon} alt="Quit" className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* Scrollable content */}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
