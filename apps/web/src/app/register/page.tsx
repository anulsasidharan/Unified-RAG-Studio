'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

import { useAuthStore } from '@/stores/auth-store';
import type { RegisterResponse } from '@/types/auth';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="flex min-h-screen">
      <AuthBrandPanel />

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">

          {result ? (
            /* Post-registration success state */
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
                  <CheckCircle2 className="h-8 w-8 text-success-600" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-neutral-900">Account created!</h1>
                  <p className="mt-1 text-sm text-neutral-500">{result.message}</p>
                </div>
              </div>

              {token ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Verification token (dev)
                  </p>
                  <code className="block break-all rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-700">
                    {token}
                  </code>
                  <button
                    type="button"
                    onClick={() => router.push(`/verify-email?token=${encodeURIComponent(token)}`)}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-200/60 transition-all hover:from-primary-700 hover:to-indigo-700 active:scale-[0.98]"
                  >
                    Verify email →
                  </button>
                </div>
              ) : (
                <p className="text-center text-sm text-neutral-500">
                  Check your email for the verification link.
                </p>
              )}

              <p className="text-center text-sm text-neutral-500">
                Already verified?{' '}
                <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700">
                  Log in
                </Link>
              </p>
            </div>
          ) : (
            /* Registration form */
            <>
              <div className="mb-8">
                <h1 className="font-display text-3xl font-bold text-neutral-900">Create your account</h1>
                <p className="mt-2 text-sm text-neutral-500">
                  Free forever. No credit card required.
                </p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
                    Full name
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                    autoComplete="name"
                    required
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                    placeholder="Jane Smith"
                  />
                </div>

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
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                    placeholder="you@company.com"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={6}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 pr-11 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                      placeholder="At least 6 characters"
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
                  <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-200/60 transition-all hover:from-primary-700 hover:to-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? 'Creating account…' : 'Create free account'}
                </button>

                <p className="text-center text-xs text-neutral-400">
                  By creating an account you agree to our Terms of Service.
                </p>
              </form>

              <p className="mt-6 text-center text-sm text-neutral-500">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
