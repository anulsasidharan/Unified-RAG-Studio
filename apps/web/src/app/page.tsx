import { Hero } from '@/components/landing/Hero';
import { ModeComparison } from '@/components/landing/ModeComparison';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Features } from '@/components/landing/Features';
import { UseCases } from '@/components/landing/UseCases';
import { Pricing } from '@/components/landing/Pricing';
import { CTA } from '@/components/landing/CTA';

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <ModeComparison />
      <HowItWorks />
      <Features />
      <UseCases />
      <Pricing />
      <CTA />

      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="font-bold text-neutral-900">RAG Studio</p>
            <p className="text-sm text-neutral-500">
              The complete RAG development platform. Build smarter, deploy faster.
            </p>
            <p className="text-xs text-neutral-400">© 2026 RAG Studio</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
