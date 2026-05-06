'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, Volume2, VolumeX, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type DemoId = 'full' | 'teaser';

const DEMOS: {
  id: DemoId;
  title: string;
  blurb: string;
  src: string;
  loop: boolean;
  chapters: boolean;
}[] = [
  {
    id: 'full',
    title: 'Pipeline Premiere',
    blurb: 'Full studio tour · ~3 min',
    src: '/videos/product-tour-main.mp4',
    loop: false,
    chapters: true,
  },
  {
    id: 'teaser',
    title: 'Lightning Look',
    blurb: 'Quick cut · ~30 s',
    src: '/videos/product-tour-teaser.mp4',
    loop: true,
    chapters: false,
  },
];

export function HeroProductDemo() {
  const [active, setActive] = useState<DemoId>('full');
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const config = DEMOS.find((d) => d.id === active)!;

  const syncMuteState = useCallback(() => {
    const el = videoRef.current;
    if (el) setMuted(el.muted);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    setMuted(true);
    el.muted = true;
    const p = el.play();
    if (p) p.catch(() => {});
  }, [active]);

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    const next = !el.muted;
    el.muted = next;
    setMuted(next);
    if (!next) {
      el.play().catch(() => {});
    }
  };

  return (
    <div className="w-full max-w-xl lg:max-w-none">
      <div className="mb-4 text-center lg:text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
          See it live
        </p>
        <h2
          className="mt-1 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl"
          id="product-demos-heading"
        >
          <span className="gradient-text">Pipeline Premiere</span>
        </h2>
        <p className="mt-1.5 text-sm text-neutral-600 sm:text-base">
          Product demos — pick the full walkthrough or the lightning cut
        </p>
      </div>

      <div
        className="mb-3 flex flex-wrap justify-center gap-2 lg:justify-start"
        role="tablist"
        aria-labelledby="product-demos-heading"
      >
        {DEMOS.map((d) => {
          const isOn = active === d.id;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={isOn}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all',
                isOn
                  ? 'border-primary-500 bg-primary-50 text-primary-800 shadow-sm ring-2 ring-primary-200'
                  : 'border-neutral-200 bg-white/90 text-neutral-700 hover:border-primary-200 hover:bg-primary-50/50',
              )}
              onClick={() => setActive(d.id)}
            >
              {d.id === 'full' ? (
                <Clapperboard className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Zap className="h-4 w-4 shrink-0" aria-hidden />
              )}
              <span>{d.title}</span>
              <span className="text-xs font-normal opacity-80">({d.blurb})</span>
            </button>
          );
        })}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-primary-200/70 bg-neutral-950 shadow-2xl shadow-primary-900/20 ring-1 ring-black/10">
        <video
          key={config.src}
          ref={videoRef}
          className="aspect-video w-full bg-black object-contain"
          controls
          playsInline
          muted={muted}
          autoPlay
          loop={config.loop}
          poster="/videos/hero-demo-poster.svg"
          preload="metadata"
          aria-label={`${config.title}: Unified RAG Studio product demo video`}
          onVolumeChange={syncMuteState}
        >
          <source src={config.src} type="video/mp4" />
          {config.chapters ? (
            <track
              kind="chapters"
              src="/videos/product-tour-chapters.vtt"
              srcLang="en"
              label="Sections"
            />
          ) : null}
          {config.id === 'full' ? (
            <track
              kind="captions"
              src="/videos/product-tour-captions.vtt"
              srcLang="en"
              label="English captions"
            />
          ) : null}
        </video>

        <button
          type="button"
          onClick={toggleMute}
          className="absolute bottom-14 right-3 flex items-center gap-2 rounded-lg bg-black/75 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-black/90 sm:bottom-16"
          aria-label={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? (
            <VolumeX className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
          {muted ? 'Sound on' : 'Mute'}
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-neutral-500 lg:text-left">
        Autoplays muted — use the control above or the player for sound and fullscreen.
      </p>
    </div>
  );
}
