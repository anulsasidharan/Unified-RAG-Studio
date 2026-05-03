import { describe, expect, it } from 'vitest';

import {
  generationConfigFromCatalogEntry,
  getGenerationCatalog,
  getGenerationModelMeta,
  isGenerationProvider,
  listGenerationModels,
} from '@/lib/generation-catalog';

describe('generation-catalog', () => {
  it('lists models from data/models/generation.json', () => {
    const models = listGenerationModels();
    expect(models.length).toBe(9);
    expect(getGenerationCatalog().models.length).toBe(9);
  });

  it('resolves known ids', () => {
    const mini = getGenerationModelMeta('gpt-4o-mini');
    expect(mini?.provider).toBe('openai');
    expect(mini?.tier).toBe('fast');
    const sonnet = getGenerationModelMeta('claude-sonnet-4-6');
    expect(sonnet?.tier).toBe('balanced');
  });

  it('flags generation providers', () => {
    expect(isGenerationProvider('openai')).toBe(true);
    expect(isGenerationProvider('anthropic')).toBe(true);
    expect(isGenerationProvider('not-a-provider')).toBe(false);
  });

  it('generationConfigFromCatalogEntry maps model + caps max tokens', () => {
    const patch = generationConfigFromCatalogEntry('gpt-4o-mini', {
      model: 'gpt-4o',
      provider: 'openai',
      temperature: 0.2,
      maxTokens: 8192,
    });
    expect(patch?.model).toBe('gpt-4o-mini');
    expect(patch?.provider).toBe('openai');
    expect(patch?.maxTokens).toBe(8192);
    const capped = generationConfigFromCatalogEntry('gemini-1.5-flash', {
      model: 'gpt-4o',
      provider: 'openai',
      temperature: 0.1,
      maxTokens: 16000,
    });
    expect(capped?.maxTokens).toBe(8192);
  });
});
