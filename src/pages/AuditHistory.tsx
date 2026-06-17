import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { API_URLS } from '@/config/api';

interface AuditLogEntry {
  log_id: string;
  created_at: string;
  action: string;
  entity: string;
  status: string;
  endpoint: string;
  method: string;
  actor_id: string;
  actor_name: string;
  no_rawat: string;
  no_rkm_medis: string;
  reference_id: string;
  ip_address: string;
  user_agent: string;
  request_payload: Record<string, unknown> | unknown[];
  response_payload: Record<string, unknown> | unknown[];
  error_message: string;
}

interface AuditHistoryResponse {
  success: boolean;
  data?: AuditLogEntry[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
}

const formatDateTime = (value: string) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const formatJson = (value: unknown) => {
  if (value === null || value === undefined) {
    return '-';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const AuditHistory: React.FC = () => {
  const { user } = useAuth();
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const [canAccess, setCanAccess] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [entries, setEntries] = React.useState<AuditLogEntry[]>([]);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 25,
    total: 0,
    hasMore: false
  });
  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [action, setAction] = React.useState('all');
  const [status, setStatus] = React.useState('all');
  const [entity, setEntity] = React.useState('');

  React.useEffect(() => {
    const checkAccess = async () => {
      const username = String(user?.username || '').trim();
      if (!username) {
        setCanAccess(false);
        setCheckingAccess(false);
        return;
      }

      setCheckingAccess(true);
      setError('');

      try {
        const response = await fetch(`${API_URLS.AUDIT_HISTORY_ACCESS}/${encodeURIComponent(username)}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || 'Gagal memeriksa akses riwayat audit');
        }

        setCanAccess(Boolean(result?.can_access));
      } catch (accessError) {
        setCanAccess(false);
        setError(accessError instanceof Error ? accessError.message : 'Gagal memeriksa akses riwayat audit');
      } finally {
        setCheckingAccess(false);
      }
    };

    void checkAccess();
  }, [user?.username]);

  React.useEffect(() => {
    const username = String(user?.username || '').trim();
    if (!username || !canAccess) {
      setEntries([]);
      return;
    }

    const fetchAuditHistory = async () => {
      setLoading(true);
      setError('');

      try {
        const params = new URLSearchParams({
          username,
          page: String(page),
          limit: String(pagination.limit)
        });

        if (search) {
          params.set('search', search);
        }
        if (action !== 'all') {
          params.set('action', action);
        }
        if (status !== 'all') {
          params.set('status', status);
        }
        if (entity.trim()) {
          params.set('entity', entity.trim());
        }

        const response = await fetch(`${API_URLS.AUDIT_HISTORY}?${params.toString()}`);
        const result = (await response.json()) as AuditHistoryResponse;

        if (!response.ok || !result.success) {
          throw new Error(result?.error || 'Gagal memuat riwayat audit');
        }

        setEntries(Array.isArray(result.data) ? result.data : []);
        setPagination((previous) => ({
          ...previous,
          page: result.pagination?.page || page,
          total: result.pagination?.total || 0,
          hasMore: Boolean(result.pagination?.hasMore)
        }));
      } catch (fetchError) {
        setEntries([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat riwayat audit');
      } finally {
        setLoading(false);
      }
    };

    void fetchAuditHistory();
  }, [action, canAccess, entity, page, pagination.limit, search, status, user?.username]);

  const handleApplyFilter = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  if (checkingAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Audit</h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Memeriksa akses riwayat audit...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Audit</h1>
        <Card>
          <CardContent className="p-6 text-sm text-red-600">
            {error || 'Anda tidak memiliki akses ke halaman riwayat audit.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Riwayat Audit</h1>
          <p className="text-sm text-muted-foreground">
            Menampilkan log proses create, update, dan delete dari backend.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Total log: <span className="font-medium text-foreground">{pagination.total}</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter Audit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Cari username, endpoint, no rawat, payload"
            />
            <Select value={action} onValueChange={(value) => { setAction(value); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Semua aksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua aksi</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="upsert">Upsert</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="success">Sukses</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={entity}
              onChange={(event) => {
                setEntity(event.target.value);
                setPage(1);
              }}
              placeholder="Filter entity, mis. prescription"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleApplyFilter}>Terapkan Pencarian</Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchInput('');
                setSearch('');
                setAction('all');
                setStatus('all');
                setEntity('');
                setPage(1);
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="p-4 text-sm text-red-600">{error}</CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Memuat riwayat audit...
            </CardContent>
          </Card>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Belum ada data riwayat audit.
            </CardContent>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.log_id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      {entry.entity || '-'} · {entry.action || '-'} · {entry.status || '-'}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(entry.created_at)} · {entry.method} {entry.endpoint}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const actorId = String(entry.actor_id || '').trim();
                      const actorName = String(entry.actor_name || '').trim();
                      const display = actorId
                        ? `${actorId}${actorName && actorName !== actorId ? ` - ${actorName}` : ''}`
                        : actorName || '-';

                      return (
                        <>
                          Aktor: <span className="font-medium text-foreground">{display}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">No. Rawat</p>
                    <p className="font-medium">{entry.no_rawat || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">No. RM</p>
                    <p className="font-medium">{entry.no_rkm_medis || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Reference ID</p>
                    <p className="font-medium">{entry.reference_id || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-900">Request Payload</p>
                    <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                      {formatJson(entry.request_payload)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-900">Response Payload</p>
                    <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                      {formatJson(entry.response_payload)}
                    </pre>
                  </div>
                </div>
                {entry.error_message ? (
                  <div>
                    <p className="mb-2 text-sm font-medium text-red-700">Error</p>
                    <pre className="overflow-auto rounded-md bg-red-50 p-3 text-xs text-red-700">
                      {entry.error_message}
                    </pre>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Halaman {pagination.page} · Menampilkan {entries.length} data
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((previous) => Math.max(previous - 1, 1))}
          >
            Sebelumnya
          </Button>
          <Button
            variant="outline"
            disabled={!pagination.hasMore || loading}
            onClick={() => setPage((previous) => previous + 1)}
          >
            Berikutnya
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuditHistory;
