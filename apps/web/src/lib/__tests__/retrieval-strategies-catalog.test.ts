import { describe, expect, it } from 'vitest';

import {
  getRetrievalStrategyMeta,
  getRetrievalStrategiesCatalog,
  isRetrievalStrategyId,
  listRetrievalStrategies,
  retrievalDefaultsFromCatalog,
} from '@/lib/retrieval-strategies-catalog';

describe('retrieval-strategies-catalog', () => {
  it('lists strategies from data/retrieval-strategies.json', () => {
    const rows = listRetrievalStrategies();
    expect(rows.length).toBe(6);
    expect(getRetrievalStrategiesCatalog().strategies.length).toBe(6);
  });

  it('flags known strategy ids', () => {
    expect(isRetrievalStrategyId('hybrid')).toBe(true);
    expect(isRetrievalStrategyId('parent-child')).toBe(true);
    expect(isRetrievalStrategyId('not-a-strategy')).toBe(false);
  });

  it('resolves hybrid and multi-query metadata', () => {
    const h = getRetrievalStrategyMeta('hybrid');
    expect(h?.implementationComplexity).toBe('high');
    const mq = getRetrievalStrategyMeta('multi-query');
    expect(mq?.id).toBe('multi-query');
  });

  it('retrievalDefaultsFromCatalog sets schema fields per strategy', () => {
    const sim = retrievalDefaultsFromCatalog('similarity');
    expect(sim.strategy).toBe('similarity');
    expect(sim.topK).toBeDefined();

    const hybrid = retrievalDefaultsFromCatalog('hybrid');
    expect(hybrid.hybridSearch?.alpha).toBeDefined();

    const mq = retrievalDefaultsFromCatalog('multi-query', { fallbackLlmModel: 'gpt-4o' });
    expect(mq.multiQueryConfig?.llmModel).toBe('gpt-4o');
    expect(mq.multiQueryConfig?.numVariants).toBeGreaterThanOrEqual(2);
  });
});
