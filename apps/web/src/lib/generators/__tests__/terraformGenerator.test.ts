import { describe, it, expect } from 'vitest';
import { generateTerraform } from '../terraformGenerator';
import { minimalConfig, fullConfig, azureConfig } from './fixtures';

describe('generateTerraform', () => {
  it('starts with a comment header', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toMatch(/^# RAG Studio/);
  });

  it('includes pipeline name in header', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('Test RAG Pipeline');
  });

  // ── AWS ───────────────────────────────────────────────────────────────────

  it('uses AWS provider for aws cloud', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('provider "aws"');
    expect(result).toContain('hashicorp/aws');
  });

  it('includes ECS cluster for aws cloud', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('aws_ecs_cluster');
  });

  it('includes Qdrant ECS task for aws + qdrant vector store', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('qdrant/qdrant:latest');
  });

  it('includes Secrets Manager for aws', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('aws_secretsmanager_secret');
  });

  it('outputs api_endpoint for aws', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('output "api_endpoint"');
    expect(result).toContain('aws_lb');
  });

  // ── GCP ───────────────────────────────────────────────────────────────────

  it('uses Google provider for gcp cloud', () => {
    const result = generateTerraform(fullConfig);
    expect(result).toContain('provider "google"');
    expect(result).toContain('hashicorp/google');
  });

  it('includes Cloud Run service for gcp', () => {
    const result = generateTerraform(fullConfig);
    expect(result).toContain('google_cloud_run_v2_service');
  });

  it('includes Pinecone secret in Secret Manager for gcp + pinecone', () => {
    const result = generateTerraform(fullConfig);
    expect(result).toContain('google_secret_manager_secret');
    expect(result).toContain('pinecone');
  });

  it('outputs Cloud Run URI for gcp', () => {
    const result = generateTerraform(fullConfig);
    expect(result).toContain('google_cloud_run_v2_service.api.uri');
  });

  // ── Azure ─────────────────────────────────────────────────────────────────

  it('uses Azure provider for azure cloud', () => {
    const result = generateTerraform(azureConfig);
    expect(result).toContain('provider "azurerm"');
    expect(result).toContain('hashicorp/azurerm');
  });

  it('includes Container App Environment for azure', () => {
    const result = generateTerraform(azureConfig);
    expect(result).toContain('azurerm_container_app_environment');
  });

  it('includes Key Vault for azure secrets', () => {
    const result = generateTerraform(azureConfig);
    expect(result).toContain('azurerm_key_vault');
  });

  it('includes azure-ai-search TODO comment for azure vector store', () => {
    const result = generateTerraform(azureConfig);
    expect(result).toContain('azure-ai-search');
  });

  it('outputs Container App FQDN for azure', () => {
    const result = generateTerraform(azureConfig);
    expect(result).toContain('azurerm_container_app.api.ingress');
  });

  // ── Multi-cloud ───────────────────────────────────────────────────────────

  it('falls back to AWS provider for multi-cloud', () => {
    const multiConfig = { ...minimalConfig, cloudProvider: 'multi-cloud' as const };
    const result = generateTerraform(multiConfig);
    expect(result).toContain('provider "aws"');
  });

  // ── General ───────────────────────────────────────────────────────────────

  it('includes required_version constraint', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('required_version');
  });

  it('includes variable blocks', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toContain('variable "project_name"');
    expect(result).toContain('variable "environment"');
  });

  it('matches snapshot for minimal config (aws)', () => {
    const result = generateTerraform(minimalConfig);
    expect(result).toMatchSnapshot();
  });

  it('matches snapshot for full config (gcp)', () => {
    const result = generateTerraform(fullConfig);
    expect(result).toMatchSnapshot();
  });
});
