import catalogJson from '../../../../data/retrieval-strategies.json';

import type { RetrievalStrategyMeta } from '@/types/models';
import type {
  EnsembleMemberStrategy,
  HybridSearchConfig,
  RetrievalConfig,
  RetrievalStrategy,
} from '@/types/pipeline';

export type RetrievalStrategiesCatalogFile = {
  version: string;
  description: string;
  strategies: RetrievalStrategyMeta[];
};

const catalog = catalogJson as RetrievalStrategiesCatalogFile;

const STRATEGY_IDS = [
  'similarity',
  'mmr',
  'hybrid',
  'parent-child',
  'multi-query',
  'ensemble',
] as const satisfies readonly RetrievalStrategy[];

export function getRetrievalStrategiesCatalog(): RetrievalStrategiesCatalogFile {
  return catalog;
}

export function listRetrievalStrategies(): RetrievalStrategyMeta[] {
  return catalog.strategies;
}

export function isRetrievalStrategyId(id: string): id is RetrievalStrategy {
  return (STRATEGY_IDS as readonly string[]).includes(id);
}

export function getRetrievalStrategyMeta(id: RetrievalStrategy): RetrievalStrategyMeta | undefined {
  return catalog.strategies.find((s) => s.id === id);
}

/**
 * Maps catalog defaults into fields that satisfy {@link RetrievalConfigSchema} for the given strategy.
 */
export function retrievalDefaultsFromCatalog(
  strategy: RetrievalStrategy,
  opts?: { fallbackLlmModel?: string },
): Partial<RetrievalConfig> {
  const meta = getRetrievalStrategyMeta(strategy);
  const fallbackLlm = opts?.fallbackLlmModel ?? 'gpt-4o-mini';
  if (!meta) {
    return { strategy };
  }

  const d = meta.defaultConfig as Record<string, unknown>;
  const out: Partial<RetrievalConfig> = { strategy };

  const topK =
    typeof d.topK === 'number' && Number.isFinite(d.topK)
      ? Math.min(100, Math.max(1, Math.round(d.topK)))
      : undefined;
  if (topK !== undefined) {
    out.topK = topK;
  }

  if (strategy === 'hybrid') {
    const alpha =
      typeof d.alpha === 'number' && Number.isFinite(d.alpha)
        ? Math.min(1, Math.max(0, d.alpha))
        : 0.5;
    const hybridSearch: HybridSearchConfig = { alpha, fusion: 'rrf' };
    out.hybridSearch = hybridSearch;
  } else {
    out.hybridSearch = undefined;
  }

  if (strategy === 'mmr') {
    const rawFetch =
      typeof d.fetchK === 'number' && Number.isFinite(d.fetchK) ? Math.round(d.fetchK) : 20;
    const fetchK = Math.min(200, Math.max(5, rawFetch));
    const rawLambda =
      typeof d.lambdaMult === 'number' && Number.isFinite(d.lambdaMult)
        ? Number(d.lambdaMult)
        : 0.5;
    const lambdaMult = Math.min(1, Math.max(0, rawLambda));
    out.mmrFetchK = fetchK;
    out.mmrLambdaMult = lambdaMult;
  } else {
    out.mmrFetchK = undefined;
    out.mmrLambdaMult = undefined;
  }

  if (strategy === 'ensemble') {
    const rawList = Array.isArray(d.strategies) ? d.strategies : ['similarity', 'hybrid'];
    const allowed = new Set<EnsembleMemberStrategy>([
      'similarity',
      'mmr',
      'hybrid',
      'multi-query',
      'parent-child',
    ]);
    const ensembleStrategies = rawList
      .map((x) => (String(x) === 'bm25' ? 'hybrid' : String(x)))
      .filter((x): x is EnsembleMemberStrategy =>
        allowed.has(x as EnsembleMemberStrategy),
      ) as EnsembleMemberStrategy[];
    out.ensembleStrategies =
      ensembleStrategies.length > 0 ? ensembleStrategies : ['similarity', 'hybrid'];
    const rawRrf =
      typeof d.rrfK === 'number' && Number.isFinite(d.rrfK) ? Math.round(d.rrfK as number) : 60;
    out.ensembleRrfK = Math.min(120, Math.max(1, rawRrf));
  } else {
    out.ensembleStrategies = undefined;
    out.ensembleRrfK = undefined;
  }

  if (strategy === 'parent-child') {
    let child =
      typeof d.childChunkSize === 'number' && Number.isFinite(d.childChunkSize)
        ? Math.round(d.childChunkSize)
        : 256;
    let parent =
      typeof d.parentChunkSize === 'number' && Number.isFinite(d.parentChunkSize)
        ? Math.round(d.parentChunkSize)
        : 1024;
    child = Math.min(4096, Math.max(64, child));
    parent = Math.min(4096, Math.max(512, parent));
    if (parent <= child) {
      parent = Math.min(4096, child + 256);
    }
    out.parentChildConfig = { childChunkSize: child, parentChunkSize: parent };
  } else {
    out.parentChildConfig = undefined;
  }

  if (strategy === 'multi-query') {
    const rawN =
      typeof d.numQueries === 'number' && Number.isFinite(d.numQueries)
        ? Math.round(d.numQueries)
        : 3;
    const numVariants = Math.min(10, Math.max(2, rawN));
    out.multiQueryConfig = {
      numVariants,
      llmModel: fallbackLlm,
    };
  } else {
    out.multiQueryConfig = undefined;
  }

  if (strategy === 'similarity' || strategy === 'mmr' || strategy === 'ensemble') {
    const st = d.scoreThreshold;
    if (st === null || st === undefined) {
      out.scoreThreshold = null;
    } else if (typeof st === 'number' && Number.isFinite(st)) {
      out.scoreThreshold = Math.min(1, Math.max(0, st));
    }
  }

  return out;
}
