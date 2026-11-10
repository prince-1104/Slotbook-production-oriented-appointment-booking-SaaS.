import Link from 'next/link';

import { getHostSessionFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getHostSessionFromCookies();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Host Dashboard</h1>
        <p className="text-sm text-slate-600">
          Signed in as <span className="font-medium text-slate-900">{session?.host.email}</span> ·
          Public handle <code className="text-xs">/{session?.host.slug}</code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">Host Settings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Active timezone: <span className="font-medium">{session?.host.timezone}</span>
          </p>
          <Link
            href="/dashboard/settings"
            className="mt-4 inline-block text-sm font-medium text-slate-900 underline underline-offset-4"
          >
            Update timezone &amp; profile
          </Link>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <h2 className="text-sm font-semibold text-slate-900">Event Types &amp; Bookings</h2>
          <p className="mt-1 text-sm text-slate-600">
            Event type management, weekly schedules, and bookings arrive in Phase 3 &amp; Phase 6.
          </p>
        </div>
      </div>
    </div>
  );
}
