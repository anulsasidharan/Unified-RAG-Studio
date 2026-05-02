const designerSteps = [
  {
    step: '01',
    title: 'Choose your cloud provider',
    description: 'Select AWS, GCP, Azure, or multi-cloud and get provider-specific recommendations.',
  },
  {
    step: '02',
    title: 'Configure each pipeline stage',
    description: 'Walk through 12 stages — from ingestion and chunking to retrieval and generation.',
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
    description: 'Define target metrics (faithfulness, relevance), budget limits, and latency goals.',
  },
  {
    step: '03',
    title: 'AI agents build and test',
    description: '6 specialized agents benchmark chunking, embeddings, retrieval, and evaluate with RAGAS.',
  },
  {
    step: '04',
    title: 'Review and deploy',
    description: 'Inspect agent decisions, view metrics, export code, or deploy with one click.',
  },
];

export function HowItWorks() {
  return (
    <section className="bg-neutral-50/80 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
            How It Works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-neutral-600">
            Both modes produce the same production-ready output — choose based on how you want to work.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          {/* Designer steps */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <span className="rounded-full bg-primary-600 px-4 py-1.5 text-sm font-semibold text-white">
                Designer Mode
              </span>
              <span className="text-sm text-neutral-500">Manual control</span>
            </div>
            <div className="space-y-6">
              {designerSteps.map((item, idx) => (
                <div key={item.step} className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-primary-200 bg-white font-bold text-sm text-primary-600">
                      {item.step}
                    </div>
                    {idx < designerSteps.length - 1 && (
                      <div className="mt-2 h-full w-px bg-primary-100" />
                    )}
                  </div>
                  <div className="pb-6">
                    <h4 className="mb-1 font-semibold text-neutral-900">{item.title}</h4>
                    <p className="text-sm leading-relaxed text-neutral-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Autopilot steps */}
          <div>
            <div className="mb-8 flex items-center gap-3">
              <span className="rounded-full bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white">
                Autopilot Mode
              </span>
              <span className="text-sm text-neutral-500">AI-powered automation</span>
            </div>
            <div className="space-y-6">
              {autopilotSteps.map((item, idx) => (
                <div key={item.step} className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-purple-200 bg-white font-bold text-sm text-purple-600">
                      {item.step}
                    </div>
                    {idx < autopilotSteps.length - 1 && (
                      <div className="mt-2 h-full w-px bg-purple-100" />
                    )}
                  </div>
                  <div className="pb-6">
                    <h4 className="mb-1 font-semibold text-neutral-900">{item.title}</h4>
                    <p className="text-sm leading-relaxed text-neutral-600">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
