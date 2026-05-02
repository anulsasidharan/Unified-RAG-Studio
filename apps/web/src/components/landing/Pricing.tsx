import Link from 'next/link';
import { Check, Minus } from 'lucide-react';

type Feature = { label: string; included: boolean | 'partial'; note?: string };

interface Tier {
  name: string;
  price: string;
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
    price: '$0',
    period: 'forever',
    description: 'Perfect for learning RAG and building personal projects.',
    cta: 'Get Started Free',
    ctaHref: '/designer',
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
    price: '$49',
    period: '/ month',
    description: 'For teams that need unlimited builds and all export formats.',
    cta: 'Start Free Trial',
    ctaHref: '/designer',
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
    price: 'Custom',
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
      <Check className="h-4 w-4 flex-shrink-0 text-success-600" />
      <span>
        {feature.label}
        {feature.note && (
          <span className="ml-1 text-xs text-neutral-500">({feature.note})</span>
        )}
      </span>
    </li>
  );
}

export function Pricing() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
          Simple, Transparent Pricing
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-neutral-600">
          Start free, upgrade when you need more. No hidden fees or per-query charges.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-2xl border p-8 shadow-sm ${
              tier.popular
                ? 'border-primary-300 bg-gradient-to-b from-primary-50 to-white shadow-primary-100'
                : 'border-neutral-200 bg-white'
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white shadow-sm">
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <h3 className="mb-1 text-lg font-bold text-neutral-900">{tier.name}</h3>
              <div className="mb-2 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-neutral-900">{tier.price}</span>
                {tier.period && (
                  <span className="text-sm text-neutral-500">{tier.period}</span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-neutral-600">{tier.description}</p>
            </div>

            <ul className="mb-8 flex-1 space-y-3">
              {tier.features.map((f) => (
                <FeatureRow key={f.label} feature={f} />
              ))}
            </ul>

            <Link
              href={tier.ctaHref}
              className={`inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
                tier.popular
                  ? 'bg-primary-600 text-white shadow-md shadow-primary-200 hover:bg-primary-700'
                  : 'border-2 border-neutral-200 bg-white text-neutral-900 hover:border-primary-300 hover:bg-primary-50'
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      <p className="mt-10 text-center text-sm text-neutral-500">
        All plans include a 14-day free trial for Pro features. No credit card required.
      </p>
    </section>
  );
}
