import { describe, expect, it } from 'vitest';

import { deployHintCaption, deployHintCommand } from '../deploy-hints';

describe('deployHintCommand', () => {
  it('returns python runner', () => {
    expect(deployHintCommand('python', 'my-pipeline.py')).toBe('python3 my-pipeline.py');
  });

  it('sanitizes odd filenames', () => {
    expect(deployHintCommand('python', 'bad name!.py')).toBe('python3 bad_name_.py');
  });

  it('returns docker compose up', () => {
    expect(deployHintCommand('docker-compose', 'docker-compose.yml')).toBe(
      'docker compose -f docker-compose.yml up -d --build'
    );
  });

  it('returns kubectl apply for k8s', () => {
    expect(deployHintCommand('k8s', 'stack-k8s-manifests.yaml')).toBe(
      'kubectl apply -f stack-k8s-manifests.yaml'
    );
  });

  it('mentions terraform init for terraform', () => {
    const cmd = deployHintCommand('terraform', 'my-stack-main.tf');
    expect(cmd).toContain('terraform init');
    expect(cmd).toContain('my-stack-main.tf');
  });
});

describe('deployHintCaption', () => {
  it('returns non-empty for each format', () => {
    const formats = ['python', 'yaml', 'terraform', 'docker-compose', 'k8s'] as const;
    for (const f of formats) {
      expect(deployHintCaption(f).length).toBeGreaterThan(10);
    }
  });
});
