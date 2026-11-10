import Link from 'next/link';
import type { ReactNode } from 'react';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white"
            >
              S
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-900">Slotbook</span>
          </Link>

          <nav aria-label="Primary navigation" className="flex items-center gap-4">
            <Link
              href="/login"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Host sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6 lg:px-8">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Slotbook — Transactional Appointment Scheduling Platform</p>
          <p>Next.js 16 App Router · Strict TypeScript · PostgreSQL Modular Monolith</p>
        </div>
      </footer>
    </div>
  );
}
