import catalogJson from '../../../../data/vector-stores.json';

import type { VectorStoreType } from '@/types/models';
import type { SimilarityMetric, VectorStoreConfig, VectorStoreProvider } from '@/types/pipeline';

export type VectorStoreCatalogRow = {
  id: string;
  name: string;
  type: VectorStoreType;
  description: string;
  bestFor: string[];
  pros: string[];
  cons: string[];
  pricing: Record<string, unknown>;
  cloudNative: {
    aws: boolean;
    gcp: boolean;
    azure: boolean;
    ownCloud?: boolean;
  };
  features: Record<string, boolean | undefined>;
  maxVectors: string;
  supportedMetrics: string[];
  embeddedMode?: boolean;
};

export type VectorStoresCatalogFile = {
  version: string;
  description: string;
  stores: VectorStoreCatalogRow[];
};

const catalog = catalogJson as VectorStoresCatalogFile;

const STORE_IDS = [
  'pinecone',
  'weaviate',
  'qdrant',
  'chroma',
  'faiss',
  'opensearch',
  'vertex-ai-vector-search',
  'azure-ai-search',
  'pgvector',
] as const satisfies readonly VectorStoreProvider[];

export function getVectorStoresCatalog(): VectorStoresCatalogFile {
  return catalog;
}

export function listVectorStores(): VectorStoreCatalogRow[] {
  return catalog.stores;
}

export function getVectorStoreMeta(id: string): VectorStoreCatalogRow | undefined {
  return catalog.stores.find((s) => s.id === id);
}

export function isVectorStoreProvider(id: string): id is VectorStoreProvider {
  return (STORE_IDS as readonly string[]).includes(id);
}

/** Maps catalog metric strings to pipeline {@link SimilarityMetric} where possible. */
export function catalogMetricToSchemaMetric(raw: string): SimilarityMetric | undefined {
  const x = raw.toLowerCase();
  if (x === 'cosine') return 'cosine';
  if (x === 'euclidean' || x === 'l2') return 'euclidean';
  if (x === 'dot' || x === 'ip') return 'dot';
  return undefined;
}

/** Metrics valid for {@link VectorStoreConfigSchema} that this store advertises. */
export function schemaMetricsForStore(meta: VectorStoreCatalogRow): SimilarityMetric[] {
  const out = new Set<SimilarityMetric>();
  for (const m of meta.supportedMetrics) {
    const s = catalogMetricToSchemaMetric(m);
    if (s) out.add(s);
  }
  const list = Array.from(out);
  return list.length > 0 ? list : (['cosine'] as SimilarityMetric[]);
}

/**
 * When switching catalog entries, keep index/replicas/shards where possible and align metric to a value the store supports.
 */
export function vectorStorePatchFromCatalog(
  storeId: string,
  current: VectorStoreConfig
): Partial<VectorStoreConfig> | undefined {
  const meta = getVectorStoreMeta(storeId);
  if (!meta || !isVectorStoreProvider(meta.id)) return undefined;

  const allowed = schemaMetricsForStore(meta);
  const prevMetric = current.configuration.metric;
  const metric =
    prevMetric && allowed.includes(prevMetric) ? prevMetric : allowed[0] ?? 'cosine';

  return {
    provider: meta.id,
    configuration: {
      ...current.configuration,
      metric,
    },
  };
}
