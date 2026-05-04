'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Filter, LayoutTemplate, Loader2, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DESIGNER_STAGES, ROUTES } from '@/lib/constants';
import { ApiError, apiClient, formatApiErrorForUi } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import { useProjectStore } from '@/stores/project-store';
import type { Template, TemplateComplexity } from '@/types/models';
import type { DesignerProjectSnapshot } from '@/types/project';
import type { PipelineConfiguration } from '@/types/pipeline';

type TemplatesCatalogResponse = {
  version: string;
  description?: string | null;
  templates: Template[];
};

type ProjectSummaryRow = {
  id: string;
  name: string;
  description?: string | null;
};

type PaginatedProjects = {
  items: ProjectSummaryRow[];
  total: number;
  page: number;
  pageSize: number;
};

type ApplyTemplateResponse = {
  id: string;
  templateId: string;
  name: string;
  projectId: string;
  description?: string | null;
  config: PipelineConfiguration;
  createdAt: string;
  updatedAt: string;
};

const COMPLEXITIES: Array<TemplateComplexity | 'all'> = [
  'all',
  'beginner',
  'intermediate',
  'advanced',
];

function complexityBadgeClass(c: string): string {
  switch (c) {
    case 'beginner':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100';
    case 'intermediate':
      return 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100';
    case 'advanced':
      return 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100';
    default:
      return 'border-neutral-200 bg-muted text-muted-foreground';
  }
}

export function TemplateGallery({ className }: Readonly<{ className?: string }>) {
  const router = useRouter();
  const loadPipeline = useDesignerStore((s) => s.loadPipeline);
  const addProject = useProjectStore((s) => s.addProject);
  const updateProject = useProjectStore((s) => s.updateProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const localProjects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const [catalog, setCatalog] = useState<TemplatesCatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [complexity, setComplexity] = useState<TemplateComplexity | 'all'>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<Template | null>(null);
  const [projectMode, setProjectMode] = useState<'new' | 'existing'>('new');
  const [newProjectName, setNewProjectName] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [apiProjects, setApiProjects] = useState<ProjectSummaryRow[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await apiClient.get<TemplatesCatalogResponse>('/api/templates');
        if (!cancelled) setCatalog(data);
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof ApiError ? formatApiErrorForUi(e) : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dialogOpen || !applyTarget) return;
    let cancelled = false;
    (async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const data = await apiClient.get<PaginatedProjects>('/api/projects?page=1&page_size=50');
        if (!cancelled) {
          setApiProjects(data.items);
          setSelectedProjectId((prev) => {
            if (prev && data.items.some((p) => p.id === prev)) return prev;
            return data.items[0]?.id ?? '';
          });
        }
      } catch (e) {
        if (!cancelled) {
          setProjectsError(e instanceof ApiError ? JSON.stringify(e.data) : String(e));
          setApiProjects([]);
        }
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, applyTarget]);

  const filtered = useMemo(() => {
    const list = catalog?.templates ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((t) => {
      if (complexity !== 'all' && t.complexity !== complexity) return false;
      if (!q) return true;
      const blob = [t.name, t.description, t.useCase, ...(t.tags ?? [])].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [catalog, search, complexity]);

  const openApply = useCallback((t: Template) => {
    setApplyTarget(t);
    setProjectMode('new');
    setNewProjectName(`${t.name} project`);
    setPipelineName(t.name);
    setApplyError(null);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setApplyTarget(null);
      setApplyError(null);
      setApplyLoading(false);
    }
  }, []);

  const handleApply = useCallback(async () => {
    if (!applyTarget) return;
    setApplyError(null);
    setApplyLoading(true);
    try {
      let projectId = selectedProjectId;
      let projectName = apiProjects.find((p) => p.id === projectId)?.name ?? applyTarget.name;

      if (projectMode === 'new') {
        const name = newProjectName.trim() || `${applyTarget.name} project`;
        const created = await apiClient.post<ProjectSummaryRow>('/api/projects', { name });
        projectId = created.id;
        projectName = created.name;
      } else if (!projectId) {
        setApplyError('Select a project or create a new one.');
        setApplyLoading(false);
        return;
      }

      const pname = pipelineName.trim() || applyTarget.name;
      const applied = await apiClient.post<ApplyTemplateResponse>(
        `/api/templates/${encodeURIComponent(applyTarget.id)}/apply`,
        { projectId, name: pname }
      );

      const designerSnapshot: DesignerProjectSnapshot = {
        draft: applied.config,
        diagramMaxVisitedStageIndex: DESIGNER_STAGES.length - 1,
      };

      const existingLocal = localProjects.some((p) => p.id === projectId);
      if (existingLocal) {
        updateProject(projectId, { linkedPipelineId: applied.id, designerSnapshot });
        loadPipeline(applied.config);
        if (activeProjectId !== projectId) setActiveProject(projectId);
      } else {
        addProject({
          id: projectId,
          name: projectName,
          linkedPipelineId: applied.id,
          designerSnapshot,
        });
      }

      closeDialog(false);
      router.push(`${ROUTES.designer}/review`);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? typeof e.data === 'object' && e.data && 'detail' in e.data
            ? String((e.data as { detail: unknown }).detail)
            : e.message
          : String(e);
      setApplyError(msg);
    } finally {
      setApplyLoading(false);
    }
  }, [
    activeProjectId,
    addProject,
    applyTarget,
    apiProjects,
    closeDialog,
    loadPipeline,
    newProjectName,
    pipelineName,
    projectMode,
    router,
    selectedProjectId,
    setActiveProject,
    localProjects,
    updateProject,
  ]);

  return (
    <div className={cn('mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-12', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Designer
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            <LayoutTemplate className="h-8 w-8 text-primary-600 dark:text-primary-400" aria-hidden />
            Template gallery
          </h1>
          <p className="mt-2 max-w-2xl text-neutral-600 dark:text-neutral-400">
            {catalog?.description ??
              'Start from a curated RAG pipeline preset, then refine every stage in Designer mode.'}
          </p>
        </div>
        <Link
          href={ROUTES.designer}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-accent dark:border-neutral-700"
        >
          Blank pipeline
        </Link>
      </div>

      <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <label htmlFor="template-search" className="sr-only">
            Search templates
          </label>
          <input
            id="template-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, use case, or tag…"
            className="w-full rounded-lg border border-neutral-200 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-neutral-700"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Filter className="h-3.5 w-3.5" aria-hidden />
            Complexity
          </span>
          {COMPLEXITIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setComplexity(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                complexity === c
                  ? 'border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-600'
                  : 'border-neutral-200 bg-card text-muted-foreground hover:border-primary-400 dark:border-neutral-700'
              )}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-label="Loading" />
        </div>
      ) : loadError ? (
        <div
          className="mt-10 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">Could not load templates</p>
          <p className="mt-1 break-words opacity-90">{loadError}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ensure the API is running (e.g. <code className="rounded bg-muted px-1">npm run dev:full</code> from the
            repo root).
          </p>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => (
            <li key={t.id}>
              <article
                className={cn(
                  'flex h-full flex-col rounded-xl border border-neutral-200 bg-card p-5 shadow-sm transition hover:border-primary-400/60 hover:shadow-md dark:border-neutral-700'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-foreground">{t.name}</h2>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      complexityBadgeClass(t.complexity)
                    )}
                  >
                    {t.complexity}
                  </span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{t.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Use case:</span> {t.useCase}
                </p>
                <p className="mt-1 text-xs font-medium text-foreground">{t.estimatedMonthlyCost}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(t.tags ?? []).slice(0, 6).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {(t.providerLogos ?? []).map((p) => (
                    <span
                      key={p}
                      className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground dark:border-neutral-600"
                    >
                      {p}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  <button
                    type="button"
                    onClick={() => openApply(t)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-primary-600 dark:hover:bg-primary-500"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Use template
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      loadPipeline(t.config);
                      router.push(`${ROUTES.designer}/review`);
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent dark:border-neutral-700"
                  >
                    Preview locally
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {!loading && !loadError && filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-muted-foreground">No templates match your filters.</p>
      ) : null}

      <Dialog.Root open={dialogOpen} onOpenChange={closeDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out" />
          <Dialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-50 w-[min(100%,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-neutral-200 bg-card p-6 shadow-xl',
              'focus:outline-none dark:border-neutral-700'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <Dialog.Title className="text-lg font-semibold text-foreground">
                Apply “{applyTarget?.name}”
              </Dialog.Title>
              <Dialog.Close
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              Creates a saved pipeline configuration on the server and loads it into Designer.
            </Dialog.Description>

            <div className="mt-6 space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Project
                </legend>
                <div className="flex gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="proj-mode"
                      checked={projectMode === 'new'}
                      onChange={() => setProjectMode('new')}
                    />
                    New project
                  </label>
                  <label
                    className={cn(
                      'flex items-center gap-2 text-sm',
                      apiProjects.length === 0 ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    )}
                  >
                    <input
                      type="radio"
                      name="proj-mode"
                      checked={projectMode === 'existing'}
                      disabled={apiProjects.length === 0}
                      onChange={() => setProjectMode('existing')}
                    />
                    Existing
                  </label>
                </div>
              </fieldset>

              {projectMode === 'new' ? (
                <div>
                  <label htmlFor="new-proj-name" className="text-xs font-medium text-muted-foreground">
                    Project name
                  </label>
                  <input
                    id="new-proj-name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm dark:border-neutral-700"
                  />
                </div>
              ) : (
                <div>
                  <label htmlFor="existing-proj" className="text-xs font-medium text-muted-foreground">
                    Server project
                  </label>
                  {projectsLoading ? (
                    <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading projects…
                    </p>
                  ) : projectsError ? (
                    <p className="mt-2 text-sm text-destructive">{projectsError}</p>
                  ) : (
                    <select
                      id="existing-proj"
                      value={selectedProjectId}
                      onChange={(e) => setSelectedProjectId(e.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm dark:border-neutral-700"
                    >
                      {apiProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="pipeline-name" className="text-xs font-medium text-muted-foreground">
                  Saved pipeline name
                </label>
                <input
                  id="pipeline-name"
                  value={pipelineName}
                  onChange={(e) => setPipelineName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-neutral-200 bg-background px-3 py-2 text-sm dark:border-neutral-700"
                />
              </div>
            </div>

            {applyError ? (
              <p className="mt-4 text-sm text-destructive" role="alert">
                {applyError}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium dark:border-neutral-700"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                disabled={
                  applyLoading ||
                  (projectMode === 'existing' &&
                    (projectsLoading || !selectedProjectId))
                }
                onClick={() => void handleApply()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-primary-600"
              >
                {applyLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Apply & open Designer
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
