// Re-export CloudProvider from pipeline so callers can import from either module
export type { CloudProvider } from './pipeline';

// ─── Cloud Native Services ───────────────────────────────────────────────────

export interface CloudNativeService {
  llm: string[];
  vectorStore: string[];
  objectStorage: string[];
  containerOrchestration: string[];
  monitoring: string[];
  secretsManagement: string[];
  computeOptions?: string[];
}

// ─── Cloud Provider Configuration ────────────────────────────────────────────

export type CloudPricingTier = 'startup' | 'growth' | 'enterprise';

export interface CloudProviderDefaults {
  /** Default vector store ID for this provider (e.g. "opensearch" for AWS) */
  vectorStore: string;
  /** Default object storage ID (e.g. "s3" for AWS) */
  objectStorage: string;
  /** Default deployment target (e.g. "ecs" for AWS) */
  deployment: string;
}

export interface CloudProviderConfig {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  description: string;
  bestFor: string[];
  strengths: string[];
  nativeServices: CloudNativeService;
  ragStudioDefaults: CloudProviderDefaults;
  compliance: string[];
  pricingTier: CloudPricingTier;
}
