import type { HumanInTheLoopConfig } from '@/types/pipeline';

/** Short label for stage navigator under “Human in the Loop”. */
export function hitlNavigatorHint(hitl?: HumanInTheLoopConfig | null): string {
  if (!hitl?.enabled) return 'Off';
  const t = hitl.tier;
  const places: string[] = [];
  const p = hitl.placement;
  if (p.preIngestionValidation) places.push('ingest');
  if (p.retrievalTime) places.push('retrieve');
  if (p.generationTime) places.push('generate');
  if (p.postResponseFeedback) places.push('feedback');
  const placeShort = places.length ? places.join('/') : 'none';
  return `${t} · ${placeShort}`;
}

/** One-line bullet for pipeline highlights / review card. */
export function hitlHighlightBullet(hitl?: HumanInTheLoopConfig | null): string {
  if (!hitl?.enabled) return 'Human in the loop: off';
  const roles = hitl.roles?.length ? `${hitl.roles.length} role(s)` : 'no roles';
  return `Human in the loop: ${hitl.tier} · ${roles}`;
}

/** Compact subtitle for Mermaid HITL nodes (caller runs `q()`). */
export function hitlPlacementMermaidSubtitle(hitl?: HumanInTheLoopConfig | null): string {
  if (!hitl?.enabled) return 'off';
  const p = hitl.placement;
  const bits: string[] = [];
  if (p.preIngestionValidation) bits.push('pre-index');
  if (p.retrievalTime) bits.push('retrieve');
  if (p.generationTime) bits.push('answer');
  if (p.postResponseFeedback) bits.push('feedback');
  return bits.length ? bits.join(',') : 'tier ' + hitl.tier;
}
