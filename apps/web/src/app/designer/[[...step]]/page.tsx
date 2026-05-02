import { DesignerStagePlaceholder } from '@/components/designer/designer-stage-placeholder';
import { stageIdFromStepParams } from '@/lib/designer-routes';

type PageProps = {
  params: { step?: string[] };
};

export default function DesignerStepPage({ params }: PageProps) {
  const stageId = stageIdFromStepParams(params.step);
  return <DesignerStagePlaceholder stageId={stageId} />;
}
