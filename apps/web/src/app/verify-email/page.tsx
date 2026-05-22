'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { apiClient, ApiError } from '@/lib/api-client';
import type { VerifyEmailResponse } from '@/types/auth';

function VerifyEmailContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const tokenFromQuery = sp.get('token') ?? '';

  const [token, setToken] = useState(tokenFromQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyEmailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(tokenFromQuery);
    // Auto-verify only when token is present.
    if (tokenFromQuery.trim()) {
      void (async () => {
        setError(null);
        setLoading(true);
        try {
          const res = await apiClient.post<VerifyEmailResponse>('/api/auth/verify-email', {
            token: tokenFromQuery,
          });
          setResult(res);
        } catch (e) {
          const msg =
            e instanceof ApiError
              ? typeof e.data === 'object' && e.data && 'detail' in e.data
                ? String((e.data as { detail: unknown }).detail)
                : e.message
              : e instanceof Error
                ? e.message
                : String(e);
          setError(msg);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [tokenFromQuery]);

  const onVerify = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiClient.post<VerifyEmailResponse>('/api/auth/verify-email', {
        token,
      });
      setResult(res);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? typeof e.data === 'object' && e.data && 'detail' in e.data
            ? String((e.data as { detail: unknown }).detail)
            : e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Verify your email</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Enter your verification token (or use the token from the link).
      </p>

      {result ? (
        <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-700">Email verified. You can now log in.</p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Go to login
          </button>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <label className="flex flex-col gap-2 text-sm">
            Token
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-600"
            />
          </label>

          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void onVerify()}
            disabled={loading || !token.trim()}
            className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </div>
      )}
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}

