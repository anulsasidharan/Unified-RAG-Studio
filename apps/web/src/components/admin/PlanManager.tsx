'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, Loader2, Check, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { AdminPlan } from '@/types/user-management';

type Props = {
  plans: AdminPlan[];
  onRefresh: () => void;
};

type PlanFormState = {
  name: string;
  description: string;
  price_monthly: string;
  price_yearly: string;
  features: string;
  is_active: boolean;
};

const EMPTY_FORM: PlanFormState = {
  name: '',
  description: '',
  price_monthly: '0',
  price_yearly: '0',
  features: '{"max_documents": 100, "api_calls_limit": 1000, "storage_limit_mb": 50}',
  is_active: true,
};

function PlanForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: PlanFormState;
  onSave: (data: PlanFormState) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PlanFormState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      JSON.parse(form.features);
    } catch {
      setError('Features must be valid JSON.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Plan name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="focus:border-primary-500 focus:ring-primary-500/20 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none focus:ring-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <input
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className="focus:border-primary-500 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <input
          type="number"
          placeholder="Monthly price ($)"
          value={form.price_monthly}
          onChange={(e) => setForm((f) => ({ ...f, price_monthly: e.target.value }))}
          className="focus:border-primary-500 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <input
          type="number"
          placeholder="Yearly price ($)"
          value={form.price_yearly}
          onChange={(e) => setForm((f) => ({ ...f, price_yearly: e.target.value }))}
          className="focus:border-primary-500 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
      </div>
      <textarea
        placeholder='Features JSON (e.g. {"max_documents": 100})'
        value={form.features}
        onChange={(e) => setForm((f) => ({ ...f, features: e.target.value }))}
        rows={3}
        className="focus:border-primary-500 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 font-mono text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
      />
      <label className="flex items-center gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          className="rounded"
        />
        Active
      </label>
      {error ? (
        <div className="border-destructive/20 bg-destructive/8 text-destructive rounded-xl border px-4 py-2.5 text-sm">
          {error}
        </div>
      ) : null}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving || !form.name}
          className="from-primary-600 flex items-center gap-2 rounded-xl bg-gradient-to-r to-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PlanManager({ plans, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleCreate = async (form: PlanFormState) => {
    await apiClient.post('/api/admin/plans', {
      name: form.name,
      description: form.description || null,
      price_monthly: parseFloat(form.price_monthly) || 0,
      price_yearly: parseFloat(form.price_yearly) || 0,
      features: JSON.parse(form.features),
    });
    setShowCreate(false);
    onRefresh();
  };

  const handleUpdate = async (planId: string, form: PlanFormState) => {
    await apiClient.put(`/api/admin/plans/${planId}`, {
      name: form.name,
      description: form.description || null,
      price_monthly: parseFloat(form.price_monthly) || 0,
      price_yearly: parseFloat(form.price_yearly) || 0,
      features: JSON.parse(form.features),
      is_active: form.is_active,
    });
    setEditingId(null);
    onRefresh();
  };

  const handleDelete = async (plan: AdminPlan) => {
    if (!confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
    setDeleting(plan.id);
    try {
      await apiClient.delete(`/api/admin/plans/${plan.id}`);
      onRefresh();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
          Subscription Plans
        </h2>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="from-primary-600 flex items-center gap-1.5 rounded-xl bg-gradient-to-r to-indigo-600 px-3 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" />
          New plan
        </button>
      </div>

      {showCreate ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <h3 className="mb-4 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Create Plan
          </h3>
          <PlanForm
            initial={EMPTY_FORM}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      ) : null}

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-400">No custom plans yet. Create one above.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
            >
              {editingId === plan.id ? (
                <PlanForm
                  initial={{
                    name: plan.name,
                    description: plan.description ?? '',
                    price_monthly: String(plan.price_monthly),
                    price_yearly: String(plan.price_yearly),
                    features: JSON.stringify(plan.features, null, 2),
                    is_active: plan.is_active,
                  }}
                  onSave={(form) => handleUpdate(plan.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100">
                          {plan.name}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            plan.is_active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-neutral-100 text-neutral-500'
                          }`}
                        >
                          {plan.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {plan.description ? (
                        <p className="mt-0.5 text-xs text-neutral-400">{plan.description}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingId(plan.id)}
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        disabled={deleting === plan.id}
                        className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"
                      >
                        {deleting === plan.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                      {plan.price_monthly === 0 ? 'Free' : `$${plan.price_monthly}/mo`}
                    </p>
                    {plan.price_yearly > 0 ? (
                      <p className="text-xs text-neutral-400">${plan.price_yearly}/yr</p>
                    ) : null}
                  </div>

                  <div className="space-y-1">
                    {Object.entries(plan.features).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="capitalize text-neutral-500">{k.replace(/_/g, ' ')}</span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {v === -1 ? 'Unlimited' : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
