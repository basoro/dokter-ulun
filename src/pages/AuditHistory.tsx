import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { API_URLS } from '@/config/api';
import { formatUIDateTime } from '@/lib/date-utils';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

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
  full_access?: boolean;
  actor_scope?: string;
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
  return formatUIDateTime(value);
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

const getPayloadRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const getAuditActorDisplay = (entry: AuditLogEntry) => {
  const payload = getPayloadRecord(entry.request_payload);
  const actorId = String(
    entry.actor_id
    || payload.username
    || payload.userId
    || payload.id_user
    || payload.kd_dokter
    || ''
  ).trim();
  const actorName = String(
    entry.actor_name
    || payload.nama
    || payload.doctorName
    || payload.nm_dokter
    || payload.dokter
    || payload.username
    || ''
  ).trim();

  return actorId
    ? `${actorId}${actorName && actorName !== actorId ? ` - ${actorName}` : ''}`
    : actorName || '-';
};

const ENTITY_LABELS: Record<string, string> = {
  allergy: 'Alergi',
  assesmen_rehab_medik: 'Asesmen Rehab Medik',
  auth_password: 'Password',
  balance_cairan: 'Balance Cairan',
  clinical_pathway: 'Clinical Pathway',
  clinical_pathway_execution: 'Eksekusi Clinical Pathway',
  clinical_pathway_patient_status: 'Status Clinical Pathway',
  digital_file: 'Berkas Digital',
  echocardiography: 'Ekokardiografi',
  examination: 'Pemeriksaan',
  icd_management: 'ICD Management',
  internal_referral: 'Rujukan Internal',
  laboratory_request: 'Permintaan Laboratorium',
  laboratory_review: 'Review Laboratorium',
  operation_report: 'Laporan Operasi',
  patient_contact: 'Kontak Pasien',
  patient_note: 'Catatan Pasien',
  prescription: 'Resep',
  procedure: 'Tindakan',
  radiology_report: 'Laporan Radiologi',
  radiology_request: 'Permintaan Radiologi',
  resume_pasien: 'Resume Pasien',
  resume_verification: 'Verifikasi Resume',
  triase_igd: 'Triase IGD'
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Tambah',
  update: 'Ubah',
  delete: 'Hapus',
  upsert: 'Simpan'
};

const STATUS_LABELS: Record<string, string> = {
  success: 'Sukses',
  error: 'Gagal'
};

const getEntityLabel = (value: string) => ENTITY_LABELS[String(value || '').trim()] || String(value || '-').trim() || '-';
const getActionLabel = (value: string) => ACTION_LABELS[String(value || '').trim()] || String(value || '-').trim() || '-';
const getStatusLabel = (value: string) => STATUS_LABELS[String(value || '').trim()] || String(value || '-').trim() || '-';
const getStatusChartColor = (value: string) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  if (normalizedValue === 'success') {
    return '#16a34a';
  }
  if (normalizedValue === 'error' || normalizedValue === 'failed' || normalizedValue === 'gagal') {
    return '#dc2626';
  }
  return '#f59e0b';
};

const getStatusTone = (value: string) => (
  String(value || '').trim().toLowerCase() === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300'
    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300'
);

const getAuditSummary = (entry: AuditLogEntry) => {
  const entity = getEntityLabel(entry.entity);
  const action = getActionLabel(entry.action);
  const reference = String(entry.reference_id || entry.no_rawat || entry.no_rkm_medis || '').trim();
  return reference ? `${action} ${entity} untuk ${reference}` : `${action} ${entity}`;
};

const AUDIT_CHART_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const AuditHistory: React.FC = () => {
  const { user } = useAuth();
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const [canAccess, setCanAccess] = React.useState(false);
  const [fullAccess, setFullAccess] = React.useState(false);
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
  const [selectedInsightView, setSelectedInsightView] = React.useState<'action' | 'actor' | 'module' | 'status'>('action');

  const auditInsights = React.useMemo(() => {
    const actionMap = new Map<string, number>();
    const actorMap = new Map<string, number>();
    const moduleMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    entries.forEach((entry) => {
      const actionKey = String(entry.action || '').trim() || '-';
      actionMap.set(actionKey, (actionMap.get(actionKey) || 0) + 1);

      const actorKey = getAuditActorDisplay(entry);
      actorMap.set(actorKey, (actorMap.get(actorKey) || 0) + 1);

      const moduleKey = getEntityLabel(entry.entity);
      moduleMap.set(moduleKey, (moduleMap.get(moduleKey) || 0) + 1);

      const statusKey = String(entry.status || '').trim() || '-';
      statusMap.set(statusKey, (statusMap.get(statusKey) || 0) + 1);
    });

    const toSortedArray = (map: Map<string, number>, labelFormatter?: (label: string) => string) => (
      Array.from(map.entries())
        .map(([name, total]) => ({
          name,
          label: labelFormatter ? labelFormatter(name) : name,
          total
        }))
        .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    );

    const actionData = toSortedArray(actionMap, getActionLabel);
    const actorData = toSortedArray(actorMap).slice(0, 5);
    const moduleData = toSortedArray(moduleMap).slice(0, 5);
    const statusData = toSortedArray(statusMap, getStatusLabel);

    return {
      actionData,
      actorData,
      moduleData,
      statusData,
      topAction: actionData[0] || null,
      topActor: actorData[0] || null,
      topModule: moduleData[0] || null,
      topStatus: statusData[0] || null
    };
  }, [entries]);

  const selectedInsight = React.useMemo(() => {
    if (selectedInsightView === 'status') {
      return {
        title: 'Status Hasil Aksi',
        description: 'Lihat distribusi hasil aksi audit seperti sukses dan error.',
        topLabel: auditInsights.topStatus?.label || '-',
        topCount: auditInsights.topStatus?.total || 0,
        data: auditInsights.statusData,
        color: '#f59e0b'
      };
    }

    if (selectedInsightView === 'actor') {
      return {
        title: 'Aktor Teraktif',
        description: 'Lihat aktor dengan aktivitas terbanyak pada data audit yang sedang tampil.',
        topLabel: auditInsights.topActor?.label || '-',
        topCount: auditInsights.topActor?.total || 0,
        data: auditInsights.actorData,
        color: '#0ea5e9'
      };
    }

    if (selectedInsightView === 'module') {
      return {
        title: 'Modul Teraktif',
        description: 'Lihat modul yang paling sering dipakai pada data audit yang sedang tampil.',
        topLabel: auditInsights.topModule?.label || '-',
        topCount: auditInsights.topModule?.total || 0,
        data: auditInsights.moduleData,
        color: '#10b981'
      };
    }

    return {
      title: 'Aksi Terbanyak',
      description: 'Lihat distribusi aksi seperti create, update, delete, dan aksi lainnya.',
      topLabel: auditInsights.topAction?.label || '-',
      topCount: auditInsights.topAction?.total || 0,
      data: auditInsights.actionData,
      color: '#8b5cf6'
    };
  }, [auditInsights, selectedInsightView]);

  React.useEffect(() => {
    const checkAccess = async () => {
      const username = String(user?.username || '').trim();
      if (!username) {
        setCanAccess(false);
        setFullAccess(false);
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
        setFullAccess(Boolean(result?.full_access));
      } catch (accessError) {
        setCanAccess(false);
        setFullAccess(false);
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

        setFullAccess(Boolean(result.full_access));
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
            Menampilkan seluruh riwayat audit karena kode dokter Anda terdaftar pada konfigurasi akses audit.
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
              placeholder="Cari no. rawat, endpoint, referensi, atau isi log"
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
              placeholder="Filter modul, mis. prescription"
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

      {!loading && entries.length > 0 ? (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h4 className="font-medium">Ringkasan Aktivitas Audit</h4>
                <p className="text-xs text-muted-foreground">
                  Pilih tampilan ringkasan sesuai kebutuhan: aksi, aktor, modul, atau status hasil aksi.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'action', label: 'Aksi', color: '#8b5cf6' },
                  { key: 'actor', label: 'Aktor', color: '#0ea5e9' },
                  { key: 'module', label: 'Modul', color: '#10b981' },
                  { key: 'status', label: 'Status', color: '#f59e0b' }
                ].map((item) => (
                  <Button
                    key={item.key}
                    type="button"
                    variant={selectedInsightView === item.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedInsightView(item.key as 'action' | 'actor' | 'module' | 'status')}
                    className="gap-2"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="w-fit">
                Berdasarkan data yang tampil
              </Badge>
              <Badge variant="outline" className="w-fit">
                Teratas: {selectedInsight.topLabel}
              </Badge>
              <Badge variant="outline" className="w-fit">
                {selectedInsight.topCount} aktivitas
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="mb-4">
                <h5 className="font-medium">{selectedInsight.title}</h5>
                <p className="text-sm text-muted-foreground">
                  {selectedInsight.description}
                </p>
              </div>

              <ResponsiveContainer width="100%" height={320}>
                <BarChart
                  data={selectedInsight.data}
                  margin={{ left: 8, right: 12, top: 8, bottom: 24 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="label"
                    interval={0}
                    angle={selectedInsight.data.length > 4 ? -18 : 0}
                    textAnchor={selectedInsight.data.length > 4 ? 'end' : 'middle'}
                    height={selectedInsight.data.length > 4 ? 72 : 40}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={40}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip formatter={(value: number) => [`${value} aktivitas`, 'Total']} />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                    {selectedInsight.data.map((item, index) => (
                      <Cell
                        key={`${selectedInsightView}-bar-${item.name}`}
                        fill={
                          selectedInsightView === 'action'
                            ? AUDIT_CHART_COLORS[index % AUDIT_CHART_COLORS.length]
                            : selectedInsightView === 'status'
                              ? getStatusChartColor(item.name)
                              : selectedInsight.color
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      ) : null}

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
                      {getAuditSummary(entry)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatDateTime(entry.created_at)} · {entry.method} {entry.endpoint}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                      {getEntityLabel(entry.entity)}
                    </span>
                    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-300">
                      {getActionLabel(entry.action)}
                    </span>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusTone(entry.status)}`}>
                      {getStatusLabel(entry.status)}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Aktor</p>
                    <p className="font-medium">{getAuditActorDisplay(entry)}</p>
                  </div>
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
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="text-muted-foreground">Ringkasan</p>
                  <p className="font-medium text-foreground">{getAuditSummary(entry)}</p>
                </div>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Data yang dikirim</p>
                    <pre className="max-h-64 overflow-auto rounded-md border bg-slate-950 p-3 text-xs text-slate-100 dark:border-slate-800">
                      {formatJson(entry.request_payload)}
                    </pre>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">Hasil proses</p>
                    <pre className="max-h-64 overflow-auto rounded-md border bg-slate-950 p-3 text-xs text-slate-100 dark:border-slate-800">
                      {formatJson(entry.response_payload)}
                    </pre>
                  </div>
                </div>
                {entry.error_message ? (
                  <div>
                    <p className="mb-2 text-sm font-medium text-red-700 dark:text-red-300">Pesan error</p>
                    <pre className="overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
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
