import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-neutral-50 via-white to-primary-50">
      {/* Navbar */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold gradient-text">RAG Studio</span>
          <div className="flex items-center gap-4">
            <Link
              href="/designer"
              className="text-sm font-medium text-neutral-600 hover:text-primary-600 transition-colors"
            >
              Designer
            </Link>
            <Link
              href="/autopilot"
              className="text-sm font-medium text-neutral-600 hover:text-primary-600 transition-colors"
            >
              Autopilot
            </Link>
            <Link
              href="/templates"
              className="text-sm font-medium text-neutral-600 hover:text-primary-600 transition-colors"
            >
              Templates
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-primary-50 border border-primary-200 text-primary-700 text-sm font-medium px-4 py-1.5 rounded-full mb-8">
          <span className="h-2 w-2 rounded-full bg-primary-500 animate-pulse" />
          Now in Beta — Design or Automate your RAG pipeline
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-neutral-900 leading-tight mb-6">
          Build RAG Systems{' '}
          <span className="gradient-text">Your Way</span>
        </h1>

        <p className="text-xl text-neutral-600 max-w-3xl mx-auto mb-10">
          Design step-by-step with our visual pipeline builder, or let our AI agents
          build and optimize automatically. Both modes produce production-ready RAG systems.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/designer"
            className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-8 py-3.5 text-base font-semibold text-white hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
          >
            🎨 Start Designing
          </Link>
          <Link
            href="/autopilot"
            className="inline-flex items-center justify-center rounded-lg border-2 border-neutral-200 bg-white px-8 py-3.5 text-base font-semibold text-neutral-900 hover:border-primary-300 hover:bg-primary-50 transition-colors"
          >
            🤖 Launch Autopilot
          </Link>
        </div>
      </section>

      {/* Mode Comparison */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold text-center text-neutral-900 mb-12">
          Two Modes, One Platform
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Designer Mode Card */}
          <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-white p-8">
            <div className="text-4xl mb-4">🎨</div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-3">Designer Mode</h3>
            <p className="text-neutral-600 mb-6">
              Visual step-by-step pipeline builder. Configure every stage manually
              with intelligent recommendations and real-time cost estimates.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-neutral-700">
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
              className="inline-flex items-center justify-center w-full rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              Open Designer →
            </Link>
          </div>

          {/* Autopilot Mode Card */}
          <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-8">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-2xl font-bold text-neutral-900 mb-3">Autopilot Mode</h3>
            <p className="text-neutral-600 mb-6">
              Upload documents, set your requirements, and let AI agents build and
              optimize the entire RAG pipeline automatically.
            </p>
            <ul className="space-y-2 mb-8 text-sm text-neutral-700">
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
              className="inline-flex items-center justify-center w-full rounded-lg border-2 border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:border-primary-300 hover:bg-primary-50 transition-colors"
            >
              Launch Autopilot →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white mt-24 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-neutral-500">
          <p className="font-bold text-neutral-900 mb-2">RAG Studio</p>
          <p>The complete RAG development platform. Build smarter, deploy faster.</p>
        </div>
      </footer>
    </main>
  );
}
