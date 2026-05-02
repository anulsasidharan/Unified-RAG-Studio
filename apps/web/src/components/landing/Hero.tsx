import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-purple-50">
      {/* Animated gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary-200/40 blur-3xl" />
        <div className="animate-float-delayed absolute -right-40 top-20 h-80 w-80 rounded-full bg-purple-200/40 blur-3xl" />
        <div className="animate-float absolute bottom-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-100/50 blur-2xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 text-center sm:px-6 sm:pb-32 sm:pt-28 lg:px-8">
        {/* Beta badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-white/80 px-4 py-2 text-sm font-medium text-primary-700 shadow-sm backdrop-blur-sm">
          <span className="flex h-2 w-2 items-center justify-center">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
          </span>
          <Sparkles className="h-3.5 w-3.5" />
          Now in Beta — Design or Automate your RAG pipeline
        </div>

        {/* Headline */}
        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight text-neutral-900 sm:text-6xl md:text-7xl">
          Build RAG Systems{' '}
          <span className="gradient-text">Your Way</span>
        </h1>

        {/* Sub-headline */}
        <p className="mx-auto mb-10 max-w-3xl text-xl leading-relaxed text-neutral-600 sm:text-2xl">
          Design step-by-step with our visual pipeline builder, or let our AI
          agents build and optimize automatically. Both modes produce{' '}
          <span className="font-semibold text-neutral-800">
            production-ready RAG systems.
          </span>
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/designer"
            className="group inline-flex items-center gap-2 rounded-xl bg-primary-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-primary-200/60 transition-all hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-300/50 active:scale-[0.98]"
          >
            Start Designing
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/autopilot"
            className="group inline-flex items-center gap-2 rounded-xl border-2 border-neutral-200 bg-white/80 px-8 py-4 text-base font-semibold text-neutral-900 shadow-md backdrop-blur-sm transition-all hover:border-primary-300 hover:bg-primary-50 hover:shadow-lg active:scale-[0.98]"
          >
            Launch Autopilot
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm text-neutral-500">
          No credit card required · Deploy in minutes · Multi-cloud ready
        </p>
      </div>
    </section>
  );
}
