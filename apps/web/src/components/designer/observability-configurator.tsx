'use client';

import { useCallback, useMemo } from 'react';
import { Activity, Bot, ListTree } from 'lucide-react';

import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import {
  AdaptivePolicyRuleSchema,
  AgentToolsConfigSchema,
  ObservabilityConfigSchema,
} from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { AdaptivePolicyRule, AgentToolsConfig, ObservabilityConfig } from '@/types/pipeline';

const DEFAULT_OBS = createDefaultPipelineConfiguration().observability!;
const DEFAULT_TOOLS = createDefaultPipelineConfiguration().agentTools!;
const EMPTY_RULES: AdaptivePolicyRule[] = [];

export function ObservabilityConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const patchDraft = useDesignerStore((s) => s.patchDraft);

  const obs = draft.observability ?? DEFAULT_OBS;
  const tools = draft.agentTools ?? DEFAULT_TOOLS;
  const rules = draft.adaptivePolicies ?? EMPTY_RULES;

  const patchObs = useCallback(
    (p: Partial<ObservabilityConfig>) => {
      patchDraft({ observability: { ...obs, ...p } });
    },
    [obs, patchDraft],
  );

  const patchTools = useCallback(
    (p: Partial<AgentToolsConfig>) => {
      patchDraft({ agentTools: { ...tools, ...p } });
    },
    [patchDraft, tools],
  );

  const setRules = useCallback(
    (next: AdaptivePolicyRule[]) => {
      patchDraft({ adaptivePolicies: next });
    },
    [patchDraft],
  );

  const obsOk = useMemo(() => ObservabilityConfigSchema.safeParse(obs), [obs]);
  const toolsOk = useMemo(() => AgentToolsConfigSchema.safeParse(tools), [tools]);
  const rulesOk = useMemo(
    () => rules.every((r) => AdaptivePolicyRuleSchema.safeParse(r).success),
    [rules],
  );

  const addRule = () => {
    setRules([
      ...rules,
      { predicate: 'query_word_count_gt:40', action: 'use_smaller_generation_model' },
    ]);
  };

  const updateRule = (i: number, patch: Partial<AdaptivePolicyRule>) => {
    const next = [...rules];
    const cur = next[i];
    if (!cur) return;
    next[i] = { ...cur, ...patch };
    setRules(next);
  };

  const removeRule = (i: number) => {
    setRules(rules.filter((_, j) => j !== i));
  };

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="obs-main-heading"
      >
        <div className="flex items-start gap-3">
          <Activity
            className="text-primary-600 dark:text-primary-400 mt-0.5 h-5 w-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 id="obs-main-heading" className="text-foreground text-lg font-semibold">
              Observability
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Flags persisted on the pipeline for export and alignment with Phase 11 logging. They
              do not toggle server features by themselves — wire them in your deployment from the
              emitted YAML/Python comments.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['tokenTracking', 'Token usage tracking', obs.tokenTracking],
              ['latencyMonitoring', 'Latency monitoring', obs.latencyMonitoring],
              ['retrievalTracing', 'Retrieval tracing', obs.retrievalTracing],
              ['promptTracing', 'Prompt tracing (careful in prod)', obs.promptTracing],
            ] as const
          ).map(([key, label, checked]) => (
            <label
              key={key}
              className="border-border bg-muted/20 flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => patchObs({ [key]: e.target.checked })}
                className="border-input mt-1 rounded"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="tools-heading"
      >
        <div className="flex items-start gap-3">
          <Bot
            className="text-primary-600 dark:text-primary-400 mt-0.5 h-5 w-5 shrink-0"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <h2 id="tools-heading" className="text-foreground text-lg font-semibold">
              Agent tools (export hints)
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Declares which tool families your exported graph should plan for. Full tool execution
              is not bundled in preview — enable flags so downstream LangGraph templates match your
              intent.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {(
            [
              ['calculatorEnabled', 'Calculator / math'],
              ['webSearchEnabled', 'Web search'],
              ['sqlAgentEnabled', 'SQL agent'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={tools[key]}
                onChange={(e) => patchTools({ [key]: e.target.checked })}
                className="border-input h-4 w-4 rounded"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="adapt-heading"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ListTree
              className="text-primary-600 dark:text-primary-400 mt-0.5 h-5 w-5 shrink-0"
              aria-hidden
            />
            <div>
              <h2 id="adapt-heading" className="text-foreground text-lg font-semibold">
                Adaptive policies
              </h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Lightweight predicate → action hints (evaluated in API helpers for benchmarks). Use
                readable tokens such as{' '}
                <code className="bg-muted rounded px-1">query_word_count_gt:40</code>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={addRule}
            className="border-input bg-background hover:bg-accent shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium shadow-sm"
          >
            Add rule
          </button>
        </div>

        <ul className="mt-6 space-y-4">
          {rules.map((r, i) => (
            <li key={i} className="border-border bg-muted/10 rounded-lg border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Predicate
                  </label>
                  <input
                    value={r.predicate}
                    onChange={(e) => updateRule(i, { predicate: e.target.value })}
                    className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Action
                  </label>
                  <input
                    value={r.action}
                    onChange={(e) => updateRule(i, { action: e.target.value })}
                    className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeRule(i)}
                className="text-destructive mt-3 text-xs font-medium hover:underline"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

      {(!obsOk.success || !toolsOk.success || !rulesOk) && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          Fix validation issues before export.
        </div>
      )}
    </div>
  );
}
