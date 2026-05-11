'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { UserTable } from '@/components/admin/UserTable';
import type { AdminUsersListResponse } from '@/types/user-management';

export default function AdminUsersPage() {
  const [data, setData] = useState<AdminUsersListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: '25',
        ...(search ? { search } : {}),
      });
      const res = await apiClient.get<AdminUsersListResponse>(`/api/admin/users?${params}`);
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void fetchUsers(); }, [fetchUsers]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="relative">
      {loading ? (
        <div className="absolute right-4 top-4 z-10">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      ) : null}
      <UserTable
        data={data}
        onRefresh={fetchUsers}
        search={search}
        onSearchChange={setSearch}
        page={page}
        onPageChange={setPage}
      />
    </div>
  );
}
