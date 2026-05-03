import { describe, expect, it } from 'vitest';

import {
  getCloudProvidersCatalog,
  isCloudProviderId,
  listCloudProviders,
} from '@/lib/cloud-providers-catalog';
import type { CloudProvider } from '@/types/pipeline';

describe('cloud-providers-catalog', () => {
  it('loads catalog with four providers', () => {
    const cat = getCloudProvidersCatalog();
    expect(cat.providers).toHaveLength(4);
    expect(cat.version).toMatch(/\d+\.\d+\.\d+/);
  });

  it('maps JSON ids to pipeline CloudProvider union', () => {
    const ids = listCloudProviders().map((p) => p.id);
    for (const id of ids) {
      expect(isCloudProviderId(id)).toBe(true);
    }
    expect(ids.sort()).toEqual(['aws', 'azure', 'gcp', 'multi-cloud']);
  });

  it('exposes ragStudioDefaults for each provider', () => {
    for (const p of listCloudProviders()) {
      expect(p.ragStudioDefaults.vectorStore).toBeTruthy();
      expect(p.ragStudioDefaults.objectStorage).toBeTruthy();
      expect(p.ragStudioDefaults.deployment).toBeTruthy();
      expect(p.nativeServices.llm.length).toBeGreaterThan(0);
    }
  });

  it('rejects arbitrary strings as CloudProvider', () => {
    expect(isCloudProviderId('oracle')).toBe(false);
    expect(isCloudProviderId('')).toBe(false);
  });

  it('narrows id when true', () => {
    const id = listCloudProviders()[0]!.id;
    if (isCloudProviderId(id)) {
      const _: CloudProvider = id;
      expect(_).toBeDefined();
    }
  });
});
