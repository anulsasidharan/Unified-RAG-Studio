import type { DesignerExportFormat } from '@/types/pipeline';

/** Suggested shell commands for local deploy / smoke after downloading the artefact. */
export function deployHintCommand(format: DesignerExportFormat, filename: string): string {
  const safe = filename.replace(/[^\w./-]+/g, '_');
  switch (format) {
    case 'python':
      return `python3 ${safe}`;
    case 'yaml':
      return `# Pipeline manifest — wire into your LangChain / LangGraph app or CI\n# Saved as: ${safe}`;
    case 'terraform':
      return `# From the directory where you saved ${safe}:\nterraform init && terraform plan && terraform apply`;
    case 'docker-compose':
      return `docker compose -f ${safe} up -d --build`;
    case 'k8s':
      return `kubectl apply -f ${safe}`;
    default:
      return '';
  }
}

export function deployHintCaption(format: DesignerExportFormat): string {
  switch (format) {
    case 'python':
      return 'Run generated script (install provider SDKs and env vars first).';
    case 'yaml':
      return 'Use as a portable pipeline manifest alongside your runtime.';
    case 'terraform':
      return 'Review variables and state backend before apply.';
    case 'docker-compose':
      return 'Builds and starts API + dependencies from the generated stack.';
    case 'k8s':
      return 'Applies multi-document manifests to the current kubectl context.';
    default:
      return '';
  }
}
