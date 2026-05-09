'use client';

import { useCallback, useMemo } from 'react';
import { UsersRound } from 'lucide-react';

import { createDefaultHumanInTheLoopConfig } from '@/lib/default-pipeline';
import { HumanInTheLoopConfigSchema } from '@/lib/validators';
import { cn } from '@/lib/utils';
import { useDesignerStore } from '@/stores/designer-store';
import type {
  HitlEscalationMode,
  HitlOrchestrationHint,
  HitlRole,
  HitlTier,
  HumanInTheLoopConfig,
} from '@/types/pipeline';

const DEFAULT_HITL = createDefaultHumanInTheLoopConfig();

function mergeHitl(current: HumanInTheLoopConfig | undefined, patch: Partial<HumanInTheLoopConfig>): HumanInTheLoopConfig {
  const base = current ?? DEFAULT_HITL;
  return {
    ...base,
    ...patch,
    placement: patch.placement ? { ...base.placement, ...patch.placement } : base.placement,
    confidence: patch.confidence ? { ...base.confidence, ...patch.confidence } : base.confidence,
    workflow: patch.workflow ? { ...base.workflow, ...patch.workflow } : base.workflow,
    advanced: patch.advanced ? { ...base.advanced, ...patch.advanced } : base.advanced,
    roles: patch.roles !== undefined ? patch.roles : base.roles,
  };
}

const ROLE_OPTIONS: { id: HitlRole; label: string; hint: string }[] = [
  { id: 'reviewer', label: 'Reviewer', hint: 'Validate responses against sources' },
  { id: 'approver', label: 'Approver', hint: 'Final sign-off before delivery' },
  { id: 'corrector', label: 'Corrector', hint: 'Edit tone or fix hallucinations' },
  { id: 'escalation_handler', label: 'Escalation handler', hint: 'Take over low-confidence queries' },
  { id: 'trainer', label: 'Trainer', hint: 'Feedback for continuous improvement' },
  { id: 'data_curator', label: 'Data curator', hint: 'Approve documents before indexing' },
];

const ESCALATION_OPTIONS: { id: HitlEscalationMode; label: string }[] = [
  { id: 'soft_warn', label: 'Soft — warn user' },
  { id: 'hard_block', label: 'Hard — require approval' },
  { id: 'silent_route', label: 'Silent — route internally' },
  { id: 'deferred_queue', label: 'Deferred — async review queue' },
  { id: 'human_takeover', label: 'Human takeover' },
];

const ORCH_OPTIONS: { id: HitlOrchestrationHint; label: string }[] = [
  { id: 'langgraph', label: 'LangGraph' },
  { id: 'temporal', label: 'Temporal' },
  { id: 'step_functions', label: 'AWS Step Functions' },
  { id: 'prefect', label: 'Prefect' },
  { id: 'camunda', label: 'Camunda' },
  { id: 'airflow', label: 'Airflow' },
];

function toggleRole(list: HitlRole[], id: HitlRole): HitlRole[] {
  if (list.includes(id)) return list.filter((r) => r !== id);
  return [...list, id];
}

export function HitlConfigurator({
  className,
}: Readonly<{
  className?: string;
}>) {
  const draft = useDesignerStore((s) => s.draft);
  const updateStages = useDesignerStore((s) => s.updateStages);

  const cfg = draft.stages.humanInTheLoop ?? DEFAULT_HITL;

  const setHitl = useCallback(
    (next: HumanInTheLoopConfig) => {
      updateStages({ humanInTheLoop: next });
    },
    [updateStages]
  );

  const patchHitl = useCallback(
    (patch: Partial<HumanInTheLoopConfig>) => {
      setHitl(mergeHitl(draft.stages.humanInTheLoop, patch));
    },
    [draft.stages.humanInTheLoop, setHitl]
  );

  const validation = useMemo(() => HumanInTheLoopConfigSchema.safeParse(cfg), [cfg]);

  const showMedium = cfg.tier !== 'simple';
  const showAdvanced = cfg.tier === 'advanced';

  const roleSet = new Set(cfg.roles);

  return (
    <div className={cn('space-y-8', className)}>
      <section
        className="rounded-xl border border-neutral-200 bg-card p-5 shadow-sm dark:border-neutral-700"
        aria-labelledby="hitl-main-heading"
      >
        <div className="flex items-start gap-3">
          <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id="hitl-main-heading" className="text-lg font-semibold text-foreground">
              Human in the loop
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Define whether runtime workflows pause for human review, where those gates sit, and how escalation behaves.
              Updates <strong className="font-medium text-foreground">draft.stages.humanInTheLoop</strong> for exports and
              pipeline YAML.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={cfg.enabled}
              onChange={(e) => patchHitl({ enabled: e.target.checked })}
              className="h-4 w-4 rounded border-input"
            />
            Enable human in the loop
          </label>
        </div>

        {cfg.enabled ? (
          <div className="mt-8 space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Capability tier</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Simple focuses on answer-time review; Medium adds confidence-driven escalation and workflow controls;
                Advanced adds orchestration hints, agentic gates, and governance-oriented flags.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['simple', 'medium', 'advanced'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => patchHitl({ tier })}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                      cfg.tier === tier
                        ? 'border-primary-600 bg-primary-600/10 text-primary-900 dark:text-primary-50'
                        : 'border-neutral-200 bg-background text-muted-foreground hover:bg-muted dark:border-neutral-600'
                    )}
                  >
                    {tier.charAt(0).toUpperCase() + tier.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Human roles</h3>
              <p className="mt-1 text-xs text-muted-foreground">Which responsibilities humans cover in this pipeline.</p>
              <ul className="mt-3 space-y-2">
                {ROLE_OPTIONS.map((r) => (
                  <li key={r.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-transparent px-2 py-2 hover:bg-muted/50">
                      <input
                        type="checkbox"
                        checked={roleSet.has(r.id)}
                        onChange={() => patchHitl({ roles: toggleRole(cfg.roles, r.id) })}
                        className="mt-1 h-4 w-4 rounded border-input"
                      />
                      <span>
                        <span className="font-medium text-foreground">{r.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{r.hint}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Placement in the pipeline</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Where humans can intervene. Combine placements for stricter governance (adds latency).
              </p>
              <ul className="mt-3 space-y-2">
                <li>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.placement.preIngestionValidation}
                      onChange={(e) =>
                        patchHitl({
                          placement: { ...cfg.placement, preIngestionValidation: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Pre-ingestion — approve documents before indexing
                  </label>
                </li>
                <li>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.placement.retrievalTime}
                      onChange={(e) =>
                        patchHitl({ placement: { ...cfg.placement, retrievalTime: e.target.checked } })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Retrieval-time — escalate weak retrieval / manual sources
                  </label>
                </li>
                <li>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.placement.generationTime}
                      onChange={(e) =>
                        patchHitl({ placement: { ...cfg.placement, generationTime: e.target.checked } })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Generation-time — review LLM answers before delivery
                  </label>
                </li>
                <li>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.placement.postResponseFeedback}
                      onChange={(e) =>
                        patchHitl({
                          placement: { ...cfg.placement, postResponseFeedback: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Post-response — capture corrections and ratings for learning loops
                  </label>
                </li>
              </ul>
            </div>

            {showMedium ? (
              <>
                <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-foreground">Confidence & escalation</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Signals that route requests to humans (implement in your confidence engine).
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm">
                      <span className="text-muted-foreground">Retriever score floor (0–1)</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={1}
                        value={cfg.confidence.retrieverScoreThreshold ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          patchHitl({
                            confidence: {
                              ...cfg.confidence,
                              retrieverScoreThreshold: v === '' ? null : Number(v),
                            },
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-muted-foreground">Reranker score floor (optional)</span>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={1}
                        value={cfg.confidence.rerankerScoreThreshold ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          patchHitl({
                            confidence: {
                              ...cfg.confidence,
                              rerankerScoreThreshold: v === '' ? null : Number(v),
                            },
                          });
                        }}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.confidence.llmUncertaintySignals}
                      onChange={(e) =>
                        patchHitl({
                          confidence: { ...cfg.confidence, llmUncertaintySignals: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Include LLM uncertainty / self-check signals in escalation
                  </label>
                  <label className="mt-4 block text-sm font-medium text-foreground">
                    Escalation mode
                    <select
                      value={cfg.confidence.escalationMode}
                      onChange={(e) =>
                        patchHitl({
                          confidence: {
                            ...cfg.confidence,
                            escalationMode: e.target.value as HitlEscalationMode,
                          },
                        })
                      }
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {ESCALATION_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                  <h3 className="text-sm font-semibold text-foreground">Review workflow</h3>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.workflow.synchronousReview}
                      onChange={(e) =>
                        patchHitl({
                          workflow: { ...cfg.workflow, synchronousReview: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Synchronous review (blocks until human responds)
                  </label>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.workflow.allowHumanEdit}
                      onChange={(e) =>
                        patchHitl({ workflow: { ...cfg.workflow, allowHumanEdit: e.target.checked } })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Allow humans to edit answers (not only approve/reject)
                  </label>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Sequential approvals (ordered roles): pick roles in the order gates should run — duplicate a role if
                    needed for multi-stage sign-off.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((r) => (
                      <button
                        key={`seq-${r.id}`}
                        type="button"
                        title="Append to approval chain"
                        onClick={() =>
                          patchHitl({
                            workflow: {
                              ...cfg.workflow,
                              sequentialApprovalRoles: [...cfg.workflow.sequentialApprovalRoles, r.id],
                            },
                          })
                        }
                        className="rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium hover:bg-muted dark:border-neutral-600"
                      >
                        + {r.label}
                      </button>
                    ))}
                  </div>
                  {cfg.workflow.sequentialApprovalRoles.length > 0 ? (
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-foreground">
                      {cfg.workflow.sequentialApprovalRoles.map((role, i) => (
                        <li key={`${role}-${i}`} className="flex flex-wrap items-center gap-2">
                          <span>{ROLE_OPTIONS.find((x) => x.id === role)?.label ?? role}</span>
                          <button
                            type="button"
                            className="text-xs text-primary-600 hover:underline dark:text-primary-400"
                            onClick={() =>
                              patchHitl({
                                workflow: {
                                  ...cfg.workflow,
                                  sequentialApprovalRoles: cfg.workflow.sequentialApprovalRoles.filter(
                                    (_, j) => j !== i
                                  ),
                                },
                              })
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No ordered chain yet — optional.</p>
                  )}
                </div>
              </>
            ) : null}

            {showAdvanced ? (
              <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
                <h3 className="text-sm font-semibold text-foreground">Advanced orchestration & governance</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hints for generated IaC/code; wire to your workflow engine in deployment.
                </p>
                <label className="mt-4 block text-sm font-medium text-foreground">
                  Preferred orchestration pattern
                  <select
                    value={cfg.advanced.orchestrationHint ?? ''}
                    onChange={(e) =>
                      patchHitl({
                        advanced: {
                          ...cfg.advanced,
                          orchestrationHint: (e.target.value || null) as HitlOrchestrationHint | null,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Not specified</option>
                    {ORCH_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.advanced.agenticToolApproval}
                      onChange={(e) =>
                        patchHitl({
                          advanced: { ...cfg.advanced, agenticToolApproval: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Agentic tool / API call approval
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.advanced.multiReviewerConsensus}
                      onChange={(e) =>
                        patchHitl({
                          advanced: { ...cfg.advanced, multiReviewerConsensus: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Multi-reviewer consensus
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.advanced.auditLoggingRequired}
                      onChange={(e) =>
                        patchHitl({
                          advanced: { ...cfg.advanced, auditLoggingRequired: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Immutable audit logging required
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.advanced.humanGuidedRetrieval}
                      onChange={(e) =>
                        patchHitl({
                          advanced: { ...cfg.advanced, humanGuidedRetrieval: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Human-guided retrieval overrides
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cfg.advanced.activeLearningFeedback}
                      onChange={(e) =>
                        patchHitl({
                          advanced: { ...cfg.advanced, activeLearningFeedback: e.target.checked },
                        })
                      }
                      className="h-4 w-4 rounded border-input"
                    />
                    Active learning / feedback datasets
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {!validation.success ? (
          <p className="mt-4 text-xs text-destructive" role="alert">
            Configuration does not match the schema — check numeric thresholds (0–1).
          </p>
        ) : null}
      </section>
    </div>
  );
}
