import catalogJson from '../../../../data/models/generation.json';

import { DEFAULT_MAX_TOKENS } from '@/lib/constants';
import type { GenerationModel } from '@/types/models';
import type { GenerationConfig, GenerationProvider } from '@/types/pipeline';

export type GenerationCatalogFile = {
  version: string;
  description: string;
  models: GenerationModel[];
};

const catalog = catalogJson as GenerationCatalogFile;

const PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'meta',
  'mistral',
  'cohere',
  'custom',
] as const satisfies readonly GenerationProvider[];

export function getGenerationCatalog(): GenerationCatalogFile {
  return catalog;
}

export function listGenerationModels(): GenerationModel[] {
  return catalog.models;
}

export function getGenerationModelMeta(id: string): GenerationModel | undefined {
  return catalog.models.find((m) => m.id === id);
}

export function isGenerationProvider(id: string): id is GenerationProvider {
  return (PROVIDERS as readonly string[]).includes(id);
}

/**
 * Maps a catalog entry into {@link GenerationConfig} fields that satisfy {@link GenerationConfigSchema}.
 * Preserves temperature, topP, systemPrompt, outputFormat from the current draft where applicable.
 */
export function generationConfigFromCatalogEntry(
  modelId: string,
  current: GenerationConfig | undefined,
  options?: { maxTokensFloor?: number },
): Partial<GenerationConfig> | undefined {
  const meta = getGenerationModelMeta(modelId);
  if (!meta || !isGenerationProvider(meta.provider)) {
    return undefined;
  }
  const floor = options?.maxTokensFloor ?? 64;
  const prevMax = current?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const capped = Math.min(Math.max(floor, prevMax), meta.maxOutputTokens);
  return {
    model: meta.id,
    provider: meta.provider,
    maxTokens: capped,
  };
}
