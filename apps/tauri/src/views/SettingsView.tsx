import { useState } from 'react';
import { useSettings } from '../lib/settings-context';

interface SettingsViewProps {
  onClose: () => void;
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const { settings, updateSettings } = useSettings();
  // @ts-ignore
  const isTauri = typeof window !== 'undefined' && (!!window.__TAURI_INTERNALS__ || !!window.__TAURI__);
  const [jiraToken, setJiraToken] = useState(settings.jiraToken);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateSettings({ jiraToken });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (jiraToken) {
        setTimeout(onClose, 500);
      }
    } catch (error) {
      console.error('Save Settings Error:', error);
      if (error instanceof Error) {
        setError(`${error.message} (${JSON.stringify(error)})`);
      } else {
        setError(`Failed to save settings: ${JSON.stringify(error)}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
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
