'use client';

import { DesignerStagePlaceholder } from '@/components/designer/designer-stage-placeholder';
import type { DesignerStageId } from '@/lib/constants';

export function DesignerStepView({
  stageId,
}: Readonly<{
  stageId: DesignerStageId;
}>) {
  return <DesignerStagePlaceholder stageId={stageId} />;
}
