import { describe, expect, it } from 'vitest';

import {
  embeddingConfigFromCatalogEntry,
  getEmbeddingModelMeta,
  getEmbeddingsCatalog,
  isEmbeddingProvider,
  listEmbeddingModels,
} from '@/lib/embeddings-catalog';

describe('embeddings-catalog', () => {
  it('lists models from data/models/embeddings.json', () => {
    const models = listEmbeddingModels();
    expect(models.length).toBe(10);
    const cat = getEmbeddingsCatalog();
    expect(cat.models.length).toBe(10);
  });

  it('resolves known OpenAI and Hugging Face entries', () => {
    const small = getEmbeddingModelMeta('text-embedding-3-small');
    expect(small?.provider).toBe('openai');
    expect(small?.dimensions).toBe(1536);
    const bge = getEmbeddingModelMeta('bge-large-en');
    expect(bge?.provider).toBe('huggingface');
    expect(bge?.openSource).toBe(true);
  });

  it('flags embedding API providers', () => {
    expect(isEmbeddingProvider('openai')).toBe(true);
    expect(isEmbeddingProvider('nomic')).toBe(true);
    expect(isEmbeddingProvider('not-a-provider')).toBe(false);
  });

  it('embeddingConfigFromCatalogEntry maps schema fields and preserves batch size', () => {
    const partial = embeddingConfigFromCatalogEntry('nomic-embed-text', { batchSize: 64 });
    expect(partial).toMatchObject({
      model: 'nomic-embed-text',
      provider: 'nomic',
      dimensions: 768,
      maxTokens: 8192,
      batchSize: 64,
    });
  });

  it('returns undefined for unknown model id', () => {
    expect(embeddingConfigFromCatalogEntry('unknown-model-xyz')).toBeUndefined();
  });
});
