'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Minus } from 'lucide-react';

type Feature = { label: string; included: boolean | 'partial'; note?: string };

interface Tier {
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  popular: boolean;
  features: Feature[];
}

const tiers: Tier[] = [
  {
    name: 'Free',
    monthlyPrice: '$0',
    annualPrice: '$0',
    period: 'forever',
    description: 'Perfect for learning RAG and building personal projects.',
    cta: 'Get Started Free',
    ctaHref: '/register',
    popular: false,
    features: [
      { label: 'Designer Mode (full access)', included: true },
      { label: 'Autopilot builds', included: 'partial', note: '3 / month' },
      { label: 'Pipeline templates', included: true },
      { label: 'Python / YAML export', included: true },
      { label: 'Terraform / K8s export', included: false },
      { label: 'MLflow experiment tracking', included: false },
      { label: 'Team collaboration', included: false },
      { label: 'Priority support', included: false },
    ],
  },
  {
    name: 'Pro',
    monthlyPrice: '$49',
    annualPrice: '$39',
    period: '/ month',
    description: 'For teams that need unlimited builds and all export formats.',
    cta: 'Start Free Trial',
    ctaHref: '/register',
    popular: true,
    features: [
      { label: 'Designer Mode (full access)', included: true },
      { label: 'Autopilot builds', included: 'partial', note: 'Unlimited' },
      { label: 'Pipeline templates', included: true },
      { label: 'Python / YAML export', included: true },
      { label: 'Terraform / K8s export', included: true },
      { label: 'MLflow experiment tracking', included: true },
      { label: 'Team collaboration', included: 'partial', note: 'Up to 5 members' },
      { label: 'Priority support', included: true },
    ],
  },
  {
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    annualPrice: 'Custom',
    period: '',
    description: 'For large teams with compliance, audit, and SLA requirements.',
    cta: 'Contact Sales',
    ctaHref: 'mailto:hello@ragstudio.dev',
    popular: false,
    features: [
      { label: 'Designer Mode (full access)', included: true },
      { label: 'Autopilot builds', included: 'partial', note: 'Unlimited' },
      { label: 'Pipeline templates', included: true },
      { label: 'Python / YAML export', included: true },
      { label: 'Terraform / K8s export', included: true },
      { label: 'MLflow experiment tracking', included: true },
      { label: 'Team collaboration', included: 'partial', note: 'Unlimited members' },
      { label: 'Priority support', included: true },
    ],
  },
];

function FeatureRow({ feature }: { feature: Feature }) {
  if (!feature.included) {
    return (
      <li className="flex items-center gap-3 text-sm text-neutral-400">
        <Minus className="h-4 w-4 flex-shrink-0" />
        <span>{feature.label}</span>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 text-sm text-neutral-700">
      <Check className="text-success-600 h-4 w-4 flex-shrink-0" />
      <span>
        {feature.label}
        {feature.note && (
          <span className="ml-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
            {feature.note}
          </span>
        )}
      </span>
    </li>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="font-display mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-neutral-500">
            Start free, upgrade when you need more. No hidden fees or per-query charges.
          </p>

          {/* Annual/Monthly toggle */}
          <div className="mt-8 inline-flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
            <button
              type="button"
              onClick={() => setAnnual(false)}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                !annual
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all ${
                annual
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              Annual
              <span className="bg-success-100 text-success-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl p-8 ${
                tier.popular
                  ? 'border-primary-500 shadow-primary-100/40 border-2 bg-white shadow-xl'
                  : 'border border-neutral-200 bg-white shadow-sm'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="from-primary-600 shadow-primary-200/60 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r to-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-md">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="font-display mb-1 text-lg font-bold text-neutral-900">
                  {tier.name}
                </h3>
                <div className="mb-2 flex items-baseline gap-1">
                  <span className="font-display text-4xl font-bold text-neutral-900">
                    {annual ? tier.annualPrice : tier.monthlyPrice}
                  </span>
                  {tier.period && <span className="text-sm text-neutral-500">{tier.period}</span>}
                  {annual && tier.annualPrice !== '$0' && tier.annualPrice !== 'Custom' && (
                    <span className="ml-1 text-xs text-neutral-400">billed annually</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-neutral-500">{tier.description}</p>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((f) => (
                  <FeatureRow key={f.label} feature={f} />
                ))}
              </ul>

              <Link
                href={tier.ctaHref}
                className={`inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                  tier.popular
                    ? 'from-primary-600 shadow-primary-200/60 hover:from-primary-700 bg-gradient-to-r to-indigo-600 text-white shadow-md hover:to-indigo-700'
                    : 'hover:border-primary-300 hover:bg-primary-50 border-2 border-neutral-200 bg-white text-neutral-900'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-neutral-400">
          All plans include a 14-day free trial for Pro features. No credit card required.
        </p>
      </div>
    </section>
  );
}
