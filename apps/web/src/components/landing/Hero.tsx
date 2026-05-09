import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { HeroProductDemo } from '@/components/landing/HeroProductDemo';

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-neutral-950">
      {/* Animated gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="animate-float-delayed absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-600/20 blur-[100px]" />
        <div className="animate-float-slow absolute bottom-0 left-1/2 h-[350px] w-[350px] -translate-x-1/2 rounded-full bg-indigo-500/15 blur-[80px]" />
      </div>

      {/* Dot grid overlay */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" />

      {/* Content */}
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-36 sm:px-6 sm:pt-44 lg:px-8">
        <div className="flex flex-col items-center text-center">

          {/* Beta badge */}
          <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm font-medium text-white/80 backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
            </span>
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            Now in Beta — Design or Automate your RAG pipeline
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up-delay-1 mb-6 font-display text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
            Build RAG Systems{' '}
            <span className="gradient-text-animated">Your Way</span>
          </h1>

          {/* Sub-headline */}
          <p className="animate-fade-in-up-delay-2 mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-white/60 sm:text-2xl">
            Design step-by-step with our visual pipeline builder, or let AI agents
            build and optimize automatically. Both modes ship{' '}
            <span className="font-semibold text-white/90">production-ready RAG systems.</span>
          </p>

          {/* CTAs */}
          <div className="animate-fade-in-up-delay-3 flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-neutral-900 shadow-lg shadow-white/10 transition-all hover:bg-neutral-100 hover:shadow-xl active:scale-[0.98]"
            >
              Get started free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/12 active:scale-[0.98]"
            >
              Log in
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          {/* Trust bar */}
          <p className="mt-6 text-sm text-white/35">
            No credit card required · Deploy in minutes · Multi-cloud ready
          </p>

          {/* Demo frame */}
          <div className="mt-16 w-full max-w-5xl">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/80 shadow-2xl shadow-black/60 backdrop-blur-sm ring-1 ring-white/5">
              {/* Browser chrome bar */}
              <div className="flex items-center gap-2 border-b border-white/8 bg-neutral-900/60 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-500/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <span className="h-3 w-3 rounded-full bg-green-500/70" />
                <div className="ml-3 flex-1 rounded-md bg-white/6 px-3 py-1 text-center text-xs text-white/30">
                  ragstudio.dev/designer
                </div>
              </div>
              <HeroProductDemo />
            </div>
          </div>

        </div>
      </div>

      {/* Bottom fade into light background */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[hsl(210_20%_99%)] to-transparent" />
    </section>
  );
}
