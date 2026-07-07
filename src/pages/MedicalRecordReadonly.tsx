import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  BedDouble,
  Calendar,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileText,
  Loader2,
  Pill,
  Radio,
  Stethoscope,
  Syringe,
  User
} from 'lucide-react';
import { API_URLS } from '@/config/api';
import { formatUIDate, formatUIDateTime, parseDateLike } from '@/lib/date-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

type VisitTab = 'outpatient' | 'inpatient';

interface MedicalRecordReadonlyProps {
  asModal?: boolean;
  onClose?: () => void;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface MedicalRecordResponseData {
  patient?: {
    nama?: string;
    no_rm?: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
    alamat?: string;
    telepon?: string;
    golongan_darah?: string;
    alergi?: string;
    prb?: string;
    prb_program?: string;
  };
  outpatient_visits?: any[];
  inpatient_visits?: any[];
}

const DEFAULT_PAGINATION: PaginationMeta = {
  page: 1,
  limit: 10,
  total: 0,
  hasMore: false
};

const PAGE_SIZE = 10;

const mergeVisitsByNoRawat = (previous: any[] = [], incoming: any[] = []) => {
  const nextVisits = [...previous];

  incoming.forEach((visit) => {
    const index = nextVisits.findIndex((item) => item.no_rawat === visit.no_rawat);
    if (index === -1) {
      nextVisits.push(visit);
      return;
    }

    nextVisits[index] = {
      ...nextVisits[index],
      ...visit
    };
  });

  return nextVisits;
};

const formatDateTime = (value?: string) => {
  return formatUIDateTime(value);
};

const formatDate = (value?: string) => {
  return formatUIDate(value);
};

const formatAge = (birthDateValue?: string) => {
  const birthDate = parseDateLike(String(birthDateValue || '').trim());
  const referenceDate = new Date();

  if (!birthDate) {
    return '-';
  }

  let years = referenceDate.getFullYear() - birthDate.getFullYear();
  let months = referenceDate.getMonth() - birthDate.getMonth();
  let days = referenceDate.getDate() - birthDate.getDate();

  if (days < 0) {
    const previousMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0);
    days += previousMonth.getDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} th`);
  }
  if (months > 0) {
    parts.push(`${months} bln`);
  }
  if (days > 0 || parts.length === 0) {
    parts.push(`${Math.max(days, 0)} hr`);
  }

  return parts.join(' ');
};

const formatLongDate = (value?: string) => {
  return formatUIDate(value);
};

const getVisitDateLabel = (visit: any) => {
  if (visit.tanggal_masuk) {
    return formatLongDate(visit.tanggal_masuk);
  }

  return formatLongDate(visit.tanggal);
};

const getVisitSubtitle = (visit: any, tab: VisitTab) => {
  if (tab === 'inpatient') {
    return [visit.ruangan, visit.kamar, visit.cara_keluar].filter(Boolean).join(' • ') || 'Rawat inap';
  }

  return [visit.poliklinik, visit.status].filter(Boolean).join(' • ') || 'Rawat jalan';
};

const SectionCard = ({
  title,
  icon,
  emptyMessage,
  children,
  hasData
}: {
  title: string;
  icon: React.ReactNode;
  emptyMessage: string;
  children: React.ReactNode;
  hasData: boolean;
}) => (
  <div className="rounded-lg border bg-background">
    <div className="flex items-center gap-2 border-b px-4 py-3">
      {icon}
      <h4 className="font-medium">{title}</h4>
    </div>
    <div className="space-y-3 px-4 py-4">
      {hasData ? children : <p className="text-sm text-muted-foreground">{emptyMessage}</p>}
    </div>
  </div>
);

const MedicalRecordReadonly: React.FC<MedicalRecordReadonlyProps> = ({
  asModal = false,
  onClose
}) => {
  const navigate = useNavigate();
  const { no_rkm_medis } = useParams();

  const [medicalData, setMedicalData] = React.useState<MedicalRecordResponseData | null>(null);
  const [pagination, setPagination] = React.useState<Record<VisitTab, PaginationMeta>>({
    outpatient: DEFAULT_PAGINATION,
    inpatient: DEFAULT_PAGINATION
  });
  const [activeTab, setActiveTab] = React.useState<VisitTab>('outpatient');
  const [loading, setLoading] = React.useState(true);
  const [loadingMoreTab, setLoadingMoreTab] = React.useState<VisitTab | null>(null);
  const [loadingVisitDetailsKeys, setLoadingVisitDetailsKeys] = React.useState<Record<string, boolean>>({});
  const [expandedVisitKeys, setExpandedVisitKeys] = React.useState<Record<string, boolean>>({});
  const [error, setError] = React.useState('');

  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const fetchMedicalRecord = React.useCallback(async ({
    outpatientPage = 1,
    inpatientPage = 1,
    includeOutpatient = true,
    includeInpatient = true,
    reset = false
  }: {
    outpatientPage?: number;
    inpatientPage?: number;
    includeOutpatient?: boolean;
    includeInpatient?: boolean;
    reset?: boolean;
  } = {}) => {
    if (!no_rkm_medis) {
      return;
    }

    try {
      if (reset) {
        setLoading(true);
        setError('');
      } else {
        setLoadingMoreTab(includeOutpatient ? 'outpatient' : 'inpatient');
      }

      const response = await fetch(API_URLS.GET_MEDICAL_RECORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          no_rm: no_rkm_medis,
          limit: PAGE_SIZE,
          outpatientPage,
          inpatientPage,
          includeOutpatient,
          includeInpatient,
          includeVisitDetails: false
        })
      });

      const responseJson = await response.json();
      if (!response.ok) {
        throw new Error(responseJson?.error || `HTTP error ${response.status}`);
      }

      const nextData = responseJson?.data;
      if (!nextData) {
        throw new Error('Data rekam medis tidak ditemukan');
      }

      setMedicalData((previous) => {
        if (!previous || reset) {
          return nextData;
        }

        return {
          ...previous,
          patient: nextData.patient || previous.patient,
          outpatient_visits: mergeVisitsByNoRawat(previous.outpatient_visits, nextData.outpatient_visits),
          inpatient_visits: mergeVisitsByNoRawat(previous.inpatient_visits, nextData.inpatient_visits)
        };
      });

      setPagination((previous) => ({
        outpatient: responseJson?.pagination?.outpatient || previous.outpatient,
        inpatient: responseJson?.pagination?.inpatient || previous.inpatient
      }));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat rekam medis');
      if (reset) {
        setMedicalData(null);
      }
    } finally {
      setLoading(false);
      setLoadingMoreTab(null);
    }
  }, [no_rkm_medis]);

  const fetchVisitDetails = React.useCallback(async (noRawat: string) => {
    if (!noRawat) {
      return;
    }

    try {
      setLoadingVisitDetailsKeys((previous) => ({ ...previous, [noRawat]: true }));
      const response = await fetch(API_URLS.GET_MEDICAL_RECORD_VISIT_DETAILS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ no_rawat: noRawat })
      });
      const responseJson = await response.json();

      if (!response.ok) {
        throw new Error(responseJson?.error || `HTTP error ${response.status}`);
      }

      const visitData = responseJson?.data;
      if (!visitData) {
        return;
      }

      setMedicalData((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          outpatient_visits: mergeVisitsByNoRawat(previous.outpatient_visits, [visitData]),
          inpatient_visits: mergeVisitsByNoRawat(previous.inpatient_visits, [visitData])
        };
      });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat detail kunjungan');
    } finally {
      setLoadingVisitDetailsKeys((previous) => ({ ...previous, [noRawat]: false }));
    }
  }, []);

  React.useEffect(() => {
    void fetchMedicalRecord({ reset: true });
  }, [fetchMedicalRecord]);

  React.useEffect(() => {
    const target = sentinelRef.current;
    if (!target || loading || loadingMoreTab) {
      return;
    }

    const activePagination = pagination[activeTab];
    if (!activePagination?.hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        if (activeTab === 'outpatient') {
          void fetchMedicalRecord({
            outpatientPage: activePagination.page + 1,
            inpatientPage: pagination.inpatient.page,
            includeOutpatient: true,
            includeInpatient: false
          });
          return;
        }

        void fetchMedicalRecord({
          outpatientPage: pagination.outpatient.page,
          inpatientPage: activePagination.page + 1,
          includeOutpatient: false,
          includeInpatient: true
        });
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '160px',
        threshold: 0.1
      }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [activeTab, fetchMedicalRecord, loading, loadingMoreTab, pagination]);

  const handleToggleVisit = async (visit: any) => {
    const noRawat = String(visit?.no_rawat || '').trim();
    if (!noRawat) {
      return;
    }

    const nextExpanded = !expandedVisitKeys[noRawat];
    setExpandedVisitKeys((previous) => ({ ...previous, [noRawat]: nextExpanded }));

    if (nextExpanded && !visit?.details_loaded && !loadingVisitDetailsKeys[noRawat]) {
      await fetchVisitDetails(noRawat);
    }
  };

  const outpatientVisits = medicalData?.outpatient_visits || [];
  const inpatientVisits = medicalData?.inpatient_visits || [];
  const currentPatient = medicalData?.patient;

  const renderVisitList = (tab: VisitTab, visits: any[]) => {
    if (visits.length === 0 && !loading) {
      return (
        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          {tab === 'outpatient' ? 'Belum ada riwayat rawat jalan.' : 'Belum ada riwayat rawat inap.'}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {visits.map((visit) => {
          const isExpanded = Boolean(expandedVisitKeys[visit.no_rawat]);
          const isDetailLoading = Boolean(loadingVisitDetailsKeys[visit.no_rawat]);
          const examinations = Array.isArray(visit.examinations) ? visit.examinations : [];
          const procedures = Array.isArray(visit.procedures) ? visit.procedures : [];
          const medications = Array.isArray(visit.medications) ? visit.medications : [];
          const medicationDischargeRequests = Array.isArray(visit.medicationsRequestPulang) ? visit.medicationsRequestPulang : [];
          const medicationIbsRequests = Array.isArray(visit.medicationsRequestIbs) ? visit.medicationsRequestIbs : [];
          const laboratories = Array.isArray(visit.laboratory) ? visit.laboratory : [];
          const radiologies = Array.isArray(visit.radiology) ? visit.radiology : [];
          const operationReports = Array.isArray(visit.operationReports) ? visit.operationReports : [];

          return (
            <div key={visit.no_rawat} className="rounded-lg border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => void handleToggleVisit(visit)}
                className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="font-semibold text-foreground">{visit.no_rawat}</p>
                    <p className="text-sm text-muted-foreground">{getVisitDateLabel(visit)}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{getVisitSubtitle(visit, tab)}</p>
                  <p className="mt-2 text-sm">{visit.dokter || 'Dokter belum tersedia'}</p>
                  {visit.diagnosa_icd10 ? (
                    <p className="mt-1 text-xs text-muted-foreground">Diagnosa utama: {visit.diagnosa_icd10}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isDetailLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </button>

              {isExpanded ? (
                <div className="space-y-4 border-t bg-muted/20 px-4 py-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg border bg-background px-4 py-3">
                      <p className="text-xs text-muted-foreground">Dokter</p>
                      <p className="text-sm font-medium">{visit.dokter || '-'}</p>
                    </div>
                    <div className="rounded-lg border bg-background px-4 py-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="text-sm font-medium">{visit.status || '-'}</p>
                    </div>
                    {tab === 'inpatient' ? (
                      <>
                        <div className="rounded-lg border bg-background px-4 py-3">
                          <p className="text-xs text-muted-foreground">Tanggal Keluar</p>
                          <p className="text-sm font-medium">{formatDateTime(visit.tanggal_keluar)}</p>
                        </div>
                        <div className="rounded-lg border bg-background px-4 py-3">
                          <p className="text-xs text-muted-foreground">Cara Keluar</p>
                          <p className="text-sm font-medium">{visit.cara_keluar || '-'}</p>
                        </div>
                      </>
                    ) : null}
                  </div>

                  <SectionCard
                    title="Pemeriksaan"
                    icon={<Stethoscope className="h-4 w-4 text-primary" />}
                    emptyMessage="Belum ada detail pemeriksaan."
                    hasData={examinations.length > 0}
                  >
                    {examinations.map((exam: any, index: number) => (
                      <div key={`${visit.no_rawat}-exam-${index}`} className="rounded-md border px-3 py-3">
                        <p className="text-sm font-medium">{formatDateTime(exam.tanggal)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{exam.pegawai || '-'}</p>
                        <div className="mt-2 space-y-2 text-sm">
                          {exam.s ? (
                            <p className="whitespace-pre-wrap">
                              <span className="font-medium">S:</span>{'\n'}{exam.s}
                            </p>
                          ) : null}
                          {exam.o ? (
                            <p className="whitespace-pre-wrap">
                              <span className="font-medium">O:</span>{'\n'}{exam.o}
                            </p>
                          ) : null}
                          {exam.a ? (
                            <p className="whitespace-pre-wrap">
                              <span className="font-medium">A:</span>{'\n'}{exam.a}
                            </p>
                          ) : null}
                          {exam.p ? (
                            <p className="whitespace-pre-wrap">
                              <span className="font-medium">P:</span>{'\n'}{exam.p}
                            </p>
                          ) : null}
                          {tab === 'inpatient' && (exam.i || exam.instruksi) ? (
                            <p className="whitespace-pre-wrap">
                              <span className="font-medium">I (Instruksi):</span>{'\n'}{exam.i || exam.instruksi}
                            </p>
                          ) : null}
                          {tab === 'inpatient' && (exam.e || exam.evaluasi) ? (
                            <p className="whitespace-pre-wrap">
                              <span className="font-medium">E (Evaluasi):</span>{'\n'}{exam.e || exam.evaluasi}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Tindakan"
                    icon={<Syringe className="h-4 w-4 text-primary" />}
                    emptyMessage="Belum ada data tindakan."
                    hasData={procedures.length > 0}
                  >
                    {procedures.map((procedure: any, index: number) => (
                      <div key={`${visit.no_rawat}-procedure-${index}`} className="rounded-md border px-3 py-3 text-sm">
                        <p className="font-medium">{procedure.nm_perawatan || procedure.nama || '-'}</p>
                        <p className="mt-1 text-muted-foreground">{formatDateTime(procedure.tanggal)}</p>
                        <p className="mt-1 text-muted-foreground">{procedure.nama_pelaksana || '-'}</p>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Resep"
                    icon={<Pill className="h-4 w-4 text-primary" />}
                    emptyMessage="Belum ada riwayat pemberian obat, obat pulang, atau obat IBS."
                    hasData={medications.length > 0 || medicationDischargeRequests.length > 0 || medicationIbsRequests.length > 0}
                  >
                    {medications.map((medication: any, index: number) => (
                      <div key={`${visit.no_rawat}-medreq-${index}`} className="rounded-md border px-3 py-3">
                        <p className="text-sm font-medium">Riwayat pemberian obat {medication.no_resep || '-'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(medication.tanggal)}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          {(medication.obat || []).map((item: any, itemIndex: number) => (
                            <p key={`${medication.no_resep || index}-item-${itemIndex}`}>
                              {item.nama} • {item.jumlah} • {item.aturan_pakai || '-'}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}

                    {medicationDischargeRequests.map((request: any, index: number) => (
                      <div key={`${visit.no_rawat}-med-pulang-${index}`} className="rounded-md border px-3 py-3">
                        <p className="text-sm font-medium">Obat pulang {request.no_resep || '-'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(request.tanggal)}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          {(request.obat || []).map((item: any, itemIndex: number) => (
                            <p key={`${request.no_resep || index}-pulang-obat-${itemIndex}`}>
                              {item.nama} • {item.jumlah} • {item.aturan_pakai || '-'}
                            </p>
                          ))}
                          {(request.compounds || []).map((compound: any, compoundIndex: number) => (
                            <p key={`${request.no_resep || index}-pulang-racik-${compoundIndex}`}>
                              Racikan {compound.nama_racik || compound.nm_racik || compound.no_racik}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}

                    {medicationIbsRequests.map((request: any, index: number) => (
                      <div key={`${visit.no_rawat}-med-ibs-${index}`} className="rounded-md border px-3 py-3">
                        <p className="text-sm font-medium">Obat IBS {request.no_resep || '-'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(request.tanggal)}</p>
                        <div className="mt-2 space-y-1 text-sm">
                          {(request.obat || []).map((item: any, itemIndex: number) => (
                            <p key={`${request.no_resep || index}-ibs-obat-${itemIndex}`}>
                              {item.nama} • {item.jumlah} • {item.aturan_pakai || '-'}
                            </p>
                          ))}
                          {(request.compounds || []).map((compound: any, compoundIndex: number) => (
                            <p key={`${request.no_resep || index}-ibs-racik-${compoundIndex}`}>
                              Racikan {compound.nama_racik || compound.nm_racik || compound.no_racik}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Laboratorium"
                    icon={<Activity className="h-4 w-4 text-primary" />}
                    emptyMessage="Belum ada hasil laboratorium."
                    hasData={laboratories.length > 0}
                  >
                    {laboratories.map((lab: any, index: number) => (
                      <div key={`${visit.no_rawat}-lab-${index}`} className="rounded-md border px-3 py-3 text-sm">
                        <p className="font-medium">{formatDateTime(lab.tanggal)}</p>
                        <div className="mt-2 space-y-1">
                          {(lab.pemeriksaan || []).map((item: any, itemIndex: number) => (
                            <p key={`${visit.no_rawat}-lab-item-${index}-${itemIndex}`}>
                              {item.nama || item.pemeriksaan} {item.hasil ? `• ${item.hasil}` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    ))}
                  </SectionCard>

                  <SectionCard
                    title="Radiologi"
                    icon={<Radio className="h-4 w-4 text-primary" />}
                    emptyMessage="Belum ada hasil radiologi."
                    hasData={radiologies.length > 0}
                  >
                    {radiologies.map((radiology: any, index: number) => (
                      <div key={`${visit.no_rawat}-rad-${index}`} className="rounded-md border px-3 py-3 text-sm">
                        <p className="font-medium">{radiology.pemeriksaan || '-'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(radiology.tanggal)}</p>
                        {radiology.hasil ? <p className="mt-2 whitespace-pre-wrap">{radiology.hasil}</p> : null}
                      </div>
                    ))}
                  </SectionCard>

                  {tab === 'inpatient' ? (
                    <SectionCard
                      title="Laporan Operasi"
                      icon={<ClipboardList className="h-4 w-4 text-primary" />}
                      emptyMessage="Belum ada laporan operasi."
                      hasData={operationReports.length > 0}
                    >
                      {operationReports.map((report: any, index: number) => (
                        <div key={`${visit.no_rawat}-op-${index}`} className="rounded-md border px-3 py-3 text-sm">
                          <p className="font-medium">{report.nm_op || 'Laporan Operasi'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDate(report.tanggal_op)}</p>
                          {report.dokter_operator ? <p className="mt-2"><span className="font-medium">Operator:</span> {report.dokter_operator}</p> : null}
                          {report.dokter_anestesi ? <p className="mt-1"><span className="font-medium">Anestesi:</span> {report.dokter_anestesi}</p> : null}
                          {report.pre_op ? <p className="mt-2"><span className="font-medium">Pre-op:</span> {report.pre_op}</p> : null}
                          {report.post_op ? <p className="mt-1"><span className="font-medium">Post-op:</span> {report.post_op}</p> : null}
                          {report.hasil_op ? <p className="mt-1 whitespace-pre-wrap"><span className="font-medium">Hasil:</span> {report.hasil_op}</p> : null}
                        </div>
                      ))}
                    </SectionCard>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}

        <div ref={sentinelRef} className="h-4" />

        {loadingMoreTab === tab ? (
          <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat riwayat berikutnya...
          </div>
        ) : null}
      </div>
    );
  };

  const content = (
    <div className={cn('flex min-h-0 flex-1 flex-col', asModal ? 'max-h-[88vh]' : '')}>
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Rekam Medis Pasien</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Mode baca-saja untuk riwayat kunjungan
              <br />
              dan detail rekam medis pasien.
            </p>
          </div>
          {!asModal ? (
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
          ) : null}
        </div>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border px-4 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat rekam medis...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {!loading && currentPatient ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Data Pasien
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Nama</p>
                    <p className="font-medium">{currentPatient.nama || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">No. RM</p>
                    <p className="font-medium">{currentPatient.no_rm || no_rkm_medis}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tanggal Lahir</p>
                    <p className="font-medium">
                      {formatDate(currentPatient.tanggal_lahir)}
                      {currentPatient.tanggal_lahir ? ` (${formatAge(currentPatient.tanggal_lahir)})` : ''}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Jenis Kelamin</p>
                    <p className="font-medium">{currentPatient.jenis_kelamin || '-'}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Alamat</p>
                    <p className="font-medium">{currentPatient.alamat || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telepon</p>
                    <p className="font-medium">{currentPatient.telepon || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Golongan Darah</p>
                    <p className="font-medium">{currentPatient.golongan_darah || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Alergi</p>
                    <p className="font-medium">{currentPatient.alergi || '-'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Riwayat Rekam Medis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as VisitTab)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="outpatient">
                      <Calendar className="mr-2 h-4 w-4" />
                      Rawat Jalan ({pagination.outpatient.total})
                    </TabsTrigger>
                    <TabsTrigger value="inpatient">
                      <BedDouble className="mr-2 h-4 w-4" />
                      Rawat Inap ({pagination.inpatient.total})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="outpatient" className="mt-4">
                    {renderVisitList('outpatient', outpatientVisits)}
                  </TabsContent>
                  <TabsContent value="inpatient" className="mt-4">
                    {renderVisitList('inpatient', inpatientVisits)}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );

  if (asModal) {
    return (
      <Dialog open onOpenChange={(open) => {
        if (!open) {
          onClose?.();
        }
      }}>
        <DialogContent className="max-w-6xl gap-0 overflow-hidden p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Rekam Medis Pasien</DialogTitle>
            <DialogDescription>Viewer rekam medis pasien dalam mode baca-saja.</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col rounded-lg border bg-background shadow-sm">
      {content}
      <Separator />
    </div>
  );
};

export default MedicalRecordReadonly;
