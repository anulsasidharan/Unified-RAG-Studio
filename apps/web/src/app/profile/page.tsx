'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { ProfileCard } from '@/components/profile/ProfileCard';
import { PlanCard } from '@/components/profile/PlanCard';
import { SecuritySettings } from '@/components/profile/SecuritySettings';
import { APIKeyManager } from '@/components/profile/APIKeyManager';
import type { UserProfile, SubscriptionPlan, UsageResponse } from '@/types/user-management';

export default function ProfilePage() {
  const router = useRouter();
  const { isAuthenticated, hasInitialized } = useAuthStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasInitialized && !isAuthenticated) {
      router.replace('/login');
    }
  }, [hasInitialized, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void Promise.all([
      apiClient.get<UserProfile>('/api/users/me'),
      apiClient.get<{ plans: SubscriptionPlan[] }>('/api/subscriptions/plans'),
      apiClient.get<UsageResponse>('/api/users/me/usage'),
    ]).then(([prof, plansRes, usageRes]) => {
      setProfile(prof);
      setPlans(plansRes.plans);
      setUsage(usageRes);
    }).catch(() => {
      // errors are handled gracefully — loading stops and profile stays null
    }).finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!hasInitialized || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-neutral-900 dark:text-neutral-100">
          Your Profile
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Manage your account settings, plan, and API access.
        </p>
      </div>

      <div className="space-y-6">
        <ProfileCard
          profile={profile}
          onUpdated={(updated) => setProfile(updated)}
        />

        <PlanCard
          currentTier={profile.subscription_tier}
          plans={plans}
          usage={usage}
          onUpgraded={(tier) => setProfile((p) => p ? { ...p, subscription_tier: tier } : p)}
        />

        <SecuritySettings />

        <APIKeyManager />
      </div>
    </main>
  );
}
