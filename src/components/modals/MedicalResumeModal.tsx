import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { BadgeCheck, Check, ChevronsUpDown, FileText, Loader2, Paperclip, Search, Trash2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

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
}

interface ResumePickerConfig {
  target: ResumePickerTarget;
  title: string;
  description: string;
  emptyMessage: string;
  multiple: boolean;
  items: ResumePickerItem[];
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
  onSelect: (name: string, code: string) => void;
  onClear: () => void;
}

const SearchableMedicalCodeField: React.FC<SearchableMedicalCodeFieldProps> = ({
  label,
  placeholder,
  emptyMessage,
  selectedName,
  selectedCode,
  type,
  onSelect,
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

  const displayValue = selectedName
    ? `${selectedCode ? `${selectedCode} - ` : ''}${selectedName}`
    : '';

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between"
            >
              <span className="truncate text-left">
                {displayValue || placeholder}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[420px] p-0" align="start">
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
                        onSelect(option.label, option.code);
                        setOpen(false);
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

  const handleSave = async () => {
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

    if (!isRalan && isRanapVerified) {
      toast({
        title: "Error",
        description: "Resume sudah diverifikasi. Batal verifikasi terlebih dahulu sebelum mengubah resume medis.",
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
          no_rawat: noRawat,
          status_rawat: currentStatusRawat,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menyimpan resume medis');
      }

      await fetchResume();
      toast({
        title: "Berhasil",
        description: "Resume medis berhasil disimpan",
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
          `${API_URLS.RESUME_PASIEN_DATA}/${encodeURIComponent(noRawat)}?status_rawat=${encodeURIComponent(currentStatusRawat)}&kd_dokter=${encodeURIComponent(currentDoctorCode)}`,
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

    return [
      item.tanggal ? `Tanggal: ${item.tanggal}` : '',
      detailLines ? `Laboratorium:\n${detailLines}` : ''
    ].filter(Boolean).join('\n');
  };

  const buildRadiologyResultText = (item: any) => {
    return [
      item.tanggal ? `Tanggal: ${item.tanggal}` : '',
      item.pemeriksaan ? `Radiologi: ${item.pemeriksaan}` : '',
      item.hasil ? `Hasil:\n${item.hasil}` : '',
      item.kesan && item.kesan !== item.hasil ? `Kesan:\n${item.kesan}` : ''
    ].filter(Boolean).join('\n');
  };

  const buildExaminationProcedureText = (item: ResumeRanapExamination, sourceLabel: string) => {
    return [
      item.tanggal || item.tgl_perawatan ? `Tanggal: ${item.tanggal || item.tgl_perawatan}` : '',
      item.jam_rawat ? `Jam: ${item.jam_rawat}` : '',
      `Sumber: ${sourceLabel}`,
      item.pegawai ? `Petugas: ${item.pegawai}` : '',
      item.a ? `Assessment: ${item.a}` : '',
      item.p ? `Plan: ${item.p}` : '',
      item.i ? `Instruksi/Intervensi: ${item.i}` : '',
      item.e ? `Evaluasi: ${item.e}` : ''
    ].filter(Boolean).join('\n');
  };

  const buildOperationText = (item: any) => {
    return [
      item.tanggal_op ? `Tanggal Operasi: ${item.tanggal_op}` : '',
      item.nm_op ? `Nama Operasi: ${item.nm_op}` : '',
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

    return [
      item.tanggal ? `Tanggal: ${item.tanggal}` : '',
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
                      title: item.tanggal || item.tgl_perawatan || `Pemeriksaan ${index + 1}`,
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
                        title: item.tanggal || item.tgl_perawatan || `IGD ${index + 1}`,
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
                        title: item.tanggal || item.tgl_perawatan || `Rawat Inap ${index + 1}`,
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
                      title: item.tanggal || item.tgl_perawatan || `Pemeriksaan ${index + 1}`,
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
                        title: item.tanggal || item.tgl_perawatan || `IGD ${index + 1}`,
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
                        title: item.tanggal || item.tgl_perawatan || `Rawat Inap ${index + 1}`,
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
                      title: item.tanggal || item.tgl_perawatan || `Pemeriksaan ${index + 1}`,
                      subtitle: item.pegawai || 'Pemeriksaan Rawat Jalan',
                      description: [item.s, item.o, item.a, item.p, item.i, item.e].filter(Boolean).join('\n'),
                      value: [
                        item.tanggal ? `Tanggal: ${item.tanggal}` : '',
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
                        title: item.tanggal || item.tgl_perawatan || `IGD ${index + 1}`,
                        subtitle: item.pegawai || 'IGD',
                        description: [item.s, item.o, item.a, item.p].filter(Boolean).join('\n'),
                        value: [
                          item.tanggal ? `Tanggal: ${item.tanggal}` : '',
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
                        title: item.tanggal || item.tgl_perawatan || `Rawat Inap ${index + 1}`,
                        subtitle: item.pegawai || 'Rawat Inap',
                        description: [item.s, item.o, item.a, item.p, item.i, item.e].filter(Boolean).join('\n'),
                        value: [
                          item.tanggal ? `Tanggal: ${item.tanggal}` : '',
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
          title: 'Pilih Pemeriksaan Penunjang',
          description: `Tampilkan semua data pemeriksaan laboratorium dan radiologi ${isRalan ? 'rawat jalan' : 'sesuai nomor rawat'}, lalu pilih yang ingin dimasukkan.`,
          emptyMessage: 'Belum ada data pemeriksaan lab atau radiologi untuk nomor rawat ini.',
          multiple: true,
          items: [
            ...currentSourceData.laboratoryResults.map((item, index) => ({
              sortTimestamp: getDateSortTimestamp(item.tanggal),
              pickerItem: {
                id: `penunjang-lab-${index}-${item.tanggal}`,
                title: item.tanggal || `Laboratorium ${index + 1}`,
                subtitle: 'Pemeriksaan Laboratorium',
                description: buildLaboratoryResultText(item),
                value: buildLaboratoryResultText(item)
              }
            })),
            ...currentSourceData.radiologyResults.map((item, index) => ({
              sortTimestamp: getDateSortTimestamp(item.tanggal),
              pickerItem: {
                id: `penunjang-rad-${index}-${item.tanggal}`,
                title: item.tanggal || `Radiologi ${index + 1}`,
                subtitle: 'Pemeriksaan Radiologi',
                description: buildRadiologyResultText(item),
                value: buildRadiologyResultText(item)
              }
            }))
          ]
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
              title: item.tanggal || `Hasil Laboratorium ${index + 1}`,
              subtitle: 'Hasil Pemeriksaan Lab',
              description: buildLaboratoryResultText(item),
              value: buildLaboratoryResultText(item)
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
                  title: item.tanggal || item.tgl_perawatan || `Pemeriksaan Ralan ${index + 1}`,
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
                  title: item.tanggal || item.tgl_perawatan || `Pemeriksaan Ranap ${index + 1}`,
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
                  title: item.nm_op || item.tanggal_op || `Operasi ${index + 1}`,
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
                  title: item.tanggal || `Obat Pulang ${index + 1}`,
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
                  title: item.tanggal || `Pemberian Obat ${index + 1}`,
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
                <p className="font-medium">{formData.no_rawat || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">No. RM / Pasien</p>
                <p className="font-medium">{formData.no_rkm_medis || '-'} {formData.nm_pasien ? `- ${formData.nm_pasien}` : ''}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Dokter Penulis</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{formData.dokter_penulis || currentDoctorName}</p>
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
                <CardTitle className="flex items-center justify-between">
                  <span>{formData.has_resume ? 'Edit Resume Pasien' : 'Tambah Resume Pasien'}</span>
                  <div className="flex gap-2">
                    {formData.has_resume ? (
                      <Button variant="destructive" onClick={handleDelete} disabled={deleting || saving || verifying || isRanapVerified}>
                        {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Hapus
                      </Button>
                    ) : null}
                    <Button onClick={handleSave} disabled={saving || deleting || verifying || isRanapVerified}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                      {formData.has_resume ? 'Update' : 'Simpan'}
                    </Button>
                    {canVerifyRanap ? (
                      <Button
                        type="button"
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
                        {renderFieldLabel('jalannya_penyakit', 'Jalannya Penyakit', 'jalannya_penyakit')}
                        <Textarea id="jalannya_penyakit" rows={6} value={formData.jalannya_penyakit} onChange={(e) => updateField('jalannya_penyakit', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        {renderFieldLabel('pemeriksaan_penunjang', 'Pemeriksaan Penunjang yang Penting', 'pemeriksaan_penunjang')}
                        <Textarea id="pemeriksaan_penunjang" rows={6} value={formData.pemeriksaan_penunjang} onChange={(e) => updateField('pemeriksaan_penunjang', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        {renderFieldLabel('hasil_laborat', 'Pemeriksaan Laboratorium', 'hasil_laborat')}
                        <Textarea id="hasil_laborat" rows={6} value={formData.hasil_laborat} onChange={(e) => updateField('hasil_laborat', e.target.value)} />
                      </div>
                    </>
                  ) : null}
                </div>

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
                      onSelect={(name, code) => updateDiagnosisFields('diagnosa_utama', 'kd_diagnosa_utama', name, code)}
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
                          onSelect={(name, code) => updateDiagnosisFields('diagnosa_sekunder', 'kd_diagnosa_sekunder', name, code)}
                          onClear={() => updateDiagnosisFields('diagnosa_sekunder', 'kd_diagnosa_sekunder', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Diagnosa Sekunder 2"
                          placeholder="Pilih diagnosa sekunder 2"
                          emptyMessage="Tidak ada diagnosa ditemukan."
                          selectedName={formData.diagnosa_sekunder2}
                          selectedCode={formData.kd_diagnosa_sekunder2}
                          type="icd10"
                          onSelect={(name, code) => updateDiagnosisFields('diagnosa_sekunder2', 'kd_diagnosa_sekunder2', name, code)}
                          onClear={() => updateDiagnosisFields('diagnosa_sekunder2', 'kd_diagnosa_sekunder2', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Diagnosa Sekunder 3"
                          placeholder="Pilih diagnosa sekunder 3"
                          emptyMessage="Tidak ada diagnosa ditemukan."
                          selectedName={formData.diagnosa_sekunder3}
                          selectedCode={formData.kd_diagnosa_sekunder3}
                          type="icd10"
                          onSelect={(name, code) => updateDiagnosisFields('diagnosa_sekunder3', 'kd_diagnosa_sekunder3', name, code)}
                          onClear={() => updateDiagnosisFields('diagnosa_sekunder3', 'kd_diagnosa_sekunder3', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Diagnosa Sekunder 4"
                          placeholder="Pilih diagnosa sekunder 4"
                          emptyMessage="Tidak ada diagnosa ditemukan."
                          selectedName={formData.diagnosa_sekunder4}
                          selectedCode={formData.kd_diagnosa_sekunder4}
                          type="icd10"
                          onSelect={(name, code) => updateDiagnosisFields('diagnosa_sekunder4', 'kd_diagnosa_sekunder4', name, code)}
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
                      onSelect={(name, code) => updateProcedureFields('prosedur_utama', 'kd_prosedur_utama', name, code)}
                      onClear={() => updateProcedureFields('prosedur_utama', 'kd_prosedur_utama', '', '')}
                    />
                    {!isRalan ? (
                      <>
                        <div>
                          <Label htmlFor="tindakan_venti">Tindakan Ventilator</Label>
                          <Input
                            id="tindakan_venti"
                            value={formData.tindakan_venti || ''}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                        <SearchableMedicalCodeField
                          label="Prosedur Sekunder 1"
                          placeholder="Pilih prosedur sekunder 1"
                          emptyMessage="Tidak ada prosedur ditemukan."
                          selectedName={formData.prosedur_sekunder}
                          selectedCode={formData.kd_prosedur_sekunder}
                          type="icd9"
                          onSelect={(name, code) => updateProcedureFields('prosedur_sekunder', 'kd_prosedur_sekunder', name, code)}
                          onClear={() => updateProcedureFields('prosedur_sekunder', 'kd_prosedur_sekunder', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Prosedur Sekunder 2"
                          placeholder="Pilih prosedur sekunder 2"
                          emptyMessage="Tidak ada prosedur ditemukan."
                          selectedName={formData.prosedur_sekunder2}
                          selectedCode={formData.kd_prosedur_sekunder2}
                          type="icd9"
                          onSelect={(name, code) => updateProcedureFields('prosedur_sekunder2', 'kd_prosedur_sekunder2', name, code)}
                          onClear={() => updateProcedureFields('prosedur_sekunder2', 'kd_prosedur_sekunder2', '', '')}
                        />
                        <SearchableMedicalCodeField
                          label="Prosedur Sekunder 3"
                          placeholder="Pilih prosedur sekunder 3"
                          emptyMessage="Tidak ada prosedur ditemukan."
                          selectedName={formData.prosedur_sekunder3}
                          selectedCode={formData.kd_prosedur_sekunder3}
                          type="icd9"
                          onSelect={(name, code) => updateProcedureFields('prosedur_sekunder3', 'kd_prosedur_sekunder3', name, code)}
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
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
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
                    {filteredPickerItems.map((item) => {
                      const checked = selectedPickerItems.includes(item.id);
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => togglePickerItem(item.id)}
                          className={`w-full p-4 text-left transition-colors hover:bg-muted/50 ${checked ? 'bg-muted/60' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePickerItem(item.id)}
                              className="mt-1"
                            />
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-medium">{item.title}</p>
                                {item.badgeLabel ? (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.badgeClassName || 'bg-muted text-foreground'}`}>
                                    {item.badgeLabel}
                                  </span>
                                ) : null}
                              </div>
                              {item.subtitle ? (
                                <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                              ) : null}
                              {item.description ? (
                                <p className="text-sm whitespace-pre-line break-words text-muted-foreground">{item.description}</p>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
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
      </DialogContent>
    </Dialog>
  );
};
