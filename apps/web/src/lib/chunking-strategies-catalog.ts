import catalogJson from '../../../../data/chunking-strategies.json';

import type { ChunkingStrategyMeta } from '@/types/models';
import type { ChunkingConfig, ChunkingStrategy } from '@/types/pipeline';

export type ChunkingStrategiesCatalogFile = {
  version: string;
  description: string;
  strategies: ChunkingStrategyMeta[];
};

const catalog = catalogJson as ChunkingStrategiesCatalogFile;

const STRATEGY_IDS = [
  'fixed-size',
  'recursive-character',
  'semantic',
  'markdown-header',
  'sentence-based',
  'paragraph-based',
  'code-aware',
  'token-aware',
] as const satisfies readonly ChunkingStrategy[];

export function getChunkingStrategiesCatalog(): ChunkingStrategiesCatalogFile {
  return catalog;
}

export function listChunkingStrategies(): ChunkingStrategyMeta[] {
  return catalog.strategies;
}

export function isChunkingStrategyId(id: string): id is ChunkingStrategy {
  return (STRATEGY_IDS as readonly string[]).includes(id);
}

export function getChunkingStrategyMeta(id: ChunkingStrategy): ChunkingStrategyMeta | undefined {
  return catalog.strategies.find((s) => s.id === id);
}

const MIN_CHUNK = 128;
const MAX_CHUNK = 4096;
const MAX_OVERLAP = 1024;

/**
 * Maps catalog defaults into {@link ChunkingConfig} numbers that satisfy {@link ChunkingConfigSchema}.
 * Catalog entries may use smaller symbolic sizes (e.g. sentence counts); those are lifted to the minimum token budget.
 */
export function chunkingDefaultsFromCatalog(strategy: ChunkingStrategy): Partial<ChunkingConfig> {
  const meta = getChunkingStrategyMeta(strategy);
  if (!meta) {
    return {};
  }

  const d = meta.defaultConfig as unknown as Record<string, unknown>;
  let chunkSize =
    typeof d.chunkSize === 'number' && Number.isFinite(d.chunkSize)
      ? Math.round(d.chunkSize)
      : 512;
  if (chunkSize < MIN_CHUNK) {
    chunkSize = MIN_CHUNK;
  }
  if (chunkSize > MAX_CHUNK) {
    chunkSize = MAX_CHUNK;
  }

  let chunkOverlap =
    typeof d.chunkOverlap === 'number' && Number.isFinite(d.chunkOverlap)
      ? Math.round(d.chunkOverlap)
      : 50;
  chunkOverlap = Math.max(0, Math.min(MAX_OVERLAP, chunkOverlap));
  if (chunkOverlap >= chunkSize) {
    chunkOverlap = Math.max(0, chunkSize - 1);
  }

  const out: Partial<ChunkingConfig> = {
    strategy,
    chunkSize,
    chunkOverlap,
  };

  if (Array.isArray(d.separators) && d.separators.every((x) => typeof x === 'string')) {
    out.separators = [...(d.separators as string[])];
  }

  return out;
}
