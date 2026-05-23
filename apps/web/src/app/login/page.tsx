'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';

import { useAuthStore } from '@/stores/auth-store';
import { ApiError, formatApiErrorForUi } from '@/lib/api-client';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setError(
        err instanceof ApiError
          ? formatApiErrorForUi(err)
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AuthBrandPanel />

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-neutral-900">Welcome back</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Enter your credentials to access your projects.
            </p>
          </div>

          <form className="space-y-5" onSubmit={onSubmit}>
            {/* Email */}
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
                className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:ring-2"
                placeholder="you@company.com"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                  Password
                </label>
                <Link
                  href="/password-reset"
                  className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="focus:border-primary-500 focus:ring-primary-500/20 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 pr-11 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:bg-white focus:ring-2"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error ? (
              <div className="border-destructive/20 bg-destructive/8 text-destructive rounded-xl border px-4 py-3 text-sm">
                {error}
              </div>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="from-primary-600 shadow-primary-200/60 hover:from-primary-700 w-full rounded-xl bg-gradient-to-r to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:to-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-neutral-500">
            No account yet?{' '}
            <Link
              href="/register"
              className="text-primary-600 hover:text-primary-700 font-semibold"
            >
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
