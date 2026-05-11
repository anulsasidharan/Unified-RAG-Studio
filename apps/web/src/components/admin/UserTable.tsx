'use client';

import { useState } from 'react';
import {
  Search, ChevronLeft, ChevronRight, Trash2, Edit2, UserCheck, UserX, Loader2, Plus
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { AdminUser, AdminUsersListResponse, CreateUserRequest, UpdateUserRequest } from '@/types/user-management';

type Props = {
  data: AdminUsersListResponse;
  onRefresh: () => void;
  search: string;
  onSearchChange: (v: string) => void;
  page: number;
  onPageChange: (p: number) => void;
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      role === 'admin'
        ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
    }`}>
      {role}
    </span>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const cls = {
    free: 'bg-neutral-100 text-neutral-600',
    pro: 'bg-primary-50 text-primary-700',
    enterprise: 'bg-amber-50 text-amber-700',
  }[tier] ?? 'bg-neutral-100 text-neutral-600';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {tier}
    </span>
  );
}

function CreateUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserRequest>({
    email: '', name: '', password: '', role: 'user', subscription_tier: 'free',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/api/admin/users', form);
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <h2 className="mb-5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Create User
        </h2>
        <div className="space-y-3">
          {(['name', 'email', 'password'] as const).map((field) => (
            <input
              key={field}
              type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
              placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          ))}
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={form.subscription_tier}
              onChange={(e) => setForm((f) => ({ ...f, subscription_tier: e.target.value }))}
              className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            >
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          {error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={handleCreate}
            disabled={saving || !form.email || !form.name || !form.password}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserTable({ data, onRefresh, search, onSearchChange, page, onPageChange }: Props) {
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const handleToggleActive = async (user: AdminUser) => {
    setToggling(user.id);
    try {
      await apiClient.put<unknown, UpdateUserRequest>(`/api/admin/users/${user.id}`, {
        is_active: !user.is_active,
      });
      onRefresh();
    } catch {
      // ignore
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Delete user "${user.name}" (${user.email})? This cannot be undone.`)) return;
    setDeleting(user.id);
    try {
      await apiClient.delete(`/api/admin/users/${user.id}`);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      {showCreate ? (
        <CreateUserModal onClose={() => setShowCreate(false)} onCreated={onRefresh} />
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 dark:border-neutral-800">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => { onSearchChange(e.target.value); onPageChange(1); }}
              placeholder="Search users…"
              className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />
          </div>
          <div className="ml-3 flex items-center gap-2">
            <span className="text-sm text-neutral-500">{data.total} users</span>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Add user
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left dark:border-neutral-800">
                {['Name', 'Role', 'Plan', 'Status', 'Last Login', 'Actions'].map((h) => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800/50">
              {data.users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30"
                >
                  <td className="px-5 py-3">
                    <div>
                      <p className="font-medium text-neutral-800 dark:text-neutral-100">{user.name}</p>
                      <p className="text-xs text-neutral-400">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-5 py-3">
                    <TierBadge tier={user.subscription_tier} />
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      user.is_active
                        ? 'bg-green-50 text-green-700'
                        : 'bg-red-50 text-red-700'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-400">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={toggling === user.id}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 disabled:opacity-50 dark:hover:bg-neutral-800"
                      >
                        {toggling === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : user.is_active ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        disabled={deleting === user.id}
                        title="Delete user"
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/30"
                      >
                        {deleting === user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data.users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-neutral-400">
                    No users found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {data.pages > 1 ? (
          <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 dark:border-neutral-800">
            <span className="text-xs text-neutral-400">
              Page {page} of {data.pages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= data.pages}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
