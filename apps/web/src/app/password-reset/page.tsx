'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail } from 'lucide-react';

import { apiClient, ApiError } from '@/lib/api-client';
import type { PasswordResetResponse } from '@/types/auth';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

export default function PasswordResetRequestPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<PasswordResetResponse | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const out = await apiClient.post<PasswordResetResponse>('/api/auth/password-reset/request', { email });
      setRes(out);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? typeof err.data === 'object' && err.data && 'detail' in err.data
            ? String((err.data as { detail: unknown }).detail)
            : err.message
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const token = res?.reset_token ?? null;

  return (
    <div className="flex min-h-screen">
      <AuthBrandPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
            <Mail className="h-6 w-6 text-primary-600" />
          </div>
          <div className="mb-8 mt-4">
            <h1 className="font-display text-3xl font-bold text-neutral-900">Reset password</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Enter your email and we will send you a reset link.
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
                Email address
              </label>
              <input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                placeholder="you@company.com"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-200/60 transition-all hover:from-primary-700 hover:to-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>

          {res ? (
            <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
              <p className="text-sm text-neutral-700">{res.message}</p>
              {token ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Token (dev)
                  </p>
                  <code className="block break-all rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
                    {token}
                  </code>
                  <button
                    type="button"
                    onClick={() => router.push(`/password-reset/confirm?token=${encodeURIComponent(token)}`)}
                    className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:from-primary-700 hover:to-indigo-700 active:scale-[0.98]"
                  >
                    Reset using this token
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="mt-6 text-center text-sm text-neutral-500">
            Remember your password?{' '}
            <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
