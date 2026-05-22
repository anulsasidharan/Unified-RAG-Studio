'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const AutopilotBuildWizard = dynamic(
  () =>
    import('@/components/autopilot/autopilot-build-wizard').then((m) => ({
      default: m.AutopilotBuildWizard,
    })),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground" aria-busy="true">
        Loading build wizard…
      </p>
    ),
  }
);
import { apiClient } from '@/lib/api-client';
import { mergeBuildFromServer, parseBuildStatusPayload } from '@/lib/autopilot-build-status';
import { useAutopilotStore } from '@/stores/autopilot-store';

export function AutopilotNewPageBody() {
  const searchParams = useSearchParams();
  const buildParam = searchParams.get('build')?.trim() ?? '';
  const projectParam = searchParams.get('project')?.trim() ?? '';

  const setActiveBuildId = useAutopilotStore((s) => s.setActiveBuildId);
  const upsertBuild = useAutopilotStore((s) => s.upsertBuild);
  const setSelectedBackendProjectId = useAutopilotStore((s) => s.setSelectedBackendProjectId);

  useEffect(() => {
    if (buildParam) {
      setActiveBuildId(buildParam);
    }
    if (projectParam) {
      setSelectedBackendProjectId(projectParam);
    }
  }, [buildParam, projectParam, setActiveBuildId, setSelectedBackendProjectId]);

  useEffect(() => {
    if (!buildParam) return;
    const existing = useAutopilotStore.getState().builds[buildParam];
    if (existing) return;

    let cancelled = false;
    void (async () => {
      try {
        const raw = await apiClient.get<unknown>(
          `/api/autopilot/build/${encodeURIComponent(buildParam)}`
        );
        if (cancelled) return;
        const parsed = parseBuildStatusPayload(raw);
        if (!parsed) return;
        const prev = useAutopilotStore.getState().builds[parsed.id];
        upsertBuild(mergeBuildFromServer(prev, parsed));
      } catch {
        /* deep-link fetch failed — wizard still usable once user starts a build */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [buildParam, upsertBuild]);

  return <AutopilotBuildWizard />;
}
