'use client';

import { Loader2, RefreshCw, Clock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useState } from 'react';

import { ApiError, apiClient, formatApiErrorForUi } from '@/lib/api-client';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

type ProjectRow = { id: string; name: string };
type PaginatedProjects = { items: ProjectRow[] };

type BuildListItem = {
  buildId: string;
  projectId: string;
  projectName: string;
  status: string;
  progress: number;
  currentStage: string;
  iteration: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  error?: string | null;
};

type BuildListResponse = {
  items: BuildListItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

function statusConfig(status: string): { cls: string; pulse: boolean; dot: string } {
  switch (status) {
    case 'complete':
      return {
        cls: 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300',
        pulse: false,
        dot: 'bg-emerald-500',
      };
    case 'running':
      return {
        cls: 'border border-primary-200 bg-primary-50 text-primary-800 dark:border-primary-800/50 dark:bg-primary-950/40 dark:text-primary-300',
        pulse: true,
        dot: 'bg-primary-500',
      };
    case 'pending':
      return {
        cls: 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300',
        pulse: true,
        dot: 'bg-amber-500',
      };
    case 'failed':
      return {
        cls: 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300',
        pulse: false,
        dot: 'bg-red-500',
      };
    case 'cancelled':
      return {
        cls: 'border border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
        pulse: false,
        dot: 'bg-neutral-400',
      };
    default:
      return {
        cls: 'border border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400',
        pulse: false,
        dot: 'bg-neutral-400',
      };
  }
}

export default function AutopilotHistoryPage() {
  const filterId = useId();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [data, setData] = useState<BuildListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadProjects = useCallback(async () => {
    try {
      const res = await apiClient.get<PaginatedProjects>('/api/projects?page=1&page_size=100');
      setProjects(res.items);
    } catch {
      setProjects([]);
    }
  }, []);

  const loadBuilds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        page_size: '15',
      });
      if (projectFilter !== 'all') {
        qs.set('project_id', projectFilter);
      }
      const res = await apiClient.get<BuildListResponse>(`/api/autopilot/builds?${qs.toString()}`);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof ApiError ? formatApiErrorForUi(e) : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, projectFilter]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadBuilds();
  }, [loadBuilds]);

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 dark:bg-neutral-800">
            <Clock className="h-5 w-5 text-neutral-600 dark:text-neutral-400" aria-hidden />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
              Build history
            </h1>
            <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
              Runs persisted server-side for your account
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadBuilds()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 hover:shadow disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:bg-neutral-900"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          Refresh
        </button>
      </div>

      {/* Project filter */}
      <div className="mb-6">
        <label
          htmlFor={filterId}
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
        >
          Filter by project
        </label>
        <select
          id={filterId}
          className="w-full min-w-[200px] max-w-sm rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900"
          value={projectFilter}
          onChange={(e) => {
            setPage(1);
            setProjectFilter(e.target.value);
          }}
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-20 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-sm">Loading builds…</span>
          </div>
        ) : !data?.items.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
              <Clock className="h-7 w-7 text-neutral-400 dark:text-neutral-500" aria-hidden />
            </div>
            <p className="mt-4 font-display font-semibold text-neutral-900 dark:text-neutral-100">No builds yet</p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Run the wizard to create your first Autopilot build
            </p>
            <Link
              href={ROUTES.autopilotNew}
              className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-indigo-700"
            >
              Start your first build
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Build ID</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Project</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Stage</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                    Updated
                  </th>
                  <th className="w-[100px] px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {data.items.map((row) => {
                  const sc = statusConfig(row.status);
                  return (
                    <tr key={row.buildId} className="bg-white transition-colors hover:bg-neutral-50/50 dark:bg-neutral-950 dark:hover:bg-neutral-900/40">
                      <td className="px-4 py-3.5 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                        {row.buildId.slice(0, 8)}…
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-sm font-medium text-neutral-800 dark:text-neutral-200" title={row.projectName}>
                        {row.projectName}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize', sc.cls)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot, sc.pulse && 'animate-pulse')} aria-hidden />
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-neutral-500 dark:text-neutral-400">{row.currentStage}</td>
                      <td className="px-4 py-3.5 text-right text-xs text-neutral-400 dark:text-neutral-500">
                        {new Date(row.updatedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={`${ROUTES.autopilotNew}?build=${encodeURIComponent(row.buildId)}&project=${encodeURIComponent(row.projectId)}`}
                          className="inline-flex items-center rounded-lg border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 transition-all hover:border-primary-300 hover:bg-primary-100 dark:border-primary-800/50 dark:bg-primary-950/30 dark:text-primary-400"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {data && data.pages > 1 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            Page <span className="font-semibold text-neutral-700 dark:text-neutral-300">{data.page}</span> of{' '}
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">{data.pages}</span>
            <span className="ml-1 text-neutral-400">({data.total} total)</span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= data.pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <Link
        href={ROUTES.autopilot}
        className="mt-8 inline-block text-sm font-medium text-neutral-500 transition-colors hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
      >
        ← Autopilot overview
      </Link>
    </>
  );
}
