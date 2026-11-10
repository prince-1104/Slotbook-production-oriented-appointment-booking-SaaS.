import { redirect } from 'next/navigation';

import { HostSettingsForm } from '@/components/dashboard/host-settings-form';
import { getHostSessionFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function HostSettingsPage() {
  const session = await getHostSessionFromCookies();
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-sm text-slate-600">
          Manage your display name and scheduling IANA timezone.
        </p>
      </div>
      <HostSettingsForm initialHost={session.host} />
    </div>
  );
}
