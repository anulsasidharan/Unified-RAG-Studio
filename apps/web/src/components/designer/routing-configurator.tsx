'use client';

import { useCallback, useMemo } from 'react';
import { GitBranch, Plus, Trash2 } from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { listGenerationModels } from '@/lib/generation-catalog';
import { RoutingConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { RoutingConfig, RoutingRule } from '@/types/pipeline';

const DEFAULT_ROUTING = createDefaultPipelineConfiguration().stages.routing!;

function mergeRouting(current: RoutingConfig | undefined, patch: Partial<RoutingConfig>): RoutingConfig {
  const base = current ?? DEFAULT_ROUTING;
  return {
    ...base,
    ...patch,
    rules: patch.rules !== undefined ? patch.rules : base.rules,
  };
}

const CONDITION_LABEL: Record<RoutingRule['condition'], string> = {
  keyword: 'Keyword match',
  'query-length': 'Query length',
  'semantic-complexity': 'Semantic complexity',
};

export function RoutingConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.routing ?? DEFAULT_ROUTING;
  const generationModel = draft.stages.generation?.model ?? DEFAULT_ROUTING.defaultModel ?? 'gpt-4o-mini';

  const setRouting = useCallback(
    (next: RoutingConfig) => {
      updateStages({ routing: next });
    },
    [updateStages]
  );

  const patchRouting = useCallback(
    (patch: Partial<RoutingConfig>) => {
      setRouting(mergeRouting(draft.stages.routing, patch));
    },
    [draft.stages.routing, setRouting]
  );

  const validation = useMemo(() => RoutingConfigSchema.safeParse(cfg), [cfg]);

  const models = useMemo(() => listGenerationModels(), []);

  const addRule = () => {
    const nextRule: RoutingRule = {
      condition: 'keyword',
      keywords: [],
      targetModel: generationModel,
    };
    patchRouting({ rules: [...(cfg.rules ?? []), nextRule] });
  };

  const updateRule = (index: number, patch: Partial<RoutingRule>) => {
    const rules = [...(cfg.rules ?? [])];
    const prev = rules[index];
    if (!prev) return;
    rules[index] = { ...prev, ...patch };
    patchRouting({ rules });
  };

  const removeRule = (index: number) => {
    const rules = (cfg.rules ?? []).filter((_, i) => i !== index);
    patchRouting({ rules: rules.length ? rules : undefined });
  };

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="routing-main-heading"
      >
        <div className="flex items-start gap-3">
          <GitBranch className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="routing-main-heading" className="text-lg font-semibold text-foreground">
              LLM routing
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Route queries to different generation models using ordered rules. Updates{' '}
              <strong className="font-medium text-foreground">draft.stages.routing</strong> for YAML/Python export and
              APIs.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => patchRouting({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Enable conditional routing
          </label>
        </div>

        {cfg.enabled ? (
          <>
            <div className="mt-6">
              <label htmlFor="routing-default-model" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fallback model (no rule matched)
              </label>
              <select
                id="routing-default-model"
                className="mt-1 w-full max-w-xl rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                value={cfg.defaultModel ?? generationModel}
                onChange={(e) => patchRouting({ defaultModel: e.target.value })}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.id})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Defaults to your Generation stage model when unset; you can pick another fallback here.
              </p>
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Rules</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    First matching rule wins (top to bottom). Use keywords, length thresholds, or complexity thresholds.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addRule}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-accent"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add rule
                </button>
              </div>

              {(cfg.rules ?? []).length === 0 ? (
                <p className="mt-4 rounded-lg border border-dashed border-muted-foreground/40 px-4 py-6 text-center text-sm text-muted-foreground">
                  No rules yet — add a rule or all traffic uses the fallback model.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {(cfg.rules ?? []).map((rule, idx) => (
                    <li
                      key={`rule-${idx}-${rule.condition}-${rule.targetModel}`}
                      className="rounded-lg border border-neutral-200 bg-muted/20 p-4 dark:border-neutral-700"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">Rule {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeRule(idx)}
                          className="inline-flex items-center gap-1 rounded text-xs font-medium text-destructive hover:underline"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          Remove
                        </button>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Condition
                          </label>
                          <select
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={rule.condition}
                            onChange={(e) =>
                              updateRule(idx, {
                                condition: e.target.value as RoutingRule['condition'],
                                keywords: e.target.value === 'keyword' ? rule.keywords ?? [] : undefined,
                                threshold:
                                  e.target.value !== 'keyword'
                                    ? rule.threshold ?? 128
                                    : undefined,
                              })
                            }
                          >
                            {(Object.keys(CONDITION_LABEL) as RoutingRule['condition'][]).map((c) => (
                              <option key={c} value={c}>
                                {CONDITION_LABEL[c]}
                              </option>
                            ))}
                          </select>
                        </div>

                        {rule.condition === 'keyword' ? (
                          <div className="sm:col-span-2">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Keywords (comma-separated)
                            </label>
                            <input
                              type="text"
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              placeholder="legal, contract, compliance"
                              value={(rule.keywords ?? []).join(', ')}
                              onChange={(e) =>
                                updateRule(idx, {
                                  keywords: e.target.value
                                    .split(',')
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Threshold
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={100000}
                              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={rule.threshold ?? ''}
                              onChange={(e) =>
                                updateRule(idx, {
                                  threshold: e.target.value === '' ? undefined : Number(e.target.value),
                                })
                              }
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              {rule.condition === 'query-length'
                                ? 'Character or token count hint for routing (pipeline-specific).'
                                : 'Score or heuristic threshold for complexity routing.'}
                            </p>
                          </div>
                        )}

                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Target model
                          </label>
                          <select
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={rule.targetModel}
                            onChange={(e) => updateRule(idx, { targetModel: e.target.value })}
                          >
                            {models.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.id})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </section>

      {!validation.success ? (
        <p className="text-sm text-destructive" role="alert">
          Invalid routing configuration — check rule fields against the schema.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Validated with <code className="rounded bg-muted px-1">RoutingConfigSchema</code>.
        </p>
      )}
    </div>
  );
}
