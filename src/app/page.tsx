const FOUNDATION_PILLARS = [
  {
    title: 'Modular Monolith',
    description:
      'Clean boundaries separating presentation, API route handlers, domain services, and infrastructure adapters.',
  },
  {
    title: 'Strict Engineering Baseline',
    description:
      'TypeScript strict mode, lazy server-only Zod environment validation, structured Pino logging, and Next.js 16 Proxy.',
  },
  {
    title: 'Upcoming Phases',
    description:
      'PostgreSQL schema & GiST exclusion constraints, Temporal DST availability engine, transactional booking, and Resend outbox worker.',
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="max-w-2xl space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Appointment Booking Platform
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Reliable scheduling backed by transactional correctness.
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          Slotbook is initialized on Next.js 16 App Router, React 19, strict TypeScript, and
          Tailwind CSS. Database schemas, host authentication, availability generation, and guest
          booking flows will be added incrementally in upcoming implementation phases.
        </p>
      </section>

      <section aria-label="Platform foundation status" className="grid gap-6 sm:grid-cols-3">
        {FOUNDATION_PILLARS.map((pillar) => (
          <article
            key={pillar.title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs"
          >
            <h2 className="text-sm font-semibold text-slate-900">{pillar.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{pillar.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
