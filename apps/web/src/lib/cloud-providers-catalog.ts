import catalogJson from '../../../../data/cloud-providers.json';

import type { CloudProviderMeta } from '@/types/models';
import type { CloudProvider } from '@/types/pipeline';

export type CloudProvidersCatalogFile = {
  version: string;
  description: string;
  providers: CloudProviderMeta[];
};

const catalog = catalogJson as CloudProvidersCatalogFile;

const CLOUD_IDS: readonly CloudProvider[] = ['aws', 'gcp', 'azure', 'multi-cloud'];

export function getCloudProvidersCatalog(): CloudProvidersCatalogFile {
  return catalog;
}

export function listCloudProviders(): CloudProviderMeta[] {
  return catalog.providers;
}

export function isCloudProviderId(id: string): id is CloudProvider {
  return (CLOUD_IDS as readonly string[]).includes(id);
}

export function getCloudProviderMeta(id: CloudProvider): CloudProviderMeta | undefined {
  return catalog.providers.find((p) => p.id === id);
}
