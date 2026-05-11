'use client';

import { useState } from 'react';
import { User, Mail, Calendar, Clock, Save, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import type { UserProfile, UpdateProfileRequest } from '@/types/user-management';

type Props = {
  profile: UserProfile;
  onUpdated: (p: UserProfile) => void;
};

export function ProfileCard({ profile, onUpdated }: Props) {
  const loadMe = useAuthStore((s) => s.loadMe);
  const [name, setName] = useState(profile.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isDirty = name.trim() !== profile.name;

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const updated = await apiClient.put<UserProfile, UpdateProfileRequest>('/api/users/me', {
        name: name.trim(),
      });
      onUpdated(updated);
      await loadMe();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const tierBadgeClass = {
    free: 'bg-neutral-100 text-neutral-600',
    pro: 'bg-primary-50 text-primary-700',
    enterprise: 'bg-amber-50 text-amber-700',
  }[profile.subscription_tier] ?? 'bg-neutral-100 text-neutral-600';

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-white text-2xl font-bold">
          {profile.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {profile.name}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${tierBadgeClass}`}>
              {profile.subscription_tier}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              profile.role === 'admin'
                ? 'bg-rose-50 text-rose-700'
                : 'bg-neutral-100 text-neutral-600'
            }`}>
              {profile.role}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Full name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 hover:border-neutral-300 focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            placeholder="Your full name"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/50">
            <Mail className="h-4 w-4 shrink-0 text-neutral-400" />
            <div className="min-w-0">
              <p className="text-xs text-neutral-400">Email</p>
              <p className="truncate text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {profile.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/50">
            <Calendar className="h-4 w-4 shrink-0 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-400">Member since</p>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {formatDate(profile.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/50 sm:col-span-2">
            <Clock className="h-4 w-4 shrink-0 text-neutral-400" />
            <div>
              <p className="text-xs text-neutral-400">Last login</p>
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">
                {profile.last_login
                  ? new Date(profile.last_login).toLocaleString()
                  : 'Not recorded'}
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            Profile updated successfully.
          </div>
        ) : null}

        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-indigo-700 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </button>
      </div>
    </div>
  );
}
