import { DesignerStepView } from './designer-step-view';
import { stageIdFromStepParams } from '@/lib/designer-routes';

type PageProps = {
  params: { step?: string[] };
};

export default function DesignerStepPage({ params }: PageProps) {
  const stageId = stageIdFromStepParams(params.step);
  return <DesignerStepView stageId={stageId} />;
}
