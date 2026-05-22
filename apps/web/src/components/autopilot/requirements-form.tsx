'use client';

import { Gauge, RotateCcw, Sparkles } from 'lucide-react';
import { useCallback, useId, useMemo, useState } from 'react';

import { listCloudProviders } from '@/lib/cloud-providers-catalog';
import { cn } from '@/lib/utils';
import { BuildRequirementsSchema } from '@/lib/validators';
import { createDefaultRequirements, useAutopilotStore } from '@/stores/autopilot-store';
import type { BuildRequirements, TargetMetrics } from '@/types/autopilot';
import type { CloudProvider } from '@/types/pipeline';

const OPTIMIZE_OPTIONS: ReadonlyArray<{
  id: NonNullable<BuildRequirements['optimizeFor']>;
  label: string;
  description: string;
}> = [
  {
    id: 'quality',
    label: 'Quality',
    description: 'Prioritise RAGAS-style scores over cost and latency.',
  },
  { id: 'cost', label: 'Cost', description: 'Minimise spend per 1K queries within your targets.' },
  { id: 'latency', label: 'Latency', description: 'Prefer faster retrieval and generation paths.' },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Trade off quality, cost, and latency evenly.',
  },
];

const METRIC_FIELDS: ReadonlyArray<{
  key: keyof TargetMetrics;
  label: string;
  hint: string;
}> = [
  { key: 'faithfulness', label: 'Faithfulness', hint: 'Answers grounded in retrieved context.' },
  { key: 'answerRelevance', label: 'Answer relevance', hint: 'Responses match the user question.' },
  { key: 'contextPrecision', label: 'Context precision', hint: 'Retrieved chunks are on-topic.' },
  { key: 'contextRecall', label: 'Context recall', hint: 'Retrieval covers needed evidence.' },
];

function pct01(n: number | undefined): number {
  const v = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  return Math.round(Math.min(1, Math.max(0, v)) * 100);
}

export function RequirementsForm({ className }: Readonly<{ className?: string }>) {
  const baseId = useId();
  const requirements = useAutopilotStore((s) => s.requirements);
  const patchRequirements = useAutopilotStore((s) => s.patchRequirements);
  const setRequirements = useAutopilotStore((s) => s.setRequirements);

  const [budgetText, setBudgetText] = useState(() =>
    requirements.budgetConstraint != null ? String(requirements.budgetConstraint) : '',
  );
  const [latencyText, setLatencyText] = useState(() =>
    requirements.latencyRequirement != null ? String(requirements.latencyRequirement) : '',
  );
  const [zodError, setZodError] = useState<string | null>(null);
  const [validated, setValidated] = useState(false);

  const providers = useMemo(() => listCloudProviders(), []);

  const syncOptionalFields = useCallback((r: BuildRequirements) => {
    setBudgetText(r.budgetConstraint != null ? String(r.budgetConstraint) : '');
    setLatencyText(r.latencyRequirement != null ? String(r.latencyRequirement) : '');
  }, []);

  const applyBudgetLatency = useCallback(() => {
    const budgetTrim = budgetText.trim();
    const latTrim = latencyText.trim();
    const b = budgetTrim === '' ? undefined : Number(budgetTrim);
    const l = latTrim === '' ? undefined : Number(latTrim);
    patchRequirements({
      budgetConstraint: budgetTrim === '' || !Number.isFinite(b) ? undefined : b,
      latencyRequirement: latTrim === '' || !Number.isFinite(l) ? undefined : l,
    });
  }, [budgetText, latencyText, patchRequirements]);

  const validateAndReport = useCallback(() => {
    applyBudgetLatency();
    const next = useAutopilotStore.getState().requirements;
    const parsed = BuildRequirementsSchema.safeParse(next);
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors;
      const msg =
        Object.entries(first)
          .map(([k, v]) => `${k}: ${(v as string[]).join(', ')}`)
          .join(' · ') || parsed.error.message;
      setZodError(msg);
      setValidated(false);
      return false;
    }
    setZodError(null);
    setValidated(true);
    return true;
  }, [applyBudgetLatency]);

  const resetDefaults = useCallback(() => {
    const d = createDefaultRequirements();
    setRequirements(d);
    syncOptionalFields(d);
    setZodError(null);
    setValidated(false);
  }, [setRequirements, syncOptionalFields]);

  const patchMetric = (key: keyof TargetMetrics, pct: number) => {
    const v = Math.min(1, Math.max(0, pct / 100));
    patchRequirements({ targetMetrics: { [key]: v } });
    setValidated(false);
  };

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
            Requirements
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Targets, constraints, and optimisation goals for{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs dark:bg-neutral-800">
              POST /api/autopilot/build
            </code>
            . Values persist in the Autopilot store with your uploads.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void validateAndReport()}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Validate
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="text-muted-foreground inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:border-neutral-300 hover:text-neutral-900 dark:border-neutral-700 dark:hover:text-neutral-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset defaults
          </button>
        </div>
      </div>

      {zodError ? (
        <p className="border-destructive/40 bg-destructive/5 text-destructive mt-4 rounded-md border px-3 py-2 text-sm">
          {zodError}
        </p>
      ) : validated ? (
        <p className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
          Requirements valid — ready to start a build.
        </p>
      ) : (
        <p className="text-muted-foreground mt-4 text-xs">
          Optional budget and latency fields apply when you blur the inputs or click Validate.
        </p>
      )}

      <div className="mt-8 space-y-10">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            <Gauge className="text-primary-600 dark:text-primary-400 h-4 w-4" aria-hidden />
            Evaluation targets (0–1)
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Minimum scores agents should aim for before treating a configuration as acceptable.
          </p>
          <ul className="mt-4 space-y-5">
            {METRIC_FIELDS.map(({ key, label, hint }) => (
              <li key={key}>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <label
                      className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
                      htmlFor={`${baseId}-${key}`}
                    >
                      {label}
                    </label>
                    <p className="text-muted-foreground text-xs">{hint}</p>
                  </div>
                  <span className="text-primary-700 dark:text-primary-300 text-sm font-medium tabular-nums">
                    {(requirements.targetMetrics[key] ?? 0).toFixed(2)}
                  </span>
                </div>
                <input
                  id={`${baseId}-${key}`}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  className="accent-primary-600 mt-2 h-2 w-full cursor-pointer"
                  value={pct01(requirements.targetMetrics[key])}
                  onChange={(e) => patchMetric(key, Number(e.target.value))}
                />
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Optimisation focus
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Maps to the orchestrator&apos;s optimise_for signal.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {OPTIMIZE_OPTIONS.map((opt) => {
              const active = requirements.optimizeFor === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => patchRequirements({ optimizeFor: opt.id })}
                  className={cn(
                    'rounded-lg border px-3 py-3 text-left text-sm transition-colors',
                    active
                      ? 'border-primary-500 bg-primary-50/90 dark:bg-primary-950/40 text-neutral-900 dark:text-neutral-50'
                      : 'border-neutral-200 bg-neutral-50/40 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-900/30 dark:hover:border-neutral-600',
                  )}
                >
                  <span className="font-semibold">{opt.label}</span>
                  <p className="text-muted-foreground mt-1 text-xs">{opt.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${baseId}-budget`}
              className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
            >
              Budget cap (USD / 1K queries)
            </label>
            <p className="text-muted-foreground text-xs">
              Leave empty for no explicit budget ceiling.
            </p>
            <input
              id={`${baseId}-budget`}
              type="number"
              min={0}
              step="0.001"
              inputMode="decimal"
              placeholder="e.g. 0.12"
              className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value)}
              onBlur={() => applyBudgetLatency()}
            />
          </div>
          <div>
            <label
              htmlFor={`${baseId}-latency`}
              className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
            >
              Latency ceiling (ms)
            </label>
            <p className="text-muted-foreground text-xs">
              End-to-end target; leave empty if not binding.
            </p>
            <input
              id={`${baseId}-latency`}
              type="number"
              min={0}
              step={10}
              inputMode="numeric"
              placeholder="e.g. 800"
              className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
              value={latencyText}
              onChange={(e) => setLatencyText(e.target.value)}
              onBlur={() => applyBudgetLatency()}
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor={`${baseId}-cloud`}
              className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
            >
              Preferred cloud (optional)
            </label>
            <p className="text-muted-foreground text-xs">
              Hints deployment packaging; agents may still vary resources.
            </p>
            <select
              id={`${baseId}-cloud`}
              className="mt-2 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
              value={requirements.cloudProvider ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                patchRequirements({ cloudProvider: v === '' ? undefined : (v as CloudProvider) });
              }}
            >
              <option value="">No preference</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`${baseId}-iter`}
              className="text-sm font-medium text-neutral-800 dark:text-neutral-200"
            >
              Max orchestration iterations
            </label>
            <p className="text-muted-foreground text-xs">
              API allows 1–10; higher values run longer optimisation loops.
            </p>
            <input
              id={`${baseId}-iter`}
              type="range"
              min={1}
              max={10}
              step={1}
              className="accent-primary-600 mt-4 h-2 w-full cursor-pointer"
              value={requirements.maxIterations ?? 5}
              onChange={(e) => patchRequirements({ maxIterations: Number(e.target.value) })}
            />
            <p className="text-primary-700 dark:text-primary-300 mt-2 text-center text-sm font-medium tabular-nums">
              {requirements.maxIterations ?? 5}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
