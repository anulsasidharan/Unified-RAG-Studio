import { notFound } from 'next/navigation';

import { DESIGNER_STAGES, type DesignerStageId } from '@/lib/constants';

export function normalizeDesignerPathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '') || '/';
  }
  return pathname;
}

export function stageIdFromStepParams(step: string[] | undefined): DesignerStageId {
  const path =
    step == null || step.length === 0
      ? '/designer'
      : step.length === 1
        ? `/designer/${step[0]}`
        : null;
  if (path === null) notFound();
  const found = DESIGNER_STAGES.find((s) => s.path === path);
  if (!found) notFound();
  return found.id;
}
