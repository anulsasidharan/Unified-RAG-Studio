'use client';

import { Users, UserCheck, UserPlus, TrendingUp } from 'lucide-react';
import type { AnalyticsResponse } from '@/types/user-management';

type Props = {
  data: AnalyticsResponse;
};

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      <p className="mt-0.5 text-sm text-neutral-500">{label}</p>
    </div>
  );
}

function DistributionChart({
  title,
  data,
  colors,
}: {
  title: string;
  data: Record<string, number>;
  colors: Record<string, string>;
}) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h3 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">{title}</h3>
      <div className="space-y-3">
        {Object.entries(data).map(([key, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const colorClass = colors[key] ?? 'bg-neutral-400';
          return (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="capitalize text-neutral-700 dark:text-neutral-300">{key}</span>
                <span className="font-medium text-neutral-500">
                  {count} ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full ${colorClass} transition-all`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminAnalytics({ data }: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Users"
          value={data.total_users.toLocaleString()}
          icon={Users}
          accent="bg-primary-50 text-primary-600"
        />
        <MetricCard
          label="Active Users (30d)"
          value={data.active_users.toLocaleString()}
          icon={UserCheck}
          accent="bg-green-50 text-green-600"
        />
        <MetricCard
          label="New Registrations (30d)"
          value={data.new_registrations_30d.toLocaleString()}
          icon={UserPlus}
          accent="bg-amber-50 text-amber-600"
        />
        <MetricCard
          label="Activation Rate"
          value={
            data.total_users > 0
              ? `${Math.round((data.active_users / data.total_users) * 100)}%`
              : '0%'
          }
          icon={TrendingUp}
          accent="bg-indigo-50 text-indigo-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <DistributionChart
          title="Plan Distribution"
          data={data.plan_distribution}
          colors={{
            free: 'bg-neutral-400',
            pro: 'bg-primary-500',
            enterprise: 'bg-amber-500',
          }}
        />
        <DistributionChart
          title="Role Distribution"
          data={data.role_distribution}
          colors={{
            user: 'bg-primary-400',
            admin: 'bg-rose-400',
          }}
        />
      </div>
    </div>
  );
}
