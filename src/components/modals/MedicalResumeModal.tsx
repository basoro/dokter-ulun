import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { BadgeCheck, Check, ChevronsUpDown, FileText, History, Loader2, Paperclip, Plus, Search, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatUIDate, formatUIDateTime } from '@/lib/date-utils';

interface MedicalResume {
  no_rawat: string;
  kd_dokter: string;
  diagnosa_awal: string;
  alasan: string;
  keluhan_utama: string;
  pemeriksaan_fisik: string;
  jalannya_penyakit: string;
  pemeriksaan_penunjang: string;
  hasil_laborat: string;
  tindakan_dan_operasi: string;
  obat_di_rs: string;
  diagnosa_utama: string;
  kd_diagnosa_utama: string;
  diagnosa_sekunder: string;
  kd_diagnosa_sekunder: string;
  diagnosa_sekunder2: string;
  kd_diagnosa_sekunder2: string;
  diagnosa_sekunder3: string;
  kd_diagnosa_sekunder3: string;
  diagnosa_sekunder4: string;
  kd_diagnosa_sekunder4: string;
  prosedur_utama: string;
  kd_prosedur_utama: string;
  prosedur_sekunder: string;
  kd_prosedur_sekunder: string;
  prosedur_sekunder2: string;
  kd_prosedur_sekunder2: string;
  prosedur_sekunder3: string;
  kd_prosedur_sekunder3: string;
  alergi: string;
  diet: string;
  lab_belum: string;
  edukasi: string;
  cara_keluar: string;
  ket_keluar: string;
  keadaan: string;
  ket_keadaan: string;
  dilanjutkan: string;
  ket_dilanjutkan: string;
  kontrol: string;
  obat_pulang: string;
  tindakan_venti?: string;
  kondisi_pulang?: string;
  no_rkm_medis?: string;
  nm_pasien?: string;
  jenis_kelamin?: string;
  tgl_lahir?: string;
  tgl_masuk?: string;
  tgl_keluar?: string;
  lama?: string;
  stts_pulang?: string;
  kd_kamar?: string;
  nm_bangsal?: string;
  dokter_dpjp?: string;
  dokter_reg?: string;
  dokter_penulis?: string;
  has_resume?: number;
  is_verified?: number;
  is_dpjp_utama?: number;
}

interface MedicalResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
  defaultStatusRawat?: 'Ralan' | 'Ranap';
}

interface ResumeRanapExamination {
  tanggal?: string;
  tgl_perawatan?: string;
  jam_rawat?: string;
  tekanan_darah?: string;
  nadi?: string;
  respirasi?: string;
  suhu?: string;
  gcs?: string;
  s?: string;
  o?: string;
  a?: string;
  p?: string;
  i?: string;
  e?: string;
  pegawai?: string;
}

interface ResumeSourceData {
  examinations: ResumeRanapExamination[];
  outpatientExaminations: ResumeRanapExamination[];
  laboratoryResults: any[];
  radiologyResults: any[];
  operationData: any[];
  inpatientMedications: any[];
  dischargeMedicationRequests: any[];
}

type ResumePickerTarget =
  | 'keluhan_utama'
  | 'pemeriksaan_fisik'
  | 'jalannya_penyakit'
  | 'pemeriksaan_penunjang'
  | 'hasil_laborat'
  | 'tindakan_dan_operasi'
  | 'obat_di_rs';

interface ResumePickerItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  value: string;
  code?: string;
  badgeLabel?: string;
  badgeClassName?: string;
  laboratoryPanels?: Array<{
    groupName: string;
    tests: Array<{
      pemeriksaan?: string;
      hasil?: string;
      rujukan?: string;
      keterangan?: string;
    }>;
  }>;
}

interface ResumePickerConfig {
  target: ResumePickerTarget;
  title: string;
  description: string;
  emptyMessage: string;
  multiple: boolean;
  items: ResumePickerItem[];
}

const RESUME_PAYLOAD_LABELS: Record<string, string> = {
  no_rawat: 'No. Rawat',
  status_rawat: 'Status Rawat',
  kd_dokter: 'Kode Dokter',
  actor_username: 'Username Aktor',
  actor_name: 'Nama Aktor',
  diagnosa_awal: 'Diagnosa Masuk',
  alasan: 'Alasan Masuk',
  keluhan_utama: 'Ringkasan Riwayat Penyakit',
  pemeriksaan_fisik: 'Pemeriksaan Fisik',
  jalannya_penyakit: 'Jalannya Penyakit',
  pemeriksaan_penunjang: 'Pemeriksaan Penunjang',
  hasil_laborat: 'Pemeriksaan Laboratorium',
  tindakan_dan_operasi: 'Tindakan dan Operasi',
  obat_di_rs: 'Obat di RS',
  diagnosa_utama: 'Diagnosa Utama',
  kd_diagnosa_utama: 'Kode Diagnosa Utama',
  diagnosa_sekunder: 'Diagnosa Sekunder 1',
  kd_diagnosa_sekunder: 'Kode Diagnosa Sekunder 1',
  diagnosa_sekunder2: 'Diagnosa Sekunder 2',
  kd_diagnosa_sekunder2: 'Kode Diagnosa Sekunder 2',
  diagnosa_sekunder3: 'Diagnosa Sekunder 3',
  kd_diagnosa_sekunder3: 'Kode Diagnosa Sekunder 3',
  diagnosa_sekunder4: 'Diagnosa Sekunder 4',
  kd_diagnosa_sekunder4: 'Kode Diagnosa Sekunder 4',
  prosedur_utama: 'Prosedur Utama',
  kd_prosedur_utama: 'Kode Prosedur Utama',
  prosedur_sekunder: 'Prosedur Sekunder 1',
  kd_prosedur_sekunder: 'Kode Prosedur Sekunder 1',
  prosedur_sekunder2: 'Prosedur Sekunder 2',
  kd_prosedur_sekunder2: 'Kode Prosedur Sekunder 2',
  prosedur_sekunder3: 'Prosedur Sekunder 3',
  kd_prosedur_sekunder3: 'Kode Prosedur Sekunder 3',
  alergi: 'Alergi',
  diet: 'Diet',
  lab_belum: 'Lab Belum',
  edukasi: 'Edukasi',
  cara_keluar: 'Cara Keluar',
  ket_keluar: 'Keterangan Keluar',
  keadaan: 'Keadaan',
  ket_keadaan: 'Keterangan Keadaan',
  dilanjutkan: 'Dilanjutkan',
  ket_dilanjutkan: 'Keterangan Dilanjutkan',
  kontrol: 'Kontrol',
  obat_pulang: 'Obat Pulang',
  verified: 'Status Verifikasi'
};

interface ResumeHistoryLogEntry {
  no_rawat: string;
  timestamp: string;
  action: 'create' | 'update' | 'delete' | 'verify' | 'unverify' | string;
  status_rawat?: 'Ralan' | 'Ranap' | string;
  message?: string;
  request_payload?: Record<string, unknown>;
  actor?: {
    username?: string;
    doctor_code?: string;
    doctor_name?: string;
    ip_address?: string;
    user_agent?: string;
  };
}

interface ResumePickerTimelineItem {
  sortTimestamp: number;
  pickerItem: ResumePickerItem;
}

interface MedicalCodeOption {
  code: string;
  label: string;
  description?: string;
}

interface SearchableMedicalCodeFieldProps {
  label: string;
  placeholder: string;
  emptyMessage: string;
  selectedName: string;
  selectedCode: string;
  type: 'icd10' | 'icd9';
  onManualChange: (name: string) => void;
  onAppend: (name: string, code: string) => void;
  onClear: () => void;
}

const SearchableMedicalCodeField: React.FC<SearchableMedicalCodeFieldProps> = ({
  label,
  placeholder,
  emptyMessage,
  selectedName,
  selectedCode,
  type,
  onManualChange,
  onAppend,
  onClear,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<MedicalCodeOption[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(API_URLS.ICD_DATA, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            page: '1',
            itemsPerPage: '20',
            search,
            icdType: type,
          }),
          signal: controller.signal,
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Gagal memuat data kode medis');
        }

        const mappedOptions = (result.data || []).map((item: any) => {
          if (type === 'icd9') {
            return {
              code: String(item.kode || '').trim(),
              label: String(item.deskripsi_panjang || item.deskripsi_pendek || '').trim(),
              description: String(item.deskripsi_pendek || '').trim(),
            };
          }

          return {
            code: String(item.kd_penyakit || '').trim(),
            label: String(item.nm_penyakit || '').trim(),
            description: String(item.keterangan || item.ciri_ciri || '').trim(),
          };
        }).filter((item: MedicalCodeOption) => item.code && item.label);

        setOptions(mappedOptions);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error fetching medical code options:', error);
          setOptions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, search, type]);

  const buttonLabel = type === 'icd10' ? 'ICD-10' : 'ICD-9';

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={selectedName}
          onChange={(e) => onManualChange(e.target.value)}
          placeholder={`${placeholder} atau ketik manual`}
          className="flex-1"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="justify-between sm:w-[220px]"
            >
              <span className="flex items-center gap-2 truncate text-left">
                <Plus className="h-4 w-4 shrink-0" />
                <span>{buttonLabel}</span>
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[calc(100vw-2rem)] max-w-[420px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Ketik kode atau nama..."
                value={search}
                onValueChange={setSearch}
              />
              <CommandList>
                {loading ? (
                  <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mencari data...
                  </div>
                ) : null}
                {!loading ? <CommandEmpty>{emptyMessage}</CommandEmpty> : null}
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={`${type}-${option.code}`}
                      value={`${option.code} ${option.label}`}
                      onSelect={() => {
                        onAppend(option.label, option.code);
                        setOpen(false);
                        setSearch('');
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedCode === option.code ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span>{option.code} - {option.label}</span>
                        {option.description ? (
                          <span className="text-xs text-muted-foreground">{option.description}</span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          variant="outline"
          onClick={onClear}
          disabled={!selectedName && !selectedCode}
        >
          Hapus
        </Button>
      </div>
      {selectedCode ? (
        <p className="text-xs text-muted-foreground">
          Kode terpilih: {selectedCode}
        </p>
      ) : null}
    </div>
  );
};

const createEmptySourceData = (): ResumeSourceData => ({
  examinations: [],
  outpatientExaminations: [],
  laboratoryResults: [],
  radiologyResults: [],
  operationData: [],
  inpatientMedications: [],
  dischargeMedicationRequests: [],
});

const formatDiagnosaMasukText = (value: string): string => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return '';
  }

  const items = normalizedValue
    .split(/\r?\n|;|,(?!\d)/)
    .map((item) => String(item || '').replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);

  if (items.length <= 1) {
    return normalizedValue.startsWith('- ') ? normalizedValue : `- ${normalizedValue.replace(/^\s*-\s*/, '').trim()}`;
  }

  return items.map((item) => `- ${item}`).join('\n');
};

export const MedicalResumeModal: React.FC<MedicalResumeModalProps> = ({
  isOpen,
  onClose,
  noRawat,
  defaultStatusRawat = 'Ranap'
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const currentStatusRawat = defaultStatusRawat === 'Ralan' ? 'Ralan' : 'Ranap';
  const isRalan = currentStatusRawat === 'Ralan';
  const currentDoctorCode = user?.kd_dokter || user?.username || '';
  const currentDoctorName = user?.name || user?.username || '-';
  const kondisiPulangRanapOptions = ['Membaik', 'APS', 'Rujuk', 'Meninggal'];

  const createDefaultForm = useMemo(() => {
    return (): MedicalResume => ({
      no_rawat: noRawat,
      kd_dokter: currentDoctorCode,
      diagnosa_awal: '',
      alasan: '',
      keluhan_utama: '',
      pemeriksaan_fisik: '',
      jalannya_penyakit: '',
      pemeriksaan_penunjang: '',
      hasil_laborat: '',
      tindakan_dan_operasi: '',
      obat_di_rs: '',
      diagnosa_utama: '',
      kd_diagnosa_utama: '',
      diagnosa_sekunder: '',
      kd_diagnosa_sekunder: '',
      diagnosa_sekunder2: '',
      kd_diagnosa_sekunder2: '',
      diagnosa_sekunder3: '',
      kd_diagnosa_sekunder3: '',
      diagnosa_sekunder4: '',
      kd_diagnosa_sekunder4: '',
      prosedur_utama: '',
      kd_prosedur_utama: '',
      prosedur_sekunder: '',
      kd_prosedur_sekunder: '',
      prosedur_sekunder2: '',
      kd_prosedur_sekunder2: '',
      prosedur_sekunder3: '',
      kd_prosedur_sekunder3: '',
      alergi: '',
      diet: '',
      lab_belum: '',
      edukasi: '',
      cara_keluar: 'Atas Izin Dokter',
      ket_keluar: '',
      keadaan: 'Membaik',
      ket_keadaan: '',
      dilanjutkan: 'Kembali Ke RS',
      ket_dilanjutkan: '',
      kontrol: '',
      obat_pulang: '',
      tindakan_venti: '',
      kondisi_pulang: 'Membaik',
      dokter_penulis: currentDoctorName,
      has_resume: 0,
      is_verified: 0,
      is_dpjp_utama: 0,
    });
  }, [currentDoctorCode, currentDoctorName, noRawat]);

  const [formData, setFormData] = useState<MedicalResume>(createDefaultForm);
  const [sourceData, setSourceData] = useState<ResumeSourceData>(createEmptySourceData());
  const [sourceLoading, setSourceLoading] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<ResumePickerTarget | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [selectedPickerItems, setSelectedPickerItems] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<ResumeHistoryLogEntry[]>([]);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const isRanapVerified = !isRalan && String(formData?.ket_dilanjutkan || '').trim() === 'Selesai';
  const canVerifyRanap = !isRalan && Number(formData?.is_dpjp_utama || 0) === 1;

  useEffect(() => {
    if (isOpen) {
      void fetchResume();
    }
  }, [currentDoctorCode, currentStatusRawat, isOpen, noRawat]);

  useEffect(() => {
    if (!loading) {
      setFormData((previous) => ({
        ...previous,
        no_rawat: noRawat,
        kd_dokter: previous.kd_dokter || currentDoctorCode,
        dokter_penulis: previous.dokter_penulis || currentDoctorName,
      }));
    }
  }, [currentDoctorCode, currentDoctorName, loading, noRawat]);

  const fetchResume = async () => {
    if (!noRawat) {
      setFormData(createDefaultForm());
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_URLS.RESUME_PASIEN_DATA}/${encodeURIComponent(noRawat)}?status_rawat=${encodeURIComponent(currentStatusRawat)}&kd_dokter=${encodeURIComponent(currentDoctorCode)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Gagal memuat resume pasien');
      }

      setFormData({
        ...createDefaultForm(),
        ...result.data,
        no_rawat: result.data.no_rawat || noRawat,
        kd_dokter: result.data.kd_dokter || currentDoctorCode,
        diagnosa_awal: isRalan ? (result.data.diagnosa_awal || '') : formatDiagnosaMasukText(result.data.diagnosa_awal || ''),
        dokter_penulis: result.data.dokter_penulis || currentDoctorName,
        kontrol: result.data.kontrol || '',
        has_resume: Number(result.data.has_resume || 0),
        is_verified: Number(result.data.is_verified || 0),
        is_dpjp_utama: Number(result.data.is_dpjp_utama || 0),
      });

      void fetchResumeSources(result.data.no_rkm_medis || '');
    } catch (error) {
      console.error('Error fetching resumes:', error);
      toast({
        title: "Error",
        description: "Gagal memuat resume medis",
        variant: "destructive",
      });
      setFormData(createDefaultForm());
      setSourceData(createEmptySourceData());
    } finally {
      setLoading(false);
    }
  };

  const fetchResumeHistory = async () => {
    if (!noRawat) {
      setHistoryEntries([]);
      return;
    }

    setHistoryLoading(true);
    try {
      const response = await fetch(`${API_URLS.RESUME_PASIEN_DATA}/${encodeURIComponent(noRawat)}/logs`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat log resume');
      }

      setHistoryEntries(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memuat log resume",
        variant: "destructive",
      });
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchResumeSources = async (noRm: string) => {
    const normalizedNoRm = String(noRm || '').trim();
    if (!noRawat || !normalizedNoRm) {
      const emptyData = createEmptySourceData();
      setSourceData(emptyData);
      return emptyData;
    }

    setSourceLoading(true);
    try {
      const medicalResponse = await fetch(API_URLS.GET_MEDICAL_RECORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rm: normalizedNoRm,
          limit: 5,
          outpatientPage: 1,
          inpatientPage: 1,
          includeOutpatient: false,
          includeInpatient: false,
          includeVisitDetails: false,
          includeFocusedExaminations: true,
          includeFocusedProcedures: true,
          includeFocusedMedications: true,
          includeFocusedLaboratory: true,
          includeFocusedRadiology: true,
          focus_no_rawat: noRawat
        }),
      });

      if (!medicalResponse.ok) {
        throw new Error(`Gagal memuat sumber data resume: HTTP ${medicalResponse.status}`);
      }

      const medicalResult = await medicalResponse.json();
      const medicalData = Array.isArray(medicalResult) ? medicalResult[0] : medicalResult?.data;

      const nextSourceData = {
        examinations: medicalData?.focused_examinations?.ranap || [],
        outpatientExaminations: medicalData?.focused_examinations?.ralan || [],
        laboratoryResults: [
          ...(medicalData?.focused_laboratory?.ranap || []),
          ...(medicalData?.focused_laboratory?.ralan || [])
        ],
        radiologyResults: [
          ...(medicalData?.focused_radiology?.ranap || []),
          ...(medicalData?.focused_radiology?.ralan || [])
        ],
        operationData: medicalData?.focused_operation_reports || [],
        inpatientMedications: [
          ...(medicalData?.focused_medications?.ranap || []),
          ...(medicalData?.focused_medications?.ralan || [])
        ],
        dischargeMedicationRequests: medicalData?.focused_medications_request?.pulang || [],
      };

      setSourceData(nextSourceData);
      return nextSourceData;
    } catch (error) {
      console.error('Error fetching resume source data:', error);
      toast({
        title: "Peringatan",
        description: error instanceof Error ? error.message : "Gagal memuat sumber data picker resume",
        variant: "destructive",
      });
      const emptyData = createEmptySourceData();
      setSourceData(emptyData);
      return emptyData;
    } finally {
      setSourceLoading(false);
    }
  };

  const executeSave = async () => {
    if (!noRawat) {
      toast({
        title: "Error",
        description: "No. rawat tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    if (!currentDoctorCode) {
      toast({
        title: "Error",
        description: "Identitas dokter login tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_URLS.RESUME_PASIEN_DATA}/${encodeURIComponent(noRawat)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          diagnosa_awal: isRalan ? formData.diagnosa_awal : formatDiagnosaMasukText(formData.diagnosa_awal),
          kd_dokter: currentDoctorCode,
          actor_username: user?.username || '',
          actor_name: currentDoctorName,
          no_rawat: noRawat,
          status_rawat: currentStatusRawat,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menyimpan resume medis');
      }

      await fetchResume();
      setSaveConfirmOpen(false);
      toast({
        title: "Berhasil",
        description: formData.has_resume ? "Resume medis berhasil diperbarui" : "Resume medis berhasil disimpan",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menyimpan resume medis",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (formData.has_resume) {
      setSaveConfirmOpen(true);
      return;
    }

    void executeSave();
  };

  const handleDelete = async () => {
    if (!noRawat) {
      return;
    }

    if (!isRalan && isRanapVerified) {
      toast({
        title: "Error",
        description: "Resume sudah diverifikasi. Batal verifikasi terlebih dahulu sebelum menghapus resume medis.",
        variant: "destructive",
      });
      return;
    }

    if (confirm('Apakah Anda yakin ingin menghapus resume medis ini?')) {
      try {
        setDeleting(true);
        const response = await fetch(
          `${API_URLS.RESUME_PASIEN_DATA}/${encodeURIComponent(noRawat)}?status_rawat=${encodeURIComponent(currentStatusRawat)}&kd_dokter=${encodeURIComponent(currentDoctorCode)}&actor_username=${encodeURIComponent(user?.username || '')}&actor_name=${encodeURIComponent(currentDoctorName)}`,
          {
          method: 'DELETE',
          }
        );

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Gagal menghapus resume medis');
        }

        await fetchResume();
        toast({
          title: "Berhasil",
          description: "Resume medis berhasil dihapus",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Gagal menghapus resume medis",
          variant: "destructive",
        });
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleToggleVerification = async () => {
    if (isRalan || !noRawat) {
      return;
    }

    if (!currentDoctorCode) {
      toast({
        title: "Error",
        description: "Identitas dokter login tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    if (!canVerifyRanap) {
      toast({
        title: "Error",
        description: "Hanya DPJP Utama yang dapat memverifikasi resume medis.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.has_resume) {
      toast({
        title: "Error",
        description: "Resume rawat inap belum dibuat.",
        variant: "destructive",
      });
      return;
    }

    try {
      setVerifying(true);
      const response = await fetch(`${API_URLS.RESUME_PASIEN_VERIFICATION}/${encodeURIComponent(noRawat)}/verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          actor_name: currentDoctorName,
          actor_username: user?.username || '',
          kd_dokter: currentDoctorCode,
          verified: !isRanapVerified,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memverifikasi resume medis');
      }

      await fetchResume();
      toast({
        title: "Berhasil",
        description: result.message || (!isRanapVerified ? 'Resume berhasil diverifikasi' : 'Verifikasi resume berhasil dibatalkan'),
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Gagal memverifikasi resume medis',
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  const updateField = <K extends keyof MedicalResume>(field: K, value: MedicalResume[K]) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const updateDiagnosisFields = (
    nameField: keyof Pick<MedicalResume, 'diagnosa_utama' | 'diagnosa_sekunder' | 'diagnosa_sekunder2' | 'diagnosa_sekunder3' | 'diagnosa_sekunder4'>,
    codeField: keyof Pick<MedicalResume, 'kd_diagnosa_utama' | 'kd_diagnosa_sekunder' | 'kd_diagnosa_sekunder2' | 'kd_diagnosa_sekunder3' | 'kd_diagnosa_sekunder4'>,
    name: string,
    code: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [nameField]: name,
      [codeField]: code,
    }));
  };

  const updateProcedureFields = (
    nameField: keyof Pick<MedicalResume, 'prosedur_utama' | 'prosedur_sekunder' | 'prosedur_sekunder2' | 'prosedur_sekunder3'>,
    codeField: keyof Pick<MedicalResume, 'kd_prosedur_utama' | 'kd_prosedur_sekunder' | 'kd_prosedur_sekunder2' | 'kd_prosedur_sekunder3'>,
    name: string,
    code: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [nameField]: name,
      [codeField]: code,
    }));
  };

  const appendCommaSeparatedText = (currentValue: string, nextValue: string) => {
    const currentItems = String(currentValue || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const normalizedNextValue = String(nextValue || '').trim();

    if (!normalizedNextValue) {
      return currentItems.join(', ');
    }

    if (!currentItems.some((item) => item.toLowerCase() === normalizedNextValue.toLowerCase())) {
      currentItems.push(normalizedNextValue);
    }

    return currentItems.join(', ');
  };

  const appendDiagnosisFields = (
    nameField: keyof Pick<MedicalResume, 'diagnosa_utama' | 'diagnosa_sekunder' | 'diagnosa_sekunder2' | 'diagnosa_sekunder3' | 'diagnosa_sekunder4'>,
    codeField: keyof Pick<MedicalResume, 'kd_diagnosa_utama' | 'kd_diagnosa_sekunder' | 'kd_diagnosa_sekunder2' | 'kd_diagnosa_sekunder3' | 'kd_diagnosa_sekunder4'>,
    name: string,
    code: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [nameField]: appendCommaSeparatedText(String(previous[nameField] || ''), name),
      [codeField]: appendCommaSeparatedText(String(previous[codeField] || ''), code),
    }));
  };

  const appendProcedureFields = (
    nameField: keyof Pick<MedicalResume, 'prosedur_utama' | 'prosedur_sekunder' | 'prosedur_sekunder2' | 'prosedur_sekunder3'>,
    codeField: keyof Pick<MedicalResume, 'kd_prosedur_utama' | 'kd_prosedur_sekunder' | 'kd_prosedur_sekunder2' | 'kd_prosedur_sekunder3'>,
    name: string,
    code: string
  ) => {
    setFormData((previous) => ({
      ...previous,
      [nameField]: appendCommaSeparatedText(String(previous[nameField] || ''), name),
      [codeField]: appendCommaSeparatedText(String(previous[codeField] || ''), code),
    }));
  };

  const mergeTextBlocks = (currentValue: string, nextBlocks: string[]) => {
    const normalizedBlocks = nextBlocks
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    if (normalizedBlocks.length === 0) {
      return currentValue;
    }

    const existingBlocks = String(currentValue || '')
      .split(/\n\s*\n/)
      .map((item) => item.trim())
      .filter(Boolean);

    const merged = [...existingBlocks];
    normalizedBlocks.forEach((item) => {
      if (!merged.includes(item)) {
        merged.push(item);
      }
    });

    return merged.join('\n\n');
  };

  const buildVitalsText = (exam: any) => {
    return [
      exam.tekanan_darah ? `Tekanan Darah: ${exam.tekanan_darah}` : '',
      exam.nadi ? `Nadi: ${exam.nadi}` : '',
      exam.respirasi ? `Respirasi: ${exam.respirasi}` : '',
      exam.suhu ? `Suhu: ${exam.suhu}` : '',
      exam.gcs ? `GCS: ${exam.gcs}` : '',
    ].filter(Boolean).join('\n');
  };

  const buildLaboratoryResultText = (item: any) => {
    const detailLines = (item.pemeriksaan || [])
      .map((detail: any) => {
        const resultText = detail.hasil ? `: ${detail.hasil}` : '';
        const referenceText = detail.rujukan ? ` (Rujukan: ${detail.rujukan})` : '';
        const noteText = detail.keterangan ? ` - ${detail.keterangan}` : '';
        return `${detail.nama}${detail.pemeriksaan ? ` - ${detail.pemeriksaan}` : ''}${resultText}${referenceText}${noteText}`;
      })
      .filter(Boolean)
      .join('\n');

    const formattedDate = item.tanggal ? formatUIDate(item.tanggal) : '';

    return [
      formattedDate ? `Tanggal: ${formattedDate}` : '',
      detailLines ? `Laboratorium:\n${detailLines}` : ''
    ].filter(Boolean).join('\n');
  };

  const buildLaboratoryPickerPanels = (item: any) => {
    const groupedTests = ((Array.isArray(item?.pemeriksaan) ? item.pemeriksaan : []) as any[]).reduce<
      Record<string, Array<{ pemeriksaan?: string; hasil?: string; rujukan?: string; keterangan?: string }>>
    >((groups, detail) => {
      const groupName = String(detail?.nama || 'Laboratorium').trim() || 'Laboratorium';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }

      groups[groupName].push({
        pemeriksaan: String(detail?.pemeriksaan || '').trim(),
        hasil: String(detail?.hasil || '').trim(),
        rujukan: String(detail?.rujukan || '').trim(),
        keterangan: String(detail?.keterangan || '').trim()
      });

      return groups;
    }, {});

    return Object.entries(groupedTests).map(([groupName, tests]) => ({
      groupName,
      tests
    }));
  };

  const buildRadiologyResultText = (item: any) => {
    const formattedDate = item.tanggal ? formatUIDate(item.tanggal) : '';

    return [
      formattedDate ? `Tanggal: ${formattedDate}` : '',
      item.pemeriksaan ? `Radiologi: ${item.pemeriksaan}` : '',
      item.hasil ? `Hasil:\n${item.hasil}` : '',
      item.kesan && item.kesan !== item.hasil ? `Kesan:\n${item.kesan}` : ''
    ].filter(Boolean).join('\n');
  };

  const buildExaminationProcedureText = (item: ResumeRanapExamination, sourceLabel: string) => {
    const formattedDateTime = item.tanggal || item.tgl_perawatan
      ? formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`)
      : '';

    return [
      formattedDateTime ? `Tanggal & Jam: ${formattedDateTime}` : '',
      `Sumber: ${sourceLabel}`,
      item.pegawai ? `Petugas: ${item.pegawai}` : '',
      item.a ? `Assessment: ${item.a}` : '',
      item.p ? `Plan: ${item.p}` : '',
      item.i ? `Instruksi/Intervensi: ${item.i}` : '',
      item.e ? `Evaluasi: ${item.e}` : ''
    ].filter(Boolean).join('\n');
  };

  const buildOperationText = (item: any) => {
    const formattedDate = item.tanggal_op
      ? (/[T\s]\d{2}:\d{2}/.test(String(item.tanggal_op))
          ? formatUIDateTime(item.tanggal_op)
          : formatUIDate(item.tanggal_op))
      : '';

    return [
      formattedDate ? `Tanggal Operasi: ${formattedDate}` : '',
      item.nm_op ? `Nama Operasi: ${item.nm_op}` : '',
      item.dokter_operator ? `Dokter Operator: ${item.dokter_operator}` : '',
      item.dokter_anestesi ? `Dokter Anestesi: ${item.dokter_anestesi}` : '',
      item.dokter_laporan ? `Dokter Laporan: ${item.dokter_laporan}` : '',
      item.pre_op ? `Pre Operasi: ${item.pre_op}` : '',
      item.post_op ? `Post Operasi: ${item.post_op}` : '',
      item.implan ? `Implan: ${item.implan}` : '',
      item.kirim_pa ? `Kirim PA: ${item.kirim_pa}` : '',
      item.hasil_op ? `Hasil Operasi:\n${item.hasil_op}` : ''
    ].filter(Boolean).join('\n');
  };

  const buildMedicationListText = (item: any, sourceLabel: string) => {
    const detailLines = (item.obat || [])
      .map((obat: any) => {
        const jumlah = obat.jumlah ? `, Jumlah: ${obat.jumlah}` : '';
        const aturan = obat.aturan_pakai ? `, Aturan Pakai: ${obat.aturan_pakai}` : '';
        return `${obat.nama || '-'}${jumlah}${aturan}`;
      })
      .filter(Boolean)
      .join('\n');

    const formattedDate = item.tanggal ? formatUIDate(item.tanggal) : '';

    return [
      formattedDate ? `Tanggal: ${formattedDate}` : '',
      item.no_resep ? `No. Resep: ${item.no_resep}` : '',
      `Sumber: ${sourceLabel}`,
      detailLines ? `Obat:\n${detailLines}` : ''
    ].filter(Boolean).join('\n');
  };

  const getDateSortTimestamp = (dateValue?: string, timeValue?: string) => {
    if (!dateValue) {
      return Number.MAX_SAFE_INTEGER;
    }

    const normalizedDate = String(dateValue).trim().replace(' ', 'T');
    const datePart = normalizedDate.split('T')[0];
    const dateTimeCandidate = timeValue
      ? `${datePart}T${String(timeValue).trim()}`
      : normalizedDate;

    const parsed = new Date(dateTimeCandidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }

    const fallbackParsed = new Date(`${datePart}T00:00:00`);
    return Number.isNaN(fallbackParsed.getTime()) ? Number.MAX_SAFE_INTEGER : fallbackParsed.getTime();
  };

  const getExaminationSortTimestamp = (item: ResumeRanapExamination) => {
    return getDateSortTimestamp(item.tanggal || item.tgl_perawatan, item.jam_rawat);
  };

  const buildPickerConfigFromSource = (
    target: ResumePickerTarget,
    currentSourceData: ResumeSourceData
  ): ResumePickerConfig => {
    switch (target) {
      case 'keluhan_utama':
        return {
          target,
          title: 'Pilih Keluhan Utama',
          description: isRalan
            ? 'Tampilkan semua data subjektif dari tabel pemeriksaan_ralan sesuai nomor rawat, lalu pilih yang ingin dimasukkan.'
            : 'Tampilkan semua data subjektif dari IGD atau Rawat Inap.',
          emptyMessage: isRalan
            ? 'Belum ada data keluhan utama dari pemeriksaan_ralan.'
            : 'Belum ada data keluhan utama dari pemeriksaan IGD atau rawat inap.',
          multiple: true,
          items: (
            isRalan
              ? currentSourceData.outpatientExaminations
                  .filter((item) => String(item.s || '').trim())
                  .map((item, index): ResumePickerTimelineItem => ({
                    sortTimestamp: getExaminationSortTimestamp(item),
                    pickerItem: {
                      id: `keluhan-ralan-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                      title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                      subtitle: item.pegawai || 'Pemeriksaan Rawat Jalan',
                      description: item.s,
                      value: item.s
                    }
                  }))
              : [
                  ...currentSourceData.outpatientExaminations
                    .filter((item) => String(item.s || '').trim())
                    .map((item, index): ResumePickerTimelineItem => ({
                      sortTimestamp: getExaminationSortTimestamp(item),
                      pickerItem: {
                        id: `keluhan-igd-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                        title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                        subtitle: item.pegawai || 'IGD',
                        description: item.s,
                        value: item.s,
                        badgeLabel: 'IGD',
                        badgeClassName: 'bg-red-500/15 text-red-700 border border-red-200'
                      }
                    })),
                  ...currentSourceData.examinations
                    .filter((item) => String(item.s || '').trim())
                    .map((item, index): ResumePickerTimelineItem => ({
                      sortTimestamp: getExaminationSortTimestamp(item),
                      pickerItem: {
                        id: `keluhan-ranap-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                        title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                        subtitle: item.pegawai || 'Rawat Inap',
                        description: item.s,
                        value: item.s,
                        badgeLabel: 'Rawat Inap',
                        badgeClassName: 'bg-blue-500/15 text-blue-700 border border-blue-200'
                      }
                    }))
                ]
          )
            .sort((a: ResumePickerTimelineItem, b: ResumePickerTimelineItem) => a.sortTimestamp - b.sortTimestamp)
            .map((item: ResumePickerTimelineItem) => item.pickerItem)
        };
      case 'pemeriksaan_fisik':
        return {
          target,
          title: 'Pilih Pemeriksaan Fisik',
          description: isRalan
            ? 'Tampilkan semua data objektif dan tanda vital dari tabel pemeriksaan rawat jalan sesuai nomor rawat.'
            : 'Tampilkan semua data objektif dan tanda vital dari IGD atau Rawat Inap sesuai nomor rawat.',
          emptyMessage: isRalan
            ? 'Belum ada data pemeriksaan fisik dari pemeriksaan rawat jalan.'
            : 'Belum ada data pemeriksaan fisik dari IGD atau Rawat Inap.',
          multiple: true,
          items: (
            isRalan
              ? currentSourceData.outpatientExaminations
                  .filter((item) => String(item.o || buildVitalsText(item) || '').trim())
                  .map((item, index): ResumePickerTimelineItem => ({
                    sortTimestamp: getExaminationSortTimestamp(item),
                    pickerItem: {
                      id: `objektif-ralan-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                      title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                      subtitle: item.pegawai || 'Pemeriksaan Rawat Jalan',
                      description: [item.o, buildVitalsText(item)].filter(Boolean).join('\n'),
                      value: [item.o, buildVitalsText(item)].filter(Boolean).join('\n')
                    }
                  }))
              : [
                  ...currentSourceData.outpatientExaminations
                    .filter((item) => String(item.o || buildVitalsText(item) || '').trim())
                    .map((item, index): ResumePickerTimelineItem => ({
                      sortTimestamp: getExaminationSortTimestamp(item),
                      pickerItem: {
                        id: `objektif-igd-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                        title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                        subtitle: item.pegawai || 'IGD',
                        description: [item.o, buildVitalsText(item)].filter(Boolean).join('\n'),
                        value: [item.o, buildVitalsText(item)].filter(Boolean).join('\n'),
                        badgeLabel: 'IGD',
                        badgeClassName: 'bg-red-500/15 text-red-700 border border-red-200'
                      }
                    })),
                  ...currentSourceData.examinations
                    .filter((item) => String(item.o || buildVitalsText(item) || '').trim())
                    .map((item, index): ResumePickerTimelineItem => ({
                      sortTimestamp: getExaminationSortTimestamp(item),
                      pickerItem: {
                        id: `objektif-ranap-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                        title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                        subtitle: item.pegawai || 'Rawat Inap',
                        description: [item.o, buildVitalsText(item)].filter(Boolean).join('\n'),
                        value: [item.o, buildVitalsText(item)].filter(Boolean).join('\n'),
                        badgeLabel: 'Rawat Inap',
                        badgeClassName: 'bg-blue-500/15 text-blue-700 border border-blue-200'
                      }
                    }))
                ]
          )
            .sort((a: ResumePickerTimelineItem, b: ResumePickerTimelineItem) => a.sortTimestamp - b.sortTimestamp)
            .map((item: ResumePickerTimelineItem) => item.pickerItem)
        };
      case 'jalannya_penyakit':
        return {
          target,
          title: 'Pilih Jalannya Penyakit',
          description: isRalan
            ? 'Tampilkan semua entri SOAP dari tabel pemeriksaan_ralan sesuai nomor rawat, lalu pilih data yang diperlukan.'
            : 'Tampilkan semua entri SOAP dari IGD dan SOAPIE dari Rawat Inap sesuai nomor rawat, lalu pilih data yang diperlukan.',
          emptyMessage: isRalan
            ? 'Belum ada data jalannya penyakit dari pemeriksaan_ralan.'
            : 'Belum ada data jalannya penyakit dari IGD atau Rawat Inap.',
          multiple: true,
          items: (
            isRalan
              ? currentSourceData.outpatientExaminations
                  .map((item, index): ResumePickerTimelineItem => ({
                    sortTimestamp: getExaminationSortTimestamp(item),
                    pickerItem: {
                      id: `soap-ralan-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                      title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                      subtitle: item.pegawai || 'Pemeriksaan Rawat Jalan',
                      description: [item.s, item.o, item.a, item.p, item.i, item.e].filter(Boolean).join('\n'),
                      value: [
                        item.tanggal ? `Tanggal: ${formatUIDate(item.tanggal)}` : '',
                        buildVitalsText(item),
                        item.s ? `S: ${item.s}` : '',
                        item.o ? `O: ${item.o}` : '',
                        item.a ? `A: ${item.a}` : '',
                        item.p ? `P: ${item.p}` : '',
                        item.i ? `I: ${item.i}` : '',
                        item.e ? `E: ${item.e}` : ''
                      ].filter(Boolean).join('\n')
                    }
                  }))
              : [
                  ...currentSourceData.outpatientExaminations
                    .map((item, index): ResumePickerTimelineItem => ({
                      sortTimestamp: getExaminationSortTimestamp(item),
                      pickerItem: {
                        id: `soap-igd-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                        title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                        subtitle: item.pegawai || 'IGD',
                        description: [item.s, item.o, item.a, item.p].filter(Boolean).join('\n'),
                        value: [
                          item.tanggal ? `Tanggal: ${formatUIDate(item.tanggal)}` : '',
                          buildVitalsText(item),
                          item.s ? `S: ${item.s}` : '',
                          item.o ? `O: ${item.o}` : '',
                          item.a ? `A: ${item.a}` : '',
                          item.p ? `P: ${item.p}` : ''
                        ].filter(Boolean).join('\n'),
                        badgeLabel: 'IGD',
                        badgeClassName: 'bg-red-500/15 text-red-700 border border-red-200'
                      }
                    })),
                  ...currentSourceData.examinations
                    .map((item, index): ResumePickerTimelineItem => ({
                      sortTimestamp: getExaminationSortTimestamp(item),
                      pickerItem: {
                        id: `soap-ranap-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                        title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                        subtitle: item.pegawai || 'Rawat Inap',
                        description: [item.s, item.o, item.a, item.p, item.i, item.e].filter(Boolean).join('\n'),
                        value: [
                          item.tanggal ? `Tanggal: ${formatUIDate(item.tanggal)}` : '',
                          buildVitalsText(item),
                          item.s ? `S: ${item.s}` : '',
                          item.o ? `O: ${item.o}` : '',
                          item.a ? `A: ${item.a}` : '',
                          item.p ? `P: ${item.p}` : '',
                          item.i ? `I: ${item.i}` : '',
                          item.e ? `E: ${item.e}` : ''
                        ].filter(Boolean).join('\n'),
                        badgeLabel: 'Rawat Inap',
                        badgeClassName: 'bg-blue-500/15 text-blue-700 border border-blue-200'
                      }
                    }))
                ]
          )
            .filter((item: ResumePickerTimelineItem) => item.pickerItem.value.trim())
            .sort((a: ResumePickerTimelineItem, b: ResumePickerTimelineItem) => a.sortTimestamp - b.sortTimestamp)
            .map((item: ResumePickerTimelineItem) => item.pickerItem)
        };
      case 'pemeriksaan_penunjang':
        return {
          target,
          title: 'Pilih Pemeriksaan Radiologi',
          description: `Tampilkan semua data pemeriksaan radiologi ${isRalan ? 'rawat jalan' : 'sesuai nomor rawat'}, lalu pilih yang ingin dimasukkan.`,
          emptyMessage: 'Belum ada data pemeriksaan radiologi untuk nomor rawat ini.',
          multiple: true,
          items: currentSourceData.radiologyResults
            .map((item, index) => ({
              sortTimestamp: getDateSortTimestamp(item.tanggal),
              pickerItem: {
                id: `penunjang-rad-${index}-${item.tanggal}`,
                title: item.tanggal ? formatUIDate(item.tanggal) : `Radiologi ${index + 1}`,
                subtitle: 'Pemeriksaan Radiologi',
                description: buildRadiologyResultText(item),
                value: buildRadiologyResultText(item)
              }
            }))
            .filter((item) => item.pickerItem.value.trim())
            .sort((a, b) => a.sortTimestamp - b.sortTimestamp)
            .map((item) => item.pickerItem)
        };
      case 'hasil_laborat':
        return {
          target,
          title: 'Pilih Hasil Laborat',
          description: `Tampilkan semua hasil pemeriksaan laboratorium ${isRalan ? 'rawat jalan' : 'sesuai nomor rawat'}, lalu pilih yang ingin dimasukkan.`,
          emptyMessage: 'Belum ada hasil pemeriksaan laboratorium untuk nomor rawat ini.',
          multiple: true,
          items: currentSourceData.laboratoryResults
            .slice()
            .sort((a, b) => getDateSortTimestamp(a.tanggal) - getDateSortTimestamp(b.tanggal))
            .map((item, index) => ({
              id: `hasil-lab-${index}-${item.tanggal}`,
              title: item.tanggal ? formatUIDate(item.tanggal) : `Hasil Laboratorium ${index + 1}`,
              subtitle: 'Hasil Pemeriksaan Lab',
              description: buildLaboratoryResultText(item),
              value: buildLaboratoryResultText(item),
              laboratoryPanels: buildLaboratoryPickerPanels(item)
            }))
            .filter((item) => item.value.trim())
        };
      case 'tindakan_dan_operasi':
        return {
          target,
          title: 'Pilih Tindakan dan Operasi',
          description: 'Tampilkan semua data dari pemeriksaan rawat jalan, pemeriksaan rawat inap, dan laporan operasi sesuai nomor rawat, lalu pilih yang ingin dimasukkan.',
          emptyMessage: 'Belum ada data tindakan atau operasi untuk nomor rawat ini.',
          multiple: true,
          items: [
            ...currentSourceData.outpatientExaminations
              .map((item, index) => ({
                sortTimestamp: getExaminationSortTimestamp(item),
                pickerItem: {
                  id: `tindakan-ralan-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                  title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                  subtitle: item.pegawai || 'Pemeriksaan Rawat Jalan',
                  description: buildExaminationProcedureText(item, 'Pemeriksaan Ralan'),
                  value: buildExaminationProcedureText(item, 'Pemeriksaan Ralan')
                }
              }))
              .filter((item) => item.pickerItem.value.trim()),
            ...currentSourceData.examinations
              .map((item, index) => ({
                sortTimestamp: getExaminationSortTimestamp(item),
                pickerItem: {
                  id: `tindakan-ranap-${index}-${item.tgl_perawatan || item.tanggal || ''}-${item.jam_rawat || ''}`,
                  title: formatUIDateTime(`${item.tanggal || item.tgl_perawatan} ${item.jam_rawat || '00:00'}`),
                  subtitle: item.pegawai || 'Pemeriksaan Rawat Inap',
                  description: buildExaminationProcedureText(item, 'Pemeriksaan Ranap'),
                  value: buildExaminationProcedureText(item, 'Pemeriksaan Ranap')
                }
              }))
              .filter((item) => item.pickerItem.value.trim()),
            ...currentSourceData.operationData
              .map((item, index) => ({
                sortTimestamp: getDateSortTimestamp(item.tanggal_op),
                pickerItem: {
                  id: `operasi-${item.id || index}`,
                  title: item.nm_op || (/[T\s]\d{2}:\d{2}/.test(String(item.tanggal_op || '')) ? formatUIDateTime(item.tanggal_op) : formatUIDate(item.tanggal_op)) || `Operasi ${index + 1}`,
                  subtitle: item.post_op || item.pre_op || 'Laporan Operasi',
                  description: buildOperationText(item),
                  value: buildOperationText(item)
                }
              }))
              .filter((item) => item.pickerItem.value.trim())
          ]
            .sort((a, b) => a.sortTimestamp - b.sortTimestamp)
            .map((item) => item.pickerItem)
        };
      case 'obat_di_rs':
        return {
          target,
          title: 'Pilih Obat di RS',
          description: 'Tampilkan data obat pulang dan pemberian obat selama perawatan sesuai nomor rawat, lalu pilih yang ingin dimasukkan.',
          emptyMessage: 'Belum ada data obat pulang atau pemberian obat selama perawatan untuk nomor rawat ini.',
          multiple: true,
          items: [
            ...currentSourceData.dischargeMedicationRequests
              .map((item, index) => ({
                sortTimestamp: getDateSortTimestamp(item.tanggal),
                pickerItem: {
                  id: `obat-pulang-${index}-${item.no_resep || ''}-${item.tanggal || ''}`,
                  title: item.tanggal ? formatUIDate(item.tanggal) : `Obat Pulang ${index + 1}`,
                  subtitle: 'Obat Pulang',
                  description: buildMedicationListText(item, 'Obat Pulang'),
                  value: buildMedicationListText(item, 'Obat Pulang')
                }
              }))
              .filter((item) => item.pickerItem.value.trim()),
            ...currentSourceData.inpatientMedications
              .map((item, index) => ({
                sortTimestamp: getDateSortTimestamp(item.tanggal),
                pickerItem: {
                  id: `obat-ranap-${index}-${item.no_resep || ''}-${item.tanggal || ''}`,
                  title: item.tanggal ? formatUIDate(item.tanggal) : `Pemberian Obat ${index + 1}`,
                  subtitle: 'Pemberian Obat Selama Perawatan',
                  description: buildMedicationListText(item, 'Pemberian Obat Selama Perawatan'),
                  value: buildMedicationListText(item, 'Pemberian Obat Selama Perawatan')
                }
              }))
              .filter((item) => item.pickerItem.value.trim())
          ]
            .sort((a, b) => a.sortTimestamp - b.sortTimestamp)
            .map((item) => item.pickerItem)
        };
      default:
        return {
          target,
          title: 'Pilih Data',
          description: '',
          emptyMessage: 'Belum ada data.',
          multiple: true,
          items: []
        };
    }
  };

  const buildPickerConfig = (target: ResumePickerTarget): ResumePickerConfig => (
    buildPickerConfigFromSource(target, sourceData)
  );

  const pickerConfig = pickerTarget ? buildPickerConfig(pickerTarget) : null;
  const filteredPickerItems = (pickerConfig?.items || []).filter((item) => {
    const keyword = pickerSearch.trim().toLowerCase();
    if (!keyword) {
      return true;
    }

    return [item.title, item.subtitle, item.description, item.value, item.code]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(keyword));
  });
  const filteredPickerItemIds = filteredPickerItems.map((item) => item.id);
  const filteredSelectedCount = filteredPickerItemIds.filter((id) => selectedPickerItems.includes(id)).length;
  const allFilteredItemsSelected = filteredPickerItems.length > 0 && filteredSelectedCount === filteredPickerItems.length;
  const someFilteredItemsSelected = filteredSelectedCount > 0 && !allFilteredItemsSelected;
  const abnormalFilteredPickerItemIds = filteredPickerItems
    .filter((item) =>
      Array.isArray(item.laboratoryPanels)
      && item.laboratoryPanels.some((panel) =>
        Array.isArray(panel.tests)
        && panel.tests.some((test) => ['H', 'L'].includes(String(test?.keterangan || '').trim().toUpperCase()))
      )
    )
    .map((item) => item.id);
  const abnormalFilteredSelectedCount = abnormalFilteredPickerItemIds.filter((id) => selectedPickerItems.includes(id)).length;
  const allAbnormalFilteredItemsSelected = abnormalFilteredPickerItemIds.length > 0
    && abnormalFilteredSelectedCount === abnormalFilteredPickerItemIds.length;

  const openPicker = async (target: ResumePickerTarget) => {
    if (sourceLoading) {
      toast({
        title: "Memuat Data",
        description: "Sumber data resume masih dimuat, silakan tunggu sebentar.",
      });
      return;
    }

    let config = buildPickerConfig(target);
    if (config.items.length === 0 && formData.no_rkm_medis) {
      const refreshedSourceData = await fetchResumeSources(formData.no_rkm_medis);
      const currentSourceData = sourceData;
      const mergedSourceData = refreshedSourceData || currentSourceData;
      config = buildPickerConfigFromSource(target, mergedSourceData);
    }

    if (config.items.length === 0) {
      toast({
        title: "Data Belum Tersedia",
        description: config.emptyMessage,
      });
      return;
    }

    setPickerTarget(target);
    setPickerSearch('');
    setSelectedPickerItems([]);
  };

  const closePicker = () => {
    setPickerTarget(null);
    setPickerSearch('');
    setSelectedPickerItems([]);
  };

  const togglePickerItem = (itemId: string) => {
    if (!pickerConfig) {
      return;
    }

    setSelectedPickerItems((previous) => {
      if (pickerConfig.multiple) {
        return previous.includes(itemId)
          ? previous.filter((id) => id !== itemId)
          : [...previous, itemId];
      }

      return previous[0] === itemId ? [] : [itemId];
    });
  };

  const toggleAllFilteredPickerItems = () => {
    if (!pickerConfig?.multiple || filteredPickerItemIds.length === 0) {
      return;
    }

    setSelectedPickerItems((previous) => {
      if (allFilteredItemsSelected) {
        return previous.filter((id) => !filteredPickerItemIds.includes(id));
      }

      return Array.from(new Set([...previous, ...filteredPickerItemIds]));
    });
  };

  const clearAllPickerSelections = () => {
    setSelectedPickerItems([]);
  };

  const toggleAbnormalFilteredPickerItems = () => {
    if (!pickerConfig?.multiple || abnormalFilteredPickerItemIds.length === 0) {
      return;
    }

    setSelectedPickerItems((previous) => {
      if (allAbnormalFilteredItemsSelected) {
        return previous.filter((id) => !abnormalFilteredPickerItemIds.includes(id));
      }

      return Array.from(new Set([...previous, ...abnormalFilteredPickerItemIds]));
    });
  };

  const handlePickerItemClick = (event: React.MouseEvent<HTMLDivElement>, itemId: string) => {
    const selectionText = window.getSelection?.()?.toString().trim() || '';
    if (selectionText) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-picker-checkbox="true"]')) {
      return;
    }

    togglePickerItem(itemId);
  };

  const applyPickerSelection = () => {
    if (!pickerConfig || selectedPickerItems.length === 0) {
      return;
    }

    const selectedItems = pickerConfig.items.filter((item) => selectedPickerItems.includes(item.id));
    if (selectedItems.length === 0) {
      return;
    }

    switch (pickerConfig.target) {
      case 'keluhan_utama':
        updateField('keluhan_utama', mergeTextBlocks(formData.keluhan_utama, selectedItems.map((item) => item.value)));
        break;
      case 'pemeriksaan_fisik':
        updateField('pemeriksaan_fisik', mergeTextBlocks(formData.pemeriksaan_fisik, selectedItems.map((item) => item.value)));
        break;
      case 'jalannya_penyakit':
        updateField('jalannya_penyakit', mergeTextBlocks(formData.jalannya_penyakit, selectedItems.map((item) => item.value)));
        break;
      case 'pemeriksaan_penunjang':
        updateField('pemeriksaan_penunjang', mergeTextBlocks(formData.pemeriksaan_penunjang, selectedItems.map((item) => item.value)));
        break;
      case 'hasil_laborat':
        updateField('hasil_laborat', mergeTextBlocks(formData.hasil_laborat, selectedItems.map((item) => item.value)));
        break;
      case 'tindakan_dan_operasi':
        updateField('tindakan_dan_operasi', mergeTextBlocks(formData.tindakan_dan_operasi, selectedItems.map((item) => item.value)));
        break;
      case 'obat_di_rs':
        updateField('obat_di_rs', mergeTextBlocks(formData.obat_di_rs, selectedItems.map((item) => item.value)));
        break;
      default:
        break;
    }

    closePicker();
  };

  const renderFieldLabel = (htmlFor: string, label: string, target?: ResumePickerTarget) => (
    <div className="mb-2 flex items-center justify-between gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {target ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          onClick={() => openPicker(target)}
          disabled={loading || saving || sourceLoading}
          title="Ambil data dari tabel terkait"
        >
          {sourceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
        </Button>
      ) : null}
    </div>
  );

  const getResumeHistoryActionLabel = (action?: string) => {
    switch (String(action || '').trim().toLowerCase()) {
      case 'create':
        return 'Simpan';
      case 'update':
        return 'Update';
      case 'delete':
        return 'Hapus';
      case 'verify':
        return 'Verifikasi';
      case 'unverify':
        return 'Batal Verifikasi';
      default:
        return String(action || 'Aksi');
    }
  };

  const getResumeHistoryActionBadgeClassName = (action?: string) => {
    switch (String(action || '').trim().toLowerCase()) {
      case 'create':
        return 'bg-emerald-500/10 text-emerald-700';
      case 'update':
        return 'bg-sky-500/10 text-sky-700';
      case 'delete':
        return 'bg-rose-500/10 text-rose-700';
      case 'verify':
        return 'bg-violet-500/10 text-violet-700';
      case 'unverify':
        return 'bg-amber-500/10 text-amber-700';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatResumePayloadLabel = (key: string) => (
    RESUME_PAYLOAD_LABELS[key] ||
    key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );

  const isMeaningfulResumePayloadValue = (value: unknown): boolean => {
    if (value === null || value === undefined) {
      return false;
    }

    if (typeof value === 'string') {
      return String(value).trim() !== '';
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }

    return true;
  };

  const formatResumePayloadValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Ya' : 'Tidak';
    }

    if (Array.isArray(value)) {
      return value.map((item) => formatResumePayloadValue(item)).filter(Boolean).join(', ');
    }

    if (typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => isMeaningfulResumePayloadValue(nestedValue))
        .map(([nestedKey, nestedValue]) => `${formatResumePayloadLabel(nestedKey)}: ${formatResumePayloadValue(nestedValue)}`)
        .join('\n');
    }

    return String(value);
  };

  const getReadableResumePayloadEntries = (payload?: Record<string, unknown>) => {
    if (!payload || typeof payload !== 'object') {
      return [];
    }

    return Object.entries(payload)
      .filter(([, value]) => isMeaningfulResumePayloadValue(value))
      .map(([key, value]) => ({
        key,
        label: formatResumePayloadLabel(key),
        value: formatResumePayloadValue(value)
      }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-6xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Pasien
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{isRalan ? 'Informasi Rawat Jalan' : 'Informasi Rawat Inap'}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">No. Rawat</p>
                <p className="font-medium break-all">{formData.no_rawat || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">No. RM / Pasien</p>
                <p className="font-medium break-words">{formData.no_rkm_medis || '-'} {formData.nm_pasien ? `- ${formData.nm_pasien}` : ''}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dokter Penulis</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium break-words">{formData.dokter_penulis || currentDoctorName}</p>
                  {!isRalan && isRanapVerified ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700"
                      title="Resume sudah diverifikasi"
                    >
                      <BadgeCheck className="h-4 w-4 fill-sky-500 text-sky-500" />
                      Verified
                    </span>
                  ) : null}
                </div>
              </div>
              {isRalan ? (
                <div>
                  <p className="text-muted-foreground">Dokter Pemeriksa</p>
                  <p className="font-medium">{formData.dokter_reg || '-'}</p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-muted-foreground">Tanggal Masuk</p>
                    <p className="font-medium">{formData.tgl_masuk || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tanggal Keluar</p>
                    <p className="font-medium">{formData.tgl_keluar || '-'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Bangsal / Kamar</p>
                    <p className="font-medium">{formData.nm_bangsal || '-'} {formData.kd_kamar ? `- ${formData.kd_kamar}` : ''}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {loading ? (
            <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Memuat data resume pasien...
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <span>{formData.has_resume ? 'Edit Resume Pasien' : 'Tambah Resume Pasien'}</span>
                  <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                    {formData.has_resume ? (
                      <Button className="w-full sm:w-auto" variant="destructive" onClick={handleDelete} disabled={deleting || saving || verifying || isRanapVerified}>
                        {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Hapus
                      </Button>
                    ) : null}
                    <Button className="w-full sm:w-auto" onClick={handleSave} disabled={saving || deleting || verifying}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {formData.has_resume ? 'Update' : 'Simpan'}
                    </Button>
                    <Button
                      type="button"
                      className="w-full sm:w-auto"
                      variant="outline"
                      onClick={() => {
                        setHistoryOpen(true);
                        void fetchResumeHistory();
                      }}
                      disabled={saving || deleting || verifying || !noRawat}
                    >
                      <History className="h-4 w-4 mr-2" />
                      Riwayat Resume
                    </Button>
                    {canVerifyRanap ? (
                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        variant={isRanapVerified ? 'outline' : 'default'}
                        onClick={handleToggleVerification}
                        disabled={saving || deleting || verifying || !formData.has_resume}
                      >
                        {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                        {isRanapVerified ? 'Batal Verifikasi' : 'Verifikasi'}
                      </Button>
                    ) : null}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {!isRalan ? (
                    <>
                      <div className="md:col-span-2">
                        <Label htmlFor="alasan">Alasan Masuk</Label>
                        <Input id="alasan" value={formData.alasan} onChange={(e) => updateField('alasan', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="diagnosa_awal">Diagnosa Masuk</Label>
                        <Textarea
                          id="diagnosa_awal"
                          rows={5}
                          value={formData.diagnosa_awal}
                          onChange={(e) => updateField('diagnosa_awal', e.target.value)}
                          onBlur={(e) => updateField('diagnosa_awal', formatDiagnosaMasukText(e.target.value))}
                        />
                      </div>
                    </>
                  ) : null}
                  <div className="md:col-span-2">
                    {renderFieldLabel('keluhan_utama', isRalan ? 'Keluhan Utama' : 'Ringkasan Riwayat Penyakit', 'keluhan_utama')}
                    <Textarea id="keluhan_utama" rows={6} value={formData.keluhan_utama} onChange={(e) => updateField('keluhan_utama', e.target.value)} />
                  </div>
                  {!isRalan ? (
                    <div className="md:col-span-2">
                      {renderFieldLabel('pemeriksaan_fisik', 'Pemeriksaan Fisik', 'pemeriksaan_fisik')}
                      <Textarea id="pemeriksaan_fisik" rows={6} value={formData.pemeriksaan_fisik} onChange={(e) => updateField('pemeriksaan_fisik', e.target.value)} />
                    </div>
                  ) : null}
                  {!isRalan ? (
                    <>
                      <div className="md:col-span-2">
                        {renderFieldLabel('hasil_laborat', 'Pemeriksaan Laboratorium', 'hasil_laborat')}
                        <Textarea id="hasil_laborat" rows={6} value={formData.hasil_laborat} onChange={(e) => updateField('hasil_laborat', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        {renderFieldLabel('pemeriksaan_penunjang', 'Pemeriksaan Radiologi', 'pemeriksaan_penunjang')}
                        <Textarea id="pemeriksaan_penunjang" rows={6} value={formData.pemeriksaan_penunjang} onChange={(e) => updateField('pemeriksaan_penunjang', e.target.value)} />
                      </div>
                    </>
                  ) : null}
                </div>
                
                {!isRalan ? (
                <div className="space-y-4">
                  <h3 className="font-semibold">Tindakan Ventilator</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <>
                      <div>
                        <Input
                          id="tindakan_venti"
                          value={formData.tindakan_venti || ''}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                    </>
                  </div>
                </div>
                ) : null}

                <div className="space-y-4">
                  <h3 className="font-semibold">Diagnosa</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <SearchableMedicalCodeField
                      label="Diagnosa Utama"
                      placeholder="Pilih diagnosa utama"
                      emptyMessage="Tidak ada diagnosa ditemukan."
                      selectedName={formData.diagnosa_utama}
                      selectedCode={formData.kd_diagnosa_utama}
                      type="icd10"
                      onManualChange={(name) => updateDiagnosisFields('diagnosa_utama', 'kd_diagnosa_utama', name, formData.kd_diagnosa_utama)}
                      onAppend={(name, code) => appendDiagnosisFields('diagnosa_utama', 'kd_diagnosa_utama', name, code)}
                      onClear={() => updateDiagnosisFields('diagnosa_utama', 'kd_diagnosa_utama', '', '')}
                    />
                    {!isRalan ? (
                      <>
                        <SearchableMedicalCodeField
                          label="Diagnosa Sekunder 1"
                          placeholder="Pilih diagnosa sekunder 1"
                          emptyMessage="Tidak ada diagnosa ditemukan."
                          selectedName={formData.diagnosa_sekunder}
                          selectedCode={formData.kd_diagnosa_sekunder}
                          type="icd10"
                          onManualChange={(name) => updateDiagnosisFields('diagnosa_sekunder', 'kd_diagnosa_sekunder', name, formData.kd_diagnosa_sekunder)}
                          onAppend={(name, code) => appendDiagnosisFields('diagnosa_sekunder', 'kd_diagnosa_sekunder', name, code)}
                          onClear={() => updateDiagnosisFields('diagnosa_sekunder', 'kd_diagnosa_sekunder', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Diagnosa Sekunder 2"
                          placeholder="Pilih diagnosa sekunder 2"
                          emptyMessage="Tidak ada diagnosa ditemukan."
                          selectedName={formData.diagnosa_sekunder2}
                          selectedCode={formData.kd_diagnosa_sekunder2}
                          type="icd10"
                          onManualChange={(name) => updateDiagnosisFields('diagnosa_sekunder2', 'kd_diagnosa_sekunder2', name, formData.kd_diagnosa_sekunder2)}
                          onAppend={(name, code) => appendDiagnosisFields('diagnosa_sekunder2', 'kd_diagnosa_sekunder2', name, code)}
                          onClear={() => updateDiagnosisFields('diagnosa_sekunder2', 'kd_diagnosa_sekunder2', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Diagnosa Sekunder 3"
                          placeholder="Pilih diagnosa sekunder 3"
                          emptyMessage="Tidak ada diagnosa ditemukan."
                          selectedName={formData.diagnosa_sekunder3}
                          selectedCode={formData.kd_diagnosa_sekunder3}
                          type="icd10"
                          onManualChange={(name) => updateDiagnosisFields('diagnosa_sekunder3', 'kd_diagnosa_sekunder3', name, formData.kd_diagnosa_sekunder3)}
                          onAppend={(name, code) => appendDiagnosisFields('diagnosa_sekunder3', 'kd_diagnosa_sekunder3', name, code)}
                          onClear={() => updateDiagnosisFields('diagnosa_sekunder3', 'kd_diagnosa_sekunder3', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Diagnosa Sekunder 4 (Lainnya)"
                          placeholder="Pilih diagnosa sekunder 4"
                          emptyMessage="Tidak ada diagnosa ditemukan."
                          selectedName={formData.diagnosa_sekunder4}
                          selectedCode={formData.kd_diagnosa_sekunder4}
                          type="icd10"
                          onManualChange={(name) => updateDiagnosisFields('diagnosa_sekunder4', 'kd_diagnosa_sekunder4', name, formData.kd_diagnosa_sekunder4)}
                          onAppend={(name, code) => appendDiagnosisFields('diagnosa_sekunder4', 'kd_diagnosa_sekunder4', name, code)}
                          onClear={() => updateDiagnosisFields('diagnosa_sekunder4', 'kd_diagnosa_sekunder4', '', '')}
                        />
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Prosedur</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <SearchableMedicalCodeField
                      label="Prosedur Utama"
                      placeholder="Pilih prosedur utama"
                      emptyMessage="Tidak ada prosedur ditemukan."
                      selectedName={formData.prosedur_utama}
                      selectedCode={formData.kd_prosedur_utama}
                      type="icd9"
                      onManualChange={(name) => updateProcedureFields('prosedur_utama', 'kd_prosedur_utama', name, formData.kd_prosedur_utama)}
                      onAppend={(name, code) => appendProcedureFields('prosedur_utama', 'kd_prosedur_utama', name, code)}
                      onClear={() => updateProcedureFields('prosedur_utama', 'kd_prosedur_utama', '', '')}
                    />
                    {!isRalan ? (
                      <>
                        <SearchableMedicalCodeField
                          label="Prosedur Sekunder 1"
                          placeholder="Pilih prosedur sekunder 1"
                          emptyMessage="Tidak ada prosedur ditemukan."
                          selectedName={formData.prosedur_sekunder}
                          selectedCode={formData.kd_prosedur_sekunder}
                          type="icd9"
                          onManualChange={(name) => updateProcedureFields('prosedur_sekunder', 'kd_prosedur_sekunder', name, formData.kd_prosedur_sekunder)}
                          onAppend={(name, code) => appendProcedureFields('prosedur_sekunder', 'kd_prosedur_sekunder', name, code)}
                          onClear={() => updateProcedureFields('prosedur_sekunder', 'kd_prosedur_sekunder', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Prosedur Sekunder 2"
                          placeholder="Pilih prosedur sekunder 2"
                          emptyMessage="Tidak ada prosedur ditemukan."
                          selectedName={formData.prosedur_sekunder2}
                          selectedCode={formData.kd_prosedur_sekunder2}
                          type="icd9"
                          onManualChange={(name) => updateProcedureFields('prosedur_sekunder2', 'kd_prosedur_sekunder2', name, formData.kd_prosedur_sekunder2)}
                          onAppend={(name, code) => appendProcedureFields('prosedur_sekunder2', 'kd_prosedur_sekunder2', name, code)}
                          onClear={() => updateProcedureFields('prosedur_sekunder2', 'kd_prosedur_sekunder2', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Prosedur Sekunder 3 (Lainnya)"
                          placeholder="Pilih prosedur sekunder 3"
                          emptyMessage="Tidak ada prosedur ditemukan."
                          selectedName={formData.prosedur_sekunder3}
                          selectedCode={formData.kd_prosedur_sekunder3}
                          type="icd9"
                          onManualChange={(name) => updateProcedureFields('prosedur_sekunder3', 'kd_prosedur_sekunder3', name, formData.kd_prosedur_sekunder3)}
                          onAppend={(name, code) => appendProcedureFields('prosedur_sekunder3', 'kd_prosedur_sekunder3', name, code)}
                          onClear={() => updateProcedureFields('prosedur_sekunder3', 'kd_prosedur_sekunder3', '', '')}
                        />
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">{isRalan ? 'Terapi Pulang' : 'Rencana Pulang'}</h3>
                  {isRalan ? (
                    <div>
                      <Label htmlFor="obat_pulang">Terapi/Catatan Dokter</Label>
                      <Textarea id="obat_pulang" rows={6} value={formData.obat_pulang} onChange={(e) => updateField('obat_pulang', e.target.value)} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        {renderFieldLabel('obat_di_rs', 'Terapi', 'obat_di_rs')}
                        <Textarea id="obat_di_rs" rows={6} value={formData.obat_di_rs} onChange={(e) => updateField('obat_di_rs', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="obat_pulang">Terapi Pulang</Label>
                        <Textarea id="obat_pulang" rows={6} value={formData.obat_pulang} onChange={(e) => updateField('obat_pulang', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <Label>Kondisi waktu pulang</Label>
                        <Select value={formData.kondisi_pulang || 'Membaik'} onValueChange={(value) => updateField('kondisi_pulang', value)}>
                          <SelectTrigger><SelectValue placeholder="Pilih kondisi waktu pulang" /></SelectTrigger>
                          <SelectContent>
                            {kondisiPulangRanapOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={Boolean(pickerTarget)} onOpenChange={(open) => { if (!open) closePicker(); }}>
          <DialogContent className="max-h-[85vh] w-[calc(100vw-1rem)] max-w-3xl overflow-hidden flex flex-col p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>{pickerConfig?.title || 'Pilih Data Resume'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 flex-1 min-h-0">
              <p className="text-sm text-muted-foreground">
                {pickerConfig?.description || 'Pilih data dari tabel terkait untuk dimasukkan ke field resume.'}
              </p>

              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari data..."
                  className="pl-9"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                />
              </div>

              <div className="border rounded-lg overflow-y-auto max-h-[50vh]">
                {filteredPickerItems.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground text-center">
                    {pickerConfig?.emptyMessage || 'Belum ada data yang bisa dipilih.'}
                  </div>
                ) : (
                  <div className="divide-y">
                    {pickerConfig?.multiple ? (
                      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            data-picker-checkbox="true"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              checked={allFilteredItemsSelected ? true : (someFilteredItemsSelected ? 'indeterminate' : false)}
                              onCheckedChange={toggleAllFilteredPickerItems}
                            />
                          </div>
                          <button
                            type="button"
                            className="text-sm font-medium hover:underline"
                            onClick={toggleAllFilteredPickerItems}
                          >
                            {allFilteredItemsSelected ? 'Batalkan pilih semua' : 'Pilih semua'}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {filteredSelectedCount} dari {filteredPickerItems.length} item dipilih
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {pickerConfig.target === 'hasil_laborat' ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={toggleAbnormalFilteredPickerItems}
                              disabled={abnormalFilteredPickerItemIds.length === 0}
                            >
                              {allAbnormalFilteredItemsSelected ? 'Batalkan abnormal' : 'Pilih abnormal'}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={clearAllPickerSelections}
                            disabled={selectedPickerItems.length === 0}
                          >
                            Bersihkan ceklis
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    {filteredPickerItems.map((item) => {
                      const checked = selectedPickerItems.includes(item.id);
                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          key={item.id}
                          onClick={(event) => handlePickerItemClick(event, item.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              togglePickerItem(item.id);
                            }
                          }}
                          className={`w-full cursor-pointer p-4 text-left transition-colors hover:bg-muted/50 ${checked ? 'bg-muted/60' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              data-picker-checkbox="true"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => togglePickerItem(item.id)}
                                className="mt-1"
                              />
                            </div>
                            <div className="space-y-1 select-text">
                              <div className="flex items-center justify-between gap-3">
                                <p className="cursor-text font-medium select-text">{item.title}</p>
                                {item.badgeLabel ? (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.badgeClassName || 'bg-muted text-foreground'}`}>
                                    {item.badgeLabel}
                                  </span>
                                ) : null}
                              </div>
                              {item.subtitle ? (
                                <p className="cursor-text select-text text-xs text-muted-foreground">{item.subtitle}</p>
                              ) : null}
                              {Array.isArray(item.laboratoryPanels) && item.laboratoryPanels.length > 0 ? (
                                <div className="space-y-2 pt-1">
                                  {item.laboratoryPanels.map((panel, panelIndex) => (
                                    <div
                                      key={`${panel.groupName}-${panelIndex}`}
                                      className="rounded-md border bg-background/70 p-2 dark:border-slate-800 dark:bg-slate-950/60"
                                    >
                                      <p className="cursor-text select-text text-sm font-semibold text-primary">
                                        {panel.groupName}
                                      </p>
                                      <div className="mt-2 space-y-1">
                                        {panel.tests.map((test, testIndex) => (
                                          <div
                                            key={`${panel.groupName}-${testIndex}`}
                                            className={cn(
                                              "cursor-text select-text rounded px-2 py-1 text-sm",
                                              test.keterangan === 'H' && "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200",
                                              test.keterangan === 'L' && "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-200"
                                            )}
                                          >
                                            <span className="font-medium">{test.pemeriksaan || '-'}</span>: {test.hasil || '-'} ({test.rujukan || '-'})
                                            {test.keterangan ? ` - ${test.keterangan}` : ''}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : item.description ? (
                                <p className="cursor-text whitespace-pre-line break-words select-text text-sm text-muted-foreground">{item.description}</p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closePicker}>
                  Batal
                </Button>
                <Button type="button" onClick={applyPickerSelection} disabled={selectedPickerItems.length === 0}>
                  Masukkan ke Field
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent className="max-h-[85vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <History className="h-5 w-5" />
                Log Resume
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="font-medium">No. Rawat</p>
                <p className="break-all text-muted-foreground">{noRawat || '-'}</p>
              </div>

              {historyLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Memuat log resume...
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Belum ada log resume untuk nomor rawat ini.
                </div>
              ) : (
                <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                  {historyEntries.map((entry, index) => (
                    <div key={`${entry.timestamp}-${entry.action}-${index}`} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', getResumeHistoryActionBadgeClassName(entry.action))}>
                              {getResumeHistoryActionLabel(entry.action)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {entry.status_rawat || '-'}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {entry.actor?.doctor_name || entry.actor?.username || 'Pengguna tidak diketahui'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.actor?.doctor_code ? `Kode dokter: ${entry.actor.doctor_code}` : 'Kode dokter tidak tersedia'}
                            {entry.actor?.username ? ` | Username: ${entry.actor.username}` : ''}
                          </p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {entry.timestamp ? formatUIDateTime(entry.timestamp) : '-'}
                        </div>
                      </div>
                      {entry.message ? (
                        <p className="mt-3 text-sm text-muted-foreground">{entry.message}</p>
                      ) : null}
                      {getReadableResumePayloadEntries(entry.request_payload).length > 0 ? (
                        <div className="mt-4 rounded-md border bg-muted/20 p-3">
                          <p className="mb-3 text-sm font-semibold">Request Payload</p>
                          <div className="space-y-3">
                            {getReadableResumePayloadEntries(entry.request_payload).map((payloadEntry) => (
                              <div key={payloadEntry.key} className="grid gap-1 md:grid-cols-[220px_1fr] md:gap-3">
                                <p className="text-sm font-medium text-muted-foreground">
                                  {payloadEntry.label}
                                </p>
                                <p className="whitespace-pre-wrap break-words text-sm">
                                  {payloadEntry.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Update Resume</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah perubahan resume pasien akan disimpan sekarang?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={saving}>Batal</AlertDialogCancel>
              <AlertDialogAction
                disabled={saving}
                onClick={(event) => {
                  event.preventDefault();
                  void executeSave();
                }}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Simpan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
