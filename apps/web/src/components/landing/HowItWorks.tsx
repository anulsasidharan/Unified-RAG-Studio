const designerSteps = [
  {
    step: '01',
    title: 'Choose your cloud provider',
    description:
      'Select AWS, GCP, Azure, or multi-cloud and get provider-specific recommendations.',
  },
  {
    step: '02',
    title: 'Configure each pipeline stage',
    description:
      'Walk through 12 stages — from ingestion and chunking to retrieval and generation.',
  },
  {
    step: '03',
    title: 'Preview cost and diagram',
    description: 'See a live Mermaid diagram and real-time cost estimate update as you configure.',
  },
  {
    step: '04',
    title: 'Export or deploy',
    description: 'Get production-ready Python, YAML, Terraform, or Docker Compose output.',
  },
];

const autopilotSteps = [
  {
    step: '01',
    title: 'Upload your documents',
    description: 'Drag and drop PDF, DOCX, Markdown, CSV, or connect an S3/GCS bucket.',
  },
  {
    step: '02',
    title: 'Set your requirements',
    description:
      'Define target metrics (faithfulness, relevance), budget limits, and latency goals.',
  },
  {
    step: '03',
    title: 'AI agents build and test',
    description:
      '6 specialized agents benchmark chunking, embeddings, retrieval, and evaluate with RAGAS.',
  },
  {
    step: '04',
    title: 'Review and deploy',
    description: 'Inspect agent decisions, view metrics, export code, or deploy with one click.',
  },
];

interface StepListProps {
  steps: typeof designerSteps;
  accent: 'blue' | 'purple';
}

function StepList({ steps, accent }: StepListProps) {
  const ring =
    accent === 'blue'
      ? 'border-primary-200 bg-primary-50 text-primary-700'
      : 'border-purple-200 bg-purple-50 text-purple-700';
  const line = accent === 'blue' ? 'bg-primary-100' : 'bg-purple-100';

  return (
    <div className="space-y-0">
      {steps.map((item, idx) => (
        <div key={item.step} className="flex gap-5">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${ring}`}
            >
              {item.step}
            </div>
            {idx < steps.length - 1 && (
              <div className={`mt-0 h-full min-h-[2.5rem] w-px ${line}`} />
            )}
          </div>
          <div className="pb-8">
            <h4 className="font-display mb-1 font-semibold text-neutral-900">{item.title}</h4>
            <p className="text-sm leading-relaxed text-neutral-500">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="font-display mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-neutral-500">
            Both modes produce the same production-ready output — choose based on how you want to
            work.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Designer steps */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="mb-8 flex items-center gap-3">
              <span className="from-primary-600 shadow-primary-200/60 rounded-full bg-gradient-to-r to-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm">
                Designer Mode
              </span>
              <span className="text-sm text-neutral-400">Manual control</span>
            </div>
            <StepList steps={designerSteps} accent="blue" />
          </div>

          {/* Autopilot steps */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="mb-8 flex items-center gap-3">
              <span className="rounded-full bg-gradient-to-r from-purple-600 to-violet-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-purple-200/60">
                Autopilot Mode
              </span>
              <span className="text-sm text-neutral-400">AI-powered automation</span>
            </div>
            <StepList steps={autopilotSteps} accent="purple" />
          </div>
        </div>
      </div>
    </section>
  );
}
