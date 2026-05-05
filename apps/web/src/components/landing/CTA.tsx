import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-purple-700 py-20">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
          Ready to Build Your First RAG Pipeline?
        </h2>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-primary-100">
          Start with Designer Mode to learn RAG hands-on, or let Autopilot build and
          optimize a production-ready system in minutes.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-semibold text-primary-700 shadow-lg transition-all hover:bg-primary-50 hover:shadow-xl active:scale-[0.98]"
          >
            Sign up
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-xl border-2 border-white/40 bg-white/10 px-8 py-4 text-base font-semibold text-white backdrop-blur-sm transition-all hover:border-white/60 hover:bg-white/20 active:scale-[0.98]"
          >
            Log in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <p className="mt-8 text-sm text-primary-200">
          Free forever plan available · No credit card required
        </p>
      </div>
    </section>
  );
}
