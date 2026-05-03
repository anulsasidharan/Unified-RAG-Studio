import { describe, expect, it } from 'vitest';

import {
  catalogMetricToSchemaMetric,
  getVectorStoreMeta,
  getVectorStoresCatalog,
  isVectorStoreProvider,
  listVectorStores,
  schemaMetricsForStore,
  vectorStorePatchFromCatalog,
} from '@/lib/vector-stores-catalog';

describe('vector-stores-catalog', () => {
  it('lists stores from data/vector-stores.json', () => {
    const stores = listVectorStores();
    expect(stores.length).toBe(9);
    expect(getVectorStoresCatalog().stores.length).toBe(9);
  });

  it('resolves qdrant and pinecone metadata', () => {
    const q = getVectorStoreMeta('qdrant');
    expect(q?.type).toBe('self-hosted');
    expect(q?.features.hybridSearch).toBe(true);
    const p = getVectorStoreMeta('pinecone');
    expect(p?.type).toBe('managed');
  });

  it('flags known provider ids', () => {
    expect(isVectorStoreProvider('qdrant')).toBe(true);
    expect(isVectorStoreProvider('vertex-ai-vector-search')).toBe(true);
    expect(isVectorStoreProvider('not-a-store')).toBe(false);
  });

  it('maps catalog metrics to schema metrics', () => {
    expect(catalogMetricToSchemaMetric('l2')).toBe('euclidean');
    expect(catalogMetricToSchemaMetric('ip')).toBe('dot');
    expect(catalogMetricToSchemaMetric('hamming')).toBeUndefined();
  });

  it('schemaMetricsForStore returns pipeline-safe metrics', () => {
    const faiss = getVectorStoreMeta('faiss')!;
    const m = schemaMetricsForStore(faiss);
    expect(m).toEqual(['euclidean', 'dot']);
  });

  it('vectorStorePatchFromCatalog updates provider and aligns metric', () => {
    const current = {
      provider: 'qdrant' as const,
      indexName: 'my-index',
      configuration: { metric: 'cosine' as const, replicas: 1, shards: 1 },
    };
    const patch = vectorStorePatchFromCatalog('faiss', current);
    expect(patch?.provider).toBe('faiss');
    expect(patch?.configuration?.metric).toBe('euclidean');
  });
});
