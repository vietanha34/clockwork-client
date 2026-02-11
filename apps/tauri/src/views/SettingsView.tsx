import { useState } from 'react';
import { resolveUserAccountId } from '../lib/api-client';
import { useSettings } from '../lib/settings-context';

interface SettingsViewProps {
  onClose: () => void;
}

export function SettingsView({ onClose }: SettingsViewProps) {
  const { settings, updateSettings } = useSettings();
  const [userEmail, setUserEmail] = useState(settings.userEmail);
  const [apiBaseUrl, setApiBaseUrl] = useState(settings.apiBaseUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountIdWarning, setAccountIdWarning] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setAccountIdWarning(null);
    try {
      let userAccountId = settings.userAccountId;
      if (userEmail && apiBaseUrl) {
        try {
          const resolved = await resolveUserAccountId(apiBaseUrl, userEmail);
          userAccountId = resolved.accountId;
        } catch {
          setAccountIdWarning(
            'Could not resolve Jira accountId. Timers may not load until resolved.',
          );
        }
      }
      await updateSettings({ userEmail, apiBaseUrl, userAccountId });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (userEmail && apiBaseUrl) {
        setTimeout(onClose, 500);
      }
    } catch {
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Settings</h2>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label htmlFor="jira-email" className="block text-xs font-medium text-gray-700 mb-1">
            Jira Email
          </label>
          <input
            id="jira-email"
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="you@yourorg.atlassian.net"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="api-base-url" className="block text-xs font-medium text-gray-700 mb-1">
            API Base URL
          </label>
          <input
            id="api-base-url"
            type="url"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://your-api.vercel.app"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="mt-1 text-xs text-gray-500">URL of your deployed Clockwork Menubar API</p>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {accountIdWarning && <p className="text-xs text-yellow-600">{accountIdWarning}</p>}

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
