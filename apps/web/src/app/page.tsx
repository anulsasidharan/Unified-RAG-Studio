import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-[calc(100vh-7rem)] bg-gradient-to-br from-neutral-50 via-white to-primary-50 md:min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 sm:py-24 lg:px-8">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-4 py-1.5 text-sm font-medium text-primary-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary-500" />
          Now in Beta — Design or Automate your RAG pipeline
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-tight text-neutral-900 md:text-7xl">
          Build RAG Systems{' '}
          <span className="gradient-text">Your Way</span>
        </h1>

        <p className="mx-auto mb-10 max-w-3xl text-xl text-neutral-600">
          Design step-by-step with our visual pipeline builder, or let our AI agents build and optimize
          automatically. Both modes produce production-ready RAG systems.
        </p>

        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href="/designer"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            Start Designing
          </Link>
          <Link
            href="/autopilot"
            className="inline-flex items-center justify-center rounded-lg border-2 border-neutral-200 bg-white px-8 py-3.5 text-base font-semibold text-neutral-900 transition-colors hover:border-primary-300 hover:bg-primary-50"
          >
            Launch Autopilot
          </Link>
        </div>
      </section>

      {/* Mode Comparison */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="mb-12 text-center text-3xl font-bold text-neutral-900">Two Modes, One Platform</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-8">
            <div className="mb-4 text-4xl">Designer</div>
            <h3 className="mb-3 text-2xl font-bold text-neutral-900">Designer Mode</h3>
            <p className="mb-6 text-neutral-600">
              Visual step-by-step pipeline builder. Configure every stage manually with intelligent
              recommendations and real-time cost estimates.
            </p>
            <ul className="mb-8 space-y-2 text-sm text-neutral-700">
              {[
                '12-stage guided builder',
                'Real-time cost estimator',
                'Visual pipeline diagram (Mermaid)',
                'Export to Python / YAML / Terraform',
                '6 template presets',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary-600">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/designer"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Open Designer →
            </Link>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-8">
            <div className="mb-4 text-4xl">Autopilot</div>
            <h3 className="mb-3 text-2xl font-bold text-neutral-900">Autopilot Mode</h3>
            <p className="mb-6 text-neutral-600">
              Upload documents, set your requirements, and let AI agents build and optimize the entire RAG
              pipeline automatically.
            </p>
            <ul className="mb-8 space-y-2 text-sm text-neutral-700">
              {[
                '6 specialized AI agents',
                'Multi-model benchmarking',
                'RAGAS evaluation framework',
                'Iterative self-optimization',
                'One-command deployment',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-neutral-500">✓</span> {f}
                </li>
              ))}
            </ul>
            <Link
              href="/autopilot"
              className="inline-flex w-full items-center justify-center rounded-lg border-2 border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-primary-300 hover:bg-primary-50"
            >
              Launch Autopilot →
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-24 border-t bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-neutral-500 sm:px-6 lg:px-8">
          <p className="mb-2 font-bold text-neutral-900">RAG Studio</p>
          <p>The complete RAG development platform. Build smarter, deploy faster.</p>
        </div>
      </footer>
    </main>
  );
}
