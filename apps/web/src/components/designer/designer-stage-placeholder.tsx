import Link from 'next/link';
import type { DesignerStageId } from '@/lib/constants';
import { DESIGNER_STAGES, ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

function phaseNoteFor(stageId: DesignerStageId): string {
  switch (stageId) {
    case 'cloud':
      return 'Detailed cloud UI — P5-2.';
    case 'ingestion':
      return 'Data ingestion UI — P5-3.';
    case 'chunking':
      return 'Chunking UI — P5-4.';
    case 'embedding':
      return 'Embedding selector — P5-5.';
    case 'vectorstore':
      return 'Vector store UI — P5-6.';
    case 'retrieval':
      return 'Retrieval UI — P5-7.';
    case 'reranking':
      return 'Covered alongside retrieval tuning in later P5 steps.';
    case 'generation':
      return 'Generation model UI — P5-8.';
    case 'routing':
    case 'memory':
    case 'evaluation':
      return 'Routing, memory & evaluation UI — P5-9.';
    case 'review':
      return 'Full review surface — P5-13.';
    default:
      return '';
  }
}

export function DesignerStagePlaceholder({
  stageId,
  className,
}: Readonly<{
  stageId: DesignerStageId;
  className?: string;
}>) {
  const meta = DESIGNER_STAGES.find((s) => s.id === stageId)!;
  const index = DESIGNER_STAGES.findIndex((s) => s.id === stageId);
  const prev = index > 0 ? DESIGNER_STAGES[index - 1] : null;
  const next = index < DESIGNER_STAGES.length - 1 ? DESIGNER_STAGES[index + 1] : null;

  return (
    <div className={cn('mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-10', className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stage {index + 1} of {DESIGNER_STAGES.length}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        {meta.label}
      </h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-400">
        Configure this step of your RAG pipeline. {phaseNoteFor(stageId)}
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-neutral-300 bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground dark:border-neutral-600">
        Configuration UI for “{meta.label}” will appear in the numbered Phase 5 task above.
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          {prev ? (
            <Link
              href={prev.path}
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              ← {prev.label}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">First stage</span>
          )}
        </div>
        <div>
          {next ? (
            <Link
              href={next.path}
              className="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              {next.label} →
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Last stage</span>
          )}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href={ROUTES.home} className="text-muted-foreground hover:text-foreground hover:underline">
          ← Back to home
        </Link>
        <Link
          href={ROUTES.templates}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          Browse templates
        </Link>
      </div>
    </div>
  );
}
