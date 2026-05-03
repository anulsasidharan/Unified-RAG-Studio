import { createDefaultGuardrailsConfig } from '@/lib/default-pipeline';
import type { GuardrailsConfig } from '@/types/pipeline';

export function resolveGuardrailsConfig(value?: GuardrailsConfig | null): GuardrailsConfig {
  return value ?? createDefaultGuardrailsConfig();
}

/** Compact subtitle for Mermaid guardrail node (no raw newlines — caller runs `q()`). */
export function guardrailPolicyMermaidSubtitle(policy?: GuardrailsConfig | null): string {
  const c = resolveGuardrailsConfig(policy);
  const inShort = c.input.enabled
    ? [
        c.input.piiRedactionEnabled && 'PII',
        c.input.promptInjectionBlockEnabled && 'inj',
        c.input.toxicityBlockEnabled && 'tox',
      ]
        .filter(Boolean)
        .join('/') || 'on'
    : 'off';
  const retShort = c.retrieval.enabled
    ? [
        c.retrieval.contentFilterEnabled && 'filter',
        c.retrieval.sourceValidationEnabled && 'src',
        c.retrieval.biasDetectionEnabled && 'bias',
      ]
        .filter(Boolean)
        .join('/') || 'on'
    : 'off';
  const outShort = c.output.enabled
    ? [
        c.output.hallucinationHeuristicEnabled && 'hallu',
        c.output.factualityCheckEnabled && 'fact',
        c.output.citationVerificationEnabled && 'cite',
      ]
        .filter(Boolean)
        .join('/') || 'on'
    : 'off';
  return `in ${inShort} · ret ${retShort} · out ${outShort}`;
}

/** One-line bullet for pipeline highlights / review. */
export function guardrailsHighlightBullet(policy?: GuardrailsConfig | null): string {
  const c = resolveGuardrailsConfig(policy);
  const layer = (on: boolean) => (on ? 'on' : 'off');
  return `Guardrails: input ${layer(c.input.enabled)} · retrieval ${layer(c.retrieval.enabled)} · output ${layer(
    c.output.enabled
  )}`;
}

/** Short hint for stage navigator under “Guardrails”. */
export function guardrailsNavigatorHint(policy?: GuardrailsConfig | null): string {
  const c = resolveGuardrailsConfig(policy);
  const bits = [c.input.enabled && 'In', c.retrieval.enabled && 'Ret', c.output.enabled && 'Out'].filter(Boolean);
  return bits.length === 0 ? 'All off' : bits.join('/') + ' layers';
}
