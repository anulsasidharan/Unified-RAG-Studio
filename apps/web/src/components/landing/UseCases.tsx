import { GraduationCap, Rocket, Building2 } from 'lucide-react';

const personas = [
  {
    icon: GraduationCap,
    role: 'Learning Engineer',
    tag: 'Start with Designer Mode',
    tagColor: 'primary',
    quote:
      '"I finally understand the tradeoffs between chunking strategies and why MMR retrieval is better for diverse corpora."',
    benefits: [
      'Learn RAG concepts by doing',
      'See cost and quality impact of each choice',
      'Export annotated Python code to study',
    ],
  },
  {
    icon: Rocket,
    role: 'Time-Strapped Startup',
    tag: 'Start with Autopilot Mode',
    tagColor: 'purple',
    quote:
      '"We had a working, evaluated RAG system deployed to production in under an hour — no ML expertise required."',
    benefits: [
      'Upload docs, set goals, hit Build',
      'Agents handle all benchmarking',
      'One-command cloud deployment',
    ],
  },
  {
    icon: Building2,
    role: 'Enterprise Architect',
    tag: 'Use Both Modes',
    tagColor: 'success',
    quote:
      '"Autopilot gives us a validated baseline. We then open it in Designer to apply compliance constraints and fine-tune."',
    benefits: [
      'Bidirectional Designer ↔ Autopilot flow',
      'Terraform output for IaC governance',
      'MLflow tracking for audit trails',
    ],
  },
];

const tagColors: Record<string, { pill: string; icon: string }> = {
  primary: { pill: 'bg-primary-100 text-primary-700', icon: 'bg-primary-100 text-primary-600' },
  purple:  { pill: 'bg-purple-100 text-purple-700',   icon: 'bg-purple-100 text-purple-600'   },
  success: { pill: 'bg-success-100 text-success-600', icon: 'bg-success-100 text-success-600' },
};

export function UseCases() {
  return (
    <section className="bg-neutral-50/80 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <h2 className="mb-4 text-3xl font-bold text-neutral-900 sm:text-4xl">
            Built for Every Team
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-neutral-600">
            Whether you are learning, prototyping, or deploying at scale, RAG Studio adapts to you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {personas.map(({ icon: Icon, role, tag, tagColor, quote, benefits }) => {
            const c = tagColors[tagColor];
            return (
              <div
                key={role}
                className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm"
              >
                <div className="mb-5 flex items-start gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${c.icon}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-neutral-900">{role}</h3>
                    <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${c.pill}`}>
                      {tag}
                    </span>
                  </div>
                </div>

                <blockquote className="mb-6 flex-1 text-sm leading-relaxed text-neutral-600 italic">
                  {quote}
                </blockquote>

                <ul className="space-y-2">
                  {benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-neutral-700">
                      <span className="mt-0.5 text-success-600 font-bold">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
