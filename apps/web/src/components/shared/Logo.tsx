'use client';

import { useId } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/constants';

type LogoProps = {
  className?: string;
};

export function Logo({ className }: LogoProps) {
  const gid = useId().replace(/:/g, '');
  const gradId = `logo-grad-${gid}`;
  const shineId = `logo-shine-${gid}`;

  return (
    <Link
      href={ROUTES.home}
      className={cn(
        'focus-visible:ring-primary-500 flex shrink-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        className,
      )}
      aria-label="RAG Studio — go to home"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect width="32" height="32" rx="9" fill={`url(#${gradId})`} />
        <ellipse cx="10" cy="9" rx="10" ry="7" fill={`url(#${shineId})`} opacity="0.35" />
        {/* Pipeline: Retrieve → Augment → Generate */}
        <circle cx="16" cy="8" r="3" fill="white" fillOpacity="0.98" />
        <circle cx="9" cy="22" r="3" fill="white" fillOpacity="0.98" />
        <circle cx="23" cy="22" r="3" fill="white" fillOpacity="0.98" />
        <path
          d="M14.5 10.5 Q16 14 12 17.5"
          stroke="white"
          strokeWidth="1.35"
          strokeOpacity="0.55"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M17.5 10.5 Q16 14 20 17.5"
          stroke="white"
          strokeWidth="1.35"
          strokeOpacity="0.55"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M11.8 22 H20.2"
          stroke="white"
          strokeWidth="1.35"
          strokeOpacity="0.45"
          strokeLinecap="round"
        />
        <circle cx="16" cy="15.5" r="1.25" fill="white" fillOpacity="0.85" />
        <defs>
          <linearGradient id={gradId} x1="4" y1="4" x2="30" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563EB" />
            <stop offset="0.55" stopColor="#6366F1" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
          <radialGradient
            id={shineId}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(10 9) rotate(42) scale(14 10)"
          >
            <stop stopColor="white" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <span className="truncate text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        RAG <span className="text-primary-600 dark:text-primary-400">Studio</span>
      </span>
    </Link>
  );
}
