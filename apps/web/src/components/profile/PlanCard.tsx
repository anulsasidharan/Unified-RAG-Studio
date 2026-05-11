'use client';

import { useState } from 'react';
import { Zap, CheckCircle2, ArrowUpRight, Loader2 } from 'lucide-react';
import { apiClient, formatApiErrorForUi } from '@/lib/api-client';
import type { SubscriptionPlan, UsageResponse } from '@/types/user-management';

type Props = {
  currentTier: string;
  plans: SubscriptionPlan[];
  usage: UsageResponse | null;
  onUpgraded: (tier: string) => void;
};

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const color =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>{label}</span>
        <span>{limit < 0 ? 'Unlimited' : `${used} / ${limit}`}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${limit < 0 ? 0 : pct}%` }}
        />
      </div>
    </div>
  );
}

export function PlanCard({ currentTier, plans, usage, onUpgraded }: Props) {
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = plans.find(
    (p) => p.name.toLowerCase() === currentTier.toLowerCase()
  );

  const handleUpgrade = async (plan: SubscriptionPlan) => {
    if (plan.name.toLowerCase() === currentTier.toLowerCase()) return;
    setUpgrading(plan.id);
    setError(null);
    try {
      await apiClient.post('/api/subscriptions/upgrade', {
        plan_id: plan.id,
        billing_cycle: 'monthly',
      });
      onUpgraded(plan.name.toLowerCase());
    } catch (e) {
      setError(e instanceof Error ? formatApiErrorForUi(e as any) : String(e));
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 flex items-center gap-2">
        <Zap className="h-5 w-5 text-primary-500" />
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Current Plan
        </h3>
        <span className="ml-auto rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-700 capitalize">
          {currentTier}
        </span>
      </div>

      {usage ? (
        <div className="mb-5 space-y-3">
          <UsageBar
            label="Documents"
            used={usage.documents_processed}
            limit={usage.limits.max_documents ?? 100}
          />
          <UsageBar
            label="API Calls"
            used={usage.api_calls_used}
            limit={usage.limits.api_calls_limit ?? 1000}
          />
          <UsageBar
            label="Storage (MB)"
            used={usage.storage_used_mb}
            limit={usage.limits.storage_limit_mb ?? 50}
          />
        </div>
      ) : null}

      {plans.length > 0 ? (
        <div>
          <p className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Available plans
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {plans.map((plan) => {
              const isCurrent = plan.name.toLowerCase() === currentTier.toLowerCase();
              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isCurrent
                      ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-950/30'
                      : 'border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                      {plan.name}
                    </p>
                    {isCurrent ? (
                      <CheckCircle2 className="h-4 w-4 text-primary-500" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}/mo`}
                  </p>
                  {!isCurrent ? (
                    <button
                      onClick={() => handleUpgrade(plan)}
                      disabled={upgrading !== null}
                      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:from-primary-700 hover:to-indigo-700 disabled:opacity-50"
                    >
                      {upgrading === plan.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {plan.price_monthly < (currentPlan?.price_monthly ?? 0)
                        ? 'Downgrade'
                        : 'Upgrade'}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}
