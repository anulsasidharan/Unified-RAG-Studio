import catalogJson from '../../../../data/models/embeddings.json';

import type { EmbeddingModel } from '@/types/models';
import type { EmbeddingConfig, EmbeddingProvider } from '@/types/pipeline';

export type EmbeddingsCatalogFile = {
  version: string;
  description: string;
  models: EmbeddingModel[];
};

const catalog = catalogJson as EmbeddingsCatalogFile;

const PROVIDERS = [
  'openai',
  'cohere',
  'google',
  'huggingface',
  'nomic',
  'custom',
] as const satisfies readonly EmbeddingProvider[];

export function getEmbeddingsCatalog(): EmbeddingsCatalogFile {
  return catalog;
}

export function listEmbeddingModels(): EmbeddingModel[] {
  return catalog.models;
}

export function getEmbeddingModelMeta(id: string): EmbeddingModel | undefined {
  return catalog.models.find((m) => m.id === id);
}

export function isEmbeddingProvider(id: string): id is EmbeddingProvider {
  return (PROVIDERS as readonly string[]).includes(id);
}

/**
 * Maps a catalog entry into {@link EmbeddingConfig} fields that satisfy {@link EmbeddingConfigSchema}.
 * Does not set batchSize — callers preserve or default that separately.
 */
export function embeddingConfigFromCatalogEntry(
  modelId: string,
  options?: { batchSize?: number },
): Partial<EmbeddingConfig> | undefined {
  const meta = getEmbeddingModelMeta(modelId);
  if (!meta || !isEmbeddingProvider(meta.provider)) {
    return undefined;
  }
  const out: Partial<EmbeddingConfig> = {
    model: meta.id,
    provider: meta.provider,
    dimensions: meta.dimensions,
    maxTokens: meta.maxTokens,
  };
  if (options?.batchSize !== undefined) {
    out.batchSize = options.batchSize;
  }
  return out;
}
