'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

import { apiClient, type HostProfileDto } from '@/lib/api-client';

interface DashboardNavProps {
  host: HostProfileDto;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/settings', label: 'Settings' },
] as const;

export function DashboardNav({ host }: DashboardNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await apiClient.auth.logout();
      router.push('/login');
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <nav aria-label="Dashboard navigation" className="flex items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-4 text-sm">
        <div className="text-slate-600">
          <span className="font-medium text-slate-900">{host.name}</span>{' '}
          <span className="text-xs text-slate-500">({host.timezone})</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {isLoggingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}
