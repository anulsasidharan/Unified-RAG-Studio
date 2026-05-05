import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Recursively replaces `null` values with `undefined`.
 * Needed when API JSON (where Pydantic serialises `None` as `null`) is fed into
 * Zod schemas that use `.optional()` (which accepts `undefined`, not `null`).
 */
export function deepStripNulls<T>(value: T): T {
  if (value === null) return undefined as unknown as T;
  if (Array.isArray(value)) return value.map(deepStripNulls) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const stripped = deepStripNulls(v);
      if (stripped !== undefined) {
        out[k] = stripped;
      }
    }
    return out as T;
  }
  return value;
}
