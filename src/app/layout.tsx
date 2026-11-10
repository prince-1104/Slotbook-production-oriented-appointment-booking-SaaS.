import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/shared/app-shell';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Slotbook — Appointment Scheduling Platform',
    template: '%s | Slotbook',
  },
  description:
    'Production-oriented appointment booking SaaS built on Next.js App Router and PostgreSQL.',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
