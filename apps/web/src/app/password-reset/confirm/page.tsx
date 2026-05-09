'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, KeyRound, CheckCircle2 } from 'lucide-react';

import { apiClient, ApiError } from '@/lib/api-client';
import type { PasswordResetResponse } from '@/types/auth';
import type { FormEvent } from 'react';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

export default function PasswordResetConfirmPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const tokenFromQuery = sp.get('token') ?? '';

  const [token, setToken] = useState(tokenFromQuery);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      const out = await apiClient.post<PasswordResetResponse>('/api/auth/password-reset/confirm', {
        token,
        new_password: newPassword,
      });
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
    <div className="flex min-h-screen">
      <AuthBrandPanel />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-12 xl:px-20">
        <div className="w-full max-w-md">
          {res ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
                <CheckCircle2 className="h-8 w-8 text-success-600" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-neutral-900">Password reset!</h1>
                <p className="mt-2 text-sm text-neutral-500">{res.message}</p>
              </div>
              <button
                type="button"
                onClick={() => router.replace('/login')}
                className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-indigo-700 active:scale-[0.98]"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
                <KeyRound className="h-6 w-6 text-primary-600" />
              </div>
              <div className="mb-8 mt-4">
                <h1 className="font-display text-3xl font-bold text-neutral-900">Set new password</h1>
                <p className="mt-2 text-sm text-neutral-500">Use the token you received to reset your password.</p>
              </div>

              <form className="space-y-5" onSubmit={onSubmit}>
                {/* Token input */}
                <div className="space-y-1.5">
                  <label htmlFor="token" className="block text-sm font-medium text-neutral-700">
                    Reset token
                  </label>
                  <input
                    id="token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-xs text-neutral-700 outline-none transition-all hover:border-neutral-300 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                    placeholder="Paste reset token here"
                  />
                </div>

                {/* New password */}
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="block text-sm font-medium text-neutral-700">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={6}
                      required
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

                {error ? (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading || !token.trim() || !newPassword.trim()}
                  className="w-full rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-200/60 transition-all hover:from-primary-700 hover:to-indigo-700 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
                >
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-neutral-500">
                <Link href="/login" className="font-semibold text-primary-600 hover:text-primary-700">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
