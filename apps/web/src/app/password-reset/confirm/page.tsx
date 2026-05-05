'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

import { apiClient, ApiError } from '@/lib/api-client';
import type { PasswordResetResponse } from '@/types/auth';
import type { FormEvent } from 'react';

export default function PasswordResetConfirmPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const tokenFromQuery = sp.get('token') ?? '';

  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<PasswordResetResponse | null>(null);

  useEffect(() => {
    setToken(tokenFromQuery);
  }, [tokenFromQuery]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const out = await apiClient.post<PasswordResetResponse>(
        '/api/auth/password-reset/confirm',
        { token, new_password: newPassword },
      );
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

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <p className="mt-2 text-sm text-neutral-600">Use the token you received.</p>

      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-2 text-sm">
          Token
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-600"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          New password
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            type="password"
            minLength={6}
            required
            className="rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-600"
          />
        </label>

        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || !token.trim() || !newPassword.trim()}
          className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      </form>

      {res ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-700">{res.message}</p>
          <button
            type="button"
            onClick={() => router.replace('/login')}
            className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Back to login
          </button>
        </div>
      ) : null}
    </main>
  );
}

