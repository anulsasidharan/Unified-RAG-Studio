import { describe, expect, it } from 'vitest';

import {
  chunkingDefaultsFromCatalog,
  getChunkingStrategyMeta,
  listChunkingStrategies,
} from '@/lib/chunking-strategies-catalog';

describe('chunking-strategies-catalog', () => {
  it('lists seven strategies from data/chunking-strategies.json', () => {
    const list = listChunkingStrategies();
    expect(list).toHaveLength(7);
    expect(list.map((s) => s.id)).toContain('recursive-character');
  });

  it('returns meta for each strategy id', () => {
    const meta = getChunkingStrategyMeta('semantic');
    expect(meta?.name).toMatch(/Semantic/i);
    expect(meta?.implementationComplexity).toBe('high');
  });

  it('chunkingDefaultsFromCatalog clamps sizes into schema bounds', () => {
    const d = chunkingDefaultsFromCatalog('sentence-based');
    expect(d.chunkSize).toBeGreaterThanOrEqual(128);
    expect(d.chunkSize).toBeLessThanOrEqual(4096);
    expect(d.chunkOverlap ?? 0).toBeLessThan(d.chunkSize!);
  });

  it('preserves recursive-character separators from catalog when present', () => {
    const d = chunkingDefaultsFromCatalog('recursive-character');
    expect(Array.isArray(d.separators)).toBe(true);
    expect(d.separators?.length).toBeGreaterThan(0);
  });
});
