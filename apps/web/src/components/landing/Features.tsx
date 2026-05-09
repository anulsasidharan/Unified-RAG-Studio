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
      'Step-by-step 12-stage designer with live Mermaid diagrams, stage-level recommendations, and intelligent defaults for every configuration choice.',
    color: 'primary',
    large: true,
  },
  {
    icon: Bot,
    title: 'AI-Powered Autopilot',
    description:
      'Six LangGraph agents analyze your corpus, benchmark models, tune retrieval, and iterate until quality targets are met.',
    color: 'purple',
    large: false,
  },
  {
    icon: Cloud,
    title: 'Multi-Cloud Ready',
    description:
      'First-class support for AWS, GCP, and Azure. Recommendations adapt to each provider\'s native vector and LLM services.',
    color: 'sky',
    large: false,
  },
  {
    icon: FlaskConical,
    title: 'RAGAS Evaluation',
    description:
      'Built-in faithfulness, answer relevance, context precision, and recall metrics. Synthetic test set generation included.',
    color: 'success',
    large: false,
  },
  {
    icon: DollarSign,
    title: 'Cost Optimization',
    description:
      'Real-time cost estimates per query and per month. Routing logic automatically sends simple queries to cheaper models.',
    color: 'warning',
    large: false,
  },
  {
    icon: Rocket,
    title: 'Production Deployment',
    description:
      'Export to Python, YAML, Terraform, Docker Compose, or K8s manifests. One-click deploy to your cloud provider.',
    color: 'danger',
    large: false,
  },
];

const colorMap: Record<string, { bg: string; icon: string; border: string; glow: string }> = {
  primary: { bg: 'bg-primary-50',  icon: 'text-primary-600', border: 'border-primary-100', glow: 'hover:border-primary-200 hover:shadow-primary-100/60' },
  purple:  { bg: 'bg-purple-50',   icon: 'text-purple-600',  border: 'border-purple-100',  glow: 'hover:border-purple-200 hover:shadow-purple-100/60'  },
  sky:     { bg: 'bg-sky-50',      icon: 'text-sky-600',     border: 'border-sky-100',     glow: 'hover:border-sky-200 hover:shadow-sky-100/60'         },
  success: { bg: 'bg-success-50',  icon: 'text-success-600', border: 'border-success-100', glow: 'hover:border-success-200 hover:shadow-success-100/60' },
  warning: { bg: 'bg-warning-50',  icon: 'text-warning-600', border: 'border-warning-100', glow: 'hover:border-yellow-200 hover:shadow-yellow-100/60'   },
  danger:  { bg: 'bg-danger-50',   icon: 'text-danger-600',  border: 'border-danger-100',  glow: 'hover:border-red-200 hover:shadow-red-100/60'          },
};

export function Features() {
  const [hero, ...rest] = features;
  const heroColors = colorMap[hero.color];

  return (
    <section id="features" className="bg-neutral-50/60 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold text-neutral-900 sm:text-4xl">
            Everything You Need to Build Production RAG
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-neutral-500">
            From first prototype to production deployment, RAG Studio has every tool at every stage.
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Hero feature — spans 2 cols × 2 rows */}
          <div
            className={`group relative col-span-1 overflow-hidden rounded-2xl border ${heroColors.border} bg-white p-8 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${heroColors.glow} sm:col-span-2 lg:row-span-2`}
          >
            <div className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${heroColors.bg}`}>
              <hero.icon className={`h-7 w-7 ${heroColors.icon}`} />
            </div>
            <h3 className="mb-3 font-display text-xl font-bold text-neutral-900">{hero.title}</h3>
            <p className="text-base leading-relaxed text-neutral-600">{hero.description}</p>

            {/* Decorative mini pipeline */}
            <div className="pointer-events-none absolute bottom-6 right-6 flex items-center gap-1.5 opacity-20">
              {['Retrieve', 'Augment', 'Generate'].map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className="rounded-md bg-primary-600 px-2 py-1 text-[9px] font-bold text-white">
                    {s}
                  </span>
                  {i < 2 && <span className="text-primary-400 text-xs">→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Remaining 5 feature cards */}
          {rest.map(({ icon: Icon, title, description, color }) => {
            const c = colorMap[color];
            return (
              <div
                key={title}
                className={`group rounded-2xl border ${c.border} bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${c.glow}`}
              >
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.bg}`}>
                  <Icon className={`h-5 w-5 ${c.icon}`} />
                </div>
                <h3 className="mb-2 font-display font-semibold text-neutral-900">{title}</h3>
                <p className="text-sm leading-relaxed text-neutral-600">{description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
