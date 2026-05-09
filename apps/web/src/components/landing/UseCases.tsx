import { GraduationCap, Rocket, Building2, Check } from 'lucide-react';

const personas = [
  {
    icon: GraduationCap,
    role: 'Learning Engineer',
    initial: 'LE',
    tag: 'Start with Designer Mode',
    color: 'primary',
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
    initial: 'ST',
    tag: 'Start with Autopilot Mode',
    color: 'purple',
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
    initial: 'EA',
    tag: 'Use Both Modes',
    color: 'success',
    quote:
      '"Autopilot gives us a validated baseline. We then open it in Designer to apply compliance constraints and fine-tune."',
    benefits: [
      'Bidirectional Designer ↔ Autopilot flow',
      'Terraform output for IaC governance',
      'MLflow tracking for audit trails',
    ],
  },
];

const cardColors = {
  primary: {
    topBar: 'from-primary-500 to-indigo-600',
    avatar: 'bg-primary-100 text-primary-700',
    pill: 'bg-primary-100 text-primary-700',
    check: 'text-primary-600',
  },
  purple: {
    topBar: 'from-purple-500 to-violet-600',
    avatar: 'bg-purple-100 text-purple-700',
    pill: 'bg-purple-100 text-purple-700',
    check: 'text-purple-600',
  },
  success: {
    topBar: 'from-emerald-500 to-teal-600',
    avatar: 'bg-success-100 text-success-600',
    pill: 'bg-success-100 text-success-600',
    check: 'text-success-600',
  },
};

export function UseCases() {
  return (
    <section className="bg-neutral-50/60 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-4 font-display text-3xl font-bold text-neutral-900 sm:text-4xl">
            Built for Every Team
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-neutral-500">
            Whether you are learning, prototyping, or deploying at scale, RAG Studio adapts to you.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {personas.map(({ icon: Icon, role, initial, tag, color, quote, benefits }) => {
            const c = cardColors[color as keyof typeof cardColors];
            return (
              <div
                key={role}
                className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Gradient top bar */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${c.topBar}`} />

                <div className="flex flex-1 flex-col p-7">
                  {/* Header */}
                  <div className="mb-5 flex items-start gap-4">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl font-bold text-sm ${c.avatar}`}>
                      {initial}
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-neutral-900">{role}</h3>
                      <span className={`mt-1 inline-block rounded-full px-3 py-0.5 text-xs font-medium ${c.pill}`}>
                        {tag}
                      </span>
                    </div>
                  </div>

                  {/* Quote */}
                  <blockquote className="mb-6 flex-1 text-sm leading-relaxed text-neutral-500 italic border-l-2 border-neutral-200 pl-4">
                    {quote}
                  </blockquote>

                  {/* Benefits */}
                  <ul className="space-y-2.5">
                    {benefits.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-neutral-700">
                        <Check className={`mt-0.5 h-4 w-4 flex-shrink-0 font-bold ${c.check}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
