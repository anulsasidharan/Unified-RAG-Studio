import {
  LayoutTemplate,
  Bot,
  Cloud,
  FlaskConical,
  DollarSign,
  Rocket,
} from 'lucide-react';

const features = [
  {
    icon: LayoutTemplate,
    title: 'Visual Pipeline Builder',
    description:
      'Step-by-step 12-stage designer with live Mermaid diagrams, stage-level recommendations, and intelligent defaults.',
    color: 'primary',
  },
  {
    icon: Bot,
    title: 'AI-Powered Autopilot',
    description:
      'Six LangGraph agents analyze your corpus, benchmark models, tune retrieval, and iterate until your quality targets are met.',
    color: 'purple',
  },
  {
    icon: Cloud,
    title: 'Multi-Cloud Ready',
    description:
      'First-class support for AWS, GCP, and Azure. Recommendations adapt to each provider\'s native vector and LLM services.',
    color: 'sky',
  },
  {
    icon: FlaskConical,
    title: 'RAGAS Evaluation',
    description:
      'Built-in faithfulness, answer relevance, context precision, and recall metrics. Synthetic test set generation included.',
    color: 'success',
  },
  {
    icon: DollarSign,
    title: 'Cost Optimization',
    description:
      'Real-time cost estimates per query and per month. Routing logic automatically routes simple queries to cheaper models.',
    color: 'warning',
  },
  {
    icon: Rocket,
    title: 'Production Deployment',
    description:
      'Export to Python, YAML, Terraform, Docker Compose, or K8s manifests. One-click deploy to your cloud provider.',
    color: 'danger',
  },
];

const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
  primary: { bg: 'bg-primary-50', icon: 'text-primary-600', border: 'border-primary-100' },
  purple:  { bg: 'bg-purple-50',  icon: 'text-purple-600',  border: 'border-purple-100'  },
  sky:     { bg: 'bg-sky-50',     icon: 'text-sky-600',     border: 'border-sky-100'     },
  success: { bg: 'bg-success-50', icon: 'text-success-600', border: 'border-success-100' },
  warning: { bg: 'bg-warning-50', icon: 'text-warning-600', border: 'border-warning-100' },
  danger:  { bg: 'bg-danger-50',  icon: 'text-danger-600',  border: 'border-danger-100'  },
};

export function Features() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-14 text-center">
        <h2 className="mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
          Everything You Need to Build Production RAG
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-neutral-600">
          From first prototype to production deployment, RAG Studio has every tool at every stage.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, description, color }) => {
          const c = colorMap[color];
          return (
            <div
              key={title}
              className={`group rounded-2xl border ${c.border} bg-white p-7 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md`}
            >
              <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${c.bg}`}>
                <Icon className={`h-6 w-6 ${c.icon}`} />
              </div>
              <h3 className="mb-2 font-semibold text-neutral-900">{title}</h3>
              <p className="text-sm leading-relaxed text-neutral-600">{description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
