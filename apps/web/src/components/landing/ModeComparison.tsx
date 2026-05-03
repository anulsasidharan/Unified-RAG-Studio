import Link from 'next/link';
import { ArrowRight, Palette, Zap } from 'lucide-react';

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
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
          Two Modes, One Platform
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-neutral-600">
          Choose the approach that fits your workflow — or use both together.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Designer Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 via-white to-white p-8 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
              <Palette className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">Designer Mode</h3>
              <p className="text-sm text-primary-600 font-medium">Visual builder</p>
            </div>
          </div>

          <p className="mb-6 text-neutral-600">
            Configure every stage of your RAG pipeline manually with intelligent
            recommendations, real-time cost estimates, and a live pipeline diagram.
          </p>

          <ul className="mb-8 space-y-3">
            {designerFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-neutral-700">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 font-bold text-xs">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <Link
            href="/designer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Open Designer
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-100/50 blur-2xl" />
        </div>

        {/* Autopilot Card */}
        <div className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-8 shadow-sm transition-shadow hover:shadow-md">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Zap className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">Autopilot Mode</h3>
              <p className="text-sm text-purple-600 font-medium">AI-powered builder</p>
            </div>
          </div>

          <p className="mb-6 text-neutral-600">
            Upload your documents, set requirements, and let AI agents build,
            benchmark, and optimize the entire RAG pipeline automatically.
          </p>

          <ul className="mb-8 space-y-3">
            {autopilotFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-neutral-700">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 font-bold text-xs">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <Link
            href="/autopilot"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-purple-300 hover:bg-purple-50"
          >
            Launch Autopilot
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-100/50 blur-2xl" />
        </div>
      </div>
    </section>
  );
}
