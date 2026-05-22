import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CTA() {
  return (
    <section className="from-primary-700 relative overflow-hidden bg-gradient-to-br via-indigo-700 to-purple-700 py-24">
      {/* Grid overlay */}
      <div className="bg-line-grid pointer-events-none absolute inset-0 opacity-20" />

      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-white/8 absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-purple-400/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="font-display mb-4 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
          Ready to Build Your First RAG Pipeline?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-white/70">
          Start with Designer Mode to learn RAG hands-on, or let Autopilot build and optimize a
          production-ready system in minutes.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="text-primary-700 group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold shadow-lg shadow-black/20 transition-all hover:bg-neutral-50 hover:shadow-xl active:scale-[0.98]"
          >
            Sign up free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl border-2 border-white/25 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/15 active:scale-[0.98]"
          >
            Log in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-8 text-sm text-white/40">
          Free forever plan available · No credit card required
        </p>
      </div>
    </section>
  );
}
