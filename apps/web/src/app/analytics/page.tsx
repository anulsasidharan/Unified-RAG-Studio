'use client';

import Link from 'next/link';
import { BarChart3, RefreshCw, FolderOpen, FileCode2, Bot, FileUp, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ROUTES } from '@/lib/constants';
import { ApiError, apiClient, formatApiErrorForUi } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';

type CountBreakdown = { counts: Record<string, number> };

type AnalyticsSummaryResponse = {
  projects: number;
  pipeline_configs: number;
  autopilot_builds?: CountBreakdown;
  evaluation_runs?: CountBreakdown;
  deployments?: CountBreakdown;
  documents_uploaded_recent_builds_hint: number;
  cost_signals?: {
    avg_cost_per_query_usd: number | null;
    builds_with_cost_sample: number;
    avg_budget_constraint_usd_per_1k_queries: number | null;
    builds_with_budget_sample: number;
  };
};

function normalizeAnalyticsSummary(raw: AnalyticsSummaryResponse): AnalyticsSummaryResponse {
  return {
    ...raw,
    autopilot_builds: raw.autopilot_builds ?? { counts: {} },
    evaluation_runs: raw.evaluation_runs ?? { counts: {} },
    deployments: raw.deployments ?? { counts: {} },
    cost_signals: raw.cost_signals ?? {
      avg_cost_per_query_usd: null,
      builds_with_cost_sample: 0,
      avg_budget_constraint_usd_per_1k_queries: null,
      builds_with_budget_sample: 0,
    },
  };
}

function formatCounts(row: Record<string, number>): string {
  const parts = Object.entries(row)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}: ${n}`);
  return parts.length ? parts.join(' · ') : '—';
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'primary',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'primary' | 'purple' | 'success' | 'warning';
}) {
  const colors = {
    primary: 'bg-primary-100 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400',
    purple:  'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
    success: 'bg-success-100 text-success-600 dark:bg-success-950/40 dark:text-success-400',
    warning: 'bg-warning-100 text-warning-600 dark:bg-warning-950/40 dark:text-warning-400',
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 font-display text-3xl font-bold tabular-nums text-neutral-900 dark:text-neutral-50">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-neutral-600 dark:text-neutral-400">{label}</p>
      {sub ? <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">{sub}</p> : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const costSignals = data?.cost_signals;

  const load = useCallback(async () => {
    if (!useAuthStore.getState().accessToken?.trim()) {
      setLoading(false);
      setError('Sign in to load analytics. If you were signed in, your session may have expired — log in again.');
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<AnalyticsSummaryResponse>('/api/analytics/summary');
      setData(normalizeAnalyticsSummary(res));
    } catch (e) {
      if (e instanceof ApiError) setError(formatApiErrorForUi(e));
      else setError(String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, accessToken]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-950/40">
              <BarChart3 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Usage &amp; Analytics
            </h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">
            Portfolio snapshot scoped to your API session. Cost averages are inferred from Autopilot results — not cloud billing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 hover:shadow disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error ? (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {/* Loading skeleton */}
      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" />
          ))}
        </div>
      ) : null}

      {/* Data */}
      {!loading && !error && data ? (
        <div className="space-y-6">
          {/* Hero stat row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={FolderOpen}
              label="Projects"
              value={data.projects}
              color="primary"
            />
            <StatCard
              icon={FileCode2}
              label="Pipeline configs"
              value={data.pipeline_configs}
              color="purple"
            />
            <StatCard
              icon={Bot}
              label="Autopilot builds"
              value={Object.values(data.autopilot_builds?.counts ?? {}).reduce((a, b) => a + b, 0)}
              sub={formatCounts(data.autopilot_builds?.counts ?? {})}
              color="success"
            />
            <StatCard
              icon={FileUp}
              label="Documents uploaded"
              value={data.documents_uploaded_recent_builds_hint}
              sub="Recent builds hint"
              color="warning"
            />
          </div>

          {/* Detail cards row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Evaluation runs
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {formatCounts(data.evaluation_runs?.counts ?? {})}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Deployments
              </h2>
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {formatCounts(data.deployments?.counts ?? {})}
              </p>
            </div>
          </div>

          {/* Cost signals */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-neutral-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Cost signals
              </h2>
            </div>
            <dl className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">Avg cost / query</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                  {costSignals?.avg_cost_per_query_usd != null
                    ? `$${costSignals.avg_cost_per_query_usd.toFixed(4)}`
                    : '—'}
                </dd>
                <div className="mt-1 text-xs text-neutral-400">
                  sample n={costSignals?.builds_with_cost_sample ?? 0}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
                <dt className="text-xs text-neutral-500 dark:text-neutral-400">Avg budget constraint / 1k queries</dt>
                <dd className="mt-1 font-mono text-2xl font-bold text-neutral-900 dark:text-neutral-50">
                  {costSignals?.avg_budget_constraint_usd_per_1k_queries != null
                    ? `$${costSignals.avg_budget_constraint_usd_per_1k_queries.toFixed(4)}`
                    : '—'}
                </dd>
                <div className="mt-1 text-xs text-neutral-400">
                  sample n={costSignals?.builds_with_budget_sample ?? 0}
                </div>
              </div>
            </dl>
          </div>

          {/* Observability notice */}
          <div className="rounded-xl border border-dashed border-neutral-200 p-5 text-sm dark:border-neutral-700">
            <p className="font-medium text-neutral-700 dark:text-neutral-300">Operational metrics</p>
            <p className="mt-1.5 text-neutral-500 dark:text-neutral-400">
              Prometheus scraping available at{' '}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">/metrics</code>{' '}
              · JSON snapshot at{' '}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs dark:bg-neutral-800">/monitoring/rag</code>
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
