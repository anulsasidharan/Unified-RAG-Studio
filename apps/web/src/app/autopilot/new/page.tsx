import { Suspense } from 'react';

import { AutopilotNewPageBody } from './autopilot-new-page-body';

export default function AutopilotNewPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
      <AutopilotNewPageBody />
    </Suspense>
  );
}
