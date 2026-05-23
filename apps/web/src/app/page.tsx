import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { Hero } from '@/components/landing/Hero';
import { ModeComparison } from '@/components/landing/ModeComparison';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Features } from '@/components/landing/Features';
import { UseCases } from '@/components/landing/UseCases';
import { Pricing } from '@/components/landing/Pricing';
import { CTA } from '@/components/landing/CTA';

export default function LandingPage() {
  return (
    <>
      <LandingNavbar />
      <main>
        <Hero />
        <ModeComparison />
        <HowItWorks />
        <Features />
        <UseCases />
        <Pricing />
        <CTA />

        <footer className="border-t border-neutral-200 bg-white py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div>
                <p className="font-display font-bold text-neutral-900">RAG Studio</p>
                <p className="mt-1 text-xs text-neutral-400">
                  The complete RAG development platform.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-6 text-sm text-neutral-500">
                <a href="#features" className="hover:text-neutral-900">
                  Features
                </a>
                <a href="#how-it-works" className="hover:text-neutral-900">
                  How it works
                </a>
                <a href="#pricing" className="hover:text-neutral-900">
                  Pricing
                </a>
                <a href="/login" className="hover:text-neutral-900">
                  Log in
                </a>
                <a href="/register" className="hover:text-neutral-900">
                  Sign up
                </a>
              </div>
              <p className="text-xs text-neutral-400">© 2026 RAG Studio</p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
