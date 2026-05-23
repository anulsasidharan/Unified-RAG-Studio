'use client';

import { useCallback, useMemo, useState } from 'react';
import { Bot, Check, Layers, Plus, Search, Trash2 } from 'lucide-react';

import {
  generationConfigFromCatalogEntry,
  getGenerationModelMeta,
  listGenerationModels,
} from '@/lib/generation-catalog';
import { createDefaultPipelineConfiguration } from '@/lib/default-pipeline';
import { GenerationConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type { GenerationModel } from '@/types/models';
import type { FewShotMessage, GenerationConfig, OutputFormat } from '@/types/pipeline';

const DEFAULT_GEN = createDefaultPipelineConfiguration().stages.generation;

function mergeGeneration(
  current: GenerationConfig | undefined,
  patch: Partial<GenerationConfig>,
): GenerationConfig {
  const base = current ?? DEFAULT_GEN;
  return { ...base, ...patch };
}

function tierBadgeStyles(tier: string): string {
  const t = tier.toLowerCase();
  if (t === 'advanced') {
    return 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100';
  }
  if (t === 'fast') {
    return 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100';
  }
  return 'border-neutral-200 bg-muted text-muted-foreground';
}

const PROVIDER_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  meta: 'Meta',
  mistral: 'Mistral',
  cohere: 'Cohere',
  custom: 'Custom',
};

const OUTPUT_LABEL: Record<OutputFormat, string> = {
  text: 'Plain text',
  json: 'JSON',
  markdown: 'Markdown',
};

export function GenerationConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.generation ?? DEFAULT_GEN;

  const setGeneration = useCallback(
    (next: GenerationConfig) => {
      updateStages({ generation: next });
    },
    [updateStages],
  );

  const patchGeneration = useCallback(
    (patch: Partial<GenerationConfig>) => {
      setGeneration(mergeGeneration(draft.stages.generation, patch));
    },
    [draft.stages.generation, setGeneration],
  );

  const validation = useMemo(() => GenerationConfigSchema.safeParse(cfg), [cfg]);

  const allModels = useMemo(() => listGenerationModels(), []);

  const [query, setQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [openSourceFilter, setOpenSourceFilter] = useState<string>('all');
  const [jsonModeFilter, setJsonModeFilter] = useState<string>('all');
  const [toolUseFilter, setToolUseFilter] = useState<string>('all');

  const providerOptions = useMemo(() => {
    const set = new Set(allModels.map((m) => m.provider));
    return Array.from(set).sort();
  }, [allModels]);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allModels.filter((m) => {
      if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
      if (tierFilter !== 'all' && m.tier !== tierFilter) return false;
      if (openSourceFilter === 'yes' && !m.openSource) return false;
      if (openSourceFilter === 'no' && m.openSource) return false;
      if (jsonModeFilter === 'yes' && !m.supportsJsonMode) return false;
      if (jsonModeFilter === 'no' && m.supportsJsonMode) return false;
      if (toolUseFilter === 'yes' && !m.supportsToolUse) return false;
      if (toolUseFilter === 'no' && m.supportsToolUse) return false;
      if (!q) return true;
      const hay = [m.id, m.name, m.description, ...(m.bestFor ?? []), ...(m.strengths ?? [])]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    allModels,
    providerFilter,
    tierFilter,
    openSourceFilter,
    jsonModeFilter,
    toolUseFilter,
    query,
  ]);

  const pinnedSelectionId = useMemo(() => {
    const m = getGenerationModelMeta(cfg.model);
    if (!m) return undefined;
    if (filteredModels.some((x) => x.id === m.id)) return undefined;
    return m.id;
  }, [filteredModels, cfg.model]);

  const displayModels = useMemo(() => {
    const m = getGenerationModelMeta(cfg.model);
    if (!m) return filteredModels;
    if (filteredModels.some((x) => x.id === m.id)) return filteredModels;
    return [m, ...filteredModels];
  }, [filteredModels, cfg.model]);

  const selectedMeta = useMemo(() => getGenerationModelMeta(cfg.model), [cfg.model]);

  const selectModel = (entry: GenerationModel) => {
    const fromCat = generationConfigFromCatalogEntry(entry.id, draft.stages.generation);
    if (fromCat) {
      setGeneration(mergeGeneration(draft.stages.generation, fromCat));
    }
  };

  const maxOutCap = selectedMeta?.maxOutputTokens ?? 32768;
  const tempMin = 0;
  const tempMax = 2;
  const temperature = cfg.temperature ?? DEFAULT_GEN.temperature;
  const maxTokens = cfg.maxTokens ?? DEFAULT_GEN.maxTokens;
  const clampedMaxTokens = Math.min(Math.max(64, maxTokens), maxOutCap);

  const useTopP = cfg.topP !== undefined && cfg.topP !== null;

  const fewShots = cfg.fewShotMessages ?? [];

  const addFewShot = () => {
    patchGeneration({
      fewShotMessages: [...fewShots, { role: 'user', content: 'Example user turn…' }],
    });
  };

  const updateFewShot = (index: number, patch: Partial<FewShotMessage>) => {
    patchGeneration({
      fewShotMessages: fewShots.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    });
  };

  const removeFewShot = (index: number) => {
    const next = fewShots.filter((_, i) => i !== index);
    patchGeneration({ fewShotMessages: next.length ? next : undefined });
  };

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="gen-filter-heading"
      >
        <h2 id="gen-filter-heading" className="text-foreground text-lg font-semibold">
          Discover & filter
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Search and narrow models from{' '}
          <code className="bg-muted rounded px-1">data/models/generation.json</code>. Your choice
          updates <strong className="text-foreground font-medium">draft.stages.generation</strong>{' '}
          for exports and APIs.
        </p>

        <div className="mt-4">
          <label htmlFor="gen-search" className="sr-only">
            Search generation models
          </label>
          <div className="relative">
            <Search
              className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <input
              id="gen-search"
              type="search"
              placeholder="Search by name, id, description, strengths…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring w-full rounded-md border py-2 pl-9 pr-3 text-sm shadow-sm outline-none focus-visible:ring-2"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label
              htmlFor="gen-filter-provider"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Provider
            </label>
            <select
              id="gen-filter-provider"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
            >
              <option value="all">All providers</option>
              {providerOptions.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABEL[p] ?? p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="gen-filter-tier"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Tier
            </label>
            <select
              id="gen-filter-tier"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
            >
              <option value="all">All tiers</option>
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="gen-filter-oss"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Open source
            </label>
            <select
              id="gen-filter-oss"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              value={openSourceFilter}
              onChange={(e) => setOpenSourceFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="yes">Open source only</option>
              <option value="no">Proprietary only</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="gen-filter-json"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              JSON mode
            </label>
            <select
              id="gen-filter-json"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              value={jsonModeFilter}
              onChange={(e) => setJsonModeFilter(e.target.value)}
            >
              <option value="all">Any</option>
              <option value="yes">Supports JSON mode</option>
              <option value="no">No JSON mode</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="gen-filter-tools"
              className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
            >
              Tool / function use
            </label>
            <select
              id="gen-filter-tools"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
              value={toolUseFilter}
              onChange={(e) => setToolUseFilter(e.target.value)}
            >
              <option value="all">Any</option>
              <option value="yes">Supports tools</option>
              <option value="no">No tools</option>
            </select>
          </div>
        </div>

        <p className="text-muted-foreground mt-3 text-xs" aria-live="polite">
          Showing {filteredModels.length} of {allModels.length} models
          {filteredModels.length === 0 ? ' — relax filters or clear search.' : '.'}
          {pinnedSelectionId ? (
            <>
              {' '}
              Your current selection is pinned at the top because it does not match the active
              filters.
            </>
          ) : null}
        </p>
      </section>

      <div role="radiogroup" aria-label="Generation model" className="grid gap-4 sm:grid-cols-2">
        {displayModels.map((m) => {
          const selected = cfg.model === m.id;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectModel(m)}
              className={cn(
                'flex flex-col rounded-xl border p-4 text-left shadow-sm transition-all',
                'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                selected
                  ? 'border-primary-600 bg-primary-600/[0.06] ring-primary-600 dark:bg-primary-500/10 ring-2'
                  : 'bg-card hover:border-primary-400/60 hover:bg-accent/40 border-neutral-200 dark:border-neutral-700',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'bg-background flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                    selected
                      ? 'border-primary-600 text-primary-700 dark:text-primary-200'
                      : 'border-muted',
                  )}
                  aria-hidden
                >
                  <Bot className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-foreground font-semibold">{m.name}</span>
                    {m.id === pinnedSelectionId ? (
                      <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-900 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100">
                        Current · outside filters
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        tierBadgeStyles(m.tier),
                      )}
                    >
                      {m.tier}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{m.description}</p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    <span className="tabular-nums">{(m.contextWindow / 1000).toFixed(0)}k ctx</span>
                    <span>·</span>
                    <span>{PROVIDER_LABEL[m.provider] ?? m.provider}</span>
                    <span>·</span>
                    <span className="tabular-nums">{m.latencyMs} ms est.</span>
                    {m.openSource ? (
                      <>
                        <span>·</span>
                        <span>Open source</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
                    selected
                      ? 'border-primary-600 bg-primary-600 text-primary-foreground'
                      : 'border-muted bg-muted/50 text-transparent',
                  )}
                  aria-hidden
                >
                  <Check className="h-4 w-4" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedMeta ? (
        <section
          className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
          aria-labelledby="gen-detail-heading"
        >
          <h2 id="gen-detail-heading" className="text-foreground text-lg font-semibold">
            About this model
          </h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Strengths
              </h3>
              <ul className="text-foreground mt-2 list-inside list-disc text-sm">
                {selectedMeta.strengths.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-3 text-sm">
              <div className="border-border flex justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">Context window</span>
                <span className="font-medium tabular-nums">
                  {selectedMeta.contextWindow.toLocaleString()} tokens
                </span>
              </div>
              <div className="border-border flex justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">Max output (catalog)</span>
                <span className="font-medium tabular-nums">
                  {selectedMeta.maxOutputTokens.toLocaleString()}
                </span>
              </div>
              <div className="border-border flex justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">Cost / 1M input (USD)</span>
                <span className="font-medium tabular-nums">
                  {selectedMeta.costInput.toFixed(2)}
                </span>
              </div>
              <div className="border-border flex justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">Cost / 1M output (USD)</span>
                <span className="font-medium tabular-nums">
                  {selectedMeta.costOutput.toFixed(2)}
                </span>
              </div>
              <div className="border-border flex flex-wrap justify-between gap-2 border-b pb-2">
                <span className="text-muted-foreground">Capabilities</span>
                <span className="max-w-[60%] text-right text-xs">
                  {selectedMeta.supportsStreaming ? 'Streaming · ' : ''}
                  {selectedMeta.supportsToolUse ? 'Tools · ' : ''}
                  {selectedMeta.supportsJsonMode ? 'JSON mode' : ''}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Best for</span>
                <span className="max-w-[60%] text-right text-xs">
                  {selectedMeta.bestFor.join(', ')}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="gen-params-heading"
      >
        <h2 id="gen-params-heading" className="text-foreground text-lg font-semibold">
          Inference parameters
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Temperature, max tokens, optional top-p, system prompt, and output format are validated by{' '}
          <strong className="text-foreground font-medium">GenerationConfigSchema</strong>. Max
          tokens cannot exceed the selected model&apos;s catalog{' '}
          <strong className="text-foreground font-medium">maxOutputTokens</strong> (
          {maxOutCap.toLocaleString()}).
        </p>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="gen-temp" className="text-foreground text-sm font-medium">
                Temperature
              </label>
              <span className="text-muted-foreground text-sm tabular-nums">
                {temperature.toFixed(2)}
              </span>
            </div>
            <input
              id="gen-temp"
              type="range"
              min={tempMin}
              max={tempMax}
              step={0.05}
              value={temperature}
              onChange={(e) => patchGeneration({ temperature: Number(e.target.value) })}
              className="accent-primary-600 h-2 w-full cursor-pointer"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="gen-max-tok" className="text-foreground text-sm font-medium">
                Max output tokens
              </label>
              <span className="text-muted-foreground text-sm tabular-nums">{clampedMaxTokens}</span>
            </div>
            <input
              id="gen-max-tok"
              type="range"
              min={64}
              max={maxOutCap}
              step={1}
              value={clampedMaxTokens}
              onChange={(e) => patchGeneration({ maxTokens: Number(e.target.value) })}
              className="accent-primary-600 h-2 w-full cursor-pointer"
            />
          </div>

          <div className="border-border bg-muted/20 rounded-lg border px-3 py-3">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={useTopP}
                onChange={(e) => {
                  if (e.target.checked) {
                    patchGeneration({ topP: cfg.topP ?? 0.95 });
                  } else {
                    patchGeneration({ topP: undefined });
                  }
                }}
                className="border-input mt-1 rounded"
              />
              <span>
                <span className="text-foreground font-medium">Use nucleus sampling (top-p)</span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  When off, top-p is omitted so providers use their default nucleus behavior.
                </span>
              </span>
            </label>
            {useTopP ? (
              <div className="mt-4 space-y-2 pl-7">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="gen-topp" className="text-foreground text-sm">
                    Top-p
                  </label>
                  <span className="text-muted-foreground text-sm tabular-nums">
                    {(cfg.topP ?? 0.95).toFixed(2)}
                  </span>
                </div>
                <input
                  id="gen-topp"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={cfg.topP ?? 0.95}
                  onChange={(e) => patchGeneration({ topP: Number(e.target.value) })}
                  className="accent-primary-600 h-2 w-full cursor-pointer"
                />
              </div>
            ) : null}
          </div>

          <div>
            <label htmlFor="gen-format" className="text-foreground text-sm font-medium">
              Output format
            </label>
            <select
              id="gen-format"
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 sm:max-w-xs"
              value={cfg.outputFormat ?? 'markdown'}
              onChange={(e) => patchGeneration({ outputFormat: e.target.value as OutputFormat })}
            >
              {(Object.keys(OUTPUT_LABEL) as OutputFormat[]).map((k) => (
                <option key={k} value={k}>
                  {OUTPUT_LABEL[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gen-system" className="text-foreground text-sm font-medium">
              System prompt (optional)
            </label>
            <textarea
              id="gen-system"
              rows={5}
              placeholder="Instructions for the assistant, e.g. cite sources, tone, safety rules…"
              value={cfg.systemPrompt ?? ''}
              onChange={(e) =>
                patchGeneration({
                  systemPrompt: e.target.value.trim() === '' ? undefined : e.target.value,
                })
              }
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Max 10,000 characters per pipeline schema.
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Model id</dt>
            <dd className="text-foreground mt-1 font-mono text-xs">{cfg.model}</dd>
          </div>
          <div className="border-border bg-muted/20 rounded-lg border px-3 py-2">
            <dt className="text-muted-foreground text-xs uppercase tracking-wide">Provider</dt>
            <dd className="text-foreground mt-1">{PROVIDER_LABEL[cfg.provider] ?? cfg.provider}</dd>
          </div>
        </dl>
      </section>

      <section
        className="bg-card rounded-xl border border-neutral-200 p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="gen-prompt-heading"
      >
        <h2 id="gen-prompt-heading" className="text-foreground text-lg font-semibold">
          Prompt engineering
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Persona, optional few-shot turns, and citation grounding are passed through to{' '}
          <strong className="text-foreground font-medium">GenerationService</strong> on guarded RAG
          and exports.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="gen-persona" className="text-foreground text-sm font-medium">
              Persona (optional)
            </label>
            <input
              id="gen-persona"
              type="text"
              maxLength={256}
              placeholder="e.g. a concise support agent for ACME SaaS"
              value={cfg.persona ?? ''}
              onChange={(e) =>
                patchGeneration({
                  persona: e.target.value.trim() === '' ? undefined : e.target.value,
                })
              }
              className="border-input bg-background ring-offset-background focus-visible:ring-ring mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={Boolean(cfg.citationGrounding)}
              onChange={(e) => patchGeneration({ citationGrounding: e.target.checked })}
              className="border-input mt-1 rounded"
            />
            <span>
              <span className="text-foreground font-medium">Citation grounding</span>
              <span className="text-muted-foreground mt-0.5 block text-xs">
                Adds instructions to ground answers in retrieved context (best-effort; depends on
                model compliance).
              </span>
            </span>
          </label>

          <div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-foreground text-sm font-semibold">Few-shot examples</h3>
              <button
                type="button"
                onClick={addFewShot}
                disabled={fewShots.length >= 24}
                className="border-input bg-background hover:bg-accent inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium shadow-sm disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add turn
              </button>
            </div>
            {fewShots.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                No few-shot messages — optional structured priming.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {fewShots.map((shot, idx) => (
                  <li
                    key={`fs-${idx}-${shot.role}`}
                    className="border-border bg-muted/15 rounded-lg border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        className="border-input bg-background rounded-md border px-2 py-1 text-xs"
                        value={shot.role}
                        onChange={(e) =>
                          updateFewShot(idx, { role: e.target.value as FewShotMessage['role'] })
                        }
                      >
                        <option value="user">user</option>
                        <option value="assistant">assistant</option>
                        <option value="system">system</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeFewShot(idx)}
                        className="text-destructive inline-flex items-center gap-1 text-xs font-medium hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Remove
                      </button>
                    </div>
                    <textarea
                      rows={3}
                      value={shot.content}
                      onChange={(e) => updateFewShot(idx, { content: e.target.value })}
                      className="border-input bg-background mt-2 w-full rounded-md border px-3 py-2 text-sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {!validation.success ? (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-lg border px-4 py-3 text-sm"
        >
          <p className="font-medium">Configuration needs adjustment</p>
          <ul className="mt-2 list-inside list-disc text-xs">
            {validation.error.issues.slice(0, 8).map((issue) => (
              <li key={issue.path.join('.')}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground flex items-start gap-2 text-xs" aria-live="polite">
          <Layers className="mt-0.5 h-4 w-4 shrink-0 opacity-70" aria-hidden />
          <span>
            Generation settings are valid and saved with your pipeline draft (local storage).
            Runtime calls use backend{' '}
            <strong className="text-foreground font-medium">GenerationService</strong> (P2-6).
          </span>
        </p>
      )}
    </div>
  );
}
