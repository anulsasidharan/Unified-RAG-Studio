'use client';

import Link from 'next/link';

import { AgentActivityFeed } from '@/components/autopilot/agent-activity-feed';
import { BuildProgressMonitor } from '@/components/autopilot/build-progress-monitor';
import { DecisionExplainer } from '@/components/autopilot/decision-explainer';
import { MetricsDashboard } from '@/components/autopilot/metrics-dashboard';
import { DocumentUploader } from '@/components/autopilot/document-uploader';
import { RequirementsForm } from '@/components/autopilot/requirements-form';
import { ResultsSummary } from '@/components/autopilot/results-summary';
import { ROUTES } from '@/lib/constants';
import { useAutopilotStore } from '@/stores/autopilot-store';

export function AutopilotBuildWizard() {
  const activeBuildId = useAutopilotStore((s) => s.activeBuildId);
  const builds = useAutopilotStore((s) => s.builds);
  const displayBuild = activeBuildId ? builds[activeBuildId] : undefined;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        New Autopilot build
      </h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">
        Upload corpus files, set requirements, then start a build. Progress streams over SSE with polling
        fallback.
      </p>

      <DocumentUploader className="mt-8" />
      <RequirementsForm className="mt-8" />
      <BuildProgressMonitor className="mt-8" />
      <MetricsDashboard className="mt-8" />
      {displayBuild ? (
        <>
          <ResultsSummary className="mt-8" build={displayBuild} />
          <DecisionExplainer className="mt-8" build={displayBuild} />
        </>
      ) : null}
      <AgentActivityFeed className="mt-8" />

      <Link
        href={ROUTES.autopilot}
        className="mt-8 inline-block text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
      >
        ← Autopilot overview
      </Link>
    </>
  );
}
