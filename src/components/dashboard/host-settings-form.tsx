'use client';

import { useMemo, useState, type FormEvent } from 'react';

import { ApiClientError, apiClient, type HostProfileDto } from '@/lib/api-client';

interface HostSettingsFormProps {
  initialHost: HostProfileDto;
}

export function HostSettingsForm({ initialHost }: HostSettingsFormProps) {
  const [name, setName] = useState(initialHost.name);
  const [timezone, setTimezone] = useState(initialHost.timezone);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const timezones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return [
        'UTC',
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Kolkata',
      ];
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSavedMessage(null);
    setIsSaving(true);

    try {
      const result = await apiClient.host.updateSettings({ name, timezone });
      setName(result.host.name);
      setTimezone(result.host.timezone);
      setSavedMessage(`Settings saved (${result.host.timezone}).`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to save settings.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-lg space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
    >
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {savedMessage ? (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {savedMessage}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="host-name" className="block text-sm font-medium text-slate-700">
          Display name
        </label>
        <input
          id="host-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="host-timezone" className="block text-sm font-medium text-slate-700">
          IANA timezone
        </label>
        <select
          id="host-timezone"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 shadow-xs outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Weekly availability and date overrides evaluate in this IANA timezone.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>Public slug: /{initialHost.slug}</span>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
