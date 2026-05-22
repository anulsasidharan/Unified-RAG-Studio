import Link from 'next/link';
import { ArrowRight, Palette, Zap, Check } from 'lucide-react';

const designerFeatures = [
  'Multi-stage guided visual builder',
  'Real-time cost estimator',
  'Live Mermaid pipeline diagram',
  'Export to Python / YAML / Terraform',
  '6 pre-built template presets',
  'Intelligent stage recommendations',
];

const autopilotFeatures = [
  '6 specialized LangGraph agents',
  'Automatic document corpus analysis',
  'Multi-model benchmarking',
  'RAGAS evaluation framework',
  'Iterative self-optimization loop',
  'One-command cloud deployment',
];

export function ModeComparison() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mb-16 text-center">
        <h2 className="font-display mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
          Two Modes, One Platform
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-neutral-500">
          Choose the approach that fits your workflow — or use both together.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Designer Card */}
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
          {/* Gradient header */}
          <div className="from-primary-600 via-primary-700 relative overflow-hidden bg-gradient-to-br to-indigo-700 p-8 pb-10">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Palette className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-white">Designer Mode</h3>
                <p className="text-sm font-medium text-white/70">Visual pipeline builder</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/80">
              Configure every stage of your RAG pipeline manually with intelligent recommendations,
              real-time cost estimates, and a live pipeline diagram.
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-1 flex-col p-8">
            <ul className="mb-8 flex-1 space-y-3">
              {designerFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-neutral-700">
                  <span className="bg-primary-100 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full">
                    <Check className="text-primary-600 h-3 w-3" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="bg-primary-600 shadow-primary-200 hover:bg-primary-700 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors"
            >
              Open Designer
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Autopilot Card */}
        <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-lg">
          {/* Gradient header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-violet-800 p-8 pb-10">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-white">Autopilot Mode</h3>
                <p className="text-sm font-medium text-white/70">AI-powered builder</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-white/80">
              Upload your documents, set requirements, and let AI agents build, benchmark, and
              optimize the entire RAG pipeline automatically.
            </p>
          </div>

          {/* Feature list */}
          <div className="flex flex-1 flex-col p-8">
            <ul className="mb-8 flex-1 space-y-3">
              {autopilotFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-neutral-700">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100">
                    <Check className="h-3 w-3 text-purple-600" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-purple-200 transition-colors hover:bg-purple-700"
            >
              Launch Autopilot
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
