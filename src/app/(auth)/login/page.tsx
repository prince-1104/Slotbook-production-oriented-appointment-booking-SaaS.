import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/auth/login-form';
import { getHostSessionFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getHostSessionFromCookies();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-xs">
        <div className="mb-6 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Host sign in</h1>
          <p className="text-sm text-slate-600">
            Access your Slotbook scheduling dashboard and event configuration.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
