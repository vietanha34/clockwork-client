import { useState } from 'react';
import { API_BASE_URL } from '../lib/constants';
import { ApiValidationError, validateSettings } from '../lib/api-client';
import { useSettings } from '../lib/settings-context';

interface SettingsViewProps {
  onClose: () => void;
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const { settings, updateSettings } = useSettings();
  // @ts-ignore
  const isTauri = typeof window !== 'undefined' && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
  const [jiraToken, setJiraToken] = useState(settings.jiraToken);
  const [clockworkApiToken, setClockworkApiToken] = useState(settings.clockworkApiToken);
  const [accountIdError, setAccountIdError] = useState<string | null>(null);
  const [clockworkTokenError, setClockworkTokenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
