import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { DashboardNav } from '@/components/dashboard/dashboard-nav';
import { getHostSessionFromCookies } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await getHostSessionFromCookies();
  if (!session) {
    redirect('/login');
  }

  return (
    <div>
      <DashboardNav host={session.host} />
      {children}
    </div>
  );
}
