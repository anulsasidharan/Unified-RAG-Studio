'use client';

import { useCallback, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { EvaluationConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { EvaluationConfig, EvaluationMetricName } from '@/types/pipeline';

const DEFAULT_EVAL = createDefaultPipelineConfiguration().stages.evaluation!;

function mergeEvaluation(current: EvaluationConfig | undefined, patch: Partial<EvaluationConfig>): EvaluationConfig {
  const base = current ?? DEFAULT_EVAL;
  return {
    ...base,
    ...patch,
    metrics: patch.metrics !== undefined ? patch.metrics : base.metrics,
  };
}

const METRICS: { id: EvaluationMetricName; label: string; hint: string }[] = [
  { id: 'faithfulness', label: 'Faithfulness', hint: 'Answer grounded in retrieved context' },
  { id: 'answer_relevance', label: 'Answer relevance', hint: 'Response matches the user question' },
  { id: 'context_precision', label: 'Context precision', hint: 'Retrieved chunks are on-topic' },
  { id: 'context_recall', label: 'Context recall', hint: 'Retrieval covers needed evidence' },
  { id: 'latency', label: 'Latency', hint: 'End-to-end response time' },
];

function toggleMetric(list: EvaluationMetricName[] | undefined, id: EvaluationMetricName): EvaluationMetricName[] {
  const cur = list ?? [];
  if (cur.includes(id)) return cur.filter((m) => m !== id);
  return [...cur, id];
}

export function EvaluationConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.evaluation ?? DEFAULT_EVAL;

  const setEvaluation = useCallback(
    (next: EvaluationConfig) => {
      updateStages({ evaluation: next });
    },
    [updateStages]
  );

  const patchEvaluation = useCallback(
    (patch: Partial<EvaluationConfig>) => {
      setEvaluation(mergeEvaluation(draft.stages.evaluation, patch));
    },
    [draft.stages.evaluation, setEvaluation]
  );

  const validation = useMemo(() => EvaluationConfigSchema.safeParse(cfg), [cfg]);

  const selected = new Set(cfg.metrics ?? []);

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="eval-main-heading"
      >
        <div className="flex items-start gap-3">
          <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="eval-main-heading" className="text-lg font-semibold text-foreground">
              Evaluation
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure offline or scheduled quality checks (e.g. RAGAS-style metrics). Updates{' '}
              <strong className="font-medium text-foreground">draft.stages.evaluation</strong> for the evaluation engine
              and exports.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => patchEvaluation({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Enable pipeline evaluation
          </label>
        </div>

        {cfg.enabled ? (
          <div className="mt-8 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Metrics</h3>
              <p className="mt-1 text-xs text-muted-foreground">Select one or more metrics to compute on the test set.</p>
              <ul className="mt-3 space-y-2">
                {METRICS.map((m) => (
                  <li key={m.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-2 py-2 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() =>
                          patchEvaluation({
                            metrics: toggleMetric(cfg.metrics, m.id),
                          })
                        }
                        className="mt-1 h-4 w-4 rounded border-input"
                      />
                      <span>
                        <span className="font-medium text-foreground">{m.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{m.hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="eval-test-size" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Synthetic / held-out test set size
                </label>
                <input
                  id="eval-test-size"
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={cfg.testSetSize ?? DEFAULT_EVAL.testSetSize ?? 50}
                  onChange={(e) => patchEvaluation({ testSetSize: Number(e.target.value) })}
                />
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Schedule</span>
                <div className="mt-2 flex flex-col gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="eval-schedule"
                      checked={(cfg.schedule ?? 'on-demand') === 'on-demand'}
                      onChange={() => patchEvaluation({ schedule: 'on-demand' })}
                    />
                    On demand (CI or manual runs)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="eval-schedule"
                      checked={cfg.schedule === 'continuous'}
                      onChange={() => patchEvaluation({ schedule: 'continuous' })}
                    />
                    Continuous (periodic in production — requires worker support)
                  </label>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {!validation.success ? (
        <p className="text-sm text-destructive" role="alert">
          Invalid evaluation configuration — check metric list and test set size (10–1000).
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Validated with <code className="rounded bg-muted px-1">EvaluationConfigSchema</code>.
        </p>
      )}
    </div>
  );
}
