import catalogJson from '../../../../data/models/rerankers.json';

export type RerankerProvider = 'cohere' | 'huggingface' | 'custom';

export type RerankerCatalogRow = {
  id: string;
  name: string;
  provider: string;
  description: string;
  bestFor: string[];
  quality: string;
  speed: string;
  modelCard?: string;
};

type RerankersFile = {
  version: string;
  description: string;
  models: RerankerCatalogRow[];
};

const catalog = catalogJson as RerankersFile;

export function listRerankers(): RerankerCatalogRow[] {
  return catalog.models;
}

export function mapCatalogProviderToSchema(pid: string): RerankerProvider {
  if (pid === 'cohere') return 'cohere';
  if (pid === 'huggingface') return 'huggingface';
  return 'custom';
}

export function getRerankerRow(id: string): RerankerCatalogRow | undefined {
  return catalog.models.find((m) => m.id === id);
}
