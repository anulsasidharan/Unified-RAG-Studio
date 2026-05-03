'use client';

import { useCallback } from 'react';
import { Shield } from 'lucide-react';

import { resolveGuardrailsConfig } from '@/lib/guardrails-summary';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { GuardrailsConfig, InputStageGuardrails, OutputStageGuardrails, RetrievalStageGuardrails } from '@/types/pipeline';

function SubToggle({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}>) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-2 py-2 hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-input"
      />
      <span>
        <span className="font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function GuardrailsConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const patchDraft = useDesignerStore((s) => s.patchDraft);

  const cfg = resolveGuardrailsConfig(draft.guardrails);

  const setGuardrails = useCallback(
    (next: GuardrailsConfig) => {
      patchDraft({ guardrails: next });
    },
    [patchDraft]
  );

  const patchInput = useCallback(
    (patch: Partial<InputStageGuardrails>) => {
      const g = resolveGuardrailsConfig(draft.guardrails);
      setGuardrails({ ...g, input: { ...g.input, ...patch } });
    },
    [draft.guardrails, setGuardrails]
  );

  const patchRetrieval = useCallback(
    (patch: Partial<RetrievalStageGuardrails>) => {
      const g = resolveGuardrailsConfig(draft.guardrails);
      setGuardrails({ ...g, retrieval: { ...g.retrieval, ...patch } });
    },
    [draft.guardrails, setGuardrails]
  );

  const patchOutput = useCallback(
    (patch: Partial<OutputStageGuardrails>) => {
      const g = resolveGuardrailsConfig(draft.guardrails);
      setGuardrails({ ...g, output: { ...g.output, ...patch } });
    },
    [draft.guardrails, setGuardrails]
  );

  const inDisabled = !cfg.input.enabled;
  const retDisabled = !cfg.retrieval.enabled;
  const outDisabled = !cfg.output.enabled;

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="guardrails-main-heading"
      >
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="guardrails-main-heading" className="text-lg font-semibold text-foreground">
              Guardrails
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Per-stage safety policy for input, retrieved context, and model output. Stored on{' '}
              <strong className="font-medium text-foreground">draft.guardrails</strong> and sent with designer export
              and <code className="text-xs">POST /api/designer/rag-preview</code> (API defaults match “all on” when
              omitted).
            </p>
          </div>
        </div>
      </section>

      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="guardrails-input-heading"
      >
        <h3 id="guardrails-input-heading" className="text-base font-semibold text-foreground">
          Input (user query)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Runs before retrieval on the raw user message.</p>
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.input.enabled}
              onChange={(e) => patchInput({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Enable input guardrails
          </label>
        </div>
        <ul className="mt-4 space-y-1">
          <li>
            <SubToggle
              id="gr-pii"
              label="PII redaction"
              hint="Detect and redact common personally identifiable patterns."
              checked={cfg.input.piiRedactionEnabled}
              disabled={inDisabled}
              onChange={(v) => patchInput({ piiRedactionEnabled: v })}
            />
          </li>
          <li>
            <SubToggle
              id="gr-inj"
              label="Prompt-injection block"
              hint="Heuristic block for obvious instruction-override attempts."
              checked={cfg.input.promptInjectionBlockEnabled}
              disabled={inDisabled}
              onChange={(v) => patchInput({ promptInjectionBlockEnabled: v })}
            />
          </li>
          <li>
            <SubToggle
              id="gr-tox"
              label="Toxicity filter"
              hint="Block queries matching toxicity / abuse heuristics (extendable via API policy files)."
              checked={cfg.input.toxicityBlockEnabled}
              disabled={inDisabled}
              onChange={(v) => patchInput({ toxicityBlockEnabled: v })}
            />
          </li>
        </ul>
      </section>

      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="guardrails-retrieval-heading"
      >
        <h3 id="guardrails-retrieval-heading" className="text-base font-semibold text-foreground">
          Retrieval (chunks)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Runs on retrieved documents before they reach the LLM.</p>
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.retrieval.enabled}
              onChange={(e) => patchRetrieval({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Enable retrieval guardrails
          </label>
        </div>
        <ul className="mt-4 space-y-1">
          <li>
            <SubToggle
              id="gr-cf"
              label="Content filter"
              hint="Drop or flag chunks matching blocked terms / patterns."
              checked={cfg.retrieval.contentFilterEnabled}
              disabled={retDisabled}
              onChange={(v) => patchRetrieval({ contentFilterEnabled: v })}
            />
          </li>
          <li>
            <SubToggle
              id="gr-src"
              label="Source validation"
              hint="Require provenance metadata on chunks when configured."
              checked={cfg.retrieval.sourceValidationEnabled}
              disabled={retDisabled}
              onChange={(v) => patchRetrieval({ sourceValidationEnabled: v })}
            />
          </li>
          <li>
            <SubToggle
              id="gr-bias"
              label="Bias heuristic"
              hint="Lightweight pattern scan for potentially biased retrieved text."
              checked={cfg.retrieval.biasDetectionEnabled}
              disabled={retDisabled}
              onChange={(v) => patchRetrieval({ biasDetectionEnabled: v })}
            />
          </li>
        </ul>
      </section>

      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="guardrails-output-heading"
      >
        <h3 id="guardrails-output-heading" className="text-base font-semibold text-foreground">
          Output (LLM answer)
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Runs on the generated answer before it is returned.</p>
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.output.enabled}
              onChange={(e) => patchOutput({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Enable output guardrails
          </label>
        </div>
        <ul className="mt-4 space-y-1">
          <li>
            <SubToggle
              id="gr-hallu"
              label="Hallucination heuristic"
              hint="Compare answer overlap with retrieved context (warn / block on weak grounding)."
              checked={cfg.output.hallucinationHeuristicEnabled}
              disabled={outDisabled}
              onChange={(v) => patchOutput({ hallucinationHeuristicEnabled: v })}
            />
          </li>
          <li>
            <SubToggle
              id="gr-fact"
              label="Factuality check"
              hint="Lexical overlap heuristic against references."
              checked={cfg.output.factualityCheckEnabled}
              disabled={outDisabled}
              onChange={(v) => patchOutput({ factualityCheckEnabled: v })}
            />
          </li>
          <li>
            <SubToggle
              id="gr-cite"
              label="Citation verification"
              hint="Ensure citations align with provided source count / references."
              checked={cfg.output.citationVerificationEnabled}
              disabled={outDisabled}
              onChange={(v) => patchOutput({ citationVerificationEnabled: v })}
            />
          </li>
        </ul>
      </section>
    </div>
  );
}
