import { invoke } from '@tauri-apps/api/core';
import type { ReactNode } from 'react';

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
                className="text-gray-500 hover:text-gray-900 p-1 rounded"
                aria-label="Settings"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 10.5A2.5 2.5 0 1 1 8 5.5a2.5 2.5 0 0 1 0 5zm0-1a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
                  <path d="M7.14.84a1 1 0 0 1 1.72 0l.51.88c.1.17.28.28.48.3l1.01.1a1 1 0 0 1 .86 1.49l-.5.88c-.1.17-.1.38 0 .55l.5.88a1 1 0 0 1-.86 1.49l-1.01.1a.55.55 0 0 0-.48.3l-.51.88a1 1 0 0 1-1.72 0l-.51-.88a.55.55 0 0 0-.48-.3l-1.01-.1a1 1 0 0 1-.86-1.49l.5-.88c.1-.17.1-.38 0-.55l-.5-.88a1 1 0 0 1 .86-1.49l1.01-.1c.2-.02.38-.13.48-.3l.51-.88z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void invoke('exit_app')}
                className="text-gray-400 hover:text-red-500 p-1 rounded"
                aria-label="Quit app"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M10 3.75a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5ZM8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z"
                    clipRule="evenodd"
                  />
                </svg>
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
