'use client';

import { Loader2 } from 'lucide-react';
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

function statusClass(status: string): string {
  switch (status) {
    case 'complete':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200';
    case 'running':
    case 'pending':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200';
    case 'failed':
      return 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200';
    case 'cancelled':
      return 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200';
    default:
      return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200';
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
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Build history
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Runs persisted for your account. Open a build in the wizard to stream progress or review results.
      </p>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <label
            htmlFor={filterId}
            className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
          >
            Filter by project
          </label>
          <select
            id={filterId}
            className="w-full min-w-[200px] max-w-sm rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
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
        <button
          type="button"
          onClick={() => void loadBuilds()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
        {loading && !data ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Loading builds…
          </div>
        ) : !data?.items.length ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No builds yet.{' '}
            <Link
              href={ROUTES.autopilotNew}
              className="font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              Start your first build
            </Link>
            .
          </p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">Build</th>
                <th className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">Project</th>
                <th className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">Status</th>
                <th className="px-4 py-3 font-semibold text-neutral-900 dark:text-neutral-100">Stage</th>
                <th className="px-4 py-3 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                  Updated
                </th>
                <th className="w-[100px] px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.items.map((row) => (
                <tr key={row.buildId} className="bg-white dark:bg-neutral-950">
                  <td className="px-4 py-3 font-mono text-xs text-neutral-800 dark:text-neutral-200">
                    {row.buildId.slice(0, 8)}…
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-neutral-800 dark:text-neutral-200" title={row.projectName}>
                    {row.projectName}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        statusClass(row.status)
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{row.currentStage}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${ROUTES.autopilotNew}?build=${encodeURIComponent(row.buildId)}&project=${encodeURIComponent(row.projectId)}`}
                      className="font-medium text-primary-600 hover:underline dark:text-primary-400"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.pages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Page {data.page} of {data.pages} ({data.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= data.pages || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:hover:bg-neutral-800"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      <Link
        href={ROUTES.autopilot}
        className="mt-8 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        ← Autopilot overview
      </Link>
    </>
  );
}
