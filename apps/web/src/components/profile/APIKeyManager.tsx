'use client';

import { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { APIKey, CreateAPIKeyResponse } from '@/types/user-management';

export function APIKeyManager() {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await apiClient.get<{ api_keys: APIKey[] }>('/api/api-keys');
      setKeys(res.api_keys);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchKeys(); }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await apiClient.post<CreateAPIKeyResponse>('/api/api-keys', {
        key_name: newKeyName.trim(),
      });
      setNewKeyValue(res.api_key);
      setNewKeyName('');
      setShowCreate(false);
      await fetchKeys();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    setRevoking(keyId);
    try {
      await apiClient.delete(`/api/api-keys/${keyId}`);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch {
      // ignore
    } finally {
      setRevoking(null);
    }
  };

  const copyKey = async () => {
    if (!newKeyValue) return;
    await navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-5 w-5 text-primary-500" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">API Keys</h3>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          <Plus className="h-4 w-4" />
          New key
        </button>
      </div>

      {newKeyValue ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            Copy your key now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-auto rounded-lg bg-amber-100 px-3 py-2 text-xs font-mono text-amber-900">
              {newKeyValue}
            </code>
            <button
              onClick={copyKey}
              className="shrink-0 rounded-lg bg-amber-600 p-2 text-white hover:bg-amber-700"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <button
            onClick={() => setNewKeyValue(null)}
            className="mt-2 text-xs text-amber-700 hover:underline"
          >
            I&apos;ve saved my key, dismiss
          </button>
        </div>
      ) : null}

      {showCreate ? (
        <div className="mb-5 flex gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Key name (e.g. Production)"
            className="flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : keys.length === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-400">
          No API keys yet. Create one to authenticate API requests.
        </p>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-800/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-100">
                  {k.key_name}
                </p>
                <p className="text-xs text-neutral-400">
                  <code>{k.key_prefix}…</code>
                  {k.last_used
                    ? ` · Last used ${new Date(k.last_used).toLocaleDateString()}`
                    : ' · Never used'}
                  {k.expires_at
                    ? ` · Expires ${new Date(k.expires_at).toLocaleDateString()}`
                    : ''}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(k.id)}
                disabled={revoking === k.id}
                className="ml-3 shrink-0 rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/30"
              >
                {revoking === k.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
