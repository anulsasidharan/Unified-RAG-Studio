'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useAuthStore } from '@/stores/auth-store';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.replace('/projects');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12">
      <h1 className="text-2xl font-semibold">Log in</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Enter your email and password to access your projects.
      </p>

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
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
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
          disabled={loading}
          className="mt-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <div className="mt-6 text-sm text-neutral-600">
        No account yet?{' '}
        <a className="font-medium text-primary-600 hover:underline" href="/register">
          Sign up
        </a>
      </div>
      <div className="mt-3 text-sm text-neutral-600">
        <a className="font-medium text-primary-600 hover:underline" href="/password-reset">
          Forgot password?
        </a>
      </div>
    </main>
  );
}

