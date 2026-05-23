'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, apiClient, formatApiErrorForUi } from '@/lib/api-client';
import { ROUTES } from '@/lib/constants';
import { useAutopilotStore } from '@/stores/autopilot-store';

type ProjectRow = {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string;
};

type PaginatedProjects = {
  items: ProjectRow[];
  total: number;
};

export default function AutopilotProjectsPage() {
  const selectedId = useAutopilotStore((s) => s.selectedBackendProjectId);
  const setSelectedId = useAutopilotStore((s) => s.setSelectedBackendProjectId);

  const [items, setItems] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<PaginatedProjects>('/api/projects?page=1&page_size=100');
      setItems(res.items);
      const cur = useAutopilotStore.getState().selectedBackendProjectId;
      if (!cur && res.items[0]) {
        setSelectedId(res.items[0].id);
      }
    } catch (e) {
      setItems([]);
      setError(e instanceof ApiError ? formatApiErrorForUi(e) : String(e));
    } finally {
      setLoading(false);
    }
  }, [setSelectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Projects for Autopilot
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Uploads and builds are associated with a backend project. Choose the active project before
        opening the new-build wizard.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Refresh list
        </button>
        <Link
          href={ROUTES.templates}
          className="inline-flex items-center justify-center rounded-md border border-neutral-200 bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          Templates
        </Link>
        <Link
          href={ROUTES.autopilotNew}
          className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm"
        >
          Continue to new build
        </Link>
      </div>

      {error ? (
        <p className="border-destructive/40 bg-destructive/10 text-destructive mt-4 rounded-md border px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="text-muted-foreground mt-10 flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading projects…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            No backend projects
          </h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Create a project via the Templates flow or the shared Projects API, then return here to
            select it.
          </p>
          <Link
            href={ROUTES.projects}
            className="mt-4 inline-flex rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Open global projects page
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y rounded-lg border border-neutral-200 dark:border-neutral-800">
          {items.map((p) => {
            const active = p.id === selectedId;
            return (
              <li
                key={p.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-neutral-50">{p.name}</p>
                  {p.description ? (
                    <p className="text-muted-foreground mt-1 text-sm">{p.description}</p>
                  ) : null}
                  <p className="text-muted-foreground mt-1 font-mono text-xs">{p.id}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={
                      active
                        ? 'bg-primary-600 dark:bg-primary-500 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm'
                        : 'rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'
                    }
                  >
                    {active ? 'Active for uploads' : 'Set active'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href={ROUTES.autopilot}
        className="text-primary-600 dark:text-primary-400 mt-10 inline-block text-sm font-medium hover:underline"
      >
        ← Autopilot overview
      </Link>
    </>
  );
}
