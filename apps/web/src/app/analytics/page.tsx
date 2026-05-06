'use client';

import Link from 'next/link';
import { BarChart3, RefreshCw } from 'lucide-react';
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

export default function AnalyticsPage() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [data, setData] = useState<AnalyticsSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const costSignals = data?.cost_signals;

  const load = useCallback(async () => {
    if (!useAuthStore.getState().accessToken?.trim()) {
      setLoading(false);
      setError(
        'Sign in to load analytics. If you were signed in, your session may have expired — log in again.'
      );
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
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            <BarChart3 className="h-8 w-8 text-primary-600 dark:text-primary-400" aria-hidden />
            Usage & cost analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Portfolio snapshot from your API session (scoped with the same default headers as Designer and
            Autopilot). Cost averages are inferred from persisted Autopilot results and budget fields — not cloud
            billing.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && !error && data ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Projects</h2>
            <p className="mt-2 text-3xl font-bold tabular-nums">{data.projects}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Pipeline configs persisted:{' '}
              <span className="font-semibold text-foreground">{data.pipeline_configs}</span>
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Document uploads (hint)
            </h2>
            <p className="mt-2 text-3xl font-bold tabular-nums">
              {data.documents_uploaded_recent_builds_hint}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sum of object ids referenced on autopilot builds (document count proxy).
            </p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-800 sm:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Autopilot builds
            </h2>
            <p className="mt-2 text-sm">{formatCounts(data.autopilot_builds?.counts ?? {})}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Evaluation runs
            </h2>
            <p className="mt-2 text-sm">{formatCounts(data.evaluation_runs?.counts ?? {})}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Deployments
            </h2>
            <p className="mt-2 text-sm">{formatCounts(data.deployments?.counts ?? {})}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-800 sm:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Cost signals</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Avg cost / query</dt>
                <dd className="font-mono text-base font-semibold">
                  {costSignals?.avg_cost_per_query_usd != null
                    ? `$${costSignals.avg_cost_per_query_usd.toFixed(4)}`
                    : '—'}
                </dd>
                <div className="text-xs text-muted-foreground">
                  sample n={costSignals?.builds_with_cost_sample ?? 0}
                </div>
              </div>
              <div>
                <dt className="text-muted-foreground">Avg budget constraint (/1k queries)</dt>
                <dd className="font-mono text-base font-semibold">
                  {costSignals?.avg_budget_constraint_usd_per_1k_queries != null
                    ? `$${costSignals.avg_budget_constraint_usd_per_1k_queries.toFixed(4)}`
                    : '—'}
                </dd>
                <div className="text-xs text-muted-foreground">
                  sample n={costSignals?.builds_with_budget_sample ?? 0}
                </div>
              </div>
            </dl>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="mt-12 text-center text-sm text-muted-foreground">Loading analytics…</div>
      ) : null}

      <section className="mt-12 rounded-lg border border-dashed border-neutral-300 p-6 text-sm dark:border-neutral-700">
        <p className="font-medium text-foreground">Operational metrics</p>
        <p className="mt-2 text-muted-foreground">
          Prometheus scraping is available from the backend at{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">/metrics</code> JSON
          snapshot at{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            /monitoring/rag
          </code>
          . Compose overlay:{' '}
          <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
            docker/docker-compose.observability.yml
          </code>
        </p>
      </section>

      <Link
        href={ROUTES.home}
        className="mt-8 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        ← Back to home
      </Link>
    </main>
  );
}
