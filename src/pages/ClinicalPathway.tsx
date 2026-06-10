import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { API_URLS } from '@/config/api';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Loader2,
  RefreshCw,
  UserRound
} from 'lucide-react';

interface DiagnosisItem {
  kd_penyakit: string;
  nm_penyakit: string;
  prioritas: number;
  status: string;
}

interface MasterRecommendation {
  id: number;
  kode_cp: string;
  nama_cp: string;
  status_layanan: string;
  target_los: number;
  confidence_score: number;
  matched_icd_count: number;
  matched_diagnoses: Array<{
    kd_penyakit: string;
    nm_penyakit: string;
  }>;
}

interface TemplateActivity {
  kategori: string;
  uraian_kegiatan: string;
  item_nama: string;
  keterangan?: string;
  frequency?: number;
  coverage_percentage?: number;
}

interface TemplateDay {
  hari_ke: number;
  label_hari: string;
  activities: TemplateActivity[];
}

interface TemplateData {
  source_case_count: number;
  generated_from_history: boolean;
  days: TemplateDay[];
}

interface ExistingPathway {
  id: number;
  clinical_pathway_id: number;
  kode_cp: string;
  nama_cp: string;
  status_cp: string;
  status_layanan: string;
  target_los: number;
  compliance_percentage: number;
  tanggal_mulai: string;
}

interface RegistrationData {
  no_rkm_medis: string;
  nm_pasien: string;
  jk: string;
  tgl_lahir: string;
  umur: number;
  no_rawat: string;
  tgl_registrasi: string;
  jam_reg: string;
  nm_dokter: string;
  nm_poli: string;
  png_jawab: string;
  status_lanjut: string;
}

interface ClinicalPathwayPreview {
  registration: RegistrationData;
  diagnoses: DiagnosisItem[];
  existing: ExistingPathway | null;
  master_recommendations: MasterRecommendation[];
  selected_clinical_pathway_id: number | null;
  master_template: TemplateData;
  historical_template: TemplateData;
}

interface MonitoringPatientDetail {
  id: number;
  no_rawat: string;
  kd_penyakit: string;
  status_cp: string;
  tanggal_mulai: string;
  tanggal_selesai?: string | null;
  kode_cp: string;
  nama_cp: string;
  target_los: number;
  status_layanan: string;
  no_rkm_medis: string;
  nm_pasien: string;
  nm_penyakit?: string;
  compliance_percentage: number;
  variance_count: number;
}

interface MonitoringExecution {
  id: number;
  cp_patient_id: number;
  hari_ke: number;
  status: string;
  tanggal_rencana?: string;
  tanggal_realisasi?: string | null;
  catatan?: string;
  kategori: string;
  kegiatan: string;
  uraian_kegiatan: string;
  aktivitas: string;
  keterangan?: string;
}

interface MonitoringVariance {
  id: number;
  hari_ke: number;
  kategori_variance: string;
  deskripsi: string;
  status: string;
  severity: string;
  tanggal_variance: string;
}

interface MonitoringDetail {
  patient: MonitoringPatientDetail;
  execution: MonitoringExecution[];
  variance: MonitoringVariance[];
}

type WorkflowMode = 'initiation' | 'monitoring';

const formatNoRawatDisplay = (value?: string) => {
  const noRawat = String(value || '').trim();
  if (!noRawat) {
    return '-';
  }

  if (noRawat.includes('/')) {
    return noRawat;
  }

  if (noRawat.length >= 8) {
    return `${noRawat.slice(0, 4)}/${noRawat.slice(4, 6)}/${noRawat.slice(6, 8)}/${noRawat.slice(8)}`;
  }

  return noRawat;
};

const formatDateDisplay = (value?: string) => {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString('id-ID');
};

const formatDateTimeDisplay = (dateValue?: string, timeValue?: string) => {
  if (!dateValue) {
    return '-';
  }

  return `${formatDateDisplay(dateValue)}${timeValue ? ` ${String(timeValue).slice(0, 5)}` : ''}`;
};

const formatGender = (value?: string) => {
  return value === 'L' ? 'Laki-laki' : value === 'P' ? 'Perempuan' : '-';
};

const getExecutionBadgeClass = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'missed') return 'bg-red-100 text-red-800';
  if (normalized === 'variance') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-800';
};

const getPatientStatusBadgeClass = (status?: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'selesai') return 'bg-emerald-100 text-emerald-800';
  if (normalized === 'drop') return 'bg-red-100 text-red-800';
  if (normalized === 'draft') return 'bg-amber-100 text-amber-800';
  return 'bg-blue-100 text-blue-800';
};

const ClinicalPathway = () => {
  const { toast } = useToast();
  const { no_rkm_medis, no_rawat } = useParams<{ no_rkm_medis: string; no_rawat: string }>();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringActionKey, setMonitoringActionKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<ClinicalPathwayPreview | null>(null);
  const [monitoring, setMonitoring] = useState<MonitoringDetail | null>(null);
  const [selectedClinicalPathwayId, setSelectedClinicalPathwayId] = useState<number | null>(null);
  const normalizedNoRawatParam = useMemo(() => String(no_rawat || '').replace(/\//g, ''), [no_rawat]);

  const selectedRecommendation = useMemo(
    () => preview?.master_recommendations.find((item) => item.id === selectedClinicalPathwayId) || null,
    [preview, selectedClinicalPathwayId]
  );
  const hasMasterTemplate = Boolean(preview?.master_template.days.length);
  const hasHistoricalTemplate = Boolean(preview?.historical_template.days.length);

  const requestedMode = searchParams.get('mode');
  const workflowMode = useMemo<WorkflowMode>(() => {
    if (requestedMode === 'monitoring') {
      return 'monitoring';
    }

    if (requestedMode === 'initiation') {
      return 'initiation';
    }

    if (preview?.existing && preview.registration.status_lanjut === 'Ranap') {
      return 'monitoring';
    }

    return 'initiation';
  }, [requestedMode, preview]);

  const canGeneratePatientPathway =
    workflowMode === 'initiation' &&
    !preview?.existing &&
    !!selectedClinicalPathwayId &&
    (hasMasterTemplate || hasHistoricalTemplate);

  const loadPreview = async (preferredClinicalPathwayId?: number | null) => {
    if (!no_rkm_medis || !normalizedNoRawatParam) {
      return;
    }

    try {
      setLoading(true);
      const query = preferredClinicalPathwayId ? `?clinical_pathway_id=${preferredClinicalPathwayId}` : '';
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/${no_rkm_medis}/${normalizedNoRawatParam}${query}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal memuat preview Clinical Pathway');
      }

      setPreview(result.data);
      setSelectedClinicalPathwayId(
        result.data.selected_clinical_pathway_id ||
        result.data.existing?.clinical_pathway_id ||
        result.data.master_recommendations?.[0]?.id ||
        null
      );
    } catch (error) {
      console.error('Error loading clinical pathway preview:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat preview Clinical Pathway',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectClinicalPathway = (clinicalPathwayId: number) => {
    setSelectedClinicalPathwayId(clinicalPathwayId);
    void loadPreview(clinicalPathwayId);
  };

  const loadMonitoring = async () => {
    if (!normalizedNoRawatParam) {
      return;
    }

    try {
      setMonitoringLoading(true);
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/monitoring/by-no-rawat/${normalizedNoRawatParam}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        setMonitoring(null);
        return;
      }

      setMonitoring(result.data);
    } catch (error) {
      console.error('Error loading clinical pathway monitoring:', error);
      setMonitoring(null);
    } finally {
      setMonitoringLoading(false);
    }
  };

  useEffect(() => {
    void loadPreview();
  }, [no_rkm_medis, no_rawat]);

  useEffect(() => {
    if (workflowMode === 'monitoring') {
      void loadMonitoring();
      return;
    }

    setMonitoring(null);
  }, [workflowMode, no_rawat, preview?.existing?.id]);

  const handleGeneratePatientPathway = async () => {
    if (!no_rkm_medis || !normalizedNoRawatParam) {
      return;
    }

    try {
      setGenerateLoading(true);
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/generate-patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rkm_medis,
          no_rawat: normalizedNoRawatParam,
          clinical_pathway_id: selectedClinicalPathwayId || undefined
        })
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal generate Clinical Pathway pasien');
      }

      toast({
        title: 'Berhasil',
        description: `Clinical Pathway pasien berhasil digenerate (${result.data?.generated_activity_count || 0} aktivitas).`
      });

      if (result.data?.preview) {
        setPreview(result.data.preview);
        setSelectedClinicalPathwayId(
          result.data.preview.selected_clinical_pathway_id ||
          result.data.preview.existing?.clinical_pathway_id ||
          selectedClinicalPathwayId
        );
      } else {
        await loadPreview();
      }
      await loadMonitoring();
    } catch (error) {
      console.error('Error generating clinical pathway patient:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal generate Clinical Pathway pasien',
        variant: 'destructive'
      });
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleRefreshMonitoring = async () => {
    if (!monitoring?.patient?.id) {
      return;
    }

    try {
      setMonitoringActionKey('refresh');
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/monitoring/${monitoring.patient.id}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal refresh monitoring');
      }

      setMonitoring(result.data);
      await loadPreview();
      toast({
        title: 'Berhasil',
        description: 'Monitoring Clinical Pathway berhasil diperbarui.'
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal refresh monitoring',
        variant: 'destructive'
      });
    } finally {
      setMonitoringActionKey(null);
    }
  };

  const handleUpdateExecutionStatus = async (executionId: number, status: 'planned' | 'completed' | 'missed') => {
    if (!monitoring?.patient?.id) {
      return;
    }

    try {
      setMonitoringActionKey(`exec-${executionId}-${status}`);
      const response = await fetch(
        `${API_URLS.CLINICAL_PATHWAY}/monitoring/${monitoring.patient.id}/execution/${executionId}/status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status })
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal mengubah status aktivitas monitoring');
      }

      setMonitoring(result.data);
      await loadPreview();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mengubah status aktivitas monitoring',
        variant: 'destructive'
      });
    } finally {
      setMonitoringActionKey(null);
    }
  };

  const handleUpdatePatientStatus = async (status: 'Aktif' | 'Selesai' | 'Drop') => {
    if (!monitoring?.patient?.id) {
      return;
    }

    try {
      setMonitoringActionKey(`patient-${status}`);
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/monitoring/${monitoring.patient.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Gagal mengubah status pasien Clinical Pathway');
      }

      setMonitoring(result.data);
      await loadPreview();
      toast({
        title: 'Berhasil',
        description: `Status Clinical Pathway pasien diubah menjadi ${status}.`
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal mengubah status pasien Clinical Pathway',
        variant: 'destructive'
      });
    } finally {
      setMonitoringActionKey(null);
    }
  };

  if (!no_rkm_medis || !no_rawat) {
    return (
      <div className="w-full p-4">
        <Card>
          <CardHeader>
            <CardTitle>Clinical Pathway</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Buka halaman ini dari daftar pasien agar nomor rawat dan status layanan pasien otomatis terbaca.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full p-4 space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary">
                <FileText className="h-5 w-5" />
                <span className="text-sm font-semibold uppercase tracking-wide">Clinical Pathway</span>
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">
                  {workflowMode === 'monitoring' ? 'Monitoring Clinical Pathway' : 'Inisiasi Clinical Pathway'}
                </CardTitle>
                <Badge variant={workflowMode === 'monitoring' ? 'secondary' : 'default'}>
                  {workflowMode === 'monitoring' ? 'Monitoring' : 'Inisiasi'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {workflowMode === 'monitoring'
                  ? 'Pasien yang sudah masuk rawat inap menggunakan Clinical Pathway sebagai alat monitoring realisasi, kepatuhan, dan variance.'
                  : 'Clinical Pathway dibuat pertama kali saat pasien dari rawat jalan atau IGD masuk ke rumah sakit, menggunakan master CP dan histori kasus serupa.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void loadPreview()} disabled={loading || generateLoading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
              {workflowMode === 'monitoring' ? (
                <Button onClick={handleRefreshMonitoring} disabled={loading || monitoringLoading || monitoringActionKey === 'refresh' || !monitoring?.patient?.id}>
                  {monitoringLoading || monitoringActionKey === 'refresh'
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <RefreshCw className="mr-2 h-4 w-4" />}
                  Refresh Monitoring
                </Button>
              ) : (
                <Button onClick={handleGeneratePatientPathway} disabled={loading || generateLoading || !canGeneratePatientPathway}>
                  {generateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Generate Pasien
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {preview ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5" />
                Ringkasan Pasien
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Nama Pasien</div>
                <div className="font-medium">{preview.registration.nm_pasien}</div>
                <div className="text-sm text-muted-foreground">RM {preview.registration.no_rkm_medis}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Nomor Rawat</div>
                <div className="font-medium">{formatNoRawatDisplay(preview.registration.no_rawat)}</div>
                <div className="text-sm text-muted-foreground">{preview.registration.nm_poli || '-'}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Status Lanjut</div>
                <div className="font-medium">{preview.registration.status_lanjut}</div>
                <div className="text-sm text-muted-foreground">{preview.registration.nm_dokter || '-'}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Registrasi</div>
                <div className="font-medium">{formatDateTimeDisplay(preview.registration.tgl_registrasi, preview.registration.jam_reg)}</div>
                <div className="text-sm text-muted-foreground">
                  {formatGender(preview.registration.jk)} • {preview.registration.umur || 0} th
                </div>
              </div>
            </CardContent>
          </Card>

          {preview.existing ? (
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-emerald-700">Clinical Pathway pasien sudah ada</div>
                    <div className="text-sm text-emerald-900">
                      {preview.existing.kode_cp} - {preview.existing.nama_cp}
                    </div>
                    <div className="text-xs text-emerald-700">
                      Status {preview.existing.status_cp} • Kepatuhan {Number(preview.existing.compliance_percentage || 0).toFixed(2)}%
                    </div>
                  </div>
                  <Badge variant="secondary" className="w-fit bg-emerald-100 text-emerald-800">
                    {preview.existing.status_layanan}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {workflowMode === 'monitoring' && !preview.existing ? (
            <Card className="border-amber-200 bg-amber-50/60">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                <div className="space-y-1 text-sm">
                  <div className="font-semibold text-amber-800">Clinical Pathway belum tersedia untuk monitoring</div>
                  <div className="text-amber-700">
                    Sesuai alur kerja, CP sebaiknya dibuat terlebih dahulu dari pasien rawat jalan atau IGD saat pasien masuk rumah sakit.
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Diagnosis ICD-10 Aktif
                </CardTitle>
              </CardHeader>
              <CardContent>
                {preview.diagnoses.length ? (
                  <div className="space-y-3">
                    {preview.diagnoses.map((diagnosis) => (
                      <div key={`${diagnosis.kd_penyakit}-${diagnosis.prioritas}`} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium">{diagnosis.kd_penyakit}</div>
                          <Badge variant={diagnosis.prioritas === 1 ? 'default' : 'secondary'}>
                            Prioritas {diagnosis.prioritas}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{diagnosis.nm_penyakit || '-'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Diagnosis pasien untuk status layanan ini belum ditemukan.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Ringkasan Migrasi
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Master CP Cocok</div>
                  <div className="text-2xl font-semibold">{preview.master_recommendations.length}</div>
                  <div className="text-xs text-muted-foreground">Top 10 berdasarkan ICD-10</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Hari Template Master</div>
                  <div className="text-2xl font-semibold">{preview.master_template.days.length}</div>
                  <div className="text-xs text-muted-foreground">Hari dari CP terpilih</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Kasus Historis</div>
                  <div className="text-2xl font-semibold">{preview.historical_template.source_case_count}</div>
                  <div className="text-xs text-muted-foreground">Sumber 1 tahun terakhir</div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Hari Template Histori</div>
                  <div className="text-2xl font-semibold">{preview.historical_template.days.length}</div>
                  <div className="text-xs text-muted-foreground">Hari rawat hasil agregasi</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {workflowMode === 'initiation' ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Master Clinical Pathway Otomatis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {preview.master_recommendations.length ? (
                    preview.master_recommendations.map((recommendation) => {
                      const isSelected = selectedClinicalPathwayId === recommendation.id;
                      return (
                        <button
                          key={recommendation.id}
                          type="button"
                          onClick={() => handleSelectClinicalPathway(recommendation.id)}
                          className={`w-full rounded-lg border p-4 text-left transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                              : 'hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{recommendation.kode_cp}</span>
                                <Badge variant={isSelected ? 'default' : 'secondary'}>
                                  {recommendation.status_layanan}
                                </Badge>
                                <Badge variant="outline">Match {recommendation.matched_icd_count}</Badge>
                                <Badge variant="outline">LOS {recommendation.target_los || 0} hari</Badge>
                              </div>
                              <div className="font-medium">{recommendation.nama_cp}</div>
                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                {recommendation.matched_diagnoses.map((diagnosis) => (
                                  <span key={`${recommendation.id}-${diagnosis.kd_penyakit}`} className="rounded bg-muted px-2 py-1">
                                    {diagnosis.kd_penyakit} - {diagnosis.nm_penyakit || '-'}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Confidence {Number(recommendation.confidence_score || 0).toFixed(2)}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Belum ada master Clinical Pathway yang cocok dari diagnosis ICD-10 pasien ini.
                    </div>
                  )}
                  {selectedRecommendation ? (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                      Master terpilih: <span className="font-medium text-foreground">{selectedRecommendation.kode_cp} - {selectedRecommendation.nama_cp}</span>.
                      Template master dan histori di bawah mengikuti CP yang sedang dipilih. Jika template master kosong, sistem akan memakai histori 1 tahun terakhir saat `Generate Pasien` dijalankan.
                    </div>
                  ) : null}
                  {!hasMasterTemplate && !hasHistoricalTemplate && selectedRecommendation ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
                      CP terpilih sudah cocok berdasarkan ICD-10, tetapi belum memiliki template master maupun histori 1 tahun yang cukup untuk digenerate otomatis.
                    </div>
                  ) : null}
                  {preview.existing ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-800">
                      Clinical Pathway pasien ini sudah pernah dibuat. Untuk pasien yang sudah masuk rawat inap, gunakan mode monitoring.
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Template Master CP Terpilih
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {preview.master_template.days.length ? (
                    preview.master_template.days.map((day) => (
                      <div key={day.hari_ke} className="rounded-lg border">
                        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                          <div>
                            <div className="font-medium">{day.label_hari}</div>
                            <div className="text-xs text-muted-foreground">{day.activities.length} aktivitas master</div>
                          </div>
                          <Badge variant="secondary">{day.hari_ke}</Badge>
                        </div>
                        <div className="divide-y">
                          {day.activities.map((activity, index) => (
                            <div key={`${day.hari_ke}-${activity.kategori}-${activity.item_nama}-${index}`} className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr_140px]">
                              <div>
                                <div className="text-xs text-muted-foreground">Kategori</div>
                                <div className="font-medium">{activity.kategori}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">{activity.uraian_kegiatan}</div>
                                <div className="font-medium">{activity.item_nama}</div>
                                {activity.keterangan ? (
                                  <div className="text-sm text-muted-foreground">{activity.keterangan}</div>
                                ) : null}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <div>Frekuensi: {activity.frequency || 0}</div>
                                <div>Cakupan: {Number(activity.coverage_percentage || 0).toFixed(2)}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Template master untuk CP terpilih belum tersedia. Jika histori 1 tahun ada, sistem masih bisa membentuk template otomatis dari histori tersebut.
                    </div>
                  )}
                  <Separator />
                  <div className="text-xs text-muted-foreground">
                    Template master berasal dari definisi Clinical Pathway yang tersimpan di database dan menjadi acuan utama saat generate CP pasien.
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Template Harian Dari Histori 1 Tahun Terakhir
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {preview.historical_template.days.length ? (
                    preview.historical_template.days.map((day) => (
                      <div key={day.hari_ke} className="rounded-lg border">
                        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                          <div>
                            <div className="font-medium">{day.label_hari}</div>
                            <div className="text-xs text-muted-foreground">{day.activities.length} aktivitas hasil agregasi</div>
                          </div>
                          <Badge variant="secondary">{day.hari_ke}</Badge>
                        </div>
                        <div className="divide-y">
                          {day.activities.map((activity, index) => (
                            <div key={`${day.hari_ke}-${activity.kategori}-${activity.item_nama}-${index}`} className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr_140px]">
                              <div>
                                <div className="text-xs text-muted-foreground">Kategori</div>
                                <div className="font-medium">{activity.kategori}</div>
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground">{activity.uraian_kegiatan}</div>
                                <div className="font-medium">{activity.item_nama}</div>
                                {activity.keterangan ? (
                                  <div className="text-sm text-muted-foreground">{activity.keterangan}</div>
                                ) : null}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <div>Frekuensi: {activity.frequency || 0}</div>
                                <div>Cakupan: {Number(activity.coverage_percentage || 0).toFixed(2)}%</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Belum ada histori yang cukup dalam 1 tahun terakhir untuk membentuk template harian otomatis.
                      {preview.master_template.days.length
                        ? ' Template master tetap tersedia dan bisa dipakai untuk generate Clinical Pathway pasien ini.'
                        : ''}
                    </div>
                  )}
                  <Separator />
                  <div className="text-xs text-muted-foreground">
                    Template ini dibentuk dari agregasi pemeriksaan, tindakan, resep, permintaan laboratorium, dan permintaan radiologi pada kasus serupa dengan status layanan yang sama.
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Monitoring Clinical Pathway Rawat Inap
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {monitoringLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat detail monitoring...
                  </div>
                ) : monitoring?.patient ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">CP Aktif</div>
                        <div className="font-medium">{monitoring.patient.kode_cp}</div>
                        <div className="text-sm text-muted-foreground">{monitoring.patient.nama_cp}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">Kepatuhan</div>
                        <div className="text-2xl font-semibold">{Number(monitoring.patient.compliance_percentage || 0).toFixed(2)}%</div>
                        <div className="text-xs text-muted-foreground">Variance terbuka {monitoring.patient.variance_count}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">Target LOS</div>
                        <div className="text-2xl font-semibold">{monitoring.patient.target_los || 0}</div>
                        <div className="text-xs text-muted-foreground">hari</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-muted-foreground">Status CP</div>
                        <div className="mt-1">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getPatientStatusBadgeClass(monitoring.patient.status_cp)}`}>
                            {monitoring.patient.status_cp}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">Mulai {formatDateDisplay(monitoring.patient.tanggal_mulai)}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(['Aktif', 'Selesai', 'Drop'] as const).map((status) => (
                        <Button
                          key={status}
                          variant={monitoring.patient.status_cp === status ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleUpdatePatientStatus(status)}
                          disabled={monitoringActionKey === `patient-${status}`}
                        >
                          {monitoringActionKey === `patient-${status}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {status}
                        </Button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {monitoring.execution.map((item) => (
                        <div key={item.id} className="rounded-lg border p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Hari {item.hari_ke}</Badge>
                                <Badge variant="secondary">{item.kategori}</Badge>
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getExecutionBadgeClass(item.status)}`}>
                                  {item.status}
                                </span>
                              </div>
                              <div className="font-medium">{item.aktivitas}</div>
                              <div className="text-sm text-muted-foreground">{item.kegiatan} • {item.uraian_kegiatan || '-'}</div>
                              {item.keterangan ? (
                                <div className="text-sm text-muted-foreground">{item.keterangan}</div>
                              ) : null}
                              <div className="text-xs text-muted-foreground">
                                Rencana {formatDateDisplay(item.tanggal_rencana)} • Realisasi {formatDateDisplay(item.tanggal_realisasi || undefined)}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {([
                                ['planned', 'Default'],
                                ['completed', 'Selesai'],
                                ['missed', 'Terlewat']
                              ] as const).map(([status, label]) => (
                                <Button
                                  key={`${item.id}-${status}`}
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateExecutionStatus(item.id, status)}
                                  disabled={monitoringActionKey === `exec-${item.id}-${status}`}
                                >
                                  {monitoringActionKey === `exec-${item.id}-${status}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                  {label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="font-medium">Variance</div>
                      {monitoring.variance.length ? (
                        monitoring.variance.map((item) => (
                          <div key={item.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">Hari {item.hari_ke || '-'}</Badge>
                              <Badge variant="secondary">{item.kategori_variance}</Badge>
                              <Badge variant="outline">{item.severity}</Badge>
                              <Badge variant="outline">{item.status}</Badge>
                            </div>
                            <div className="mt-2 text-sm">{item.deskripsi}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {formatDateDisplay(item.tanggal_variance)}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Belum ada variance pada monitoring Clinical Pathway pasien ini.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Detail monitoring belum tersedia untuk nomor rawat ini.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loading ? 'Memuat preview Clinical Pathway...' : 'Data Clinical Pathway belum tersedia.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClinicalPathway;
