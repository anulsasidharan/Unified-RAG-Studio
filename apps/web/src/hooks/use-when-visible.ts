'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Returns true once the ref element enters (or nears) the viewport.
 * Used to defer heavy work (API calls, mermaid) until panels are actually needed.
 */
export function useWhenVisible<T extends HTMLElement = HTMLElement>(
  rootMargin = '240px 0px'
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return [ref, visible];
}
