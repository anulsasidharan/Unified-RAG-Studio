'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useAuthStore } from '@/stores/auth-store';
import type { RegisterResponse } from '@/types/auth';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegisterResponse | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await register({ email, password, name });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const token = result?.verification_token ?? null;

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-semibold">Sign up</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Create your account and verify your email to log in.
      </p>

      {result ? (
        <div className="mt-8 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="text-sm text-neutral-700 dark:text-neutral-200">{result.message}</p>

          {token ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                Verification token (dev)
              </p>
              <code className="block break-all rounded bg-neutral-100 px-3 py-2 text-xs dark:bg-neutral-900">
                {token}
              </code>
              <button
                type="button"
                onClick={() =>
                  router.push(`/verify-email?token=${encodeURIComponent(token)}`)
                }
                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Verify email
              </button>
            </div>
          ) : (
            <div className="mt-4 text-sm text-neutral-600">
              Check your email for the verification link or token.
            </div>
          )}

          <div className="mt-6 text-sm text-neutral-600">
            Already have an account?{' '}
            <a className="font-medium text-primary-600 hover:underline" href="/login">
              Log in
            </a>
          </div>
        </div>
      ) : (
        <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
          <label className="flex flex-col gap-2 text-sm">
            Email
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-600"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              type="text"
              required
              className="rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-600"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            Password
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={6}
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
            disabled={loading}
            className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
      )}
    </main>
  );
}

