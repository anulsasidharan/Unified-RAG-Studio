import { Bot, LayoutTemplate, Rocket, Check } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';

const highlights = [
  { icon: LayoutTemplate, text: '12-stage visual pipeline builder' },
  { icon: Bot,            text: 'AI agents optimize automatically'   },
  { icon: Rocket,         text: 'One-click multi-cloud deployment'   },
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-neutral-950 via-primary-950 to-purple-950 p-10 lg:flex lg:w-[44%]">
      {/* Animated orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-float absolute -left-20 top-10 h-64 w-64 rounded-full bg-blue-600/20 blur-[80px]" />
        <div className="animate-float-delayed absolute -right-16 bottom-20 h-72 w-72 rounded-full bg-purple-600/20 blur-[80px]" />
        <div className="animate-float-slow absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-[60px]" />
      </div>

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30" />

      {/* Logo */}
      <div className="relative">
        <Logo className="[&_span]:text-white [&_svg]:opacity-100" />
      </div>

      {/* Middle content */}
      <div className="relative space-y-8">
        <div>
          <h2 className="font-display text-3xl font-bold text-white leading-tight">
            Build production RAG
            <br />
            <span className="gradient-text-animated">your way.</span>
          </h2>
          <p className="mt-3 text-base text-white/50">
            Design step-by-step or let AI agents handle everything automatically.
          </p>
        </div>

        <ul className="space-y-4">
          {highlights.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Icon className="h-4 w-4 text-white/80" />
              </span>
              <span className="text-sm text-white/70">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom quote */}
      <div className="relative rounded-xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
        <p className="text-sm italic text-white/60">
          &ldquo;We had a working, evaluated RAG system in production in under an hour.&rdquo;
        </p>
        <p className="mt-2 text-xs font-medium text-white/40">— Time-Strapped Startup</p>
      </div>
    </div>
  );
}
