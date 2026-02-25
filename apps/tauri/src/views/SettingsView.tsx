import { platform } from '@tauri-apps/plugin-os';
import { useState } from 'react';
import { API_BASE_URL } from '../lib/constants';
import { ApiValidationError, validateSettings } from '../lib/api-client';
import { useSettings } from '../lib/settings-context';

interface SettingsViewProps {
  onClose: () => void;
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const { settings, updateSettings } = useSettings();
  const os = platform();
  // @ts-ignore
  const isTauri = typeof window !== 'undefined' && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
  const [jiraToken, setJiraToken] = useState(settings.jiraToken);
  const [clockworkApiToken, setClockworkApiToken] = useState(settings.clockworkApiToken);
  const [accountIdError, setAccountIdError] = useState<string | null>(null);
  const [clockworkTokenError, setClockworkTokenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showPinGuide = os === 'windows' && !settings.pinIconDismissed;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setAccountIdError(null);
    setClockworkTokenError(null);
    setError(null);
    try {
      const accountId = jiraToken.trim();
      const token = clockworkApiToken.trim();
      const validation = await validateSettings(API_BASE_URL, {
        accountId,
        clockworkApiToken: token,
      });

      await updateSettings({
        jiraToken: accountId,
        clockworkApiToken: token,
        jiraUser: validation.user,
        pinIconDismissed: settings.pinIconDismissed,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setTimeout(onClose, 300);
    } catch (error) {
      console.error('Save Settings Error:', error);
      if (error instanceof ApiValidationError) {
        if (error.field === 'accountId') {
          setAccountIdError(error.message);
        } else if (error.field === 'clockworkApiToken') {
          setClockworkTokenError(error.message);
        } else {
          setError(error.message);
        }
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to save settings');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Settings</h2>
      
      {showPinGuide && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4 relative">
          <button
            type="button"
            onClick={() => updateSettings({ ...settings, pinIconDismissed: true })}
            className="absolute top-2 right-2 text-blue-400 hover:text-blue-600 p-1 cursor-pointer"
            aria-label="Dismiss tip"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
          <h4 className="text-xs font-semibold text-blue-800 mb-1">Tip: Keep Icon Visible</h4>
          <p className="text-xs text-blue-700 leading-relaxed">
            Windows hides tray icons by default. To keep Clockwork visible:
            <br />
            1. Right-click Taskbar → <strong>Taskbar settings</strong>
            <br />
            2. Expand <strong>Other system tray icons</strong>
            <br />
            3. Toggle <strong>On</strong> for Clockwork Menubar
          </p>
        </div>
      )}

      {!isTauri && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Bạn đang chạy trên trình duyệt. Tính năng lưu settings chỉ hoạt động trên App Desktop.
                <br />
                Vui lòng mở ứng dụng Clockwork Menubar để sử dụng.
              </p>
            </div>
          </div>
        </div>
      )}
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label htmlFor="jira-token" className="block text-xs font-medium text-gray-700 mb-1">
            Jira Account ID
          </label>
          <input
            id="jira-token"
            type="text"
            value={jiraToken}
            onChange={(e) => setJiraToken(e.target.value)}
            placeholder="Enter your Jira Account ID"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {accountIdError && <p className="mt-1 text-xs text-red-600">{accountIdError}</p>}
        </div>

        <div>
          <label htmlFor="clockwork-api-token" className="block text-xs font-medium text-gray-700 mb-1">
            Clockwork API Token
          </label>
          <input
            id="clockwork-api-token"
            type="password"
            value={clockworkApiToken}
            onChange={(e) => setClockworkApiToken(e.target.value)}
            placeholder="Enter your Clockwork API token"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {clockworkTokenError && <p className="mt-1 text-xs text-red-600">{clockworkTokenError}</p>}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
