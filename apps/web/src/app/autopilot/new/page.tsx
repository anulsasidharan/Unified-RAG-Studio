import { Suspense } from 'react';

import { AutopilotNewPageBody } from './autopilot-new-page-body';

export default function AutopilotNewPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <AutopilotNewPageBody />
    </Suspense>
  );
}
