'use client';

import { Activity, Ban, Loader2, Play, Radio } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';

import { useAutopilotBuildSubscription } from '@/hooks/use-autopilot-build-subscription';
import { ApiError, apiClient } from '@/lib/api-client';
import {
  AUTOPILOT_STAGE_LABELS,
  AUTOPILOT_STAGE_ORDER,
  mergeBuildFromServer,
  parseBuildStatusPayload,
} from '@/lib/autopilot-build-status';
import { cn } from '@/lib/utils';
import { BuildRequirementsSchema } from '@/lib/validators';
import { useAutopilotStore } from '@/stores/autopilot-store';
import type { AutopilotBuild, BuildStatus } from '@/types/autopilot';
import type { PipelineConfiguration } from '@/types/pipeline';

type StartBuildResponse = {
  buildId: string;
  status: BuildStatus;
  message: string;
};

function statusBadgeClass(status: BuildStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200';
    case 'running':
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200';
    case 'complete':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200';
    case 'failed':
      return 'bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200';
    case 'cancelled':
      return 'bg-neutral-200 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200';
    default:
      return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200';
  }
}

function stageDotClass(st: AutopilotBuild['stages'][string] | undefined): string {
  const s = st?.status ?? 'pending';
  if (s === 'complete') return 'bg-emerald-500';
  if (s === 'running') return 'bg-sky-500 animate-pulse';
  if (s === 'failed') return 'bg-red-500';
  return 'bg-neutral-300 dark:bg-neutral-600';
}

function buildStartBody(args: {
  projectId: string;
  requirements: AutopilotBuild['input']['requirements'];
  documentIds: string[];
  baseConfig: PipelineConfiguration | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    projectId: args.projectId,
    requirements: args.requirements,
    documentIds: args.documentIds,
  };
  if (args.baseConfig) {
    body.baseConfig = args.baseConfig;
  }
  return body;
}

export function BuildProgressMonitor({ className }: Readonly<{ className?: string }>) {
  const uid = useId();
  const activeBuildId = useAutopilotStore((s) => s.activeBuildId);
  const builds = useAutopilotStore((s) => s.builds);
  const setActiveBuildId = useAutopilotStore((s) => s.setActiveBuildId);
  const upsertBuild = useAutopilotStore((s) => s.upsertBuild);
  const requirements = useAutopilotStore((s) => s.requirements);
  const uploadedDocuments = useAutopilotStore((s) => s.uploadedDocuments);
  const selectedBackendProjectId = useAutopilotStore((s) => s.selectedBackendProjectId);
  const baseConfig = useAutopilotStore((s) => s.baseConfig);

  const { build: liveBuild, connectionMode } = useAutopilotBuildSubscription(activeBuildId);

  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const sortedBuilds = useMemo(
    () => Object.values(builds).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [builds],
  );

  const displayBuild = liveBuild ?? (activeBuildId ? builds[activeBuildId] : undefined);

  const startBuild = useCallback(async () => {
    setActionError(null);
    if (!selectedBackendProjectId) {
      setActionError('Select a backend project and upload at least one document before starting.');
      return;
    }
    if (uploadedDocuments.length === 0) {
      setActionError('Upload at least one corpus file so documentIds can be sent to the API.');
      return;
    }
    const parsed = BuildRequirementsSchema.safeParse(requirements);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      const msg =
        Object.entries(fe)
          .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
          .join(' · ') || parsed.error.message;
      setActionError(msg);
      return;
    }

    setStarting(true);
    try {
      const documentIds = uploadedDocuments.map((d) => d.objectId);
      const body = buildStartBody({
        projectId: selectedBackendProjectId,
        requirements: parsed.data,
        documentIds,
        baseConfig,
      });
      const res = await apiClient.post<StartBuildResponse, Record<string, unknown>>(
        '/api/autopilot/build',
        body,
      );
      const now = new Date().toISOString();
      const seed: AutopilotBuild = {
        id: res.buildId,
        status: res.status,
        progress: 0,
        currentStage: 'queued',
        iteration: 0,
        input: {
          documents: documentIds,
          requirements: parsed.data as AutopilotBuild['input']['requirements'],
          baseConfig: baseConfig ?? undefined,
        },
        stages: Object.fromEntries(
          [...AUTOPILOT_STAGE_ORDER].map((k) => [
            k,
            {
              status: 'pending' as const,
              startedAt: undefined,
              completedAt: undefined,
              message: undefined,
            },
          ]),
        ),
        messages: [],
        createdAt: now,
        updatedAt: now,
      };
      upsertBuild(seed);
    } catch (e) {
      setActionError(e instanceof ApiError ? JSON.stringify(e.data) : String(e));
    } finally {
      setStarting(false);
    }
  }, [baseConfig, requirements, selectedBackendProjectId, uploadedDocuments, upsertBuild]);

  const cancelBuild = useCallback(async () => {
    if (!activeBuildId) return;
    setActionError(null);
    setCancelling(true);
    try {
      await apiClient.post<unknown, Record<string, unknown>>(
        `/api/autopilot/build/${encodeURIComponent(activeBuildId)}/cancel`,
        {},
      );
      const raw = await apiClient.get<unknown>(
        `/api/autopilot/build/${encodeURIComponent(activeBuildId)}`,
      );
      const parsed = parseBuildStatusPayload(raw);
      if (parsed) {
        const prev = useAutopilotStore.getState().builds[parsed.id];
        upsertBuild(mergeBuildFromServer(prev, parsed));
      }
    } catch (e) {
      setActionError(e instanceof ApiError ? JSON.stringify(e.data) : String(e));
    } finally {
      setCancelling(false);
    }
  }, [activeBuildId, upsertBuild]);

  const canCancel =
    !!activeBuildId &&
    !!displayBuild &&
    (displayBuild.status === 'pending' || displayBuild.status === 'running');

  return (
    <section
      className={cn(
        'rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Build progress
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Live updates via{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              {`GET /api/autopilot/build/{id}/stream`}
            </code>{' '}
            (SSE), with automatic fallback to polling if the stream fails.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {connectionMode === 'sse' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              SSE
            </span>
          ) : connectionMode === 'poll' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              <Activity className="h-3.5 w-3.5" aria-hidden />
              Polling
            </span>
          ) : null}
        </div>
      </div>

      {sortedBuilds.length > 0 ? (
        <div className="mt-6">
          <label
            htmlFor={`${uid}-watch`}
            className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
          >
            Active build
          </label>
          <select
            id={`${uid}-watch`}
            className="mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
            value={activeBuildId ?? ''}
            onChange={(e) => setActiveBuildId(e.target.value || null)}
          >
            <option value="">None (not streaming)</option>
            {sortedBuilds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id.slice(0, 8)}… · {b.status} · {b.progress}%
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={starting}
          onClick={() => void startBuild()}
          className="bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-400 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Play className="h-4 w-4" aria-hidden />
          )}
          Start build
        </button>
        <button
          type="button"
          disabled={!canCancel || cancelling}
          onClick={() => void cancelBuild()}
          className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          {cancelling ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Ban className="h-4 w-4" aria-hidden />
          )}
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveBuildId(null);
            useAutopilotStore.getState().resetSession();
            setActionError(null);
          }}
          className="text-muted-foreground inline-flex items-center rounded-md border border-neutral-200 px-3 py-2 text-sm hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:hover:text-neutral-100"
        >
          Clear session
        </button>
      </div>

      {actionError ? (
        <p className="border-destructive/40 bg-destructive/5 text-destructive mt-4 rounded-md border px-3 py-2 text-sm">
          {actionError}
        </p>
      ) : null}

      {!displayBuild && !activeBuildId ? (
        <p className="text-muted-foreground mt-6 text-sm">
          Start a build to open an SSE connection (or choose an existing build above). Requirements
          must pass <strong>Validate</strong> on the form above; this panel runs the same Zod rules
          before POST.
        </p>
      ) : null}

      {displayBuild ? (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
                  statusBadgeClass(displayBuild.status),
                )}
              >
                {displayBuild.status}
              </span>
              <span className="text-muted-foreground text-sm">
                Iteration{' '}
                <span className="font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                  {displayBuild.iteration}
                </span>
              </span>
            </div>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              Stage:{' '}
              <span className="font-medium">
                {AUTOPILOT_STAGE_LABELS[displayBuild.currentStage] ?? displayBuild.currentStage}
              </span>
            </p>
          </div>

          <div>
            <div className="text-muted-foreground mb-1 flex justify-between text-xs">
              <span>Progress</span>
              <span className="font-medium tabular-nums text-neutral-800 dark:text-neutral-200">
                {displayBuild.progress}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="bg-primary-600 dark:bg-primary-500 h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${displayBuild.progress}%` }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">Stages</h3>
            <ul className="mt-3 space-y-2">
              {AUTOPILOT_STAGE_ORDER.map((key) => {
                const st = displayBuild.stages[key];
                return (
                  <li key={key} className="flex items-start gap-3 text-sm">
                    <span
                      className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', stageDotClass(st))}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-neutral-900 dark:text-neutral-50">
                        {AUTOPILOT_STAGE_LABELS[key] ?? key}
                        {st?.status ? (
                          <span className="text-muted-foreground ml-2 text-xs font-normal uppercase">
                            {st.status}
                          </span>
                        ) : null}
                      </p>
                      {st?.message ? (
                        <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">
                          {st.message}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {displayBuild.error ? (
            <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm">
              {displayBuild.error}
            </p>
          ) : null}
        </div>
      ) : activeBuildId ? (
        <p className="text-muted-foreground mt-6 flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Connecting to build stream…
        </p>
      ) : null}
    </section>
  );
}
