import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PatientTable from "@/components/PatientTable";
import { FloatingButtonsModal } from '@/components/FloatingButtonsModal';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  User, Calendar, Stethoscope, Syringe, Pill, FlaskConical, Radio,
  Activity, ClipboardList, BedDouble, UserCircle, Building, MapPin,
  Phone, Heart, CalendarDays, FileText, Plus, X, Trash2, Image as ImageIcon, Clock,
  Copy, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Brain, Check, ChevronsUpDown, Pause, Pencil, Play,
  BadgeAlert, Download, Maximize2, RotateCcw, ZoomIn, ZoomOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTimeWIB } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { API_CONFIG, API_URLS } from '@/config/api';
import { DatePickerPopover } from '@/components/DatePickerPopover';

type PrescriptionStatus = 'Ralan' | 'Ranap' | 'Pulang' | 'IBS';

interface Medication {
  tanggal: string;
  status: PrescriptionStatus;
  obat: {
    kode_brng: string;
    nama: string;
    jumlah: string;
    aturan_pakai: string;
    satuan?: string;
    stok?: number;
  }[];
}

interface MedicineOption {
  kode_brng: string;
  nama_brng: string;
  satuan?: string;
  harga?: number;
  stok?: number;
}

type AllergyCategory = 'Lingkungan' | 'Makanan' | 'Obat';

interface AllergyOption {
  id: string;
  text: string;
}

interface AllergyHistoryItem {
  id: string | number;
  created_at?: string;
  kode_brng?: string;
  kategori: string;
  nama: string;
}

interface RacikanMedicine {
  kode_brng?: string;
  nama: string;
  jumlah: string;
  satuan?: string;
  stok?: number;
}

interface CompoundPrescription {
  tanggal: string;
  nama_racikan: string;
  jumlah: string;
  kd_racik: string;
  aturan_pakai: string;
  keterangan: string;
  komposisi: RacikanMedicine[];
}

interface CompoundMethodOption {
  kd_racik: string;
  nm_racik: string;
}

interface LabTest {
  kode?: string;
  nama?: string;
  pemeriksaan?: string;
  hasil: string;
  rujukan: string;
  keterangan: string;
}

interface LabServiceOption {
  kd_jenis_prw: string;
  nm_perawatan: string;
  total_byr?: number;
}

interface LabTemplateOption {
  id_template: string;
  Pemeriksaan: string;
  satuan?: string;
  nilai_rujukan_ld?: string;
  nilai_rujukan_la?: string;
  nilai_rujukan_pd?: string;
  nilai_rujukan_pa?: string;
}

interface LabData {
  tanggal: string;
  pemeriksaan: LabTest[];
}

interface BalanceCairanEntry {
  id: number;
  no_rawat: string;
  user: string;
  tanggal: string;
  bc_ke: string;
  minum: number;
  makan: number;
  infus: number;
  muntah: number;
  urine: number;
  bab: number;
  total_in: number;
  total_out: number;
  balance: number;
  created_at?: string;
  is_intake_reference?: boolean;
}

interface RehabMedikAssessment {
  no_rawat: string;
  tanggal: string;
  time: string;
  anamnesa: string;
  pemeriksaan_fisik: string;
  diagnosa_fungsi: string;
  anjuran: string;
  evaluasi: string;
  hasil: string;
  kesimpulan: string;
  rekomendasi: string;
  suspek_penyakit: string;
}

interface IgdTriageMasterOption {
  kd_level: string;
  nm_level: string;
  kd_tindakan: string;
  nm_tindakan: string;
}

interface IgdTriageSelectedAction {
  kd_tindakan: string;
  nm_tindakan: string;
}

interface IgdTriageForm {
  tgl_perawatan: string;
  jam_rawat: string;
  kd_level: string;
  namakasus: string;
  stts_diantar: string;
  transportasi: string;
  stts_fungsional: string;
  psikologis: string;
  stts_tinggal: string;
  keluhan_utama: string;
  riwayat_penyakit: string;
  saturasi: string;
  periksafisik: string;
  skala_nyeri: string;
  resiko_jatuh: string;
  diagnosis: string;
  tindakan: string;
  keterangan: string;
  selected_tindakan: string[];
}

interface RadiologyFormItem {
  kode: string;
  pemeriksaan: string;
}

interface RadiologyServiceOption {
  kd_jenis_prw: string;
  nm_perawatan: string;
  total_byr?: number;
}

interface ProcedureFormItem {
  kode: string;
  nama: string;
  hasil: string;
}

interface ProcedureOption {
  kode: string;
  nama: string;
  biaya_rawat: number;
}

type ProcedureStatusRawat = 'Ralan' | 'Ranap';
type LabStatusRawat = 'Ralan' | 'Ranap' | 'IGD';
type RadiologyStatusRawat = 'Ralan' | 'Ranap' | 'IGD';
type OutpatientExaminationSectionTabValue = 'examinations' | 'rehab-medik';
type InpatientExaminationSectionTabValue = 'examinations' | 'balance-cairan' | 'ekstrapiramidal' | 'rehab-medik';

interface MedicalRecordData {
  patient: {
    nama: string;
    no_rm: string;
    tanggal_lahir: string;
    jenis_kelamin: string;
    alamat: string;
    telepon: string;
    golongan_darah: string;
    alergi: string;
    prb?: string;
    prb_program?: string;
    status_lanjut?: string;
  };
  outpatient_visits: any[];
  inpatient_visits: any[];
  focused_examinations?: {
    ralan?: any[];
    ranap?: any[];
  };
  focused_ekstrapiramidal?: {
    no_rawat?: string;
    dokter?: string;
    hasil?: Record<string, string>;
    created_at?: string;
    updated_at?: string;
  } | null;
  focused_procedures?: {
    ralan?: any[];
    ranap?: any[];
  };
  focused_medications_request?: {
    ralan?: any[];
    ranap?: any[];
    pulang?: any[];
    ibs?: any[];
  };
  focused_medications_request_meta?: {
    ralan_has_more?: boolean;
    ralan_racikan_has_more?: boolean;
    ralan_umum_has_more?: boolean;
    ralan_racikan_total?: number;
    ralan_umum_total?: number;
    ranap_has_more?: boolean;
    ranap_racikan_has_more?: boolean;
    ranap_umum_has_more?: boolean;
    ranap_racikan_total?: number;
    ranap_umum_total?: number;
    pulang_has_more?: boolean;
    ibs_has_more?: boolean;
  };
  focused_medications?: {
    ralan?: any[];
    ranap?: any[];
  };
  focused_laboratory_request?: {
    ralan?: any[];
    ranap?: any[];
  };
  focused_laboratory?: {
    ralan?: LabData[];
    ranap?: LabData[];
  };
  focused_radiology_request?: {
    ralan?: any[];
    ranap?: any[];
  };
  focused_radiology?: {
    ralan?: any[];
    ranap?: any[];
  };
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface MedicalRecordPagination {
  outpatient: PaginationMeta;
  inpatient: PaginationMeta;
}

interface ExaminationHistoryItem {
  key: string;
  visit: any;
  exam: any;
  rawatType: 'Ralan' | 'Ranap';
  timestamp?: number;
}

const PAGE_SIZE = 5;
type VisitHistoryTabValue = 'outpatient' | 'inpatient';
type ExaminationHistoryTabValue = 'outpatient' | 'inpatient';
type CareSectionTabValue = 'outpatient' | 'inpatient';
type ExaminationRoleFilterValue = 'all' | 'medis' | 'paramedis' | 'apoteker' | 'gizi';
type ExaminationRoleValue = Exclude<ExaminationRoleFilterValue, 'all'>;
type MedicationRequestFilterValue = 'umum' | 'racikan' | 'pulang' | 'ibs' | 'package';
type MedicalRecordFetchOptions = {
  reset?: boolean;
  outpatientPage?: number;
  inpatientPage?: number;
  includeOutpatient?: boolean;
  includeInpatient?: boolean;
  includeVisitDetails?: boolean;
  includeFocusedExaminations?: boolean;
  includeFocusedProcedures?: boolean;
  includeFocusedMedications?: boolean;
  includeFocusedLaboratory?: boolean;
  includeFocusedRadiology?: boolean;
  focusedMedicationHistoryMode?: 'latest' | 'all';
  requestScope?: 'visits' | 'focused';
};

const getFocusedFetchOptionsForTab = (tab: string): Pick<
  MedicalRecordFetchOptions,
  'includeFocusedExaminations' | 'includeFocusedProcedures' | 'includeFocusedMedications' | 'includeFocusedLaboratory' | 'includeFocusedRadiology'
> | null => {
  switch (tab) {
    case 'examinations':
      return { includeFocusedExaminations: true };
    case 'procedures':
      return { includeFocusedProcedures: true };
    case 'medications':
      return { includeFocusedMedications: true };
    case 'laboratory':
      return { includeFocusedLaboratory: true };
    case 'radiology':
      return { includeFocusedRadiology: true };
    default:
      return null;
  }
};

const DEFAULT_PAGINATION_META: PaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  hasMore: false
};

const EXAMINATION_ROLE_OPTIONS: Array<{ value: ExaminationRoleFilterValue; label: string }> = [
  { value: 'all', label: 'Semua' },
  { value: 'medis', label: 'Dokter' },
  { value: 'paramedis', label: 'Perawat' },
  { value: 'apoteker', label: 'Farmasi' },
  { value: 'gizi', label: 'Gizi' }
];

const resolveExaminationRole = (...values: Array<string | null | undefined>): ExaminationRoleValue | '' => {
  const normalizedValues = values
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);

  const explicitRole = normalizedValues.find(
    (value) => value === 'medis' || value === 'paramedis' || value === 'apoteker' || value === 'gizi'
  );

  if (explicitRole === 'medis' || explicitRole === 'paramedis' || explicitRole === 'apoteker' || explicitRole === 'gizi') {
    return explicitRole;
  }

  if (normalizedValues.some((value) => value.includes('dr.'))) {
    return 'medis';
  }

  return '';
};

const normalizeExaminationRole = (value?: string | null): ExaminationRoleValue | '' => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'medis' || normalized === 'paramedis' || normalized === 'apoteker' || normalized === 'gizi') {
    return normalized;
  }
  return '';
};

const getExaminationRoleLabel = (value?: string | null) => {
  switch (normalizeExaminationRole(value)) {
    case 'medis':
      return 'Dokter';
    case 'paramedis':
      return 'Perawat';
    case 'apoteker':
      return 'Farmasi';
    case 'gizi':
      return 'Gizi';
    default:
      return 'Tanpa Role';
  }
};

const getExaminationRoleStyles = (value?: string | null) => {
  switch (normalizeExaminationRole(value)) {
    case 'medis':
      return {
        badge: 'border-violet-200 bg-violet-100 text-violet-700',
        soap: 'border-violet-200 bg-violet-50/80'
      };
    case 'paramedis':
      return {
        badge: 'border-sky-200 bg-sky-100 text-sky-700',
        soap: 'border-sky-200 bg-sky-50/80'
      };
    case 'apoteker':
      return {
        badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
        soap: 'border-emerald-200 bg-emerald-50/80'
      };
    case 'gizi':
      return {
        badge: 'border-amber-200 bg-amber-100 text-amber-700',
        soap: 'border-amber-200 bg-amber-50/80'
      };
    default:
      return {
        badge: 'border-slate-200 bg-slate-100 text-slate-700',
        soap: 'border-slate-200 bg-slate-50/80'
      };
  }
};

const getCurrentExaminationDateTime = () => ({
  tgl_perawatan: format(new Date(), 'yyyy-MM-dd'),
  jam_rawat: format(new Date(), 'HH:mm')
});

const getCurrentPrescriptionDate = () => format(new Date(), 'yyyy-MM-dd');

const createEmptyRacikanMedicine = (): RacikanMedicine => ({
  kode_brng: '',
  nama: '',
  jumlah: '',
  satuan: '',
  stok: 0
});

const createDefaultCompoundPrescription = (): CompoundPrescription => ({
  tanggal: getCurrentPrescriptionDate(),
  nama_racikan: '',
  jumlah: '',
  kd_racik: '',
  aturan_pakai: '',
  keterangan: '',
  komposisi: [createEmptyRacikanMedicine()]
});

const getDefaultMedicationForm = (defaultStatus: PrescriptionStatus = 'Ralan'): Medication[] => ([{
  tanggal: getCurrentPrescriptionDate(),
  status: defaultStatus,
  obat: [{
    kode_brng: '',
    nama: '',
    jumlah: '',
    aturan_pakai: '',
    satuan: '',
    stok: 0
  }]
}]);

const getDefaultExaminationForm = () => ({
  ...getCurrentExaminationDateTime(),
  suhu: '',
  tensi: '',
  nadi: '',
  respirasi: '',
  tinggi: '',
  berat: '',
  spo2: '',
  gcs: '',
  kesadaran: '',
  keluhan: '',
  pemeriksaan: '',
  rtl: '',
  penilaian: '',
  instruksi: '',
  evaluasi: '',
  nip: ''
});

const getDefaultIgdTriageForm = (): IgdTriageForm => ({
  ...getCurrentExaminationDateTime(),
  kd_level: '',
  namakasus: 'Non Trauma',
  stts_diantar: '',
  transportasi: '',
  stts_fungsional: '',
  psikologis: 'Stabil',
  stts_tinggal: '',
  keluhan_utama: '',
  riwayat_penyakit: '',
  saturasi: '',
  periksafisik: '',
  skala_nyeri: '',
  resiko_jatuh: '',
  diagnosis: '',
  tindakan: '',
  keterangan: '',
  selected_tindakan: []
});

const getDefaultRehabMedikForm = () => ({
  anamnesa: '',
  pemeriksaan_fisik: '',
  diagnosa_fungsi: '',
  anjuran: '',
  evaluasi: '',
  hasil: '',
  kesimpulan: '',
  rekomendasi: '',
  suspek_penyakit: 'Tidak'
});

const getDefaultEkstrapiramidalForm = () => ({
  piramidal1: '1',
  piramidal2: '1',
  piramidal3: '1',
  piramidal4: '1',
  piramidal5: '1',
  piramidal6: '1',
  piramidal7: '1',
  piramidal8: '1',
  piramidal9: '1',
  piramidal10: '1',
  piramidal11: '1',
  piramidal12: '1'
});

const getDefaultProcedureForm = (): ProcedureFormItem[] => ([{
  kode: '',
  nama: '',
  hasil: ''
}]);

const getDefaultLabRequestForm = (): LabTest[] => ([{
  kode: '',
  pemeriksaan: '',
  hasil: '',
  rujukan: '',
  keterangan: ''
}]);

const getDefaultRadiologyRequestForm = (): RadiologyFormItem[] => ([{
  kode: '',
  pemeriksaan: ''
}]);

const mapStatusLanjutToStatusRawat = (statusLanjut?: string | null) => {
  if (statusLanjut === 'Ranap' || statusLanjut === 'Dirawat') {
    return 'Ranap';
  }

  if (statusLanjut === 'IGD') {
    return 'IGD';
  }

  return 'Ralan';
};

const igdCaseOptions = ['Non Trauma', 'Trauma'];
const igdArrivalStatusOptions = ['Datang sendiri', 'Keluarga', 'Polisi', 'Petugas'];
const igdTransportationOptions = ['Ambulans', 'Kursi roda', 'Brankar', 'Jalan kaki', 'Lainnya'];
const igdFunctionalStatusOptions = ['Mandiri', 'Perlu bantuan', 'Ketergantungan total'];
const igdPsychologicalStatusOptions = ['Stabil', 'Cemas', 'Gelisah', 'Depresi'];
const igdLivingStatusOptions = ['Sendiri', 'Keluarga', 'Orang Tua', 'Wali', 'Lainnya'];

const getIgdTriaseBadgeTone = (value: string) => {
  switch ((value || '').toLowerCase()) {
    case 'merah':
      return 'red' as const;
    case 'merah muda':
      return 'pink' as const;
    case 'kuning':
      return 'amber' as const;
    case 'hijau muda':
      return 'lime' as const;
    case 'hijau':
      return 'green' as const;
    case 'hitam':
      return 'dark' as const;
    default:
      return 'green' as const;
  }
};

const getIgdTriaseSectionToneByLevel = (value: string) => {
  const normalizedValue = String(value || '').trim().toUpperCase();

  switch (normalizedValue) {
    case '1':
    case 'KL01':
    case 'LEVEL 1':
      return 'red' as const;
    case '2':
    case 'KL02':
    case 'LEVEL 2':
      return 'pink' as const;
    case '3':
    case 'KL03':
    case 'LEVEL 3':
      return 'amber' as const;
    case '4':
    case 'KL04':
    case 'LEVEL 4':
      return 'lime' as const;
    case '5':
    case 'KL05':
    case 'LEVEL 5':
      return 'green' as const;
    default:
      return 'green' as const;
  }
};

const igdTriaseSectionToneClasses: Record<
  ReturnType<typeof getIgdTriaseSectionToneByLevel>,
  { container: string; subtle: string }
> = {
  red: {
    container: 'border-red-200 bg-red-50/70 text-red-900',
    subtle: 'text-red-800'
  },
  pink: {
    container: 'border-pink-200 bg-pink-50/70 text-pink-900',
    subtle: 'text-pink-800'
  },
  amber: {
    container: 'border-amber-200 bg-amber-50/70 text-amber-900',
    subtle: 'text-amber-800'
  },
  lime: {
    container: 'border-lime-200 bg-lime-50/70 text-lime-900',
    subtle: 'text-lime-800'
  },
  green: {
    container: 'border-green-200 bg-green-50/70 text-green-900',
    subtle: 'text-green-800'
  }
};

const mapPrescriptionSourceToStatus = (source?: string | null): PrescriptionStatus => {
  switch (String(source || '').trim().toLowerCase()) {
    case 'rawat inap':
      return 'Ranap';
    case 'obat pulang':
      return 'Pulang';
    case 'ibs':
      return 'IBS';
    default:
      return 'Ralan';
  }
};

const matchesMedicationRequestFilter = (item: any, filter: MedicationRequestFilterValue) => {
  const status = item?.status || mapPrescriptionSourceToStatus(item?.source);
  const isPackage = Boolean(item?.is_package);
  const hasCompoundItems = Array.isArray(item?.compounds) && item.compounds.length > 0;

  switch (filter) {
    case 'racikan':
      return status !== 'Pulang' && status !== 'IBS' && !isPackage && hasCompoundItems;
    case 'pulang':
      return status === 'Pulang';
    case 'ibs':
      return status === 'IBS' && !isPackage;
    case 'package':
      return isPackage;
    default:
      return status !== 'Pulang' && status !== 'IBS' && !isPackage && !hasCompoundItems;
  }
};

const mapRequestSourceToStatusRawat = (source?: string | null): LabStatusRawat => {
  const normalizedSource = String(source || '').trim().toLowerCase();

  if (normalizedSource === 'rawat inap') {
    return 'Ranap';
  }

  if (normalizedSource === 'igd' || normalizedSource === 'gawat darurat' || normalizedSource === 'instalasi gawat darurat') {
    return 'IGD';
  }

  return 'Ralan';
};

const getPrescriptionDateOnly = (value?: string | null) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) {
    return getCurrentPrescriptionDate();
  }

  return normalizedValue.split(' ')[0] || getCurrentPrescriptionDate();
};

const formatMultilineText = (value?: string | null) => {
  const normalizedValue = value?.replace(/\r\n/g, '\n').trim();
  return normalizedValue || '-';
};

const parseVitalNumber = (value?: string | number | null) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseBloodPressure = (value?: string | null) => {
  const normalized = String(value || '').trim();
  const matches = normalized.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);

  if (!matches) {
    return { systolic: null, diastolic: null };
  }

  return {
    systolic: parseVitalNumber(matches[1]),
    diastolic: parseVitalNumber(matches[2]),
  };
};

const parseGcsValue = (value?: string | number | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return null;
  }

  if (/^\d{3}$/.test(normalized)) {
    return normalized.split('').reduce((total, digit) => total + Number(digit), 0);
  }

  return parseVitalNumber(normalized);
};

const vitalChartSeries = [
  { key: 'systolic', title: 'Sistolik', color: '#2563eb', unit: 'mmHg' },
  { key: 'diastolic', title: 'Diastolik', color: '#0f172a', unit: 'mmHg' },
  { key: 'nadi', title: 'Nadi', color: '#7c3aed', unit: 'x/menit' },
  { key: 'respirasi', title: 'Respirasi', color: '#db2777', unit: 'x/menit' },
  { key: 'suhu', title: 'Suhu', color: '#ea580c', unit: 'C' },
  { key: 'gcs', title: 'GCS', color: '#059669', unit: 'skor' },
  { key: 'spo2', title: 'SpO2', color: '#dc2626', unit: '%' },
] as const;

type VitalChartSeriesKey = typeof vitalChartSeries[number]['key'];

const formatRouteNoRawat = (rawatParam?: string) => {
  if (!rawatParam || rawatParam.length < 9) {
    return '';
  }

  const year = rawatParam.substring(0, 4);
  const month = rawatParam.substring(4, 6);
  const day = rawatParam.substring(6, 8);
  const sequence = rawatParam.substring(8);
  return `${year}/${month}/${day}/${sequence}`;
};

const getRadiologyPacsKey = (rad: any) => {
  const noRawat = String(rad?.no_rawat || '').trim();
  const examDate = String(rad?.tgl_periksa || String(rad?.tanggal || '').split(' ')[0] || '').trim();
  const examName = String(rad?.pemeriksaan || '').trim().toLowerCase();
  return [noRawat, examDate, examName].join('::');
};

const mergeVisitsByNoRawat = (existingVisits: any[] = [], incomingVisits: any[] = []) => {
  const existingNoRawat = new Set(existingVisits.map((visit) => visit.no_rawat));
  return [
    ...existingVisits,
    ...incomingVisits.filter((visit) => !existingNoRawat.has(visit.no_rawat))
  ];
};

const replaceVisitByNoRawat = (visits: any[] = [], updatedVisit: any) => (
  visits.map((visit) => (
    visit.no_rawat === updatedVisit?.no_rawat
      ? { ...visit, ...updatedVisit }
      : visit
  ))
);

const mergeExaminationHistory = (
  existingItems: ExaminationHistoryItem[] = [],
  incomingItems: ExaminationHistoryItem[] = []
) => {
  const existingKeys = new Set(existingItems.map((item) => item.key));
  return [
    ...existingItems,
    ...incomingItems.filter((item) => !existingKeys.has(item.key))
  ];
};

const buildVitalChartFromExamHistory = (items: ExaminationHistoryItem[] = []) => (
  items
    .map(({ visit, exam }) => {
      const bloodPressure = parseBloodPressure(exam.tekanan_darah || exam.tensi);
      const examDate = exam.tgl_perawatan || exam.tanggal || '';
      const examTime = exam.jam_rawat || '00:00';
      const examDateTime = examDate
        ? new Date(`${examDate}T${examTime.length === 5 ? `${examTime}:00` : examTime}`).getTime()
        : 0;

      return {
        id: `${visit.no_rawat}-${examDate}-${examTime}`,
        label: examDate
          ? `${examDate.slice(8, 10)}/${examDate.slice(5, 7)} ${examTime.slice(0, 5)}`
          : '-',
        fullDate: examDate,
        fullTime: examTime,
        systolic: bloodPressure.systolic,
        diastolic: bloodPressure.diastolic,
        nadi: parseVitalNumber(exam.nadi),
        respirasi: parseVitalNumber(exam.respirasi),
        suhu: parseVitalNumber(exam.suhu_tubuh || exam.suhu),
        gcs: parseGcsValue(exam.gcs),
        spo2: parseVitalNumber(exam.spo2),
        timestamp: Number.isNaN(examDateTime) ? 0 : examDateTime,
      };
    })
    .sort((a, b) => a.timestamp - b.timestamp)
);

const getVisitSortTimestamp = (visit: any, type: 'outpatient' | 'inpatient') => {
  const sourceValue = type === 'outpatient'
    ? visit?.tanggal
    : visit?.tanggal_masuk || visit?.tanggal_keluar || '';

  const normalized = String(sourceValue || '').trim();
  if (!normalized) {
    return 0;
  }

  const [datePart = '', timePart = '00:00'] = normalized.split(' ');
  const parsed = new Date(`${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`);
  const timestamp = parsed.getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const buildExaminationHistory = (visits: any[] = [], rawatType: 'Ralan' | 'Ranap') => {
  return visits
    .flatMap((visit) =>
      (visit.examinations || []).map((exam: any, examIndex: number) => {
        const examDate = String(exam.tgl_perawatan || exam.tanggal || '').trim();
        const examTime = String(exam.jam_rawat || '00:00').trim() || '00:00';
        const parsedDate = examDate
          ? new Date(`${examDate}T${examTime.length === 5 ? `${examTime}:00` : examTime}`).getTime()
          : 0;

        return {
          key: `${rawatType.toLowerCase()}-${visit.no_rawat}-${examDate}-${examTime}-${examIndex}`,
          visit,
          exam,
          rawatType,
          timestamp: Number.isNaN(parsedDate) ? 0 : parsedDate,
        };
      })
    )
    .sort((a, b) => b.timestamp - a.timestamp);
};

const getRecordTimestamp = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 0;
  }

  const [datePart = '', timePart = '00:00'] = normalized.split(' ');
  const parsed = new Date(`${datePart}T${timePart.length === 5 ? `${timePart}:00` : timePart}`);
  const timestamp = parsed.getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const buildFocusedItems = <T,>(
  records: T[] = [],
  noRawat: string,
  source: string,
  extra: Record<string, any> = {},
  getDateValue?: (record: T) => string | undefined | null
) => {
  return records
    .map((record, index) => ({
      ...record,
      no_rawat: (record as any)?.no_rawat || noRawat,
      source,
      ...extra,
      __timestamp: getRecordTimestamp(getDateValue ? getDateValue(record) : (record as any)?.tanggal),
      __index: index
    }))
    .sort((a, b) => {
      if (b.__timestamp !== a.__timestamp) {
        return b.__timestamp - a.__timestamp;
      }

      return a.__index - b.__index;
    });
};

const splitMedicationRequestItems = (records: any[] = []) => {
  return (Array.isArray(records) ? records : []).flatMap((record, index) => {
    const obatItems = Array.isArray(record?.obat) ? record.obat : [];
    const compoundItems = Array.isArray(record?.compounds) ? record.compounds : [];
    const hasCompoundItems = compoundItems.length > 0;
    const hasObatItems = obatItems.length > 0;
    const baseRecord = {
      ...record,
      __has_compounds_original: hasCompoundItems
    };

    if (Boolean(record?.is_package) || !hasCompoundItems || !hasObatItems) {
      return [
        {
          ...baseRecord,
          __split_key: `${record?.no_resep || record?.tanggal || index}-default`
        }
      ];
    }

    return [
      {
        ...baseRecord,
        compounds: [],
        __split_key: `${record?.no_resep || record?.tanggal || index}-umum`
      },
      {
        ...baseRecord,
        obat: [],
        __split_key: `${record?.no_resep || record?.tanggal || index}-racikan`
      }
    ];
  });
};

const buildFocusedLabItems = (
  records: LabData[] = [],
  noRawat: string,
  source: string
) => {
  return (records || [])
    .map((record, index) => {
      const normalizedTanggal = String(record?.tanggal || '').trim();
      const [datePart = '', timePart = '00:00'] = normalizedTanggal.split(' ');

      return {
        ...record,
        no_rawat: noRawat,
        source,
        __datePart: datePart,
        __timePart: timePart,
        __index: index
      };
    })
    .sort((a: any, b: any) => {
      const dateCompare = String(b.__datePart || '').localeCompare(String(a.__datePart || ''));
      if (dateCompare !== 0) {
        return dateCompare;
      }

      const timeCompare = String(a.__timePart || '').localeCompare(String(b.__timePart || ''));
      if (timeCompare !== 0) {
        return timeCompare;
      }

      return (a.__index || 0) - (b.__index || 0);
    });
};

const ekstrapiramidalQuestionLabels: Record<string, string> = {
  piramidal1: 'Perlambatan atau kelemahan yang nyata, ada kesan kesulitan dalam menjalankan tugas rutin',
  piramidal2: 'Kesulitan dalam berjalan dan menjaga keseimbangan',
  piramidal3: 'Kesulitan dalam menelan atau berbicara',
  piramidal4: 'Kekakuan, postur tubuh kaku',
  piramidal5: 'Kram atau nyeri pada anggota gerak, tulang belakang dan atau leher',
  piramidal6: 'Gelisah, nervous, tidak bisa diam',
  piramidal7: 'Tremor, gemetar',
  piramidal8: 'Krisis okulogirik atau postur tubuh yang abnormal yang dipertahankan',
  piramidal9: 'Banyak ludah',
  piramidal10: 'Gerakan-gerakan yang involunter yang abnormal (diskinesia) dari anggota gerak atau badan',
  piramidal11: 'Gerakan-gerakan yang involunter yang abnormal (diskinesia) dari lidah, rahang, bibir atau muka',
  piramidal12: 'Pusing pada saat berdiri (khususnya pada pagi hari)'
};

const mapEkstrapiramidalAnswer = (value?: string | number | null) => {
  switch (String(value || '').trim()) {
    case '1':
      return 'Tidak Ada';
    case '2':
      return 'Ringan';
    case '3':
      return 'Sedang';
    case '4':
      return 'Berat';
    default:
      return '-';
  }
};

interface MedicalRecordProps {
  noRkmMedis?: string;
  noRawat?: string;
  embedded?: boolean;
}

const MedicalRecord: React.FC<MedicalRecordProps> = ({
  noRkmMedis,
  noRawat,
  embedded = false
}) => {
  const routeParams = useParams();
  const [searchParams] = useSearchParams();
  const no_rkm_medis = noRkmMedis || routeParams.no_rkm_medis;
  const rawatParam = noRawat || routeParams.no_rawat;
  const formattedNoRawat = formatRouteNoRawat(rawatParam);
  const routeSearchQuery = embedded ? '' : (searchParams.get('search') || '');
  const [medicalData, setMedicalData] = useState<MedicalRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMoreVisits, setLoadingMoreVisits] = useState(false);
  const [loadingFocusedTab, setLoadingFocusedTab] = useState(false);
  const [loadingMoreExaminations, setLoadingMoreExaminations] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusRawat, setStatusRawat] = useState<string>('Ralan');
  const [editingExamination, setEditingExamination] = useState<any>(null);
  const [aiScribeModal, setAiScribeModal] = useState(false);
  const [aiScribeData, setAiScribeData] = useState<any>(null);
  const [aiScribeLoading, setAiScribeLoading] = useState(false);
  const [aiScribeResult, setAiScribeResult] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const allVisits = useMemo(
    () => [
      ...(medicalData?.outpatient_visits || []),
      ...(medicalData?.inpatient_visits || [])
    ],
    [medicalData?.inpatient_visits, medicalData?.outpatient_visits]
  );
  const focusedVisit = useMemo(
    () => (
      formattedNoRawat
        ? allVisits.find((visit: any) => visit.no_rawat === formattedNoRawat) || null
        : null
    ),
    [allVisits, formattedNoRawat]
  );
  const activeIgdTriageNoRawat = String(formattedNoRawat || '').trim();

  const defaultExaminationStatusRawat = useMemo(() => {
    return mapStatusLanjutToStatusRawat(
      focusedVisit?.status_lanjut || medicalData?.patient?.status_lanjut
    );
  }, [
    focusedVisit?.status_lanjut,
    medicalData?.patient?.status_lanjut
  ]);
  const preferredCareSectionTab = useMemo<CareSectionTabValue>(
    () => (defaultExaminationStatusRawat === 'Ranap' ? 'inpatient' : 'outpatient'),
    [defaultExaminationStatusRawat]
  );

  // Form states
  const [medications, setMedications] = useState<Medication[]>(() => getDefaultMedicationForm('Ralan'));
  const [medicineOptions, setMedicineOptions] = useState<Record<string, MedicineOption[]>>({});
  const [medicineSearchOpen, setMedicineSearchOpen] = useState<Record<string, boolean>>({});
  const [medicineSearchQuery, setMedicineSearchQuery] = useState<Record<string, string>>({});
  const [medicineSearchLoading, setMedicineSearchLoading] = useState<Record<string, boolean>>({});

  const [compoundPrescriptions, setCompoundPrescriptions] = useState<CompoundPrescription[]>([createDefaultCompoundPrescription()]);
  const [compoundMethods, setCompoundMethods] = useState<CompoundMethodOption[]>([]);
  const [compoundMedicineOptions, setCompoundMedicineOptions] = useState<Record<string, MedicineOption[]>>({});
  const [compoundMedicineSearchOpen, setCompoundMedicineSearchOpen] = useState<Record<string, boolean>>({});
  const [compoundMedicineSearchQuery, setCompoundMedicineSearchQuery] = useState<Record<string, string>>({});
  const [compoundMedicineSearchLoading, setCompoundMedicineSearchLoading] = useState<Record<string, boolean>>({});

  const [packageSearchOpen, setPackageSearchOpen] = useState(false);
  const [packageSearchQuery, setPackageSearchQuery] = useState('');
  const [packageSearchLoading, setPackageSearchLoading] = useState(false);
  const [packageOptions, setPackageOptions] = useState<Array<{ id: string; kd_paket: string; nama_paket: string; text: string }>>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [selectedPackageText, setSelectedPackageText] = useState<string>('');
  const [packageItemsLoading, setPackageItemsLoading] = useState(false);
  const [packageItems, setPackageItems] = useState<Array<{ kode_brng: string; nama_brng: string; satuan: string; jumlah: any; aturan_pakai: string; stok: number }>>([]);
  const [packageIsIbs, setPackageIsIbs] = useState(false);
  const [isAllergyModalOpen, setIsAllergyModalOpen] = useState(false);
  const [allergyCategory, setAllergyCategory] = useState<AllergyCategory | ''>('');
  const [allergySearchOpen, setAllergySearchOpen] = useState(false);
  const [allergySearchQuery, setAllergySearchQuery] = useState('');
  const [allergySearchLoading, setAllergySearchLoading] = useState(false);
  const [allergyOptions, setAllergyOptions] = useState<AllergyOption[]>([]);
  const [selectedAllergyOption, setSelectedAllergyOption] = useState<AllergyOption | null>(null);
  const [manualFoodAllergy, setManualFoodAllergy] = useState('');
  const [manualEnvironmentAllergy, setManualEnvironmentAllergy] = useState('');
  const [allergyHistory, setAllergyHistory] = useState<AllergyHistoryItem[]>([]);
  const [allergyHistoryLoading, setAllergyHistoryLoading] = useState(false);
  const [savingAllergy, setSavingAllergy] = useState(false);
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [sendingWhatsappMessage, setSendingWhatsappMessage] = useState(false);
  const [outpatientExaminationSectionTab, setOutpatientExaminationSectionTab] = useState<OutpatientExaminationSectionTabValue>('examinations');
  const [inpatientExaminationSectionTab, setInpatientExaminationSectionTab] = useState<InpatientExaminationSectionTabValue>('examinations');
  const [examinationRoleFilter, setExaminationRoleFilter] = useState<ExaminationRoleFilterValue>('all');
  const [rehabMedikAccess, setRehabMedikAccess] = useState(false);
  const [rehabMedikAccessLoading, setRehabMedikAccessLoading] = useState(false);
  const [rehabMedikCurrentEntries, setRehabMedikCurrentEntries] = useState<RehabMedikAssessment[]>([]);
  const [rehabMedikHistoryEntries, setRehabMedikHistoryEntries] = useState<RehabMedikAssessment[]>([]);
  const [rehabMedikLoading, setRehabMedikLoading] = useState(false);
  const [savingRehabMedik, setSavingRehabMedik] = useState(false);
  const [deletingRehabMedik, setDeletingRehabMedik] = useState(false);
  const [rehabMedikForm, setRehabMedikForm] = useState(getDefaultRehabMedikForm);
  const [balanceCairanEntries, setBalanceCairanEntries] = useState<BalanceCairanEntry[]>([]);
  const [balanceCairanLoading, setBalanceCairanLoading] = useState(false);
  const [selectedBalanceCairanId, setSelectedBalanceCairanId] = useState<number | null>(null);
  const [balanceCairanForm, setBalanceCairanForm] = useState({
    muntah: '',
    urine: '',
    bab: ''
  });
  const [savingBalanceCairan, setSavingBalanceCairan] = useState(false);
  const [ekstrapiramidalForm, setEkstrapiramidalForm] = useState(getDefaultEkstrapiramidalForm);
  const [savingEkstrapiramidal, setSavingEkstrapiramidal] = useState(false);

  const [labTests, setLabTests] = useState<LabTest[]>(getDefaultLabRequestForm);
  const [labServiceOptions, setLabServiceOptions] = useState<LabServiceOption[]>([]);
  const [labServiceSearchOpen, setLabServiceSearchOpen] = useState<Record<number, boolean>>({});
  const [labServiceSearchQuery, setLabServiceSearchQuery] = useState<Record<number, string>>({});
  const [labServiceSearchLoading, setLabServiceSearchLoading] = useState(false);
  const [labTemplatesByIndex, setLabTemplatesByIndex] = useState<Record<number, LabTemplateOption[]>>({});
  const [labTemplateLoadingByIndex, setLabTemplateLoadingByIndex] = useState<Record<number, boolean>>({});
  const [labStatusRawat, setLabStatusRawat] = useState<LabStatusRawat>('Ralan');
  const [labKlinis, setLabKlinis] = useState('');

  const [procedures, setProcedures] = useState<ProcedureFormItem[]>(getDefaultProcedureForm);
  const [procedureOptions, setProcedureOptions] = useState<Record<number, ProcedureOption[]>>({});
  const [procedureSearchOpen, setProcedureSearchOpen] = useState<Record<number, boolean>>({});
  const [procedureSearchQuery, setProcedureSearchQuery] = useState<Record<number, string>>({});
  const [procedureSearchLoading, setProcedureSearchLoading] = useState<Record<number, boolean>>({});
  const [deletingProcedureKey, setDeletingProcedureKey] = useState<string | null>(null);
  const [procedureStatusRawat, setProcedureStatusRawat] = useState<ProcedureStatusRawat>('Ralan');
  const [editingPrescriptionNo, setEditingPrescriptionNo] = useState<string | null>(null);
  const [deletingPrescriptionNo, setDeletingPrescriptionNo] = useState<string | null>(null);
  const [medicationRequestFilter, setMedicationRequestFilter] = useState<MedicationRequestFilterValue>('umum');
  const [medicationCurrentCareTab, setMedicationCurrentCareTab] = useState<CareSectionTabValue>(preferredCareSectionTab);
  const [showAllOutpatientMedicationRequests, setShowAllOutpatientMedicationRequests] = useState(false);
  const [loadingAllOutpatientMedicationRequests, setLoadingAllOutpatientMedicationRequests] = useState(false);
  const [showAllInpatientMedicationRequests, setShowAllInpatientMedicationRequests] = useState(false);
  const [loadingAllInpatientMedicationRequests, setLoadingAllInpatientMedicationRequests] = useState(false);
  const [editingLabRequestNo, setEditingLabRequestNo] = useState<string | null>(null);
  const [labFormNoRawat, setLabFormNoRawat] = useState<string>('');
  const [deletingLabRequestNo, setDeletingLabRequestNo] = useState<string | null>(null);
  const [editingRadiologyRequestNo, setEditingRadiologyRequestNo] = useState<string | null>(null);
  const [radiologyFormNoRawat, setRadiologyFormNoRawat] = useState<string>('');
  const [deletingRadiologyRequestNo, setDeletingRadiologyRequestNo] = useState<string | null>(null);

  const [radTests, setRadTests] = useState([{
    pemeriksaan: '',
    hasil: '',
    kesan: ''
  }]);

  // Examination form states
  const [examinationForm, setExaminationForm] = useState(getDefaultExaminationForm);
  const [igdTriageForm, setIgdTriageForm] = useState<IgdTriageForm>(getDefaultIgdTriageForm);
  const [igdTriageMasterOptions, setIgdTriageMasterOptions] = useState<IgdTriageMasterOption[]>([]);
  const [loadingIgdTriage, setLoadingIgdTriage] = useState(false);
  const [savingIgdTriage, setSavingIgdTriage] = useState(false);

  const [fullscreenLabHistory, setFullscreenLabHistory] = useState<any | null>(null);
  const [draggingLab, setDraggingLab] = useState<LabData | null>(null);
  const [canvasItems, setCanvasItems] = useState<Array<{ type: string; content: any; position: { x: number; y: number } }>>([]);
  const [draggingRad, setDraggingRad] = useState<any | null>(null);
  const [radiologies, setRadiologies] = useState<RadiologyFormItem[]>(getDefaultRadiologyRequestForm);
  const [radiologyServiceOptions, setRadiologyServiceOptions] = useState<RadiologyServiceOption[]>([]);
  const [radiologySearchOpen, setRadiologySearchOpen] = useState<Record<number, boolean>>({});
  const [radiologySearchQuery, setRadiologySearchQuery] = useState<Record<number, string>>({});
  const [radiologySearchLoading, setRadiologySearchLoading] = useState(false);
  const [radiologyStatusRawat, setRadiologyStatusRawat] = useState<RadiologyStatusRawat>('Ralan');
  const [radiologyKlinis, setRadiologyKlinis] = useState('');
  const [isExaminationFormOpen, setIsExaminationFormOpen] = useState(false);
  const [isProcedureFormOpen, setIsProcedureFormOpen] = useState(false);
  const [isMedicationFormOpen, setIsMedicationFormOpen] = useState(false);
  const [isCompoundFormOpen, setIsCompoundFormOpen] = useState(false);
  const [isPackageFormOpen, setIsPackageFormOpen] = useState(false);
  const [isLabFormOpen, setIsLabFormOpen] = useState(false);
  const [isRadiologyFormOpen, setIsRadiologyFormOpen] = useState(false);
  const [isIgdTriageFormOpen, setIsIgdTriageFormOpen] = useState(false);
  const [pacsPreviewModal, setPacsPreviewModal] = useState<{
    open: boolean;
    title: string;
    images: any[];
    currentIndex: number;
    modality: string;
    loading: boolean;
  }>({
    open: false,
    title: '',
    images: [],
    currentIndex: 0,
    modality: '',
    loading: false
  });
  const [isPacsPlaying, setIsPacsPlaying] = useState(false);
  const [pacsPlaybackSpeed, setPacsPlaybackSpeed] = useState(180);
  const [pacsZoomLevel, setPacsZoomLevel] = useState(1);
  const [radiologyPacsByKey, setRadiologyPacsByKey] = useState<Record<string, any>>({});
  const [loadingRadiologyPacsKeys, setLoadingRadiologyPacsKeys] = useState<Record<string, boolean>>({});
  const [radiologyPacsErrorKeys, setRadiologyPacsErrorKeys] = useState<Record<string, string>>({});
  const activePacsImage = pacsPreviewModal.images[pacsPreviewModal.currentIndex] || null;
  const isCtPacsPreview = String(pacsPreviewModal.modality || '').toUpperCase() === 'CT';
  const [visibleVitalSeries, setVisibleVitalSeries] = useState<Record<VitalChartSeriesKey, boolean>>(() => ({
    systolic: true,
    diastolic: true,
    nadi: true,
    respirasi: true,
    suhu: true,
    gcs: true,
    spo2: true,
  }));
  const [activeTab, setActiveTab] = useState('visits');
  const [visitHistoryTab, setVisitHistoryTab] = useState<VisitHistoryTabValue>('outpatient');
  const [examinationHistoryTab, setExaminationHistoryTab] = useState<ExaminationHistoryTabValue>('outpatient');
  const [pagination, setPagination] = useState<MedicalRecordPagination>({
    outpatient: DEFAULT_PAGINATION_META,
    inpatient: DEFAULT_PAGINATION_META
  });
  const [examinationPagination, setExaminationPagination] = useState<MedicalRecordPagination>({
    outpatient: DEFAULT_PAGINATION_META,
    inpatient: DEFAULT_PAGINATION_META
  });
  const [examinationHistoryData, setExaminationHistoryData] = useState<{
    outpatient: ExaminationHistoryItem[];
    inpatient: ExaminationHistoryItem[];
  }>({
    outpatient: [],
    inpatient: []
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreExaminationRef = useRef<HTMLDivElement | null>(null);
  const pacsPreviewRequestRef = useRef(0);
  const prefetchedPacsPreviewUrlsRef = useRef<Set<string>>(new Set());
  const medicalRecordRequestRef = useRef<{ visits: number; focused: number }>({
    visits: 0,
    focused: 0
  });
  const examinationHistoryRequestRef = useRef(0);
  const dataContextVersionRef = useRef(0);
  const [expandedVisitKeys, setExpandedVisitKeys] = useState<Record<string, boolean>>({});
  const [loadingVisitDetailsKeys, setLoadingVisitDetailsKeys] = useState<Record<string, boolean>>({});

  const addLaboratoryResultToCanvas = useCallback((labGroup: any) => {
    setCanvasItems((previous) => [
      ...previous,
      {
        type: 'laboratory',
        content: labGroup,
        position: { x: 0, y: 0 }
      }
    ]);
    setDraggingLab(null);
    toast({
      title: "Lab Result Added",
      description: "Hasil laboratorium berhasil ditambahkan ke canvas",
    });
  }, [toast]);

  const addRadiologyResultToCanvas = useCallback((radiologyItem: any) => {
    setCanvasItems((previous) => [
      ...previous,
      {
        type: 'radiology',
        content: radiologyItem,
        position: { x: 0, y: 0 }
      }
    ]);
    setDraggingRad(null);
    toast({
      title: "Radiology Result Added",
      description: "Hasil radiologi berhasil ditambahkan ke canvas",
    });
  }, [toast]);
  const hasMoreCurrentVisitTab = visitHistoryTab === 'outpatient'
    ? pagination.outpatient.hasMore
    : pagination.inpatient.hasMore;
  const hasMoreCurrentExaminationTab = examinationHistoryTab === 'outpatient'
    ? examinationPagination.outpatient.hasMore
    : examinationPagination.inpatient.hasMore;
  const allOutpatientVisits = medicalData?.outpatient_visits || [];
  const allInpatientVisits = medicalData?.inpatient_visits || [];
  const sortedOutpatientVisits = React.useMemo(
    () => [...allOutpatientVisits].sort((a, b) => getVisitSortTimestamp(b, 'outpatient') - getVisitSortTimestamp(a, 'outpatient')),
    [allOutpatientVisits]
  );
  const sortedInpatientVisits = React.useMemo(
    () => [...allInpatientVisits].sort((a, b) => getVisitSortTimestamp(b, 'inpatient') - getVisitSortTimestamp(a, 'inpatient')),
    [allInpatientVisits]
  );
  const scopedOutpatientVisits = formattedNoRawat
    ? sortedOutpatientVisits.filter((visit) => visit.no_rawat === formattedNoRawat)
    : sortedOutpatientVisits;
  const scopedInpatientVisits = formattedNoRawat
    ? sortedInpatientVisits.filter((visit) => visit.no_rawat === formattedNoRawat)
    : sortedInpatientVisits;
  const currentVisitCount = visitHistoryTab === 'outpatient'
    ? sortedOutpatientVisits.length
    : sortedInpatientVisits.length;
  const currentVisitTotal = visitHistoryTab === 'outpatient'
    ? pagination.outpatient.total
    : pagination.inpatient.total;
  const vitalChartData = React.useMemo(() => {
    if (formattedNoRawat) {
      const focusedExamHistory = [
        ...(medicalData?.focused_examinations?.ralan || []).map((exam: any, examIndex: number) => ({
          key: `focused-chart-ralan-${formattedNoRawat}-${examIndex}`,
          visit: { no_rawat: formattedNoRawat, status_lanjut: 'Ralan' },
          exam,
          rawatType: 'Ralan' as const
        })),
        ...(medicalData?.focused_examinations?.ranap || []).map((exam: any, examIndex: number) => ({
          key: `focused-chart-ranap-${formattedNoRawat}-${examIndex}`,
          visit: { no_rawat: formattedNoRawat, status_lanjut: 'Ranap' },
          exam,
          rawatType: 'Ranap' as const
        }))
      ];

      if (focusedExamHistory.length > 0) {
        return buildVitalChartFromExamHistory(focusedExamHistory);
      }
    }

    if (!formattedNoRawat && (examinationHistoryData.outpatient.length || examinationHistoryData.inpatient.length)) {
      return buildVitalChartFromExamHistory([
        ...examinationHistoryData.outpatient,
        ...examinationHistoryData.inpatient
      ]);
    }

    return [...scopedOutpatientVisits, ...scopedInpatientVisits]
      .flatMap((visit) => (visit.examinations || []).map((exam: any) => {
        const bloodPressure = parseBloodPressure(exam.tekanan_darah || exam.tensi);
        const examDate = exam.tgl_perawatan || exam.tanggal || '';
        const examTime = exam.jam_rawat || '00:00';
        const examDateTime = examDate
          ? new Date(`${examDate}T${examTime.length === 5 ? `${examTime}:00` : examTime}`).getTime()
          : 0;

        return {
          id: `${visit.no_rawat}-${examDate}-${examTime}`,
          label: examDate
            ? `${examDate.slice(8, 10)}/${examDate.slice(5, 7)} ${examTime.slice(0, 5)}`
            : '-',
          fullDate: examDate,
          fullTime: examTime,
          systolic: bloodPressure.systolic,
          diastolic: bloodPressure.diastolic,
          nadi: parseVitalNumber(exam.nadi),
          respirasi: parseVitalNumber(exam.respirasi),
          suhu: parseVitalNumber(exam.suhu_tubuh || exam.suhu),
          gcs: parseGcsValue(exam.gcs),
          spo2: parseVitalNumber(exam.spo2),
          timestamp: Number.isNaN(examDateTime) ? 0 : examDateTime,
        };
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [
    examinationHistoryData.inpatient,
    examinationHistoryData.outpatient,
    formattedNoRawat,
    medicalData?.focused_examinations?.ralan,
    medicalData?.focused_examinations?.ranap,
    scopedInpatientVisits,
    scopedOutpatientVisits
  ]);
  const outpatientExaminationHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      const focusedExaminations = medicalData?.focused_examinations?.ralan || [];
      return focusedExaminations
        .map((exam: any, examIndex: number) => {
          const examDate = String(exam.tgl_perawatan || exam.tanggal || '').trim();
          const examTime = String(exam.jam_rawat || '00:00').trim() || '00:00';
          const parsedDate = examDate
            ? new Date(`${examDate}T${examTime.length === 5 ? `${examTime}:00` : examTime}`).getTime()
            : 0;

          return {
            key: `focused-ralan-${formattedNoRawat}-${examDate}-${examTime}-${examIndex}`,
            visit: { no_rawat: formattedNoRawat, status_lanjut: 'Ralan' },
            exam,
            rawatType: 'Ralan' as const,
            timestamp: Number.isNaN(parsedDate) ? 0 : parsedDate,
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    }

    return examinationHistoryData.outpatient;
  }, [examinationHistoryData.outpatient, formattedNoRawat, medicalData?.focused_examinations?.ralan]);
  const inpatientExaminationHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      const focusedExaminations = medicalData?.focused_examinations?.ranap || [];
      return focusedExaminations
        .map((exam: any, examIndex: number) => {
          const examDate = String(exam.tgl_perawatan || exam.tanggal || '').trim();
          const examTime = String(exam.jam_rawat || '00:00').trim() || '00:00';
          const parsedDate = examDate
            ? new Date(`${examDate}T${examTime.length === 5 ? `${examTime}:00` : examTime}`).getTime()
            : 0;

          return {
            key: `focused-ranap-${formattedNoRawat}-${examDate}-${examTime}-${examIndex}`,
            visit: { no_rawat: formattedNoRawat, status_lanjut: 'Ranap' },
            exam,
            rawatType: 'Ranap' as const,
            timestamp: Number.isNaN(parsedDate) ? 0 : parsedDate,
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    }

    return examinationHistoryData.inpatient;
  }, [examinationHistoryData.inpatient, formattedNoRawat, medicalData?.focused_examinations?.ranap]);
  const filteredOutpatientExaminationHistory = useMemo(() => {
    if (examinationRoleFilter === 'all') {
      return outpatientExaminationHistory;
    }

    return outpatientExaminationHistory.filter(
      (item) =>
        resolveExaminationRole(
          item?.exam?.role,
          item?.exam?.pegawai,
          item?.exam?.nama,
          item?.visit?.dokter,
          item?.visit?.nm_dokter
        ) === examinationRoleFilter
    );
  }, [examinationRoleFilter, outpatientExaminationHistory]);
  const filteredInpatientExaminationHistory = useMemo(() => {
    if (examinationRoleFilter === 'all') {
      return inpatientExaminationHistory;
    }

    return inpatientExaminationHistory.filter(
      (item) =>
        resolveExaminationRole(
          item?.exam?.role,
          item?.exam?.pegawai,
          item?.exam?.nama,
          item?.visit?.dokter,
          item?.visit?.nm_dokter
        ) === examinationRoleFilter
    );
  }, [examinationRoleFilter, inpatientExaminationHistory]);
  const outpatientProcedures = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(
        medicalData?.focused_procedures?.ralan || [],
        formattedNoRawat,
        'Rawat Jalan',
        { status_rawat: 'Ralan' },
        (record: any) => record?.tanggal
      );
    }

    return buildFocusedItems(
      scopedOutpatientVisits.flatMap((visit) => (visit.procedures || []).map((proc: any) => ({ ...proc, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Jalan',
      {},
      (record: any) => record?.tanggal
    );
  }, [formattedNoRawat, medicalData?.focused_procedures?.ralan, scopedOutpatientVisits]);
  const inpatientProcedures = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(
        medicalData?.focused_procedures?.ranap || [],
        formattedNoRawat,
        'Rawat Inap',
        { status_rawat: 'Ranap' },
        (record: any) => record?.tanggal
      );
    }

    return buildFocusedItems(
      scopedInpatientVisits.flatMap((visit) => (visit.procedures || []).map((proc: any) => ({ ...proc, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Inap',
      {},
      (record: any) => record?.tanggal
    );
  }, [formattedNoRawat, medicalData?.focused_procedures?.ranap, scopedInpatientVisits]);
  const outpatientMedicationRequests = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(
        medicalData?.focused_medications_request?.ralan || [],
        formattedNoRawat,
        'Rawat Jalan',
        { status: 'Ralan' },
        (record: any) => record?.tanggal
      );
    }

    return buildFocusedItems(
      scopedOutpatientVisits.flatMap((visit) =>
        (visit.medicationsRequest || []).map((med: any) => ({
          ...med,
          no_rawat: visit.no_rawat,
          status: 'Ralan'
        }))
      ),
      '',
      'Rawat Jalan',
      {},
      (record: any) => record?.tanggal
    );
  }, [formattedNoRawat, medicalData?.focused_medications_request?.ralan, scopedOutpatientVisits]);
  const normalizedOutpatientMedicationRequests = React.useMemo(
    () => splitMedicationRequestItems(outpatientMedicationRequests),
    [outpatientMedicationRequests]
  );
  const inpatientMedicationRequests = React.useMemo(() => {
    if (formattedNoRawat) {
      const ranap = buildFocusedItems(
        medicalData?.focused_medications_request?.ranap || [],
        formattedNoRawat,
        'Rawat Inap',
        { status: 'Ranap' },
        (record: any) => record?.tanggal
      );
      const pulang = buildFocusedItems(
        medicalData?.focused_medications_request?.pulang || [],
        formattedNoRawat,
        'Obat Pulang',
        { status: 'Pulang' },
        (record: any) => record?.tanggal
      );
      const ibs = buildFocusedItems(
        medicalData?.focused_medications_request?.ibs || [],
        formattedNoRawat,
        'IBS',
        { status: 'IBS' },
        (record: any) => record?.tanggal
      );

      return [...ranap, ...pulang, ...ibs].sort((a, b) => b.__timestamp - a.__timestamp);
    }

    return buildFocusedItems(
      scopedInpatientVisits.flatMap((visit) => {
        const ranap = (visit.medicationsRequest || []).map((med: any) => ({
          ...med,
          no_rawat: visit.no_rawat,
          source: 'Rawat Inap',
          status: 'Ranap',
        }));
        const pulang = (visit.medicationsRequestPulang || []).map((med: any) => ({
          ...med,
          no_rawat: visit.no_rawat,
          source: 'Obat Pulang',
          status: 'Pulang',
        }));
        const ibs = (visit.medicationsRequestIbs || []).map((med: any) => ({
          ...med,
          no_rawat: visit.no_rawat,
          source: 'IBS',
          status: 'IBS',
        }));
        return [...ranap, ...pulang, ...ibs];
      }),
      '',
      'Rawat Inap',
      {},
      (record: any) => record?.tanggal
    );
  }, [
    formattedNoRawat,
    medicalData?.focused_medications_request?.ibs,
    medicalData?.focused_medications_request?.pulang,
    medicalData?.focused_medications_request?.ralan,
    medicalData?.focused_medications_request?.ranap,
    scopedInpatientVisits
  ]);
  const normalizedInpatientMedicationRequests = React.useMemo(
    () => splitMedicationRequestItems(inpatientMedicationRequests),
    [inpatientMedicationRequests]
  );
  const filteredOutpatientMedicationRequests = React.useMemo(
    () => normalizedOutpatientMedicationRequests.filter((item) => matchesMedicationRequestFilter(item, medicationRequestFilter)),
    [medicationRequestFilter, normalizedOutpatientMedicationRequests]
  );
  const displayedOutpatientMedicationRequests = React.useMemo(
    () => (showAllOutpatientMedicationRequests ? filteredOutpatientMedicationRequests : filteredOutpatientMedicationRequests.slice(0, 1)),
    [filteredOutpatientMedicationRequests, showAllOutpatientMedicationRequests]
  );
  const hasMoreOutpatientMedicationRequests = React.useMemo(
    () => {
      const meta = medicalData?.focused_medications_request_meta;
      const hasHiddenLoadedItems = filteredOutpatientMedicationRequests.length > 1;
      const displayedCount = showAllOutpatientMedicationRequests
        ? filteredOutpatientMedicationRequests.length
        : displayedOutpatientMedicationRequests.length;

      if (medicationRequestFilter === 'racikan') {
        return Number(meta?.ralan_racikan_total || 0) > displayedCount || hasHiddenLoadedItems;
      }

      if (medicationRequestFilter === 'umum') {
        return Number(meta?.ralan_umum_total || 0) > displayedCount || hasHiddenLoadedItems;
      }

      return Boolean(meta?.ralan_has_more) || hasHiddenLoadedItems;
    },
    [
      displayedOutpatientMedicationRequests.length,
      filteredOutpatientMedicationRequests.length,
      medicalData?.focused_medications_request_meta,
      medicationRequestFilter,
      showAllOutpatientMedicationRequests
    ]
  );
  const filteredInpatientMedicationRequests = React.useMemo(
    () => normalizedInpatientMedicationRequests.filter((item) => matchesMedicationRequestFilter(item, medicationRequestFilter)),
    [medicationRequestFilter, normalizedInpatientMedicationRequests]
  );
  const displayedInpatientMedicationRequests = React.useMemo(
    () => (showAllInpatientMedicationRequests ? filteredInpatientMedicationRequests : filteredInpatientMedicationRequests.slice(0, 1)),
    [filteredInpatientMedicationRequests, showAllInpatientMedicationRequests]
  );
  const hasMoreInpatientMedicationRequests = React.useMemo(() => {
    const meta = medicalData?.focused_medications_request_meta;
    const hasHiddenLoadedItems = filteredInpatientMedicationRequests.length > 1;
    const displayedCount = showAllInpatientMedicationRequests
      ? filteredInpatientMedicationRequests.length
      : displayedInpatientMedicationRequests.length;

    if (medicationRequestFilter === 'pulang') {
      return Boolean(meta?.pulang_has_more) || hasHiddenLoadedItems;
    }

    if (medicationRequestFilter === 'ibs') {
      return Boolean(meta?.ibs_has_more) || hasHiddenLoadedItems;
    }

    if (medicationRequestFilter === 'racikan') {
      return Number(meta?.ranap_racikan_total || 0) > displayedCount || hasHiddenLoadedItems;
    }

    if (medicationRequestFilter === 'umum') {
      return Number(meta?.ranap_umum_total || 0) > displayedCount || hasHiddenLoadedItems;
    }

    return Boolean(meta?.ranap_has_more || meta?.pulang_has_more || meta?.ibs_has_more) || hasHiddenLoadedItems;
  }, [
    displayedInpatientMedicationRequests.length,
    filteredInpatientMedicationRequests.length,
    medicalData?.focused_medications_request_meta,
    medicationRequestFilter,
    showAllInpatientMedicationRequests
  ]);
  const outpatientMedicationHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(
        medicalData?.focused_medications?.ralan || [],
        formattedNoRawat,
        'Rawat Jalan',
        {},
        (record: any) => record?.tanggal
      );
    }

    return buildFocusedItems(
      scopedOutpatientVisits.flatMap((visit) => (visit.medications || []).map((med: any) => ({ ...med, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Jalan',
      {},
      (record: any) => record?.tanggal
    );
  }, [formattedNoRawat, medicalData?.focused_medications?.ralan, scopedOutpatientVisits]);
  const inpatientMedicationHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(
        medicalData?.focused_medications?.ranap || [],
        formattedNoRawat,
        'Rawat Inap',
        {},
        (record: any) => record?.tanggal
      );
    }

    return buildFocusedItems(
      scopedInpatientVisits.flatMap((visit) => (visit.medications || []).map((med: any) => ({ ...med, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Inap',
      {},
      (record: any) => record?.tanggal
    );
  }, [formattedNoRawat, medicalData?.focused_medications?.ranap, scopedInpatientVisits]);

  useEffect(() => {
    setShowAllOutpatientMedicationRequests(false);
  }, [formattedNoRawat, medicationRequestFilter, no_rkm_medis]);

  useEffect(() => {
    setShowAllInpatientMedicationRequests(false);
  }, [formattedNoRawat, medicationRequestFilter, no_rkm_medis]);

  useEffect(() => {
    setMedicationCurrentCareTab(preferredCareSectionTab);
  }, [preferredCareSectionTab]);

  useEffect(() => {
    if (medicationCurrentCareTab === 'outpatient' && (medicationRequestFilter === 'pulang' || medicationRequestFilter === 'ibs')) {
      setMedicationRequestFilter('umum');
    }
  }, [medicationCurrentCareTab, medicationRequestFilter]);

  const outpatientLaboratoryRequests = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(medicalData?.focused_laboratory_request?.ralan || [], formattedNoRawat, 'Rawat Jalan');
    }

    return buildFocusedItems(
      scopedOutpatientVisits.flatMap((visit) => (visit.laboratoryRequest || []).map((lab: any) => ({ ...lab, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Jalan'
    );
  }, [formattedNoRawat, medicalData?.focused_laboratory_request?.ralan, scopedOutpatientVisits]);
  const inpatientLaboratoryRequests = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(medicalData?.focused_laboratory_request?.ranap || [], formattedNoRawat, 'Rawat Inap');
    }

    return buildFocusedItems(
      scopedInpatientVisits.flatMap((visit) => (visit.laboratoryRequest || []).map((lab: any) => ({ ...lab, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Inap'
    );
  }, [formattedNoRawat, medicalData?.focused_laboratory_request?.ranap, scopedInpatientVisits]);
  const outpatientLaboratoryHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedLabItems(
        (medicalData?.focused_laboratory?.ralan || []) as LabData[],
        formattedNoRawat,
        'Rawat Jalan'
      );
    }

    return buildFocusedLabItems(
      scopedOutpatientVisits.flatMap((visit) => ((visit.laboratory || []) as LabData[]).map((lab) => ({ ...lab, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Jalan'
    );
  }, [formattedNoRawat, medicalData?.focused_laboratory?.ralan, scopedOutpatientVisits]);
  const inpatientLaboratoryHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedLabItems(
        (medicalData?.focused_laboratory?.ranap || []) as LabData[],
        formattedNoRawat,
        'Rawat Inap'
      );
    }

    return buildFocusedLabItems(
      scopedInpatientVisits.flatMap((visit) => ((visit.laboratory || []) as LabData[]).map((lab) => ({ ...lab, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Inap'
    );
  }, [formattedNoRawat, medicalData?.focused_laboratory?.ranap, scopedInpatientVisits]);
  const inpatientLaboratoryHistoryAll = useMemo(() => {
    const combined = [...outpatientLaboratoryHistory, ...inpatientLaboratoryHistory];

    return combined.sort((a, b) => {
      const leftTimestamp = Number((a as any)?.__timestamp || 0);
      const rightTimestamp = Number((b as any)?.__timestamp || 0);

      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }

      const leftIndex = Number((a as any)?.__index || 0);
      const rightIndex = Number((b as any)?.__index || 0);

      return leftIndex - rightIndex;
    });
  }, [inpatientLaboratoryHistory, outpatientLaboratoryHistory]);
  const laboratoryHistoryInpatientView =
    defaultExaminationStatusRawat === 'Ranap' ? inpatientLaboratoryHistoryAll : inpatientLaboratoryHistory;
  const outpatientRadiologyRequests = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(medicalData?.focused_radiology_request?.ralan || [], formattedNoRawat, 'Rawat Jalan');
    }

    return buildFocusedItems(
      scopedOutpatientVisits.flatMap((visit) => ((visit.radiologyRequest || []) as any[]).map((rad) => ({ ...rad, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Jalan'
    );
  }, [formattedNoRawat, medicalData?.focused_radiology_request?.ralan, scopedOutpatientVisits]);
  const inpatientRadiologyRequests = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(medicalData?.focused_radiology_request?.ranap || [], formattedNoRawat, 'Rawat Inap');
    }

    return buildFocusedItems(
      scopedInpatientVisits.flatMap((visit) => ((visit.radiologyRequest || []) as any[]).map((rad) => ({ ...rad, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Inap'
    );
  }, [formattedNoRawat, medicalData?.focused_radiology_request?.ranap, scopedInpatientVisits]);
  const outpatientRadiologyHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(medicalData?.focused_radiology?.ralan || [], formattedNoRawat, 'Rawat Jalan');
    }

    return buildFocusedItems(
      scopedOutpatientVisits.flatMap((visit) => ((visit.radiology || []) as any[]).map((rad) => ({ ...rad, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Jalan'
    );
  }, [formattedNoRawat, medicalData?.focused_radiology?.ralan, scopedOutpatientVisits]);
  const inpatientRadiologyHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(medicalData?.focused_radiology?.ranap || [], formattedNoRawat, 'Rawat Inap');
    }

    return buildFocusedItems(
      scopedInpatientVisits.flatMap((visit) => ((visit.radiology || []) as any[]).map((rad) => ({ ...rad, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Inap'
    );
  }, [formattedNoRawat, medicalData?.focused_radiology?.ranap, scopedInpatientVisits]);
  const inpatientRadiologyHistoryAll = useMemo(() => {
    const combined = [...outpatientRadiologyHistory, ...inpatientRadiologyHistory];

    return combined.sort((a, b) => {
      const leftTimestamp = Number((a as any)?.__timestamp || 0);
      const rightTimestamp = Number((b as any)?.__timestamp || 0);

      if (rightTimestamp !== leftTimestamp) {
        return rightTimestamp - leftTimestamp;
      }

      const leftIndex = Number((a as any)?.__index || 0);
      const rightIndex = Number((b as any)?.__index || 0);

      return leftIndex - rightIndex;
    });
  }, [inpatientRadiologyHistory, outpatientRadiologyHistory]);
  const radiologyHistoryInpatientView =
    defaultExaminationStatusRawat === 'Ranap' ? inpatientRadiologyHistoryAll : inpatientRadiologyHistory;
  const selectedBalanceCairanEntry = useMemo(
    () => balanceCairanEntries.find((entry) => Number(entry.id) === Number(selectedBalanceCairanId)) || null,
    [balanceCairanEntries, selectedBalanceCairanId]
  );
  const activeVitalSeries = vitalChartSeries.filter((series) => visibleVitalSeries[series.key]);
  const isFocusedExaminationsLoaded =
    !formattedNoRawat ||
    (medicalData?.focused_examinations !== undefined && medicalData?.focused_ekstrapiramidal !== undefined);
  const isFocusedProceduresLoaded = !formattedNoRawat || medicalData?.focused_procedures !== undefined;
  const isFocusedMedicationsLoaded = !formattedNoRawat || (
    medicalData?.focused_medications_request !== undefined && medicalData?.focused_medications !== undefined
  );
  const isFocusedLaboratoryLoaded = !formattedNoRawat || (
    medicalData?.focused_laboratory_request !== undefined && medicalData?.focused_laboratory !== undefined
  );
  const isFocusedRadiologyLoaded = !formattedNoRawat || (
    medicalData?.focused_radiology_request !== undefined && medicalData?.focused_radiology !== undefined
  );
  const currentUsername = String(user?.username || '').trim();
  const shouldShowIgdTriageSection = Boolean(activeIgdTriageNoRawat && focusedVisit?.is_igd_visit);
  const selectedIgdTriageOptions = useMemo(
    () => igdTriageMasterOptions.filter((item) => item.kd_level === igdTriageForm.kd_level),
    [igdTriageForm.kd_level, igdTriageMasterOptions]
  );
  const activeIgdTriageSectionTone = getIgdTriaseSectionToneByLevel(igdTriageForm.kd_level);
  const activeIgdTriageSectionClasses = igdTriaseSectionToneClasses[activeIgdTriageSectionTone];
  const applyIgdTriageForm = useCallback((triageData: any | null) => {
    if (!triageData) {
      setIgdTriageForm(getDefaultIgdTriageForm());
      return;
    }

    setIgdTriageForm({
      tgl_perawatan: String(triageData.tanggal || '').trim() || format(new Date(), 'yyyy-MM-dd'),
      jam_rawat: String(triageData.jam || '').trim() || format(new Date(), 'HH:mm'),
      kd_level: String(triageData.kd_level || '').trim(),
      namakasus: String(triageData.namakasus || 'Non Trauma').trim() || 'Non Trauma',
      stts_diantar: String(triageData.stts_diantar || '').replace(/,\s*$/, '').trim(),
      transportasi: String(triageData.transportasi || '').replace(/,\s*$/, '').trim(),
      stts_fungsional: String(triageData.stts_fungsional || '').replace(/,\s*$/, '').trim(),
      psikologis: String(triageData.psikologis || 'Stabil').replace(/,\s*$/, '').trim() || 'Stabil',
      stts_tinggal: String(triageData.stts_tinggal || '').trim(),
      keluhan_utama: String(triageData.keluhan_utama || '').trim(),
      riwayat_penyakit: String(triageData.riwayat_penyakit || '').trim(),
      saturasi: String(triageData.saturasi || '').trim(),
      periksafisik: String(triageData.periksafisik || '').trim(),
      skala_nyeri: String(triageData.skala_nyeri || '').trim(),
      resiko_jatuh: String(triageData.resiko_jatuh || '').trim(),
      diagnosis: String(triageData.diagnosis || '').trim(),
      tindakan: String(triageData.tindakan || '').trim(),
      keterangan: String(triageData.keterangan || '').trim(),
      selected_tindakan: Array.isArray(triageData.selected_tindakan)
        ? triageData.selected_tindakan
            .map((item: string | IgdTriageSelectedAction) => (
              typeof item === 'string'
                ? item
                : String(item?.kd_tindakan || '').trim()
            ))
            .filter(Boolean)
        : []
    });
  }, []);
  const loadIgdTriageMaster = useCallback(async () => {
    if (igdTriageMasterOptions.length > 0) {
      return;
    }

    const response = await fetch(`${API_URLS.TRIAGE_IGD}/master`);
    const responseJson = await response.json().catch(() => null);

    if (!response.ok || !responseJson?.success) {
      throw new Error(responseJson?.error || 'Gagal memuat master triase IGD');
    }

    setIgdTriageMasterOptions(Array.isArray(responseJson.data) ? responseJson.data : []);
  }, [igdTriageMasterOptions.length]);
  const loadIgdTriageDetail = useCallback(async (targetNoRawat: string) => {
    const normalizedNoRawat = String(targetNoRawat || '').trim();
    if (!normalizedNoRawat) {
      setIgdTriageForm(getDefaultIgdTriageForm());
      return;
    }

    setLoadingIgdTriage(true);
    try {
      const response = await fetch(`${API_URLS.TRIAGE_IGD}/${encodeURIComponent(normalizedNoRawat)}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(responseJson?.error || 'Gagal memuat detail triase IGD');
      }

      applyIgdTriageForm(responseJson.data || null);
    } catch (error) {
      console.error('Error loading triase IGD:', error);
      applyIgdTriageForm(null);
    } finally {
      setLoadingIgdTriage(false);
    }
  }, [applyIgdTriageForm]);
  useEffect(() => {
    if (!editingExamination) {
      setStatusRawat(defaultExaminationStatusRawat);
    }
  }, [defaultExaminationStatusRawat, editingExamination]);

  useEffect(() => {
    setVisitHistoryTab(preferredCareSectionTab);
    setExaminationHistoryTab(preferredCareSectionTab);
  }, [preferredCareSectionTab]);

  useEffect(() => {
    setProcedureStatusRawat(defaultExaminationStatusRawat as ProcedureStatusRawat);

    if (!editingLabRequestNo) {
      setLabStatusRawat(defaultExaminationStatusRawat as LabStatusRawat);
    }

    if (!editingRadiologyRequestNo) {
      setRadiologyStatusRawat(defaultExaminationStatusRawat as RadiologyStatusRawat);
    }
  }, [
    defaultExaminationStatusRawat,
    editingLabRequestNo,
    editingRadiologyRequestNo
  ]);
  useEffect(() => {
    if (!rehabMedikAccess) {
      setOutpatientExaminationSectionTab('examinations');
      setInpatientExaminationSectionTab((previous) => (
        previous === 'rehab-medik' ? 'examinations' : previous
      ));
    }
  }, [rehabMedikAccess]);
  useEffect(() => {
    if (!shouldShowIgdTriageSection) {
      setIgdTriageForm(getDefaultIgdTriageForm());
      setIsIgdTriageFormOpen(false);
      return;
    }

    loadIgdTriageMaster().catch((error) => {
      console.error('Error loading triase IGD master:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat master triase IGD',
        variant: 'destructive'
      });
    });

    const targetNoRawat = activeIgdTriageNoRawat;
    if (!targetNoRawat) {
      setIgdTriageForm(getDefaultIgdTriageForm());
      return;
    }

    loadIgdTriageDetail(targetNoRawat);
  }, [
    activeIgdTriageNoRawat,
    loadIgdTriageDetail,
    loadIgdTriageMaster,
    shouldShowIgdTriageSection,
    toast
  ]);
  const matchesCurrentUser = (...values: Array<string | null | undefined>) =>
    Boolean(
      currentUsername &&
      values.some((value) => {
        const normalized = String(value || '').trim();
        return normalized && normalized === currentUsername;
      })
    );
  const canDeleteExamination = (exam: any) => matchesCurrentUser(exam?.nip, exam?.kd_dokter);
  const canDeleteProcedure = (procedure: any) => matchesCurrentUser(procedure?.kd_dokter, procedure?.nip);
  const canDeletePrescription = (med: any) => matchesCurrentUser(med?.kd_dokter);
  const canDeleteLabRequest = (lab: any) => matchesCurrentUser(lab?.dokter_perujuk);
  const canDeleteRadiologyRequest = (rad: any) => matchesCurrentUser(rad?.dokter_perujuk);
  const canEditExamination = canDeleteExamination;
  const canEditPrescription = canDeletePrescription;
  const canEditLabRequest = canDeleteLabRequest;
  const canEditRadiologyRequest = canDeleteRadiologyRequest;
  const renderExaminationRoleFilter = () => (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="mb-2">
        <p className="text-sm font-medium">Filter Role Pemeriksaan</p>
        <p className="text-xs text-muted-foreground">Default menampilkan semua role. Klik salah satu role untuk memfilter.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMINATION_ROLE_OPTIONS.map((option) => {
          const isActive = examinationRoleFilter === option.value;
          const roleStyles = getExaminationRoleStyles(option.value === 'all' ? '' : option.value);

          return (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={isActive ? 'default' : 'outline'}
              className={cn(
                'transition-colors',
                isActive && option.value !== 'all' && roleStyles.badge,
                isActive && option.value === 'all' && 'bg-primary text-primary-foreground'
              )}
              onClick={() => setExaminationRoleFilter(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
  const renderExaminationCards = (history: Array<{ key: string; visit: any; exam: any; rawatType: 'Ralan' | 'Ranap' }>) => {
    if (history.length === 0) {
      return (
        <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
          Belum ada data pemeriksaan pada kategori ini untuk nomor rawat tersebut.
        </div>
      );
    }

    return history.map(({ key, visit, exam, rawatType }) => {
      const allowedToDelete = canDeleteExamination(exam);
      const canEdit = canEditExamination(exam);
      const editLabel = canEdit ? 'Edit' : 'Bukan Data Anda';
      const deleteLabel = allowedToDelete ? 'Hapus' : 'Bukan Data Anda';
      const resolvedRole = resolveExaminationRole(exam?.role, exam?.pegawai, exam?.nama, visit?.dokter, visit?.nm_dokter);
      const roleStyles = getExaminationRoleStyles(resolvedRole);
      const roleLabel = getExaminationRoleLabel(resolvedRole);

      return (
      <div key={key} className="border rounded-lg p-4">
        <div className="mb-4 flex flex-col-reverse gap-3 md:flex-row md:items-start md:justify-between">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
            <div>
              <p className="text-sm text-muted-foreground">Tanggal & Jam</p>
              <p className="font-medium">{exam.tgl_perawatan} {exam.jam_rawat}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No. Rawat</p>
              <p className="font-medium">{visit.no_rawat}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Jenis Rawat</p>
              <p className="font-medium">{rawatType}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 md:justify-end">
            <Button
              size="sm"
              variant="secondary"
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              onClick={() => handleCopyExaminationAll(exam, rawatType)}
              aria-label="Copy All"
              title="Copy All"
            >
              <Copy className="h-4 w-4 sm:mr-1" />
              <span className="sr-only sm:not-sr-only">Copy All</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              onClick={() => handleCopyExaminationTTV(exam)}
              aria-label="Copy TTV"
              title="Copy TTV"
            >
              <Copy className="h-4 w-4 sm:mr-1" />
              <span className="sr-only sm:not-sr-only">Copy TTV</span>
            </Button>  
            <Button
              size="sm"
              variant="secondary"
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              onClick={() => handleCopyExaminationSOAPIE(exam, rawatType)}
              aria-label="Copy SOAPIE"
              title="Copy SOAPIE"
            >
              <Copy className="h-4 w-4 sm:mr-1" />
              <span className="sr-only sm:not-sr-only">Copy SOAPIE</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditExamination(exam, visit)}
              disabled={!canEdit}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label={editLabel}
              title={editLabel}
            >
              <Pencil className="h-4 w-4 sm:mr-1" />
              <span className="sr-only sm:not-sr-only">{editLabel}</span>
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDeleteExamination(exam, visit)}
              disabled={!allowedToDelete}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label={deleteLabel}
              title={deleteLabel}
            >
              <Trash2 className="h-4 w-4 sm:mr-1" />
              <span className="sr-only sm:not-sr-only">{deleteLabel}</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 rounded-lg border p-4">
            <h4 className="font-medium">Tanda Vital</h4>
            <p className="text-sm">Tekanan Darah: {exam.tekanan_darah || exam.tensi || '-'}</p>
            <p className="text-sm">Nadi: {exam.nadi || '-'}</p>
            <p className="text-sm">Respirasi: {exam.respirasi || '-'}</p>
            <p className="text-sm">Suhu: {exam.suhu_tubuh || exam.suhu || '-'}</p>
            <p className="text-sm">GCS: {exam.gcs || '-'}</p>
            <p className="text-sm">SpO2: {exam.spo2 || '-'}</p>
            <p className="text-sm">Tinggi: {exam.tinggi || '-'} cm</p>
            <p className="text-sm">Berat: {exam.berat || '-'} kg</p>
          </div>
          <div className={cn('space-y-2 rounded-lg border p-4', roleStyles.soap)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-medium">SOAPIE</h4>
              <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium', roleStyles.badge)}>
                {roleLabel}
              </span>
            </div>
            <div className="text-sm">
              <strong>S (Subjektif):</strong>
              <p className="whitespace-pre-line break-words">{formatMultilineText(exam.s || exam.keluhan || '-')}</p>
            </div>
            <div className="text-sm">
              <strong>O (Objektif):</strong>
              <p className="whitespace-pre-line break-words">{formatMultilineText(exam.o || exam.pemeriksaan || '-')}</p>
            </div>
            <div className="text-sm">
              <strong>A (Assessment):</strong>
              <p className="whitespace-pre-line break-words">{formatMultilineText(exam.a || exam.penilaian || '-')}</p>
            </div>
            <div className="text-sm">
              <strong>P (Planning):</strong>
              <p className="whitespace-pre-line break-words">{formatMultilineText(exam.p || exam.rtl || '-')}</p>
            </div>
            {rawatType === 'Ranap' && (
              <div className="text-sm">
                <strong>I (Implementation):</strong>
                <p className="whitespace-pre-line break-words">{formatMultilineText(exam.i || exam.instruksi || '-')}</p>
              </div>
            )}
            {rawatType === 'Ranap' && (
              <div className="text-sm">
                <strong>E (Evaluation):</strong>
                <p className="whitespace-pre-line break-words">{formatMultilineText(exam.e || exam.evaluasi || '-')}</p>
              </div>
            )}
            <p className="text-sm"><strong>Petugas:</strong> {exam.pegawai || exam.nip || '-'}</p>
          </div>
        </div>
      </div>
    )});
  };
  const renderRehabMedikSection = () => {
    if (!formattedNoRawat) {
      return (
        <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
          Pilih kunjungan terlebih dahulu untuk mengisi assesmen rehab medik.
        </div>
      );
    }

    if (rehabMedikAccessLoading) {
      return (
        <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
          Memeriksa akses assesmen rehab medik...
        </div>
      );
    }

    if (!rehabMedikAccess) {
      return (
        <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
          Anda tidak memiliki akses ke menu assesmen rehab medik.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="font-medium">Form Assesmen Rehab Medik</h4>
              <p className="text-sm text-muted-foreground">
                Data tersimpan untuk no. rawat aktif, dan riwayat di bawah bisa dicopy kembali ke form.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchRehabMedikData()}
              disabled={rehabMedikLoading}
            >
              {rehabMedikLoading ? 'Memuat...' : 'Refresh'}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="rehab-anamnesa">Anamnesa</Label>
              <Textarea
                id="rehab-anamnesa"
                value={rehabMedikForm.anamnesa}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, anamnesa: event.target.value }))}
                placeholder="Anamnesa pasien"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-fisik">Pemeriksaan Fisik dan Uji Fungsi</Label>
              <Textarea
                id="rehab-fisik"
                value={rehabMedikForm.pemeriksaan_fisik}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, pemeriksaan_fisik: event.target.value }))}
                placeholder="Pemeriksaan fisik dan uji fungsi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-diagnosa">Diagnosis Fungsi</Label>
              <Textarea
                id="rehab-diagnosa"
                value={rehabMedikForm.diagnosa_fungsi}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, diagnosa_fungsi: event.target.value }))}
                placeholder="Diagnosis fungsi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-anjuran">Anjuran</Label>
              <Textarea
                id="rehab-anjuran"
                value={rehabMedikForm.anjuran}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, anjuran: event.target.value }))}
                placeholder="Anjuran terapi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-evaluasi">Evaluasi</Label>
              <Textarea
                id="rehab-evaluasi"
                value={rehabMedikForm.evaluasi}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, evaluasi: event.target.value }))}
                placeholder="Evaluasi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-hasil">Hasil Yang Didapat</Label>
              <Textarea
                id="rehab-hasil"
                value={rehabMedikForm.hasil}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, hasil: event.target.value }))}
                placeholder="Hasil yang didapat"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-kesimpulan">Kesimpulan</Label>
              <Textarea
                id="rehab-kesimpulan"
                value={rehabMedikForm.kesimpulan}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, kesimpulan: event.target.value }))}
                placeholder="Kesimpulan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-rekomendasi">Rekomendasi</Label>
              <Textarea
                id="rehab-rekomendasi"
                value={rehabMedikForm.rekomendasi}
                onChange={(event) => setRehabMedikForm((prev) => ({ ...prev, rekomendasi: event.target.value }))}
                placeholder="Rekomendasi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rehab-suspek">Suspek Penyakit Akibat Kerja</Label>
              <Select
                value={rehabMedikForm.suspek_penyakit}
                onValueChange={(value) => setRehabMedikForm((prev) => ({ ...prev, suspek_penyakit: value }))}
              >
                <SelectTrigger id="rehab-suspek">
                  <SelectValue placeholder="Pilih status suspek" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ya">Ya</SelectItem>
                  <SelectItem value="Tidak">Tidak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRehabMedikForm(getDefaultRehabMedikForm())}
            >
              Reset
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveRehabMedik()}
              disabled={savingRehabMedik}
            >
              {savingRehabMedik ? 'Menyimpan...' : 'Simpan Assesmen Rehab Medik'}
            </Button>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-medium">Data Assesmen Rehab Medik Saat Ini</h4>
            {rehabMedikCurrentEntries.length > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => void handleDeleteRehabMedik()}
                disabled={deletingRehabMedik}
              >
                {deletingRehabMedik ? 'Menghapus...' : 'Hapus'}
              </Button>
            )}
          </div>

          {rehabMedikCurrentEntries.length === 0 ? (
            <div className="border border-dashed rounded-lg p-4 text-sm text-muted-foreground bg-muted/20">
              Belum ada assesmen rehab medik untuk no. rawat ini.
            </div>
          ) : (
            rehabMedikCurrentEntries.map((item, index) => (
              <div key={`rehab-current-${item.no_rawat}-${item.tanggal}-${item.time}-${index}`} className="rounded-lg border p-4 space-y-3 bg-background">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <p><strong>Tgl / Jam:</strong> {formatDateSafe(`${item.tanggal} ${item.time}`)}</p>
                    <p><strong>No. Rawat:</strong> {item.no_rawat || '-'}</p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleCopyRehabMedik(item)}>
                    Copy ke Form
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm">
                  <div><strong>Anamnesa:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.anamnesa)}</p></div>
                  <div><strong>Pemeriksaan Fisik:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.pemeriksaan_fisik)}</p></div>
                  <div><strong>Diagnosa Fungsi:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.diagnosa_fungsi)}</p></div>
                  <div><strong>Anjuran:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.anjuran)}</p></div>
                  <div><strong>Evaluasi:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.evaluasi)}</p></div>
                  <div><strong>Hasil:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.hasil)}</p></div>
                  <div><strong>Kesimpulan:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.kesimpulan)}</p></div>
                  <div><strong>Rekomendasi:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.rekomendasi)}</p></div>
                  <div><strong>Suspek Akibat Kerja:</strong><p>{item.suspek_penyakit || '-'}</p></div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border rounded-lg p-4 space-y-4">
          <h4 className="font-medium">Riwayat Assesmen Rehab Medik</h4>
          {rehabMedikHistoryEntries.length === 0 ? (
            <div className="border border-dashed rounded-lg p-4 text-sm text-muted-foreground bg-muted/20">
              Belum ada riwayat assesmen rehab medik pasien.
            </div>
          ) : (
            rehabMedikHistoryEntries.map((item, index) => (
              <div key={`rehab-history-${item.no_rawat}-${item.tanggal}-${item.time}-${index}`} className="rounded-lg border p-4 space-y-3 bg-muted/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <p><strong>Tgl / Jam:</strong> {formatDateSafe(`${item.tanggal} ${item.time}`)}</p>
                    <p><strong>No. Rawat:</strong> {item.no_rawat || '-'}</p>
                  </div>
                  <Button type="button" size="sm" variant="secondary" onClick={() => handleCopyRehabMedik(item)}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm">
                  <div><strong>Anamnesa:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.anamnesa)}</p></div>
                  <div><strong>Pemeriksaan Fisik:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.pemeriksaan_fisik)}</p></div>
                  <div><strong>Diagnosa Fungsi:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.diagnosa_fungsi)}</p></div>
                  <div><strong>Anjuran:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.anjuran)}</p></div>
                  <div><strong>Evaluasi:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.evaluasi)}</p></div>
                  <div><strong>Hasil:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.hasil)}</p></div>
                  <div><strong>Kesimpulan:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.kesimpulan)}</p></div>
                  <div><strong>Rekomendasi:</strong><p className="whitespace-pre-line break-words">{formatMultilineText(item.rekomendasi)}</p></div>
                  <div><strong>Suspek Akibat Kerja:</strong><p>{item.suspek_penyakit || '-'}</p></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };
  const renderEkstrapiramidalSection = () => {
    if (!formattedNoRawat) {
      return (
        <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
          Pilih kunjungan rawat inap terlebih dahulu untuk melihat data ekstrapiramidal.
        </div>
      );
    }

    const ekstrapiramidal = medicalData?.focused_ekstrapiramidal;
    const hasil = ekstrapiramidal?.hasil && typeof ekstrapiramidal.hasil === 'object'
      ? ekstrapiramidal.hasil
      : {};
    const items = Object.keys(ekstrapiramidalQuestionLabels).map((key) => ({
      key,
      question: ekstrapiramidalQuestionLabels[key],
      answer: mapEkstrapiramidalAnswer((hasil as Record<string, string>)[key])
    }));
    const dokterInput = String(user?.name || currentUsername || '').trim() || '-';
    const answerOptions = [
      { value: '1', label: 'Tidak Ada' },
      { value: '2', label: 'Ringan' },
      { value: '3', label: 'Sedang' },
      { value: '4', label: 'Berat' }
    ];

    return (
      <div className="space-y-4">
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="font-medium">Form Ekstrapiramidal</h4>
              <p className="text-sm text-muted-foreground">
                Penilaian gejala/efek samping Ekstrapiramidal.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="ep-no-rawat">No. Rawat</Label>
              <Input id="ep-no-rawat" value={formattedNoRawat} readOnly className="bg-muted" />
            </div>
            <div>
              <Label htmlFor="ep-dokter">Dokter</Label>
              <Input id="ep-dokter" value={dokterInput} readOnly className="bg-muted" />
            </div>
            <div>
              <Label htmlFor="ep-last-update">Data Tersimpan</Label>
              <Input
                id="ep-last-update"
                value={formatDateSafe(ekstrapiramidal?.updated_at || ekstrapiramidal?.created_at || '-')}
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((item, index) => (
              <div key={`form-${item.key}`} className="space-y-2 rounded-lg border bg-background p-4">
                <Label htmlFor={`ekstrapiramidal-${item.key}`} className="leading-6">
                  {index + 1}. {item.question}
                </Label>
                <select
                  id={`ekstrapiramidal-${item.key}`}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={(ekstrapiramidalForm as Record<string, string>)[item.key] || '1'}
                  onChange={(event) => setEkstrapiramidalForm((prev) => ({
                    ...prev,
                    [item.key]: event.target.value
                  }))}
                >
                  {answerOptions.map((option) => (
                    <option key={`${item.key}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEkstrapiramidalForm({
                ...getDefaultEkstrapiramidalForm(),
                ...(hasil as Record<string, string>)
              })}
              disabled={savingEkstrapiramidal}
            >
              Reset
            </Button>
            <Button
              type="button"
              onClick={() => void handleSaveEkstrapiramidal()}
              disabled={savingEkstrapiramidal}
            >
              {savingEkstrapiramidal ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </div>

        {Object.keys(hasil).length === 0 ? (
          <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
            Belum ada data ekstrapiramidal pada kunjungan ini.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border rounded-lg p-4 bg-muted/20">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">No. Rawat</p>
                  <p className="font-medium">{formattedNoRawat}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dokter</p>
                  <p className="font-medium">{ekstrapiramidal?.dokter || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Waktu Input</p>
                  <p className="font-medium">{formatDateSafe(ekstrapiramidal?.created_at || ekstrapiramidal?.updated_at || '-')}</p>
                </div>
              </div>
            </div>
            {items.map((item, index) => (
              <div key={item.key} className="rounded-lg border p-4 bg-background">
                <p className="text-sm text-muted-foreground mb-1">Pertanyaan {index + 1}</p>
                <p className="font-medium">{item.question}</p>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Jawaban: </span>
                  <span className="font-medium">{item.answer}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const renderProcedureCards = (procedures: any[]) => {
    if (procedures.length === 0) {
      return (
        <p className="text-sm italic text-muted-foreground">
          Belum ada data tindakan pada kategori ini.
        </p>
      );
    }

    const groupedProcedures = procedures.reduce((groups, proc) => {
      const groupKey = formatDateTimeToMinute(proc.tanggal);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(proc);
      return groups;
    }, {} as Record<string, any[]>);

    return (Object.entries(groupedProcedures) as Array<[string, any[]]>).map(([tanggal, items]) => (
      <div key={tanggal} className="border rounded-lg p-3 space-y-3">
        <div className="flex flex-col gap-1 border-b pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-semibold text-foreground">{formatDateTimeToMinute(tanggal)}</span>
            <span className="text-muted-foreground">{items[0]?.source || '-'}</span>
          </div>
          <p className="text-sm text-muted-foreground">{items[0]?.no_rawat || '-'}</p>
        </div>

        <div className="space-y-2">
          {items.map((proc, procIndex) => {
            const procedureKey = [
              proc.no_rawat,
              proc.kd_jenis_prw,
              proc.tgl_perawatan,
              proc.jam_rawat,
              proc.record_type
            ].join('|');

            return (
              (() => {
                const allowedToDelete = canDeleteProcedure(proc);

                return (
              <div
                key={`${proc.no_rawat}-${tanggal}-${proc.nm_perawatan}-${procIndex}`}
                className="flex items-start justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-6">{proc.nm_perawatan || proc.nama || '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    {proc.nama_pelaksana || proc.hasil || '-'}
                  </p>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteProcedure(proc)}
                    disabled={!allowedToDelete || deletingProcedureKey === procedureKey}
                  >
                    <Trash2 className="h-4 w-4 md:mr-2" />
                    <span className="hidden md:inline">
                      {deletingProcedureKey === procedureKey ? 'Menghapus...' : (allowedToDelete ? 'Hapus' : 'Bukan Data Anda')}
                    </span>
                  </Button>
                </div>
              </div>
                );
              })()
            );
          })}
        </div>
      </div>
    ));
  };
  const renderCompactVisitProcedures = (procedures: any[], noRawat?: string) => {
    if (procedures.length === 0) {
      return (
        <p className="text-sm italic text-muted-foreground">
          Belum ada data tindakan pada kunjungan ini.
        </p>
      );
    }

    const groupedProcedures = procedures.reduce((groups, proc) => {
      const groupKey = proc.tanggal || '-';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(proc);
      return groups;
    }, {} as Record<string, any[]>);

    return (
      <div className="space-y-2">
        {(Object.entries(groupedProcedures) as Array<[string, any[]]>).map(([tanggal, items]) => (
          <div key={`${noRawat || 'visit'}-${tanggal}`} className="rounded-md border bg-muted/10 px-3 py-2">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b pb-2">
              <div className="text-sm font-medium">{formatDateSafe(tanggal)}</div>
              <div className="text-xs text-muted-foreground">
                {items.length} tindakan
              </div>
            </div>
            <div className="space-y-1.5">
              {items.map((proc, procIndex) => (
                <div
                  key={`${noRawat || 'visit'}-${tanggal}-${proc.nm_perawatan || proc.nama || procIndex}`}
                  className="flex items-start justify-between gap-3 rounded-sm px-1 py-1 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-5">
                      {proc.nm_perawatan || proc.nama || '-'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {proc.nama_pelaksana || proc.hasil || '-'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };
  const renderVisitIcdDetails = (visit: any) => {
    const icdDetails = visit?.icd_details || {};
    const icd10Items = Array.isArray(icdDetails?.icd10) ? icdDetails.icd10 : [];
    const icd9Items = Array.isArray(icdDetails?.icd9) ? icdDetails.icd9 : [];

    const normalizePrioritas = (value: any) => {
      const parsed = Number(value || 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const formatIcd9Text = (item: any) => {
      const code = String(item?.kode || '').trim();
      const desc = String(item?.deskripsi_panjang || item?.deskripsi_pendek || '').trim();
      if (!code && !desc) {
        return '-';
      }
      if (!desc) {
        return code;
      }
      if (!code) {
        return desc;
      }
      return `${code} - ${desc}`;
    };

    return (
      <div className="border rounded-lg p-4 bg-muted/20">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          ICD 10 / ICD 9 / SNOMED
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-background p-4">
            <p className="text-sm font-semibold mb-2">ICD 10 (Diagnosa)</p>
            {icd10Items.length === 0 ? (
              <p className="text-sm text-muted-foreground">-</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-auto text-sm">
                {icd10Items.map((item: any, index: number) => (
                  <div key={`${item?.kd_penyakit || 'icd10'}-${index}`} className="rounded-md border bg-muted/10 px-3 py-2">
                    <p className="font-medium">
                      {normalizePrioritas(item?.prioritas) ? `${normalizePrioritas(item?.prioritas)}. ` : ''}
                      {String(item?.kd_penyakit || '').trim() || '-'}
                      {String(item?.nm_penyakit || '').trim() ? ` - ${String(item?.nm_penyakit || '').trim()}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {String(item?.status_penyakit || '').trim() ? `Status: ${String(item?.status_penyakit || '').trim()}` : '-'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      SNOMED: {String(item?.snomed_concept_id || '').trim() || '-'}
                      {String(item?.snomed_term || '').trim() ? ` - ${String(item?.snomed_term || '').trim()}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-background p-4">
            <p className="text-sm font-semibold mb-2">ICD 9 (Prosedur)</p>
            {icd9Items.length === 0 ? (
              <p className="text-sm text-muted-foreground">-</p>
            ) : (
              <div className="max-h-56 space-y-2 overflow-auto text-sm">
                {icd9Items.map((item: any, index: number) => (
                  <div key={`${item?.kode || 'icd9'}-${index}`} className="rounded-md border bg-muted/10 px-3 py-2">
                    <p className="font-medium">
                      {normalizePrioritas(item?.prioritas) ? `${normalizePrioritas(item?.prioritas)}. ` : ''}
                      {formatIcd9Text(item)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      SNOMED: {String(item?.snomed_concept_id || '').trim() || '-'}
                      {String(item?.snomed_term || '').trim() ? ` - ${String(item?.snomed_term || '').trim()}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  const renderVisitIgdTriageDetails = (visit: any) => {
    const triage = visit?.triase_igd;
    if (!triage) {
      return null;
    }

    const triageActions = Array.isArray(triage.tindakan_triase) ? triage.tindakan_triase : [];

    return (
      <div className="border rounded-lg p-4 bg-amber-50/40">
        <h3 className="text-lg font-semibold mb-3 flex items-center">
          <BadgeAlert className="h-5 w-5 mr-2" />
          Triase IGD
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Waktu Triase</span>
              <span className="font-medium text-right">{triage.tanggal || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Level</span>
              <span className="font-medium text-right">{triage.nm_level || triage.kd_level || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Jenis Kasus</span>
              <span className="font-medium text-right">{triage.namakasus || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status Diantar</span>
              <span className="font-medium text-right">{triage.stts_diantar || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Transportasi</span>
              <span className="font-medium text-right">{triage.transportasi || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status Fungsional</span>
              <span className="font-medium text-right">{triage.stts_fungsional || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Psikologis</span>
              <span className="font-medium text-right">{triage.psikologis || '-'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Saturasi</span>
              <span className="font-medium text-right">{triage.saturasi || '-'}</span>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Keluhan Utama</p>
              <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(triage.keluhan_utama)}</p>
            </div>
            <div>
              <p className="font-medium">Riwayat Penyakit</p>
              <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(triage.riwayat_penyakit)}</p>
            </div>
            <div>
              <p className="font-medium">Pemeriksaan Fisik</p>
              <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(triage.periksafisik)}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm font-medium">Skala Nyeri</p>
            <p className="text-sm text-muted-foreground">{triage.skala_nyeri || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Risiko Jatuh</p>
            <p className="text-sm text-muted-foreground">{triage.resiko_jatuh || '-'}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Diagnosis Awal</p>
            <p className="text-sm text-muted-foreground">{triage.diagnosis || '-'}</p>
          </div>
        </div>
        {triageActions.length > 0 ? (
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Tindakan Triase</p>
            <div className="flex flex-wrap gap-2">
              {triageActions.map((item: IgdTriageSelectedAction, index: number) => (
                <span
                  key={`${item.kd_tindakan || index}`}
                  className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800"
                >
                  {item.nm_tindakan || item.kd_tindakan}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };
  const renderMedicationCards = (items: any[], isRequestTab: boolean) => {
    if (items.length === 0) {
      return (
        <p className="text-sm italic text-muted-foreground">
          {isRequestTab ? 'Belum ada data riwayat resep obat.' : 'Belum ada data riwayat pemberian obat.'}
        </p>
      );
    }

    return items.map((med, index) => {
      const allowedToDelete = canDeletePrescription(med);
      const compoundItems = Array.isArray(med?.compounds) ? med.compounds : [];
      const hasCompoundItems = compoundItems.length > 0;
      const hasCompoundItemsOriginal = Boolean(med?.__has_compounds_original) || hasCompoundItems;
      const medicationItems = Array.isArray(med?.obat) ? med.obat : [];
      const hasMedicationItems = medicationItems.length > 0;
      const canEditThisPrescription = canEditPrescription(med) && !hasCompoundItemsOriginal;
      const editPrescriptionLabel = canEditPrescription(med)
        ? (hasCompoundItemsOriginal ? 'Ada Racikan' : 'Edit Resep')
        : 'Bukan Data Anda';
      const deletePrescriptionLabel = deletingPrescriptionNo === med.no_resep
        ? 'Menghapus...'
        : (allowedToDelete ? 'Hapus' : 'Bukan Data Anda');

      return (
      <div key={med.__split_key || `${med.no_resep || med.tanggal}-${index}`} className="border rounded-lg p-4">
        <div className="mb-4 flex flex-col-reverse gap-3 md:flex-col">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Nomor Resep</p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{med.no_resep || '-'}</p>
                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-100/70 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                  {med.nm_dokter ? `${med.nm_dokter}` : `${med.kd_dokter || '-'}`}
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tanggal</p>
              <p className="font-medium">{formatDateSafe(med.tanggal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No. Rawat</p>
              <p className="font-medium">{med.no_rawat}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sumber</p>
              <p className="font-medium">{med.source}</p>
              {med.is_package ? (
                <p className="text-xs text-emerald-700">
                  Paket: {med.package_name || 'Paket Obat & BHP'}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {isRequestTab ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditResep(med)}
                  disabled={!canEditThisPrescription}
                  className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                  aria-label={editPrescriptionLabel}
                  title={editPrescriptionLabel}
                >
                  <Pencil className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">{editPrescriptionLabel}</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteResep(med)}
                  disabled={!allowedToDelete || deletingPrescriptionNo === med.no_resep}
                  className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                  aria-label={deletePrescriptionLabel}
                  title={deletePrescriptionLabel}
                >
                  <Trash2 className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">{deletePrescriptionLabel}</span>
                </Button>
              </>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyResep(med)}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label="Copy Resep"
              title="Copy Resep"
            >
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">Copy Resep</span>
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {hasMedicationItems ? (
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">Obat:</h4>
            </div>
          ) : null}
          {medicationItems.map((obat: any, i: number) => (
            <div key={i} className="grid grid-cols-1 md:grid-cols-3 gap-4 border-l-2 border-secondary pl-4">
              <div>
                <p className="text-sm text-muted-foreground">Nama</p>
                <p className="font-medium">{obat.nama}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Jumlah</p>
                <p className="font-medium">{obat.jumlah}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aturan Pakai</p>
                <p className="font-medium">{obat.aturan_pakai}</p>
              </div>
            </div>
          ))}
          {hasCompoundItems ? (
            <div className="space-y-3 pt-2">
              <h4 className="font-medium text-blue-700">Racikan:</h4>
              {compoundItems.map((compound: any, compoundIndex: number) => (
                <div key={`${compound.no_racik || compoundIndex}`} className="rounded border border-blue-200 bg-blue-50/40 p-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nama Racikan</p>
                      <p className="font-medium">{compound.nama_racik || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Jumlah</p>
                      <p className="font-medium">{compound.jml_dr || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Metode</p>
                      <p className="font-medium">{compound.nm_racik || compound.kd_racik || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Aturan Pakai</p>
                      <p className="font-medium">{compound.aturan_pakai || '-'}</p>
                    </div>
                  </div>
                  {compound.keterangan ? (
                    <p className="mt-2 text-sm text-muted-foreground">Keterangan: {compound.keterangan}</p>
                  ) : null}
                  <div className="mt-3 space-y-2">
                    {(Array.isArray(compound?.details) ? compound.details : []).map((detail: any, detailIndex: number) => (
                      <div key={`${detail.kode_brng || detailIndex}`} className="grid grid-cols-1 gap-3 border-l-2 border-blue-300 pl-3 md:grid-cols-3">
                        <div>
                          <p className="text-sm text-muted-foreground">Obat</p>
                          <p className="font-medium">{detail.nama_brng || detail.nama || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Kandungan</p>
                          <p className="font-medium">{detail.kandungan ?? detail.jumlah ?? '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Jumlah Obat</p>
                          <p className="font-medium">{detail.jml ?? '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )});
  };
  const renderLaboratoryRequestCards = (items: any[]) => {
    if (items.length === 0) {
      return <p className="text-sm italic text-muted-foreground">Belum ada data permintaan laboratorium.</p>;
    }

    return items.map((lab, labIndex) => {
      const allowedToDelete = canDeleteLabRequest(lab);
      const canEdit = canEditLabRequest(lab);
      const editLabel = canEdit ? 'Edit' : 'Bukan Data Anda';
      const deleteLabel = deletingLabRequestNo === lab.noorder
        ? 'Menghapus...'
        : (allowedToDelete ? 'Hapus' : 'Bukan Data Anda');

      return (
      <div key={`${lab.no_rawat}-${lab.noorder}-${labIndex}`} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div className="mb-4 flex flex-col-reverse gap-3 md:flex-col">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Tanggal</p>
              <p className="font-medium">{formatDateSafe(lab.tanggal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No. Rawat</p>
              <p className="font-medium">{lab.no_rawat}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sumber</p>
              <p className="font-medium">{lab.source}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No. Order</p>
              <p className="font-medium">{lab.noorder || '-'}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditLabRequest(lab)}
              disabled={!canEdit}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label={editLabel}
              title={editLabel}
            >
              <Pencil className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">{editLabel}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyLabRequest(lab)}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label="Copy"
              title="Copy"
            >
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">Copy</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteLabRequest(lab)}
              disabled={!allowedToDelete || deletingLabRequestNo === lab.noorder}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label={deleteLabel}
              title={deleteLabel}
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">{deleteLabel}</span>
            </Button>
          </div>
        </div>
        {lab.klinis ? (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Klinis</p>
            <p className="font-medium whitespace-pre-line break-words">{lab.klinis}</p>
          </div>
        ) : null}
        <div className="space-y-2">
          <h4 className="font-medium">Pemeriksaan:</h4>
          {(lab.pemeriksaan || []).map((test: any, testIndex: number) => (
            <div key={testIndex} className="grid grid-cols-1 md:grid-cols-1 gap-4 border-l-2 border-primary pl-4">
              <div>
                <p className="text-sm text-muted-foreground">Nama</p>
                <p className="font-medium">{test.nama}</p>
              </div>
              {test.kode ? (
                <div>
                  <p className="text-sm text-muted-foreground">Kode Pemeriksaan</p>
                  <p className="font-medium">{test.kode}</p>
                </div>
              ) : null}
              <div>
                <p className="text-sm text-muted-foreground">Template</p>
                {Array.isArray(test.templates) && test.templates.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {test.templates.map((template: any, templateIndex: number) => (
                      <div key={`${template.id_template}-${templateIndex}`} className="rounded border bg-muted/20 p-3">
                        <p className="font-medium">{template.nama || '-'}</p>
                        <p className="text-xs text-muted-foreground">
                          ID Template: {template.id_template || '-'}
                          {template.satuan ? ` • Satuan: ${template.satuan}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rujukan LD: {template.nilai_rujukan_ld || '-'} {' • '}LA: {template.nilai_rujukan_la || '-'} {' • '}PD: {template.nilai_rujukan_pd || '-'} {' • '}PA: {template.nilai_rujukan_pa || '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">Tidak ada template tersimpan.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )});
  };
  const renderLaboratoryHistoryDetails = (labGroup: any) => {
    if (!Array.isArray(labGroup.pemeriksaan) || labGroup.pemeriksaan.length === 0) {
      return <p className="text-sm italic text-muted-foreground">Tidak ada hasil pemeriksaan</p>;
    }

    const groupedTests = (labGroup.pemeriksaan as LabTest[]).reduce((groups, test) => {
      const key = test.nama?.trim() || '-';
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(test);
      return groups;
    }, {} as Record<string, LabTest[]>);

    return Object.entries(groupedTests).map(([groupName, tests], groupIdx) => (
      <div key={`${groupName}-${groupIdx}`} className="border rounded-lg p-3 space-y-3 bg-muted/20">
        <div>
          <p className="text-sm text-muted-foreground">Nama</p>
          <p className="font-semibold">{groupName}</p>
        </div>
        <div className="space-y-2">
          {(tests as LabTest[]).map((test, testIndex) => (
            <div
              key={`${groupName}-${testIndex}`}
              className={cn(
                "grid grid-cols-1 md:grid-cols-4 gap-4 border-l-2 border-primary pl-4 rounded-r px-2 py-2 bg-background",
                test.keterangan === 'H' && "bg-red-100 text-red-900",
                test.keterangan === 'L' && "bg-yellow-100 text-yellow-900"
              )}
            >
              <div>
                <p className="text-sm text-muted-foreground">Pemeriksaan</p>
                <p className="font-medium">{test.pemeriksaan || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Hasil</p>
                <p className="font-medium">{test.hasil || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rujukan</p>
                <p className="font-medium">{test.rujukan || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Keterangan</p>
                <p className="font-medium">{test.keterangan || '-'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  const renderLaboratoryHistoryCards = (items: any[]) => {
    if (items.length === 0) {
      return <p className="text-sm italic text-muted-foreground">Belum ada riwayat pemeriksaan laboratorium.</p>;
    }

    return items.map((labGroup, groupIndex) => (
      <div
        key={`${labGroup.no_rawat}-${labGroup.tanggal}-${groupIndex}`}
        className="border rounded-lg p-4 cursor-move hover:shadow-lg transition-shadow"
        draggable
        onDragStart={(e) => {
          setDraggingLab({
            tanggal: labGroup.tanggal,
            pemeriksaan: labGroup.pemeriksaan
          });
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <div className="mb-4 flex flex-col-reverse gap-3 md:flex-row md:items-start md:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Tanggal</p>
              <p className="font-medium">{formatDateSafe(labGroup.tanggal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No. Rawat</p>
              <p className="font-medium">{labGroup.no_rawat}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sumber</p>
              <p className="font-medium">{labGroup.source}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 md:w-auto md:items-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                addLaboratoryResultToCanvas({
                  tanggal: labGroup.tanggal,
                  pemeriksaan: labGroup.pemeriksaan
                });
              }}
              aria-label="Tambah ke Canvas"
              title="Tambah ke Canvas"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">Tambah ke Canvas</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setFullscreenLabHistory(labGroup);
              }}
              aria-label="Fullscreen"
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">Fullscreen</span>
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium">Pemeriksaan:</h4>
          {renderLaboratoryHistoryDetails(labGroup)}
        </div>
      </div>
    ));
  };
  const renderVisitLaboratoryHistory = (items: LabData[], noRawat: string, source: string) => {
    const normalizedItems = buildFocusedLabItems(items || [], noRawat, source);
    return renderLaboratoryHistoryCards(normalizedItems);
  };
  const renderRadiologyRequestCards = (items: any[]) => {
    if (items.length === 0) {
      return <p className="text-sm italic text-muted-foreground">Belum ada data permintaan radiologi.</p>;
    }

    return items.map((rad, radIndex) => {
      const allowedToDelete = canDeleteRadiologyRequest(rad);
      const canEdit = canEditRadiologyRequest(rad);
      const editLabel = canEdit ? 'Edit' : 'Bukan Data Anda';
      const deleteLabel = deletingRadiologyRequestNo === rad.noorder
        ? 'Menghapus...'
        : (allowedToDelete ? 'Hapus' : 'Bukan Data Anda');

      return (
      <div key={`${rad.no_rawat}-${rad.noorder}-${radIndex}`} className="border rounded-lg p-4">
        <div className="mb-4 flex flex-col-reverse gap-3 md:flex-col">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-muted-foreground">Tanggal</p>
              <p className="font-medium">{formatDateSafe(rad.tanggal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No. Rawat</p>
              <p className="font-medium">{rad.no_rawat}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sumber</p>
              <p className="font-medium">{rad.source}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">No. Order</p>
              <p className="font-medium">{rad.noorder || '-'}</p>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleEditRadiologyRequest(rad)}
              disabled={!canEdit}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label={editLabel}
              title={editLabel}
            >
              <Pencil className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">{editLabel}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopyRadiologyRequest(rad)}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label="Copy"
              title="Copy"
            >
              <Copy className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">Copy</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteRadiologyRequest(rad)}
              disabled={!allowedToDelete || deletingRadiologyRequestNo === rad.noorder}
              className="h-9 w-9 p-0 sm:w-auto sm:px-3"
              aria-label={deleteLabel}
              title={deleteLabel}
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">{deleteLabel}</span>
            </Button>
          </div>
        </div>
        {rad.klinis ? (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Klinis</p>
            <p className="font-medium whitespace-pre-line break-words">{rad.klinis}</p>
          </div>
        ) : null}
        <div className="space-y-2">
          <h4 className="font-medium">Pemeriksaan:</h4>
          {Array.isArray(rad.pemeriksaan) && rad.pemeriksaan.length > 0 ? (
            rad.pemeriksaan.map((test: any, testIndex: number) => (
              <div key={testIndex} className="grid grid-cols-1 md:grid-cols-2 gap-4 border-l-2 border-primary pl-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nama</p>
                  <p className="font-medium">{test.nama || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kode Pemeriksaan</p>
                  <p className="font-medium">{test.kode || '-'}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm italic text-muted-foreground">Tidak ada pemeriksaan radiologi tersimpan.</p>
          )}
        </div>
      </div>
    )});
  };
  const renderRadiologyHistoryCards = (items: any[]) => {
    if (items.length === 0) {
      return <p className="text-sm italic text-muted-foreground">Belum ada riwayat radiologi.</p>;
    }

    return items.map((rad, radIndex) => (
      <div
        key={`${rad.no_rawat}-${rad.tanggal}-${radIndex}`}
        className="border rounded-lg p-4 cursor-move hover:shadow-lg transition-shadow"
        draggable
        onDragStart={(e) => {
          setDraggingRad(rad);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <div className="space-y-4">
          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-start md:justify-between">
            <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Tanggal</p>
                <p className="font-medium">{formatDateSafe(rad.tanggal)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">No. Rawat</p>
                <p className="font-medium">{rad.no_rawat}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sumber</p>
                <p className="font-medium">{rad.source}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pemeriksaan</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="font-medium">{rad.pemeriksaan}</p>
                  {renderRadiologyModalityBadge(rad)}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 w-9 self-end p-0 sm:w-auto sm:self-auto sm:px-3"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                addRadiologyResultToCanvas(rad);
              }}
              aria-label="Tambah ke Canvas"
              title="Tambah ke Canvas"
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="sr-only sm:not-sr-only">Tambah ke Canvas</span>
            </Button>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hasil</p>
            <p className="font-medium whitespace-pre-wrap break-words">{rad.hasil || '-'}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Saran</p>
              <p className="font-medium whitespace-pre-wrap break-words">{rad.saran || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kesan</p>
              <p className="font-medium whitespace-pre-wrap break-words">{rad.kesan || '-'}</p>
            </div>
          </div>
        </div>
        {renderRadiologyPacsImages(rad)}
      </div>
    ));
  };
  const renderDeferredTabState = (label: string, isTabLoading = loadingFocusedTab) => (
    <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
      {isTabLoading ? `Memuat data ${label}...` : `Data ${label} akan dimuat saat tab ini dibuka.`}
    </div>
  );

  useEffect(() => {
    dataContextVersionRef.current += 1;
    medicalRecordRequestRef.current = {
      visits: 0,
      focused: 0
    };
    examinationHistoryRequestRef.current = 0;
  }, [formattedNoRawat, no_rkm_medis]);
  
  useEffect(() => {
    const searchQuery = routeSearchQuery;
    if (searchQuery) {
      searchPatients(searchQuery);
    }
  }, [routeSearchQuery]);

  const fetchMedicalRecord = useCallback(async ({
    reset = false,
    outpatientPage = 1,
    inpatientPage = 1,
    includeOutpatient = true,
    includeInpatient = true,
    includeVisitDetails = true,
    includeFocusedExaminations = false,
    includeFocusedProcedures = false,
    includeFocusedMedications = false,
    includeFocusedLaboratory = false,
    includeFocusedRadiology = false,
    focusedMedicationHistoryMode = 'latest',
    requestScope = includeOutpatient || includeInpatient ? 'visits' : 'focused'
  }: MedicalRecordFetchOptions = {}) => {
    if (!no_rkm_medis) {
      return;
    }

    const contextVersion = dataContextVersionRef.current;
    const requestId = ++medicalRecordRequestRef.current[requestScope];

    try {
      if (requestScope === 'visits' && reset) {
        setLoading(true);
      } else if (requestScope === 'focused') {
        setLoadingFocusedTab(true);
      } else {
        setLoadingMoreVisits(true);
      }

      console.log('Fetching medical record for no_rm:', no_rkm_medis);
      
      const response = await fetch(API_URLS.GET_MEDICAL_RECORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          no_rm: no_rkm_medis,
          limit: PAGE_SIZE,
          outpatientPage,
          inpatientPage,
          includeOutpatient,
          includeInpatient,
          includeVisitDetails,
          includeFocusedExaminations,
          includeFocusedProcedures,
          includeFocusedMedications,
          includeFocusedLaboratory,
          includeFocusedRadiology,
          focusedMedicationHistoryMode,
          focus_no_rawat: formattedNoRawat || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseJson = await response.json();
      if (
        contextVersion !== dataContextVersionRef.current ||
        requestId !== medicalRecordRequestRef.current[requestScope]
      ) {
        return;
      }
      const responseData = Array.isArray(responseJson) ? responseJson[0] : responseJson?.data;
      const responsePagination = Array.isArray(responseJson)
        ? {
            outpatient: {
              ...DEFAULT_PAGINATION_META,
              page: 1,
              hasMore: false,
              total: responseJson[0]?.outpatient_visits?.length || 0
            },
            inpatient: {
              ...DEFAULT_PAGINATION_META,
              page: 1,
              hasMore: false,
              total: responseJson[0]?.inpatient_visits?.length || 0
            }
          }
        : responseJson?.pagination;
      
      console.log('Medical record response:', { responseJson });
      
      if (responseData) {
        setMedicalData((previousData) => {
          if (reset || !previousData) {
            return responseData;
          }

          return {
            ...previousData,
            patient: responseData.patient || previousData.patient,
            outpatient_visits: mergeVisitsByNoRawat(
              previousData.outpatient_visits,
              responseData.outpatient_visits || []
            ),
            inpatient_visits: mergeVisitsByNoRawat(
              previousData.inpatient_visits,
              responseData.inpatient_visits || []
            ),
            focused_examinations: responseData.focused_examinations || previousData.focused_examinations,
            focused_ekstrapiramidal:
              responseData.focused_ekstrapiramidal !== undefined
                ? responseData.focused_ekstrapiramidal
                : previousData.focused_ekstrapiramidal,
            focused_procedures: responseData.focused_procedures || previousData.focused_procedures,
            focused_medications_request: responseData.focused_medications_request || previousData.focused_medications_request,
            focused_medications_request_meta: responseData.focused_medications_request_meta || previousData.focused_medications_request_meta,
            focused_medications: responseData.focused_medications || previousData.focused_medications,
            focused_laboratory_request: responseData.focused_laboratory_request || previousData.focused_laboratory_request,
            focused_laboratory: responseData.focused_laboratory || previousData.focused_laboratory,
            focused_radiology_request: responseData.focused_radiology_request || previousData.focused_radiology_request,
            focused_radiology: responseData.focused_radiology || previousData.focused_radiology
          };
        });

        if (responsePagination) {
          setPagination((previous) => ({
            outpatient: responsePagination.outpatient || previous.outpatient,
            inpatient: responsePagination.inpatient || previous.inpatient
          }));
        }
        
        const focusedVisitStatus =
          (formattedNoRawat && responseData.inpatient_visits?.some((visit: any) => visit.no_rawat === formattedNoRawat))
            ? 'Ranap'
            : (formattedNoRawat && responseData.outpatient_visits?.some((visit: any) => visit.no_rawat === formattedNoRawat))
                ? 'Ralan'
              : undefined;
        setStatusRawat(focusedVisitStatus || mapStatusLanjutToStatusRawat(responseData.patient?.status_lanjut));
      } else {
        console.log('No medical data found');
        if (reset) {
          setMedicalData(null);
          setPagination({
            outpatient: DEFAULT_PAGINATION_META,
            inpatient: DEFAULT_PAGINATION_META
          });
        }
      }
    } catch (error) {
      if (requestId === medicalRecordRequestRef.current[requestScope]) {
        console.error('Error fetching medical record:', error);
      }
    } finally {
      if (
        dataContextVersionRef.current === contextVersion &&
        requestId === medicalRecordRequestRef.current[requestScope]
      ) {
        if (requestScope === 'visits') {
          setLoading(false);
          setLoadingMoreVisits(false);
        } else {
          setLoadingFocusedTab(false);
        }
      }
    }
  }, [formattedNoRawat, no_rkm_medis]);

  const handleLoadAllOutpatientMedicationRequests = useCallback(async () => {
    if (!formattedNoRawat || loadingAllOutpatientMedicationRequests || showAllOutpatientMedicationRequests) {
      return;
    }

    setLoadingAllOutpatientMedicationRequests(true);
    try {
      await fetchMedicalRecord({
        reset: false,
        outpatientPage: pagination.outpatient.page,
        inpatientPage: pagination.inpatient.page,
        includeOutpatient: false,
        includeInpatient: false,
        includeFocusedMedications: true,
        focusedMedicationHistoryMode: 'all',
        requestScope: 'focused'
      });
      setShowAllOutpatientMedicationRequests(true);
    } finally {
      setLoadingAllOutpatientMedicationRequests(false);
    }
  }, [
    fetchMedicalRecord,
    formattedNoRawat,
    loadingAllOutpatientMedicationRequests,
    pagination.inpatient.page,
    pagination.outpatient.page,
    showAllOutpatientMedicationRequests
  ]);

  const handleLoadAllInpatientMedicationRequests = useCallback(async () => {
    if (!formattedNoRawat || loadingAllInpatientMedicationRequests || showAllInpatientMedicationRequests) {
      return;
    }

    setLoadingAllInpatientMedicationRequests(true);
    try {
      await fetchMedicalRecord({
        reset: false,
        outpatientPage: pagination.outpatient.page,
        inpatientPage: pagination.inpatient.page,
        includeOutpatient: false,
        includeInpatient: false,
        includeFocusedMedications: true,
        focusedMedicationHistoryMode: 'all',
        requestScope: 'focused'
      });
      setShowAllInpatientMedicationRequests(true);
    } finally {
      setLoadingAllInpatientMedicationRequests(false);
    }
  }, [
    fetchMedicalRecord,
    formattedNoRawat,
    loadingAllInpatientMedicationRequests,
    pagination.inpatient.page,
    pagination.outpatient.page,
    showAllInpatientMedicationRequests
  ]);

  const fetchVisitDetails = useCallback(async (noRawat: string) => {
    if (!noRawat) {
      return;
    }

    const contextVersion = dataContextVersionRef.current;
    setLoadingVisitDetailsKeys((previous) => ({ ...previous, [noRawat]: true }));
    try {
      const response = await fetch(API_URLS.GET_MEDICAL_RECORD_VISIT_DETAILS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ no_rawat: noRawat })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseJson = await response.json();
      if (contextVersion !== dataContextVersionRef.current) {
        return;
      }
      const visitData = responseJson?.data;
      if (!visitData) {
        return;
      }

      setMedicalData((previousData) => {
        if (!previousData) {
          return previousData;
        }

        return {
          ...previousData,
          outpatient_visits: replaceVisitByNoRawat(previousData.outpatient_visits, visitData),
          inpatient_visits: replaceVisitByNoRawat(previousData.inpatient_visits, visitData)
        };
      });
    } catch (error) {
      if (contextVersion === dataContextVersionRef.current) {
        console.error('Error fetching visit details:', error);
      }
    } finally {
      if (contextVersion === dataContextVersionRef.current) {
        setLoadingVisitDetailsKeys((previous) => ({ ...previous, [noRawat]: false }));
      }
    }
  }, []);

  const fetchExaminationHistory = useCallback(async ({
    reset = false,
    outpatientPage = 1,
    inpatientPage = 1,
    includeOutpatient = true,
    includeInpatient = true
  }: {
    reset?: boolean;
    outpatientPage?: number;
    inpatientPage?: number;
    includeOutpatient?: boolean;
    includeInpatient?: boolean;
  } = {}) => {
    if (!no_rkm_medis) {
      return;
    }

    const contextVersion = dataContextVersionRef.current;
    const requestId = ++examinationHistoryRequestRef.current;
    setLoadingMoreExaminations(true);
    try {
      const response = await fetch(API_URLS.GET_MEDICAL_RECORD_EXAMINATIONS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rm: no_rkm_medis,
          limit: PAGE_SIZE,
          outpatientPage,
          inpatientPage,
          includeOutpatient,
          includeInpatient,
          focus_no_rawat: formattedNoRawat || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseJson = await response.json();
      if (
        contextVersion !== dataContextVersionRef.current ||
        requestId !== examinationHistoryRequestRef.current
      ) {
        return;
      }
      const responseData = responseJson?.data;
      const responsePagination = responseJson?.pagination;

      if (responseData) {
        setExaminationHistoryData((previous) => ({
          outpatient: reset
            ? (responseData.outpatient || [])
            : mergeExaminationHistory(previous.outpatient, responseData.outpatient || []),
          inpatient: reset
            ? (responseData.inpatient || [])
            : mergeExaminationHistory(previous.inpatient, responseData.inpatient || [])
        }));
      }

      if (responsePagination) {
        setExaminationPagination((previous) => ({
          outpatient: responsePagination.outpatient || previous.outpatient,
          inpatient: responsePagination.inpatient || previous.inpatient
        }));
      }
    } catch (error) {
      if (requestId === examinationHistoryRequestRef.current) {
        console.error('Error fetching examination history:', error);
      }
    } finally {
      if (
        dataContextVersionRef.current === contextVersion &&
        requestId === examinationHistoryRequestRef.current
      ) {
        setLoadingMoreExaminations(false);
      }
    }
  }, [formattedNoRawat, no_rkm_medis]);

  const handleToggleVisitExpansion = useCallback(async (visit: any) => {
    const noRawat = String(visit?.no_rawat || '').trim();
    if (!noRawat) {
      return;
    }

    const nextExpanded = !expandedVisitKeys[noRawat];
    setExpandedVisitKeys((previous) => ({ ...previous, [noRawat]: nextExpanded }));

    if (nextExpanded && !visit?.details_loaded && !loadingVisitDetailsKeys[noRawat]) {
      await fetchVisitDetails(noRawat);
    }
  }, [expandedVisitKeys, fetchVisitDetails, loadingVisitDetailsKeys]);

  useEffect(() => {
    if (no_rkm_medis) {
      setExpandedVisitKeys({});
      setLoadingVisitDetailsKeys({});
      setRadiologyPacsByKey({});
      setLoadingRadiologyPacsKeys({});
      setRadiologyPacsErrorKeys({});
      setExaminationHistoryData({ outpatient: [], inpatient: [] });
      setExaminationPagination({
        outpatient: DEFAULT_PAGINATION_META,
        inpatient: DEFAULT_PAGINATION_META
      });
      fetchMedicalRecord({
        reset: true,
        outpatientPage: 1,
        inpatientPage: 1,
        includeVisitDetails: false
      });
    }
  }, [fetchMedicalRecord, no_rkm_medis]);

  useEffect(() => {
    if (!formattedNoRawat || loading || loadingFocusedTab) {
      return;
    }

    if (activeTab === 'examinations' && !formattedNoRawat) {
      return;
    }

    const focusedFetchOptions = getFocusedFetchOptionsForTab(activeTab);
    if (!focusedFetchOptions) {
      return;
    }

    const isLoaded = (
      (activeTab === 'examinations' && isFocusedExaminationsLoaded) ||
      (activeTab === 'procedures' && isFocusedProceduresLoaded) ||
      (activeTab === 'medications' && isFocusedMedicationsLoaded) ||
      (activeTab === 'laboratory' && isFocusedLaboratoryLoaded) ||
      (activeTab === 'radiology' && isFocusedRadiologyLoaded)
    );

    if (isLoaded) {
      return;
    }

    fetchMedicalRecord({
      reset: false,
      outpatientPage: pagination.outpatient.page,
      inpatientPage: pagination.inpatient.page,
      includeOutpatient: false,
      includeInpatient: false,
      ...focusedFetchOptions
    });
  }, [
    activeTab,
    fetchMedicalRecord,
    formattedNoRawat,
    isFocusedExaminationsLoaded,
    isFocusedLaboratoryLoaded,
    isFocusedMedicationsLoaded,
    isFocusedProceduresLoaded,
    isFocusedRadiologyLoaded,
    loading,
    loadingFocusedTab,
    pagination.inpatient.page,
    pagination.outpatient.page
  ]);

  useEffect(() => {
    if (activeTab !== 'examinations' || formattedNoRawat || loading || loadingMoreExaminations) {
      return;
    }

    if (examinationHistoryData.outpatient.length || examinationHistoryData.inpatient.length) {
      return;
    }

    fetchExaminationHistory({ reset: true, outpatientPage: 1, inpatientPage: 1 });
  }, [
    activeTab,
    examinationHistoryData.inpatient.length,
    examinationHistoryData.outpatient.length,
    fetchExaminationHistory,
    formattedNoRawat,
    loading,
    loadingMoreExaminations
  ]);

  useEffect(() => {
    if (formattedNoRawat || loading || loadingMoreVisits) {
      return;
    }

    if (!['procedures', 'medications', 'laboratory', 'radiology'].includes(activeTab)) {
      return;
    }

    const currentVisits = [...allOutpatientVisits, ...allInpatientVisits];
    const missingVisitNoRawats = Array.from(new Set(
      currentVisits
        .filter((visit) => visit?.no_rawat && !visit?.details_loaded && !loadingVisitDetailsKeys[visit.no_rawat])
        .map((visit) => visit.no_rawat)
    ));

    if (!currentVisits.length || missingVisitNoRawats.length === 0) {
      return;
    }

    void Promise.allSettled(missingVisitNoRawats.map((noRawat) => fetchVisitDetails(noRawat)));
  }, [
    activeTab,
    allInpatientVisits,
    allOutpatientVisits,
    fetchVisitDetails,
    formattedNoRawat,
    loading,
    loadingMoreVisits,
    loadingVisitDetailsKeys
  ]);

  useEffect(() => {
    const defaultPrescriptionStatus = statusRawat === 'Ranap' ? 'Ranap' : 'Ralan';

    setMedications((previous) => previous.map((medication) => {
      const isBlankMedication = medication.obat.every((item) => (
        !item.kode_brng && !item.nama && !item.jumlah && !item.aturan_pakai
      ));

      return isBlankMedication
        ? { ...medication, status: defaultPrescriptionStatus }
        : medication;
    }));
  }, [statusRawat]);

  useEffect(() => {
    setProcedureStatusRawat(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');
  }, [statusRawat]);

  useEffect(() => {
    setLabStatusRawat(
      statusRawat === 'Ranap' ? 'Ranap' : statusRawat === 'IGD' ? 'IGD' : 'Ralan'
    );
  }, [statusRawat]);

  useEffect(() => {
    setRadiologyStatusRawat(
      statusRawat === 'Ranap' ? 'Ranap' : statusRawat === 'IGD' ? 'IGD' : 'Ralan'
    );
  }, [statusRawat]);

  useEffect(() => {
    if (!pacsPreviewModal.open || !isPacsPlaying || !isCtPacsPreview || pacsPreviewModal.images.length <= 1) {
      return;
    }

    const playbackTimer = window.setInterval(() => {
      setPacsPreviewModal((previous) => {
        if (!previous.images.length) {
          return previous;
        }

        const nextIndex = (previous.currentIndex + 1) % previous.images.length;
        return {
          ...previous,
          currentIndex: nextIndex
        };
      });
    }, pacsPlaybackSpeed);

    return () => window.clearInterval(playbackTimer);
  }, [isCtPacsPreview, isPacsPlaying, pacsPlaybackSpeed, pacsPreviewModal.images.length, pacsPreviewModal.open]);

  useEffect(() => {
    if (!pacsPreviewModal.open || !isCtPacsPreview || pacsPreviewModal.images.length === 0) {
      return;
    }

    const totalImages = pacsPreviewModal.images.length;
    const candidateIndexes = [0, 1, -1, 2, -2]
      .map((offset) => ((pacsPreviewModal.currentIndex + offset) % totalImages + totalImages) % totalImages)
      .filter((value, index, array) => array.indexOf(value) === index);

    candidateIndexes.forEach((index) => {
      const instanceId = String(pacsPreviewModal.images[index]?.instance_id || '').trim();

      if (!instanceId) {
        return;
      }

      const previewUrl = `${API_CONFIG.BASE_URL_WITHOUT_API}/api/pacs/preview/${encodeURIComponent(instanceId)}`;
      if (prefetchedPacsPreviewUrlsRef.current.has(previewUrl)) {
        return;
      }

      prefetchedPacsPreviewUrlsRef.current.add(previewUrl);
      const image = new window.Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.src = previewUrl;
    });
  }, [isCtPacsPreview, pacsPreviewModal.currentIndex, pacsPreviewModal.images, pacsPreviewModal.open]);

  useEffect(() => {
    setPacsZoomLevel(1);
  }, [pacsPreviewModal.currentIndex, pacsPreviewModal.open]);

  const loadMoreMedicalRecord = useCallback(() => {
    if (loading || loadingMoreVisits || activeTab !== 'visits') {
      return;
    }

    if (visitHistoryTab === 'outpatient') {
      if (!pagination.outpatient.hasMore) {
        return;
      }

      fetchMedicalRecord({
        reset: false,
        outpatientPage: pagination.outpatient.page + 1,
        inpatientPage: pagination.inpatient.page,
        includeOutpatient: true,
        includeInpatient: false,
        includeVisitDetails: false
      });
      return;
    }

    if (!pagination.inpatient.hasMore) {
      return;
    }

    fetchMedicalRecord({
      reset: false,
      outpatientPage: pagination.outpatient.page,
      inpatientPage: pagination.inpatient.page + 1,
      includeOutpatient: false,
      includeInpatient: true,
      includeVisitDetails: false
    });
  }, [activeTab, fetchMedicalRecord, loading, loadingMoreVisits, pagination, visitHistoryTab]);

  useEffect(() => {
    const currentTarget = loadMoreRef.current;

    if (!currentTarget || !no_rkm_medis || activeTab !== 'visits' || !hasMoreCurrentVisitTab) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreMedicalRecord();
        }
      },
      {
        rootMargin: '200px 0px'
      }
    );

    observer.observe(currentTarget);

    return () => {
      observer.disconnect();
    };
  }, [activeTab, hasMoreCurrentVisitTab, loadMoreMedicalRecord, no_rkm_medis]);

  useEffect(() => {
    if (activeTab !== 'visits' || !formattedNoRawat || loading || loadingMoreVisits || !hasMoreCurrentVisitTab) {
      return;
    }

    const targetInitialCount = Math.min(currentVisitTotal, PAGE_SIZE);
    if (targetInitialCount === 0 || currentVisitCount >= targetInitialCount) {
      return;
    }

    loadMoreMedicalRecord();
  }, [
    activeTab,
    currentVisitCount,
    currentVisitTotal,
    formattedNoRawat,
    hasMoreCurrentVisitTab,
    loadMoreMedicalRecord,
    loading,
    loadingMoreVisits
  ]);

  const loadMoreExaminationHistory = useCallback(() => {
    if (loading || loadingMoreExaminations || activeTab !== 'examinations' || formattedNoRawat) {
      return;
    }

    if (examinationHistoryTab === 'outpatient') {
      if (!examinationPagination.outpatient.hasMore) {
        return;
      }

      fetchExaminationHistory({
        reset: false,
        outpatientPage: examinationPagination.outpatient.page + 1,
        inpatientPage: examinationPagination.inpatient.page,
        includeOutpatient: true,
        includeInpatient: false
      });
      return;
    }

    if (!examinationPagination.inpatient.hasMore) {
      return;
    }

    fetchExaminationHistory({
      reset: false,
      outpatientPage: examinationPagination.outpatient.page,
      inpatientPage: examinationPagination.inpatient.page + 1,
      includeOutpatient: false,
      includeInpatient: true
    });
  }, [activeTab, examinationHistoryTab, examinationPagination, fetchExaminationHistory, formattedNoRawat, loading, loadingMoreExaminations]);

  useEffect(() => {
    const currentTarget = loadMoreExaminationRef.current;

    if (!currentTarget || !no_rkm_medis || activeTab !== 'examinations' || formattedNoRawat || !hasMoreCurrentExaminationTab) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreExaminationHistory();
        }
      },
      {
        rootMargin: '200px 0px'
      }
    );

    observer.observe(currentTarget);

    return () => {
      observer.disconnect();
    };
  }, [activeTab, formattedNoRawat, hasMoreCurrentExaminationTab, loadMoreExaminationHistory, no_rkm_medis]);

  const searchPatients = async (query: string) => {
    setIsLoading(true);
    try {
      // Simulate API call with dummy data
      setTimeout(() => {
        const results = dummySearchResults.filter(patient => 
          patient.name.toLowerCase().includes(query.toLowerCase()) ||
          patient.mrNumber.includes(query)
        );
        setSearchResults(results);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error searching patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // AI Scribe function
  const handleAiScribe = async (visit: any) => {
    setAiScribeData(visit);
    setAiScribeModal(true);
    setAiScribeLoading(true);
    setAiScribeResult('');

    try {
      // Prepare examination data for AI
      const examinationText = visit.examinations?.map((exam: any) => {
        const vitalSigns = [
          exam.tekanan_darah || exam.tensi ? `Tekanan Darah: ${exam.tekanan_darah || exam.tensi}` : '',
          exam.nadi ? `Nadi: ${exam.nadi} x/menit` : '',
          exam.respirasi ? `Respirasi: ${exam.respirasi} x/menit` : '',
          exam.suhu_tubuh || exam.suhu ? `Suhu: ${exam.suhu_tubuh || exam.suhu}°C` : '',
          exam.spo2 ? `SpO2: ${exam.spo2}%` : '',
          exam.gcs ? `GCS: ${exam.gcs}` : '',
          exam.tinggi ? `Tinggi: ${exam.tinggi} cm` : '',
          exam.berat ? `Berat: ${exam.berat} kg` : '',
          exam.kesadaran ? `Kesadaran: ${exam.kesadaran}` : ''
        ].filter(Boolean).join(', ');
        
        return `Tanggal: ${exam.tanggal}\nTanda-tanda Vital: ${vitalSigns}\nKeluhan: ${exam.s || ''}\nPemeriksaan: ${exam.o || ''}\nAssessment: ${exam.a || ''}\nPlanning: ${exam.p || ''}\nImplementation: ${exam.i || ''}\nEvaluation: ${exam.e || ''}`;
      }).join('\n\n') || '';

      // Add medication data
      const medicationText = visit.medicationsRequest?.map((med: any) => {
        const obatList = med.obat?.map((o: any) => `${o.nama} - ${o.jumlah} - ${o.aturan_pakai}`).join(', ') || '';
        return `Tanggal: ${med.tanggal}\nObat: ${obatList}`;
      }).join('\n') || '';

      const medicationPulangText = visit.medicationsRequestPulang?.map((med: any) => {
        const obatList = med.obat?.map((o: any) => `${o.nama} - ${o.jumlah} - ${o.aturan_pakai}`).join(', ') || '';
        return `Tanggal: ${med.tanggal}\nObat Pulang: ${obatList}`;
      }).join('\n') || '';

      const medicationIbsText = visit.medicationsRequestIbs?.map((med: any) => {
        const obatList = med.obat?.map((o: any) => `${o.nama} - ${o.jumlah} - ${o.aturan_pakai}`).join(', ') || '';
        return `Tanggal: ${med.tanggal}\nObat IBS: ${obatList}`;
      }).join('\n') || '';

      // Add laboratory data
      const labText = visit.laboratoryRequest?.map((lab: any) => {
        const pemeriksaanList = lab.pemeriksaan?.map((p: any) => {
          const nama = p.nama || p.pemeriksaan || '';
          return `${nama}: ${p.hasil || 'Belum ada hasil'} (Rujukan: ${p.rujukan || '-'}) ${p.keterangan ? '- ' + p.keterangan : ''}`;
        }).join(', ') || '';
        return `Tanggal: ${lab.tanggal}\nLaboratorium: ${pemeriksaanList}`;
      }).join('\n') || '';

      // Add radiology data
      const radText = visit.radiology?.map((rad: any) => {
        return [
          `Tanggal: ${rad.tanggal || ''}`,
          `Radiologi: ${rad.pemeriksaan || ''} - ${rad.hasil || 'Belum ada hasil'}`,
          rad.saran ? `Saran: ${rad.saran}` : '',
          rad.kesan ? `Kesan: ${rad.kesan}` : '',
          rad.keterangan ? `Keterangan: ${rad.keterangan}` : ''
        ].filter(Boolean).join('\n');
      }).join('\n') || '';

      // Combine all data for AI
      const combinedText = [
        examinationText,
        medicationText && `\n\nRiwayat Obat:\n${medicationText}`,
        medicationPulangText && `\n\nObat Pulang:\n${medicationPulangText}`,
        medicationIbsText && `\n\nObat IBS:\n${medicationIbsText}`,
        labText && `\n\nRiwayat Laboratorium:\n${labText}`,
        radText && `\n\nRiwayat Radiologi:\n${radText}`
      ].filter(Boolean).join('');

      const response = await fetch(API_URLS.MEDICAL_SCRIBE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: combinedText,
          no_rkm_medis: medicalData?.patient?.no_rm || '',
          patient_name: medicalData?.patient?.nama || ''
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAiScribeResult(data.result || 'Tidak ada saran dari AI');
    } catch (error) {
      console.error('Error calling AI Scribe:', error);
      toast({
        title: "Error",
        description: "Gagal mendapatkan saran dari AI. Silakan coba lagi.",
        variant: "destructive"
      });
      setAiScribeResult('Terjadi kesalahan saat mendapatkan saran dari AI.');
    } finally {
      setAiScribeLoading(false);
    }
  };

  // Form helper functions
  const getMedicineFieldKey = (medIndex: number, obatIndex: number) => `${medIndex}-${obatIndex}`;
  const getCompoundMedicineFieldKey = (compoundIndex: number, racikanIndex: number) => `${compoundIndex}-${racikanIndex}`;

  const updateMedicationItem = (
    medIndex: number,
    obatIndex: number,
    updates: Partial<Medication['obat'][number]>
  ) => {
    setMedications((previous) => previous.map((medication, medicationIndex) => (
      medicationIndex === medIndex
        ? {
            ...medication,
            obat: medication.obat.map((item, itemIndex) => (
              itemIndex === obatIndex ? { ...item, ...updates } : item
            ))
          }
        : medication
    )));
  };

  const updateCompoundMedicineItem = (
    compoundIndex: number,
    racikanIndex: number,
    updates: Partial<RacikanMedicine>
  ) => {
    setCompoundPrescriptions((previous) => previous.map((compound, compoundPosition) => (
      compoundPosition === compoundIndex
        ? {
            ...compound,
            komposisi: compound.komposisi.map((item, itemPosition) => (
              itemPosition === racikanIndex ? { ...item, ...updates } : item
            ))
          }
        : compound
    )));
  };

  const resetMedicationForm = () => {
    setMedications(getDefaultMedicationForm(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan'));
    setMedicineOptions({});
    setMedicineSearchOpen({});
    setMedicineSearchQuery({});
    setMedicineSearchLoading({});
    setEditingPrescriptionNo(null);
    setPackageIsIbs(false);
  };

  const resetCompoundForm = () => {
    setCompoundPrescriptions([createDefaultCompoundPrescription()]);
    setCompoundMedicineOptions({});
    setCompoundMedicineSearchOpen({});
    setCompoundMedicineSearchQuery({});
    setCompoundMedicineSearchLoading({});
  };

  const addMedication = () => {
    setMedications([...medications, ...getDefaultMedicationForm(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan')]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleCopyResep = (med: any) => {
    const isFirstEmpty = medications.length === 1 && 
      medications[0].tanggal === getCurrentPrescriptionDate() && 
      medications[0].obat.length === 1 && 
      medications[0].obat[0].nama === '';

    const newMedication: Medication = {
      tanggal: getCurrentPrescriptionDate(),
      status: med.status || (statusRawat === 'Ranap' ? 'Ranap' : 'Ralan'),
      obat: (Array.isArray(med?.obat) ? med.obat : []).map((o: any) => ({
        kode_brng: o.kode_brng || '',
        nama: o.nama,
        jumlah: String(o.jumlah ?? ''),
        aturan_pakai: o.aturan_pakai,
        satuan: o.satuan || '',
        stok: Number(o.stok) || 0
      }))
    };

    const compoundItems = Array.isArray(med?.compounds)
      ? med.compounds.map((compound: any) => ({
          tanggal: getCurrentPrescriptionDate(),
          nama_racikan: compound.nama_racik || '',
          jumlah: String(compound.jml_dr ?? compound.jumlah ?? ''),
          kd_racik: compound.kd_racik || '',
          aturan_pakai: compound.aturan_pakai || '',
          keterangan: compound.keterangan || '',
          komposisi: (Array.isArray(compound.details) ? compound.details : []).map((detail: any) => ({
            kode_brng: detail.kode_brng || '',
            nama: detail.nama_brng || detail.nama || '',
            jumlah: String(detail.kandungan ?? detail.jumlah ?? ''),
            satuan: detail.satuan || '',
            stok: Number(detail.stok) || 0
          }))
        }))
      : [];
    const hasMedicineItems = newMedication.obat.length > 0;

    if (hasMedicineItems && isFirstEmpty) {
      setMedications([newMedication]);
    } else if (hasMedicineItems) {
      setMedications([...medications, newMedication]);
    }

    if (compoundItems.length > 0) {
      setCompoundPrescriptions(compoundItems);
      setIsCompoundFormOpen(true);
    }

    setEditingPrescriptionNo(null);
    setIsMedicationFormOpen(hasMedicineItems);
    setActiveTab('medications');
    
    toast({
      title: "Resep Disalin",
      description: "Data resep berhasil disalin ke form tambah resep.",
    });
  };

  const handleEditResep = async (med: any) => {
    if (!canEditPrescription(med)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya dokter pembuat resep yang dapat mengedit data ini.",
        variant: "destructive"
      });
      return;
    }

    if (!med?.no_resep) {
      toast({
        title: "Error",
        description: "Nomor resep tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await fetch(
        `${API_URLS.PRESCRIPTION_DATA}?action=get_prescription_details&no_resep=${encodeURIComponent(med.no_resep)}`
      );

      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.details ||
          responseJson?.error ||
          `HTTP error! status: ${response.status}`
        );
      }

      const detailMedicines = Array.isArray(responseJson.medicines) ? responseJson.medicines : [];

      if (!detailMedicines.length) {
        throw new Error('Detail obat untuk resep ini tidak ditemukan');
      }

      setMedications([{
        tanggal: getPrescriptionDateOnly(med.tanggal),
        status: med.status || mapPrescriptionSourceToStatus(med.source),
        obat: detailMedicines.map((item: any) => ({
          kode_brng: item.kode_brng || '',
          nama: item.nama_brng || item.nama || '',
          jumlah: String(item.jml ?? item.jumlah ?? ''),
          aturan_pakai: item.aturan_pakai || '',
          satuan: item.satuan || '',
          stok: Number(item.stok) || 0
        }))
      }]);
      setMedicineOptions({});
      setMedicineSearchOpen({});
      setMedicineSearchQuery({});
      setMedicineSearchLoading({});
      setEditingPrescriptionNo(med.no_resep);
      setIsMedicationFormOpen(true);
      setActiveTab('medications');

      toast({
        title: "Mode Edit Aktif",
        description: `Resep ${med.no_resep} dimuat ke form edit.`,
      });
    } catch (error) {
      console.error('Error loading prescription details:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Gagal memuat detail resep',
        variant: "destructive"
      });
    }
  };

  const handleDeleteResep = async (med: any) => {
    if (!canDeletePrescription(med)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya dokter pembuat resep yang dapat menghapus data ini.",
        variant: "destructive"
      });
      return;
    }

    if (!med?.no_resep) {
      toast({
        title: "Error",
        description: "Nomor resep tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus resep ${med.no_resep}?`)) {
      return;
    }

    try {
      setDeletingPrescriptionNo(med.no_resep);

      const response = await fetch(API_URLS.PRESCRIPTION_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete_prescription',
          no_resep: med.no_resep,
          username: currentUsername
        })
      });

      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.details ||
          responseJson?.error ||
          `HTTP error! status: ${response.status}`
        );
      }

      if (editingPrescriptionNo === med.no_resep) {
        resetMedicationForm();
      }

      toast({
        title: "Berhasil",
        description: `Resep ${med.no_resep} berhasil dihapus`,
      });

      await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
    } catch (error) {
      console.error('Error deleting prescription:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Gagal menghapus resep',
        variant: "destructive"
      });
    } finally {
      setDeletingPrescriptionNo(null);
    }
  };

  const addCompoundPrescription = () => {
    setCompoundPrescriptions([...compoundPrescriptions, createDefaultCompoundPrescription()]);
  };

  const removeCompoundPrescription = (index: number) => {
    setCompoundPrescriptions(compoundPrescriptions.filter((_, i) => i !== index));
  };

  const addRacikanMedicine = (prescriptionIndex: number) => {
    const newPrescriptions = [...compoundPrescriptions];
    newPrescriptions[prescriptionIndex].komposisi.push(createEmptyRacikanMedicine());
    setCompoundPrescriptions(newPrescriptions);
  };

  const removeRacikanMedicine = (prescriptionIndex: number, medicineIndex: number) => {
    const newPrescriptions = [...compoundPrescriptions];
    newPrescriptions[prescriptionIndex].komposisi = newPrescriptions[prescriptionIndex].komposisi.filter((_, i) => i !== medicineIndex);
    setCompoundPrescriptions(newPrescriptions);
  };

  const addLabTest = () => {
    setLabTests([...labTests, {
      kode: '',
      pemeriksaan: '',
      hasil: '',
      rujukan: '',
      keterangan: ''
    }]);
  };

  const removeLabTest = (index: number) => {
    const reindexState = <T,>(state: Record<number, T>) => {
      return Object.entries(state).reduce<Record<number, T>>((result, [key, value]) => {
        const numericKey = Number(key);

        if (numericKey < index) {
          result[numericKey] = value;
        } else if (numericKey > index) {
          result[numericKey - 1] = value;
        }

        return result;
      }, {});
    };

    setLabTests(labTests.filter((_, i) => i !== index));
    setLabServiceSearchOpen((previous) => reindexState(previous));
    setLabServiceSearchQuery((previous) => reindexState(previous));
    setLabTemplatesByIndex((previous) => reindexState(previous));
    setLabTemplateLoadingByIndex((previous) => reindexState(previous));
  };

  const resetLabForm = () => {
    setLabTests(getDefaultLabRequestForm());
    setLabServiceSearchOpen({});
    setLabServiceSearchQuery({});
    setLabTemplatesByIndex({});
    setLabTemplateLoadingByIndex({});
    setLabKlinis('');
    setLabStatusRawat(defaultExaminationStatusRawat as LabStatusRawat);
    setEditingLabRequestNo(null);
    setLabFormNoRawat('');
  };

  const handleLabStatusRawatChange = (value: LabStatusRawat) => {
    setLabStatusRawat(value);
    setLabTests(getDefaultLabRequestForm());
    setLabServiceSearchOpen({});
    setLabServiceSearchQuery({});
    setLabTemplatesByIndex({});
    setLabTemplateLoadingByIndex({});
  };

  const addProcedure = () => {
    setProcedures([...procedures, {
      kode: '',
      nama: '',
      hasil: ''
    }]);
  };

  const removeProcedure = (index: number) => {
    const reindexState = <T,>(state: Record<number, T>) => {
      return Object.entries(state).reduce<Record<number, T>>((result, [key, value]) => {
        const numericKey = Number(key);

        if (numericKey < index) {
          result[numericKey] = value;
        } else if (numericKey > index) {
          result[numericKey - 1] = value;
        }

        return result;
      }, {});
    };

    setProcedures(procedures.filter((_, i) => i !== index));
    setProcedureOptions((previous) => reindexState(previous));
    setProcedureSearchOpen((previous) => reindexState(previous));
    setProcedureSearchQuery((previous) => reindexState(previous));
    setProcedureSearchLoading((previous) => reindexState(previous));
  };

  const updateProcedure = (index: number, updates: Partial<ProcedureFormItem>) => {
    setProcedures((previous) => previous.map((procedure, procedureIndex) => (
      procedureIndex === index ? { ...procedure, ...updates } : procedure
    )));
  };

  const resetProcedureForm = () => {
    setProcedures(getDefaultProcedureForm());
    setProcedureOptions({});
    setProcedureSearchOpen({});
    setProcedureSearchQuery({});
    setProcedureSearchLoading({});
    setProcedureStatusRawat(defaultExaminationStatusRawat as ProcedureStatusRawat);
  };

  const handleProcedureStatusRawatChange = (value: ProcedureStatusRawat) => {
    setProcedureStatusRawat(value);
    setProcedures(getDefaultProcedureForm());
    setProcedureOptions({});
    setProcedureSearchOpen({});
    setProcedureSearchQuery({});
    setProcedureSearchLoading({});
  };

  const fetchMedicineOptions = useCallback(async (medIndex: number, obatIndex: number, searchText = '') => {
    const key = getMedicineFieldKey(medIndex, obatIndex);
    const selectedPrescriptionStatus = medications[medIndex]?.status || (statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');

    try {
      setMedicineSearchLoading((previous) => ({ ...previous, [key]: true }));

      const params = new URLSearchParams({
        action: 'search_medicines',
        search: searchText,
        limit: '20'
      });

      if (formattedNoRawat) {
        params.set('no_rawat', formattedNoRawat);
        params.set('prescription_status', selectedPrescriptionStatus);
      }

      const response = await fetch(`${API_URLS.PRESCRIPTION_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setMedicineOptions((previous) => ({
        ...previous,
        [key]: responseJson.data || []
      }));
    } catch (error) {
      console.error('Error fetching medicine options:', error);
      setMedicineOptions((previous) => ({ ...previous, [key]: [] }));
    } finally {
      setMedicineSearchLoading((previous) => ({ ...previous, [key]: false }));
    }
  }, [formattedNoRawat, medications, statusRawat]);

  const fetchCompoundMedicineOptions = useCallback(async (compoundIndex: number, racikanIndex: number, searchText = '') => {
    const key = getCompoundMedicineFieldKey(compoundIndex, racikanIndex);
    const selectedPrescriptionStatus = medications[0]?.status || (statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');

    try {
      setCompoundMedicineSearchLoading((previous) => ({ ...previous, [key]: true }));

      const params = new URLSearchParams({
        action: 'search_medicines',
        search: searchText,
        limit: '20'
      });

      if (formattedNoRawat) {
        params.set('no_rawat', formattedNoRawat);
        params.set('prescription_status', selectedPrescriptionStatus);
      }

      const response = await fetch(`${API_URLS.PRESCRIPTION_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setCompoundMedicineOptions((previous) => ({
        ...previous,
        [key]: responseJson.data || []
      }));
    } catch (error) {
      console.error('Error fetching compound medicine options:', error);
      setCompoundMedicineOptions((previous) => ({ ...previous, [key]: [] }));
    } finally {
      setCompoundMedicineSearchLoading((previous) => ({ ...previous, [key]: false }));
    }
  }, [formattedNoRawat, medications, statusRawat]);

  const fetchCompoundMethods = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        action: 'get_compound_methods'
      });

      const response = await fetch(`${API_URLS.PRESCRIPTION_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setCompoundMethods(Array.isArray(responseJson.data) ? responseJson.data : []);
    } catch (error) {
      console.error('Error fetching compound methods:', error);
      setCompoundMethods([]);
    }
  }, []);

  useEffect(() => {
    void fetchCompoundMethods();
  }, [fetchCompoundMethods]);

  const resetAllergyForm = useCallback(() => {
    setAllergyCategory('');
    setAllergySearchOpen(false);
    setAllergySearchQuery('');
    setAllergySearchLoading(false);
    setAllergyOptions([]);
    setSelectedAllergyOption(null);
    setManualFoodAllergy('');
    setManualEnvironmentAllergy('');
  }, []);

  const fetchAllergyHistory = useCallback(async () => {
    if (!no_rkm_medis) {
      setAllergyHistory([]);
      return;
    }

    try {
      setAllergyHistoryLoading(true);
      const params = new URLSearchParams({
        action: 'list',
        no_rkm_medis
      });

      const response = await fetch(`${API_URLS.ALLERGY_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setAllergyHistory(Array.isArray(responseJson.data) ? responseJson.data : []);
    } catch (error) {
      console.error('Error fetching allergy history:', error);
      setAllergyHistory([]);
    } finally {
      setAllergyHistoryLoading(false);
    }
  }, [no_rkm_medis]);

  const fetchAllergyOptions = useCallback(async (category: AllergyCategory, searchText = '') => {
    try {
      setAllergySearchLoading(true);
      const params = new URLSearchParams({
        action: 'search_options',
        category,
        search: searchText,
        limit: '20'
      });

      const response = await fetch(`${API_URLS.ALLERGY_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setAllergyOptions(Array.isArray(responseJson.data) ? responseJson.data : []);
    } catch (error) {
      console.error('Error fetching allergy options:', error);
      setAllergyOptions([]);
    } finally {
      setAllergySearchLoading(false);
    }
  }, []);

  const warnIfAllergicMedicationCodes = useCallback(async (codes: string[] = []) => {
    const normalizedNoRm = String(no_rkm_medis || '').trim();
    const normalizedCodes = Array.from(
      new Set(
        codes
          .map((code) => String(code || '').trim())
          .filter(Boolean)
      )
    );

    if (!normalizedNoRm || normalizedCodes.length === 0) {
      return true;
    }

    try {
      const params = new URLSearchParams({
        action: 'list',
        no_rkm_medis: normalizedNoRm
      });

      const response = await fetch(`${API_URLS.ALLERGY_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        return true;
      }

      const allergyItems = Array.isArray(responseJson?.data) ? responseJson.data : [];
      const matchedItems = allergyItems.filter((item: any) => (
        String(item?.kategori || '').trim() === 'Obat' &&
        normalizedCodes.includes(String(item?.kode_brng || '').trim())
      ));

      if (matchedItems.length > 0) {
        return window.confirm('Peringatan Pasien Alergi dengan Obat ini. Lanjutkan simpan resep?');
      }
    } catch (error) {
      console.error('Error checking allergic medication codes:', error);
    }

    return true;
  }, [no_rkm_medis]);

  const handleSaveAllergy = useCallback(async () => {
    if (!no_rkm_medis) {
      toast({
        title: "Error",
        description: "Nomor rekam medis pasien tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    if (!allergyCategory) {
      toast({
        title: "Error",
        description: "Pilih kategori alergi terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    try {
      setSavingAllergy(true);
      const response = await fetch(API_URLS.ALLERGY_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rkm_medis,
          kategori: allergyCategory,
          kode_alergi: selectedAllergyOption?.id || '',
          makanan_manual: manualFoodAllergy,
          lingkungan_manual: manualEnvironmentAllergy,
          username: user?.username || ''
        })
      });

      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Berhasil",
        description: responseJson?.message || 'Alergi berhasil disimpan'
      });

      await Promise.all([
        fetchAllergyHistory(),
        fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 })
      ]);
      resetAllergyForm();
    } catch (error) {
      console.error('Error saving allergy:', error);
      const message = error instanceof Error ? error.message : 'Gagal menyimpan alergi';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setSavingAllergy(false);
    }
  }, [
    allergyCategory,
    fetchAllergyHistory,
    fetchMedicalRecord,
    manualEnvironmentAllergy,
    manualFoodAllergy,
    no_rkm_medis,
    resetAllergyForm,
    selectedAllergyOption,
    toast,
    user?.username
  ]);

  const handleSaveWhatsapp = useCallback(async () => {
    if (!no_rkm_medis) {
      toast({
        title: "Error",
        description: "Nomor rekam medis pasien tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    if (!whatsappNumber.trim()) {
      toast({
        title: "Error",
        description: "Nomor WhatsApp wajib diisi",
        variant: "destructive"
      });
      return;
    }

    try {
      setSavingWhatsapp(true);
      const response = await fetch(API_URLS.PATIENT_CONTACT, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rkm_medis,
          no_tlp: whatsappNumber.trim()
        })
      });

      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Berhasil",
        description: responseJson?.message || 'Nomor WhatsApp berhasil diperbarui'
      });

      setIsWhatsappModalOpen(false);
      await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
    } catch (error) {
      console.error('Error saving patient whatsapp:', error);
      const message = error instanceof Error ? error.message : 'Gagal memperbarui nomor WhatsApp';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setSavingWhatsapp(false);
    }
  }, [
    fetchMedicalRecord,
    no_rkm_medis,
    toast,
    whatsappNumber
  ]);

  const handleSendWhatsappMessage = useCallback(async () => {
    if (!whatsappNumber.trim()) {
      toast({
        title: "Error",
        description: "Nomor WhatsApp wajib diisi",
        variant: "destructive"
      });
      return;
    }

    if (!whatsappMessage.trim()) {
      toast({
        title: "Error",
        description: "Pesan WhatsApp wajib diisi",
        variant: "destructive"
      });
      return;
    }

    try {
      setSendingWhatsappMessage(true);
      const response = await fetch(API_URLS.PATIENT_CONTACT_MESSAGE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_tlp: whatsappNumber.trim(),
          message: whatsappMessage.trim()
        })
      });

      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Berhasil",
        description: responseJson?.message || 'Pesan WhatsApp berhasil dikirim'
      });
      setWhatsappMessage('');
    } catch (error) {
      console.error('Error sending patient whatsapp message:', error);
      const message = error instanceof Error ? error.message : 'Gagal mengirim pesan WhatsApp';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setSendingWhatsappMessage(false);
    }
  }, [
    toast,
    whatsappMessage,
    whatsappNumber
  ]);

  const fetchRehabMedikAccess = useCallback(async () => {
    if (!currentUsername) {
      setRehabMedikAccess(false);
      return;
    }

    try {
      setRehabMedikAccessLoading(true);
      const response = await fetch(
        `${API_URLS.ASSESMEN_REHAB_MEDIK_ACCESS}/${encodeURIComponent(currentUsername)}`
      );
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setRehabMedikAccess(Boolean(responseJson?.can_access));
    } catch (error) {
      console.error('Error checking assesmen rehab medik access:', error);
      setRehabMedikAccess(false);
    } finally {
      setRehabMedikAccessLoading(false);
    }
  }, [currentUsername]);

  const fetchRehabMedikData = useCallback(async () => {
    if (!formattedNoRawat || !currentUsername || !rehabMedikAccess) {
      setRehabMedikCurrentEntries([]);
      setRehabMedikHistoryEntries([]);
      return;
    }

    try {
      setRehabMedikLoading(true);
      const params = new URLSearchParams({
        username: currentUsername
      });
      const response = await fetch(
        `${API_URLS.ASSESMEN_REHAB_MEDIK}/${encodeURIComponent(formattedNoRawat)}?${params.toString()}`
      );
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setRehabMedikCurrentEntries(Array.isArray(responseJson?.current) ? responseJson.current : []);
      setRehabMedikHistoryEntries(Array.isArray(responseJson?.history) ? responseJson.history : []);
    } catch (error) {
      console.error('Error fetching assesmen rehab medik:', error);
      setRehabMedikCurrentEntries([]);
      setRehabMedikHistoryEntries([]);
    } finally {
      setRehabMedikLoading(false);
    }
  }, [currentUsername, formattedNoRawat, rehabMedikAccess]);

  const handleCopyRehabMedik = useCallback((item: RehabMedikAssessment) => {
    setRehabMedikForm({
      anamnesa: item.anamnesa || '',
      pemeriksaan_fisik: item.pemeriksaan_fisik || '',
      diagnosa_fungsi: item.diagnosa_fungsi || '',
      anjuran: item.anjuran || '',
      evaluasi: item.evaluasi || '',
      hasil: item.hasil || '',
      kesimpulan: item.kesimpulan || '',
      rekomendasi: item.rekomendasi || '',
      suspek_penyakit: item.suspek_penyakit === 'Ya' ? 'Ya' : 'Tidak'
    });

    toast({
      title: "Data Disalin",
      description: "Assesmen rehab medik berhasil disalin ke form"
    });
  }, [toast]);

  const handleSaveRehabMedik = useCallback(async () => {
    if (!formattedNoRawat) {
      toast({
        title: "Error",
        description: "Pilih kunjungan terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    if (!rehabMedikAccess) {
      toast({
        title: "Error",
        description: "Anda tidak memiliki akses ke assesmen rehab medik",
        variant: "destructive"
      });
      return;
    }

    try {
      setSavingRehabMedik(true);
      const response = await fetch(API_URLS.ASSESMEN_REHAB_MEDIK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: currentUsername,
          no_rawat: formattedNoRawat,
          ...rehabMedikForm
        })
      });

      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Berhasil",
        description: responseJson?.message || 'Assesmen rehab medik berhasil disimpan'
      });

      await fetchRehabMedikData();
    } catch (error) {
      console.error('Error saving assesmen rehab medik:', error);
      const message = error instanceof Error ? error.message : 'Gagal menyimpan assesmen rehab medik';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setSavingRehabMedik(false);
    }
  }, [
    currentUsername,
    fetchRehabMedikData,
    formattedNoRawat,
    rehabMedikAccess,
    rehabMedikForm,
    toast
  ]);

  const handleDeleteRehabMedik = useCallback(async () => {
    if (!formattedNoRawat || !rehabMedikAccess) {
      return;
    }

    try {
      setDeletingRehabMedik(true);
      const params = new URLSearchParams({
        username: currentUsername
      });
      const response = await fetch(
        `${API_URLS.ASSESMEN_REHAB_MEDIK}/${encodeURIComponent(formattedNoRawat)}?${params.toString()}`,
        {
          method: 'DELETE'
        }
      );
      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Berhasil",
        description: responseJson?.message || 'Assesmen rehab medik berhasil dihapus'
      });

      setRehabMedikForm(getDefaultRehabMedikForm());
      await fetchRehabMedikData();
    } catch (error) {
      console.error('Error deleting assesmen rehab medik:', error);
      const message = error instanceof Error ? error.message : 'Gagal menghapus assesmen rehab medik';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setDeletingRehabMedik(false);
    }
  }, [currentUsername, fetchRehabMedikData, formattedNoRawat, rehabMedikAccess, toast]);

  const fetchBalanceCairan = useCallback(async () => {
    if (!formattedNoRawat) {
      setBalanceCairanEntries([]);
      setSelectedBalanceCairanId(null);
      return;
    }

    try {
      setBalanceCairanLoading(true);
      const response = await fetch(`${API_URLS.BALANCE_CAIRAN}/${encodeURIComponent(formattedNoRawat)}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      const entries = Array.isArray(responseJson.data) ? responseJson.data : [];
      setBalanceCairanEntries(entries);
      setSelectedBalanceCairanId((previous) => (
        previous && entries.some((entry) => Number(entry.id) === Number(previous))
          ? previous
          : null
      ));
    } catch (error) {
      console.error('Error fetching balance cairan:', error);
      setBalanceCairanEntries([]);
      setSelectedBalanceCairanId(null);
    } finally {
      setBalanceCairanLoading(false);
    }
  }, [formattedNoRawat]);

  const handleSaveBalanceCairan = useCallback(async () => {
    if (!formattedNoRawat) {
      toast({
        title: "Error",
        description: "Pilih kunjungan rawat inap terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    if (!selectedBalanceCairanId) {
      toast({
        title: "Error",
        description: "Pilih intake balance cairan terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    try {
      setSavingBalanceCairan(true);
      const response = await fetch(API_URLS.BALANCE_CAIRAN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedBalanceCairanId,
          no_rawat: formattedNoRawat,
          user: String(user?.name || currentUsername || '').trim(),
          muntah: balanceCairanForm.muntah,
          urine: balanceCairanForm.urine,
          bab: balanceCairanForm.bab
        })
      });

      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Berhasil",
        description: responseJson?.message || 'Balance cairan berhasil disimpan'
      });

      setBalanceCairanForm({
        muntah: '',
        urine: '',
        bab: ''
      });
      setSelectedBalanceCairanId(null);
      await fetchBalanceCairan();
    } catch (error) {
      console.error('Error saving balance cairan:', error);
      const message = error instanceof Error ? error.message : 'Gagal menyimpan balance cairan';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setSavingBalanceCairan(false);
    }
  }, [
    balanceCairanForm.bab,
    balanceCairanForm.muntah,
    balanceCairanForm.urine,
    currentUsername,
    fetchBalanceCairan,
    formattedNoRawat,
    selectedBalanceCairanId,
    toast,
    user?.name
  ]);

  const handleSaveEkstrapiramidal = useCallback(async () => {
    if (!formattedNoRawat) {
      toast({
        title: "Error",
        description: "Pilih kunjungan rawat inap terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    try {
      setSavingEkstrapiramidal(true);
      const response = await fetch(API_URLS.EKSTRAPIRAMIDAL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rawat: formattedNoRawat,
          dokter: String(user?.name || currentUsername || '').trim(),
          ...ekstrapiramidalForm
        })
      });

      const responseJson = await response.json().catch(() => null);
      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      toast({
        title: "Berhasil",
        description: responseJson?.message || 'Ekstrapiramidal berhasil disimpan'
      });

      await fetchMedicalRecord({
        reset: false,
        outpatientPage: pagination.outpatient.page,
        inpatientPage: pagination.inpatient.page,
        includeOutpatient: false,
        includeInpatient: false,
        includeFocusedExaminations: true,
        requestScope: 'focused'
      });
    } catch (error) {
      console.error('Error saving ekstrapiramidal:', error);
      const message = error instanceof Error ? error.message : 'Gagal menyimpan ekstrapiramidal';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setSavingEkstrapiramidal(false);
    }
  }, [
    currentUsername,
    ekstrapiramidalForm,
    fetchMedicalRecord,
    formattedNoRawat,
    pagination.inpatient.page,
    pagination.outpatient.page,
    toast,
    user?.name
  ]);

  useEffect(() => {
    void fetchRehabMedikAccess();
  }, [fetchRehabMedikAccess]);

  useEffect(() => {
    if (!formattedNoRawat) {
      setRehabMedikForm(getDefaultRehabMedikForm());
      setRehabMedikCurrentEntries([]);
      setRehabMedikHistoryEntries([]);
      return;
    }

    setRehabMedikForm(getDefaultRehabMedikForm());
  }, [formattedNoRawat]);

  useEffect(() => {
    if (formattedNoRawat && rehabMedikAccess) {
      void fetchRehabMedikData();
      return;
    }

    setRehabMedikCurrentEntries([]);
    setRehabMedikHistoryEntries([]);
  }, [fetchRehabMedikData, formattedNoRawat, rehabMedikAccess]);

  useEffect(() => {
    if (formattedNoRawat) {
      void fetchBalanceCairan();
      return;
    }

    setBalanceCairanEntries([]);
    setSelectedBalanceCairanId(null);
  }, [fetchBalanceCairan, formattedNoRawat]);

  useEffect(() => {
    if (!formattedNoRawat) {
      setEkstrapiramidalForm(getDefaultEkstrapiramidalForm());
      return;
    }

    const hasil = medicalData?.focused_ekstrapiramidal?.hasil;
    if (hasil && typeof hasil === 'object') {
      setEkstrapiramidalForm({
        ...getDefaultEkstrapiramidalForm(),
        ...(hasil as Record<string, string>)
      });
      return;
    }

    setEkstrapiramidalForm(getDefaultEkstrapiramidalForm());
  }, [formattedNoRawat, medicalData?.focused_ekstrapiramidal]);

  const fetchPackageOptions = useCallback(async (searchText = '') => {
    try {
      setPackageSearchLoading(true);

      const params = new URLSearchParams({
        action: 'search_packages',
        search: searchText,
        limit: '20'
      });

      const response = await fetch(`${API_URLS.PRESCRIPTION_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setPackageOptions(Array.isArray(responseJson.data) ? responseJson.data : []);
    } catch (error) {
      console.error('Error fetching package options:', error);
      setPackageOptions([]);
    } finally {
      setPackageSearchLoading(false);
    }
  }, []);

  const loadPackageItems = useCallback(async () => {
    if (!formattedNoRawat) {
      toast({
        title: "Error",
        description: "Pilih kunjungan pasien terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    if (!selectedPackageId) {
      toast({
        title: "Error",
        description: "Pilih paket obat terlebih dahulu",
        variant: "destructive"
      });
      return;
    }

    try {
      setPackageItemsLoading(true);

      const params = new URLSearchParams({
        action: 'get_package_items',
        package_id: selectedPackageId,
        no_rawat: formattedNoRawat,
        prescription_status: packageIsIbs ? 'IBS' : (statusRawat === 'Ranap' ? 'Ranap' : 'Ralan')
      });

      const response = await fetch(`${API_URLS.PRESCRIPTION_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setPackageItems(Array.isArray(responseJson.data) ? responseJson.data : []);
    } catch (error) {
      console.error('Error fetching package items:', error);
      const message = error instanceof Error ? error.message : 'Gagal memuat item paket';
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
      setPackageItems([]);
    } finally {
      setPackageItemsLoading(false);
    }
  }, [formattedNoRawat, packageIsIbs, selectedPackageId, statusRawat, toast]);

  const applyPackageItemsToMedicationForm = useCallback(() => {
    if (!packageItems.length) {
      toast({
        title: "Error",
        description: "Item paket masih kosong",
        variant: "destructive"
      });
      return;
    }

    const currentPrescriptionStatus: PrescriptionStatus = packageIsIbs
      ? 'IBS'
      : (statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');
    const obatItems = packageItems.map((item) => ({
      kode_brng: String(item.kode_brng || '').trim(),
      nama: String(item.nama_brng || '').trim(),
      jumlah: String(item.jumlah ?? ''),
      aturan_pakai: String(item.aturan_pakai || '').trim(),
      satuan: String(item.satuan || '').trim(),
      stok: Number(item.stok) || 0
    }));

    setMedications((previous) => {
      const next = [...previous];
      const targetIndex = 0;
      const target = next[targetIndex] || getDefaultMedicationForm(currentPrescriptionStatus)[0];

      const isTargetEmpty = target.obat.length === 1 && !String(target.obat[0].nama || '').trim();
      const mergedObat = isTargetEmpty ? obatItems : [...target.obat, ...obatItems];

      next[targetIndex] = {
        ...target,
        status: currentPrescriptionStatus,
        obat: mergedObat
      };

      return next;
    });

    setIsMedicationFormOpen(true);

    toast({
      title: "Berhasil",
      description: currentPrescriptionStatus === 'IBS'
        ? 'Item paket IBS berhasil dimasukkan ke form resep obat'
        : 'Item paket berhasil dimasukkan ke form resep obat'
    });
  }, [packageIsIbs, packageItems, statusRawat, toast]);

  const fetchProcedureOptions = useCallback(async (index: number, searchText = '') => {
    if (!formattedNoRawat) {
      setProcedureOptions((previous) => ({ ...previous, [index]: [] }));
      return;
    }

    try {
      setProcedureSearchLoading((previous) => ({ ...previous, [index]: true }));

      const params = new URLSearchParams({
        no_rawat: formattedNoRawat,
        status_rawat: procedureStatusRawat,
        search: searchText,
        limit: '20'
      });

      const response = await fetch(`${API_URLS.PROCEDURE_OPTIONS}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setProcedureOptions((previous) => ({
        ...previous,
        [index]: responseJson.data || []
      }));
    } catch (error) {
      console.error('Error fetching procedure options:', error);
      setProcedureOptions((previous) => ({ ...previous, [index]: [] }));
    } finally {
      setProcedureSearchLoading((previous) => ({ ...previous, [index]: false }));
    }
  }, [formattedNoRawat, procedureStatusRawat]);

  const fetchLabServiceOptions = useCallback(async () => {
    try {
      setLabServiceSearchLoading(true);

      const params = new URLSearchParams({
        action: 'get_lab_services'
      });
      const response = await fetch(`${API_URLS.LABORATORY_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setLabServiceOptions(Array.isArray(responseJson) ? responseJson : []);
    } catch (error) {
      console.error('Error fetching laboratory service options:', error);
      setLabServiceOptions([]);
    } finally {
      setLabServiceSearchLoading(false);
    }
  }, []);

  const fetchLabTemplates = useCallback(async (index: number, kdJenisPrw: string) => {
    const normalizedKode = String(kdJenisPrw || '').trim();

    if (!normalizedKode) {
      setLabTemplatesByIndex((previous) => ({ ...previous, [index]: [] }));
      return;
    }

    try {
      setLabTemplateLoadingByIndex((previous) => ({ ...previous, [index]: true }));

      const params = new URLSearchParams({
        action: 'get_lab_templates',
        kd_jenis_prw: normalizedKode
      });
      const response = await fetch(`${API_URLS.LABORATORY_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setLabTemplatesByIndex((previous) => ({
        ...previous,
        [index]: Array.isArray(responseJson) ? responseJson : []
      }));
    } catch (error) {
      console.error('Error fetching laboratory templates:', error);
      setLabTemplatesByIndex((previous) => ({ ...previous, [index]: [] }));
    } finally {
      setLabTemplateLoadingByIndex((previous) => ({ ...previous, [index]: false }));
    }
  }, []);

  const addRadTest = () => {
    setRadTests([...radTests, {
      pemeriksaan: '',
      hasil: '',
      kesan: ''
    }]);
  };

  const removeRadTest = (index: number) => {
    setRadTests(radTests.filter((_, i) => i !== index));
  };

  const addRadiology = () => {
    setRadiologies([...radiologies, { kode: '', pemeriksaan: '' }]);
  };

  const removeRadiology = (index: number) => {
    const reindexState = <T,>(state: Record<number, T>) => {
      return Object.entries(state).reduce<Record<number, T>>((result, [key, value]) => {
        const numericKey = Number(key);

        if (numericKey < index) {
          result[numericKey] = value;
        } else if (numericKey > index) {
          result[numericKey - 1] = value;
        }

        return result;
      }, {});
    };

    setRadiologies(radiologies.filter((_, i) => i !== index));
    setRadiologySearchOpen((previous) => reindexState(previous));
    setRadiologySearchQuery((previous) => reindexState(previous));
  };

  const resetRadiologyForm = () => {
    setRadiologies(getDefaultRadiologyRequestForm());
    setRadiologySearchOpen({});
    setRadiologySearchQuery({});
    setRadiologyKlinis('');
    setRadiologyStatusRawat(defaultExaminationStatusRawat as RadiologyStatusRawat);
    setEditingRadiologyRequestNo(null);
    setRadiologyFormNoRawat('');
  };

  const handleRadiologyStatusRawatChange = (value: RadiologyStatusRawat) => {
    setRadiologyStatusRawat(value);
    setRadiologies(getDefaultRadiologyRequestForm());
    setRadiologySearchOpen({});
    setRadiologySearchQuery({});
  };

  const fetchRadiologyServiceOptions = useCallback(async () => {
    try {
      setRadiologySearchLoading(true);

      const params = new URLSearchParams({
        action: 'get_radiology_services'
      });
      const response = await fetch(`${API_URLS.RADIOLOGY_DATA}?${params.toString()}`);
      const responseJson = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          responseJson?.error || `HTTP error! status: ${response.status}`
        );
      }

      setRadiologyServiceOptions(Array.isArray(responseJson) ? responseJson : []);
    } catch (error) {
      console.error('Error fetching radiology service options:', error);
      setRadiologyServiceOptions([]);
    } finally {
      setRadiologySearchLoading(false);
    }
  }, []);

  const handleCopyLabRequest = (lab: any) => {
    const tests = Array.isArray(lab?.pemeriksaan) ? lab.pemeriksaan : [];

    if (!tests.length) {
      toast({
        title: "Error",
        description: "Data pemeriksaan laboratorium tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    setLabTests(tests.map((test: any) => ({
      kode: test.kode || '',
      pemeriksaan: test.nama || '',
      hasil: '',
      rujukan: '',
      keterangan: ''
    })));
    const copiedTemplatesByIndex: Record<number, any[]> = {};
    tests.forEach((test: any, index: number) => {
      copiedTemplatesByIndex[index] = Array.isArray(test.templates) ? test.templates : [];
    });
    setLabTemplatesByIndex(copiedTemplatesByIndex);
    setLabServiceSearchOpen({});
    const copiedQueries: Record<number, string> = {};
    tests.forEach((test: any, index: number) => {
      copiedQueries[index] = test.nama || '';
    });
    setLabServiceSearchQuery(copiedQueries);
    setLabTemplateLoadingByIndex({});
    setLabStatusRawat(mapRequestSourceToStatusRawat(lab.source));
    setLabKlinis(String(lab.klinis || ''));
    setEditingLabRequestNo(null);
    setLabFormNoRawat(lab.no_rawat || '');
    setIsLabFormOpen(true);
    setActiveTab('laboratory');

    toast({
      title: "Permintaan Lab Disalin",
      description: "Data permintaan laboratorium berhasil disalin ke form.",
    });
  };

  const handleEditLabRequest = (lab: any) => {
    if (!canEditLabRequest(lab)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya dokter perujuk yang dapat mengedit permintaan laboratorium ini.",
        variant: "destructive"
      });
      return;
    }

    if (!lab?.noorder) {
      toast({
        title: "Error",
        description: "Nomor order laboratorium tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    const tests = Array.isArray(lab?.pemeriksaan) ? lab.pemeriksaan : [];

    if (!tests.length) {
      toast({
        title: "Error",
        description: "Detail pemeriksaan laboratorium tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    setLabTests(tests.map((test: any) => ({
      kode: test.kode || '',
      pemeriksaan: test.nama || '',
      hasil: '',
      rujukan: '',
      keterangan: ''
    })));
    const editTemplatesByIndex: Record<number, any[]> = {};
    tests.forEach((test: any, index: number) => {
      editTemplatesByIndex[index] = Array.isArray(test.templates) ? test.templates : [];
    });
    setLabTemplatesByIndex(editTemplatesByIndex);
    setLabServiceSearchOpen({});
    const editQueries: Record<number, string> = {};
    tests.forEach((test: any, index: number) => {
      editQueries[index] = test.nama || '';
    });
    setLabServiceSearchQuery(editQueries);
    setLabTemplateLoadingByIndex({});
    setLabStatusRawat(mapRequestSourceToStatusRawat(lab.source));
    setLabKlinis(String(lab.klinis || ''));
    setEditingLabRequestNo(lab.noorder);
    setLabFormNoRawat(lab.no_rawat || '');
    setIsLabFormOpen(true);
    setActiveTab('laboratory');

    toast({
      title: "Mode Edit Aktif",
      description: `Permintaan lab ${lab.noorder} dimuat ke form edit.`,
    });
  };

  const handleDeleteLabRequest = async (lab: any) => {
    if (!canDeleteLabRequest(lab)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya dokter perujuk yang dapat menghapus permintaan laboratorium ini.",
        variant: "destructive"
      });
      return;
    }

    if (!lab?.noorder) {
      toast({
        title: "Error",
        description: "Nomor order laboratorium tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus permintaan laboratorium ${lab.noorder}?`)) {
      return;
    }

    try {
      setDeletingLabRequestNo(lab.noorder);

      const response = await fetch(
        `${API_URLS.LABORATORY_DATA}?action=delete_lab_request&noorder=${encodeURIComponent(lab.noorder)}&username=${encodeURIComponent(currentUsername)}`,
        { method: 'DELETE' }
      );
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.details ||
          responseJson?.error ||
          `HTTP error! status: ${response.status}`
        );
      }

      if (editingLabRequestNo === lab.noorder) {
        resetLabForm();
      }

      toast({
        title: "Berhasil",
        description: `Permintaan laboratorium ${lab.noorder} berhasil dihapus`,
      });

      await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
    } catch (error) {
      console.error('Error deleting laboratory request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Gagal menghapus permintaan laboratorium',
        variant: "destructive"
      });
    } finally {
      setDeletingLabRequestNo(null);
    }
  };

  const handleCopyRadiologyRequest = (rad: any) => {
    const tests = Array.isArray(rad?.pemeriksaan) ? rad.pemeriksaan : [];

    if (!tests.length) {
      toast({
        title: "Error",
        description: "Data pemeriksaan radiologi tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    setRadiologies(tests.map((test: any) => ({
      kode: test.kode || '',
      pemeriksaan: test.nama || ''
    })));
    setRadiologySearchOpen({});
    const copiedQueries: Record<number, string> = {};
    tests.forEach((test: any, index: number) => {
      copiedQueries[index] = test.nama || '';
    });
    setRadiologySearchQuery(copiedQueries);
    setRadiologyStatusRawat(mapRequestSourceToStatusRawat(rad.source));
    setRadiologyKlinis(String(rad.klinis || ''));
    setEditingRadiologyRequestNo(null);
    setRadiologyFormNoRawat(rad.no_rawat || '');
    setIsRadiologyFormOpen(true);
    setActiveTab('radiology');

    toast({
      title: "Permintaan Radiologi Disalin",
      description: "Data permintaan radiologi berhasil disalin ke form.",
    });
  };

  const handleEditRadiologyRequest = (rad: any) => {
    if (!canEditRadiologyRequest(rad)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya dokter perujuk yang dapat mengedit permintaan radiologi ini.",
        variant: "destructive"
      });
      return;
    }

    if (!rad?.noorder) {
      toast({
        title: "Error",
        description: "Nomor order radiologi tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    const tests = Array.isArray(rad?.pemeriksaan) ? rad.pemeriksaan : [];

    if (!tests.length) {
      toast({
        title: "Error",
        description: "Detail pemeriksaan radiologi tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    setRadiologies(tests.map((test: any) => ({
      kode: test.kode || '',
      pemeriksaan: test.nama || ''
    })));
    setRadiologySearchOpen({});
    const editQueries: Record<number, string> = {};
    tests.forEach((test: any, index: number) => {
      editQueries[index] = test.nama || '';
    });
    setRadiologySearchQuery(editQueries);
    setRadiologyStatusRawat(mapRequestSourceToStatusRawat(rad.source));
    setRadiologyKlinis(String(rad.klinis || ''));
    setEditingRadiologyRequestNo(rad.noorder);
    setRadiologyFormNoRawat(rad.no_rawat || '');
    setIsRadiologyFormOpen(true);
    setActiveTab('radiology');

    toast({
      title: "Mode Edit Aktif",
      description: `Permintaan radiologi ${rad.noorder} dimuat ke form edit.`,
    });
  };

  const handleDeleteRadiologyRequest = async (rad: any) => {
    if (!canDeleteRadiologyRequest(rad)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya dokter perujuk yang dapat menghapus permintaan radiologi ini.",
        variant: "destructive"
      });
      return;
    }

    if (!rad?.noorder) {
      toast({
        title: "Error",
        description: "Nomor order radiologi tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    if (!confirm(`Apakah Anda yakin ingin menghapus permintaan radiologi ${rad.noorder}?`)) {
      return;
    }

    try {
      setDeletingRadiologyRequestNo(rad.noorder);

      const response = await fetch(
        `${API_URLS.RADIOLOGY_DATA}?action=delete_radiology_request&noorder=${encodeURIComponent(rad.noorder)}&username=${encodeURIComponent(currentUsername)}`,
        { method: 'DELETE' }
      );
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.details ||
          responseJson?.error ||
          `HTTP error! status: ${response.status}`
        );
      }

      if (editingRadiologyRequestNo === rad.noorder) {
        resetRadiologyForm();
      }

      toast({
        title: "Berhasil",
        description: `Permintaan radiologi ${rad.noorder} berhasil dihapus`,
      });

      await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
    } catch (error) {
      console.error('Error deleting radiology request:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Gagal menghapus permintaan radiologi',
        variant: "destructive"
      });
    } finally {
      setDeletingRadiologyRequestNo(null);
    }
  };

  const handleEditExamination = (examination: any, visit: any) => {
    if (!canEditExamination(examination)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya petugas yang membuat data pemeriksaan yang dapat mengeditnya.",
        variant: "destructive"
      });
      return;
    }

    setActiveTab('examinations');
    setIsExaminationFormOpen(true);
    setEditingExamination({
      ...examination,
      no_rawat: visit.no_rawat,
      status_lanjut: visit.status_lanjut,
      is_igd_visit: Boolean(visit.is_igd_visit)
    });
    setStatusRawat(mapStatusLanjutToStatusRawat(visit.status_lanjut));
    
    setExaminationForm({
      tgl_perawatan: examination.tgl_perawatan || '',
      jam_rawat: examination.jam_rawat || '',
      suhu: examination.suhu_tubuh || examination.suhu || '',
      tensi: examination.tensi || examination.tekanan_darah || '',
      nadi: examination.nadi || '',
      respirasi: examination.respirasi || '',
      tinggi: examination.tinggi || '',
      berat: examination.berat || '',
      spo2: examination.spo2 || '',
      gcs: examination.gcs || '',
      kesadaran: examination.kesadaran || '',
      keluhan: examination.keluhan || examination.s || '',
      pemeriksaan: examination.pemeriksaan || examination.o || '',
      rtl: examination.rtl || examination.p || '',
      penilaian: examination.penilaian || examination.a || '',
      instruksi: examination.instruksi || examination.i || '',
      evaluasi: examination.evaluasi || examination.e || '',
      nip: examination.nip || examination.pegawai || ''
    });
  };

  const handleCopyExaminationTTV = (examination: any) => {
    setActiveTab('examinations');
    setIsExaminationFormOpen(true);
    setExaminationForm((prev) => ({
      ...prev,
      ...getCurrentExaminationDateTime(),
      suhu: examination.suhu_tubuh || examination.suhu || '',
      tensi: examination.tensi || examination.tekanan_darah || '',
      nadi: examination.nadi || '',
      respirasi: examination.respirasi || '',
      tinggi: examination.tinggi || '',
      berat: examination.berat || '',
      spo2: examination.spo2 || '',
      gcs: examination.gcs || '',
      kesadaran: examination.kesadaran || '',
      nip: examination.nip || examination.pegawai || prev.nip || ''
    }));
    
    setEditingExamination(null);
    
    toast({
      title: "Data Disalin",
      description: "TTV berhasil disalin ke form tambah pemeriksaan",
    });
  };

  const handleCopyExaminationAll = (examination: any, rawatType: 'Ralan' | 'Ranap') => {
    setActiveTab('examinations');
    setIsExaminationFormOpen(true);

    const shouldCopyIE = rawatType === 'Ranap';

    setExaminationForm((prev) => ({
      ...getDefaultExaminationForm(),
      suhu: examination.suhu_tubuh || examination.suhu || '',
      tensi: examination.tensi || examination.tekanan_darah || '',
      nadi: examination.nadi || '',
      respirasi: examination.respirasi || '',
      tinggi: examination.tinggi || '',
      berat: examination.berat || '',
      spo2: examination.spo2 || '',
      gcs: examination.gcs || '',
      kesadaran: examination.kesadaran || '',
      keluhan: examination.keluhan || examination.s || '',
      pemeriksaan: examination.pemeriksaan || examination.o || '',
      rtl: examination.rtl || examination.p || '',
      penilaian: examination.penilaian || examination.a || '',
      instruksi: shouldCopyIE ? (examination.instruksi || examination.i || '') : '',
      evaluasi: shouldCopyIE ? (examination.evaluasi || examination.e || '') : '',
      nip: examination.nip || examination.pegawai || prev.nip || ''
    }));

    setEditingExamination(null);

    toast({
      title: "Data Disalin",
      description: "TTV dan SOAPIE berhasil disalin ke form tambah pemeriksaan",
    });
  };

  const handleCopyExaminationSOAPIE = (examination: any, rawatType: 'Ralan' | 'Ranap') => {
    setActiveTab('examinations');
    setIsExaminationFormOpen(true);

    const shouldCopyIE = rawatType === 'Ranap';

    setExaminationForm((prev) => ({
      ...prev,
      ...getCurrentExaminationDateTime(),
      keluhan: examination.keluhan || examination.s || '',
      pemeriksaan: examination.pemeriksaan || examination.o || '',
      rtl: examination.rtl || examination.p || '',
      penilaian: examination.penilaian || examination.a || '',
      instruksi: shouldCopyIE ? (examination.instruksi || examination.i || '') : prev.instruksi || '',
      evaluasi: shouldCopyIE ? (examination.evaluasi || examination.e || '') : prev.evaluasi || '',
      nip: examination.nip || examination.pegawai || prev.nip || ''
    }));

    setEditingExamination(null);

    toast({
      title: "Data Disalin",
      description: "SOAPIE berhasil disalin ke form tambah pemeriksaan",
    });
  };

  const handleDeleteExamination = async (examination: any, visit: any) => {
    if (!canDeleteExamination(examination)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya petugas yang membuat data pemeriksaan yang dapat menghapusnya.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Apakah Anda yakin ingin menghapus data pemeriksaan ini?')) {
      return;
    }

    try {
      const response = await fetch(API_URLS.DELETE_EXAMINATION, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          no_rawat: visit.no_rawat,
          status_rawat: mapStatusLanjutToStatusRawat(visit.status_lanjut),
          tgl_perawatan: examination.tgl_perawatan,
          jam_rawat: examination.jam_rawat,
          username: currentUsername
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Delete examination response:', data);

      toast({
        title: "Berhasil",
        description: "Data pemeriksaan berhasil dihapus",
      });

        // Refresh medical data
        await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
    } catch (error) {
      console.error('Error deleting examination:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus data pemeriksaan",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProcedure = async (procedure: any) => {
    if (!canDeleteProcedure(procedure)) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya user yang terkait dengan tindakan ini yang dapat menghapusnya.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Apakah Anda yakin ingin menghapus data tindakan ini?')) {
      return;
    }

    const requestPayload = {
      no_rawat: procedure.no_rawat,
      status_rawat: procedure.status_rawat || (procedure.source === 'Rawat Inap' ? 'Ranap' : 'Ralan'),
      kd_jenis_prw: procedure.kd_jenis_prw,
      tgl_perawatan: procedure.tgl_perawatan,
      jam_rawat: procedure.jam_rawat,
      record_type: procedure.record_type,
      kd_dokter: procedure.kd_dokter,
      nip: procedure.nip,
      username: currentUsername
    };
    const procedureKey = [
      requestPayload.no_rawat,
      requestPayload.kd_jenis_prw,
      requestPayload.tgl_perawatan,
      requestPayload.jam_rawat,
      requestPayload.record_type
    ].join('|');

    try {
      setDeletingProcedureKey(procedureKey);

      const response = await fetch(API_URLS.DELETE_PROCEDURE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
      }

      await response.json();

      toast({
        title: "Berhasil",
        description: "Data tindakan berhasil dihapus",
      });

      await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
    } catch (error) {
      console.error('Error deleting procedure:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menghapus data tindakan",
        variant: "destructive",
      });
    } finally {
      setDeletingProcedureKey(null);
    }
  };

  const formatDateTime = (date: Date): string => {
    return formatDateTimeWIB(date);
  };

  // Safe date formatter that handles various date formats and null values
  const formatDateSafe = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    
    // If already formatted properly, return as is
    if (typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T') && !dateStr.includes('Z')) {
      return dateStr;
    }
    
    try {
      // Handle various date formats
      let date: Date;
      
      if (typeof dateStr === 'string') {
        // Remove 'Z' suffix if present (UTC indicator)
        const cleanDateStr = dateStr.replace(/Z$/, '');
        
        // Try to parse the date
        date = new Date(cleanDateStr);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
          console.warn('Invalid date:', dateStr);
          return '-';
        }
        
        // Format to WIB timezone
        return formatDateTimeWIB(date);
      }
      
      return '-';
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return '-';
    }
  };

  const formatLongDateSafe = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';

    try {
      const trimmedValue = String(dateStr).trim().replace(/Z$/, '');
      const normalizedValue = trimmedValue.includes('T')
        ? trimmedValue
        : trimmedValue.includes(' ')
          ? trimmedValue.replace(' ', 'T')
          : `${trimmedValue}T00:00:00`;
      const date = new Date(normalizedValue);

      if (isNaN(date.getTime())) {
        return '-';
      }

      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(date);
    } catch (error) {
      console.error('Error formatting long date:', dateStr, error);
      return '-';
    }
  };

  const formatDateTimeToMinute = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';

    if (typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T') && !dateStr.includes('Z')) {
      const [datePart, timePart = ''] = dateStr.split(' ');
      const minutePart = timePart.split(':').slice(0, 2).join(':');
      return minutePart ? `${datePart} ${minutePart}` : datePart;
    }

    try {
      const cleanDateStr = String(dateStr).replace(/Z$/, '');
      const date = new Date(cleanDateStr);

      if (isNaN(date.getTime())) {
        return '-';
      }

      return format(date, 'yyyy-MM-dd HH:mm');
    } catch (error) {
      console.error('Error formatting date to minute:', dateStr, error);
      return '-';
    }
  };

  const fetchRadiologyPacsPayload = useCallback(async (rad: any) => {
    const noRawat = String(rad?.no_rawat || '').trim();
    const examDate = String(rad?.tgl_periksa || String(rad?.tanggal || '').split(' ')[0] || '').trim();

    if (!noRawat || !examDate) {
      throw new Error('Data radiologi belum lengkap untuk memuat PACS');
    }

    const params = new URLSearchParams({
      no_rawat: noRawat,
      exam_date: examDate
    });
    const examName = String(rad?.pemeriksaan || '').trim();

    if (examName) {
      params.set('exam_name', examName);
    }

    const response = await fetch(`${API_CONFIG.BASE_URL_WITHOUT_API}/api/pacs/radiology-images?${params.toString()}`);
    const responseJson = await response.json().catch(() => null);

    if (!response.ok || !responseJson?.success) {
      throw new Error(responseJson?.error || 'Gagal memuat PACS radiologi');
    }

    return {
      pacs_modality: responseJson.pacs_modality || '',
      pacs_total_images: Number(responseJson.pacs_total_images) || 0,
      pacs_series: Array.isArray(responseJson.pacs_series) ? responseJson.pacs_series.filter(Boolean) : [],
      pacs_images: Array.isArray(responseJson.pacs_images) ? responseJson.pacs_images.filter(Boolean) : []
    };
  }, []);

  const getRadiologyWithLazyPacs = useCallback((rad: any) => {
    const lazyPacs = radiologyPacsByKey[getRadiologyPacsKey(rad)];
    return lazyPacs ? { ...rad, ...lazyPacs } : rad;
  }, [radiologyPacsByKey]);

  const ensureRadiologyPacsLoaded = useCallback(async (rad: any) => {
    const pacsKey = getRadiologyPacsKey(rad);
    if (!pacsKey || pacsKey === '::::') {
      throw new Error('Data radiologi belum lengkap untuk memuat PACS');
    }

    if (radiologyPacsByKey[pacsKey]) {
      return radiologyPacsByKey[pacsKey];
    }

    if (radiologyPacsErrorKeys[pacsKey]) {
      throw new Error(radiologyPacsErrorKeys[pacsKey]);
    }

    setLoadingRadiologyPacsKeys((previous) => ({ ...previous, [pacsKey]: true }));
    try {
      const pacsPayload = await fetchRadiologyPacsPayload(rad);
      setRadiologyPacsErrorKeys((previous) => {
        const next = { ...previous };
        delete next[pacsKey];
        return next;
      });
      setRadiologyPacsByKey((previous) => ({ ...previous, [pacsKey]: pacsPayload }));
      return pacsPayload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memuat PACS radiologi';
      setRadiologyPacsErrorKeys((previous) => ({ ...previous, [pacsKey]: message }));
      throw error;
    } finally {
      setLoadingRadiologyPacsKeys((previous) => ({ ...previous, [pacsKey]: false }));
    }
  }, [fetchRadiologyPacsPayload, radiologyPacsByKey, radiologyPacsErrorKeys]);

  const openPacsPreviewModal = useCallback(async (rad: any, images: any[], currentIndex = 0, modality = '') => {
    const normalizedModality = String(modality || '').toUpperCase();
    const totalImages = Math.max(Number(rad?.pacs_total_images) || 0, images.length);
    const shouldFetchFullCt = normalizedModality === 'CT' && totalImages > images.length;
    const requestId = ++pacsPreviewRequestRef.current;

    setPacsPreviewModal({
      open: true,
      title: rad?.pemeriksaan || 'Foto Radiologi PACS',
      images,
      currentIndex,
      modality: normalizedModality,
      loading: shouldFetchFullCt
    });
    setIsPacsPlaying(normalizedModality === 'CT' && !shouldFetchFullCt && images.length > 1);

    if (!shouldFetchFullCt) {
      return;
    }

    try {
      const fullPayload = await ensureRadiologyPacsLoaded(rad);
      const fullImages = Array.isArray(fullPayload?.pacs_images) ? fullPayload.pacs_images : [];

      if (pacsPreviewRequestRef.current !== requestId) {
        return;
      }

      setPacsPreviewModal((previous) => ({
        ...previous,
        images: fullImages.length > 0 ? fullImages : previous.images,
        currentIndex: Math.min(currentIndex, Math.max((fullImages.length || previous.images.length) - 1, 0)),
        loading: false
      }));
      setIsPacsPlaying(fullImages.length > 1);
    } catch (error) {
      if (pacsPreviewRequestRef.current !== requestId) {
        return;
      }

      setPacsPreviewModal((previous) => ({
        ...previous,
        loading: false
      }));
      setIsPacsPlaying(false);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal memuat PACS radiologi',
        variant: 'destructive'
      });
    }
  }, [ensureRadiologyPacsLoaded, toast]);

  useEffect(() => {
    const displayedRadiologyItems = activeTab === 'radiology'
      ? [...outpatientRadiologyHistory, ...inpatientRadiologyHistory]
      : activeTab === 'visits'
        ? [
            ...sortedOutpatientVisits.filter((visit) => expandedVisitKeys[visit.no_rawat]),
            ...sortedInpatientVisits.filter((visit) => expandedVisitKeys[visit.no_rawat])
          ].flatMap((visit) => ((visit.radiology || []) as any[]).map((rad) => ({ ...rad, no_rawat: visit.no_rawat })))
        : [];

    const pendingItems = Array.from(new Map(
      displayedRadiologyItems
        .map((rad) => [getRadiologyPacsKey(rad), rad] as const)
        .filter(([pacsKey]) => (
          Boolean(pacsKey) &&
          pacsKey !== '::::' &&
          !radiologyPacsByKey[pacsKey] &&
          !loadingRadiologyPacsKeys[pacsKey] &&
          !radiologyPacsErrorKeys[pacsKey]
        ))
    ).values());

    if (pendingItems.length === 0) {
      return;
    }

    let cancelled = false;

    const preloadThumbnails = async () => {
      for (const rad of pendingItems) {
        if (cancelled) {
          return;
        }

        try {
          await ensureRadiologyPacsLoaded(rad);
        } catch (error) {
          if (!cancelled) {
            console.error('Error preloading radiology PACS:', error);
          }
        }
      }
    };

    void preloadThumbnails();

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    ensureRadiologyPacsLoaded,
    expandedVisitKeys,
    inpatientRadiologyHistory,
    loadingRadiologyPacsKeys,
    outpatientRadiologyHistory,
    radiologyPacsByKey,
    radiologyPacsErrorKeys,
    sortedInpatientVisits,
    sortedOutpatientVisits
  ]);

  const goToPacsImage = (nextIndex: number) => {
    if (!pacsPreviewModal.images.length) {
      return;
    }

    const totalImages = pacsPreviewModal.images.length;
    const normalizedIndex = ((nextIndex % totalImages) + totalImages) % totalImages;
    setPacsPreviewModal((previous) => ({
      ...previous,
      currentIndex: normalizedIndex
    }));
  };

  const getRadiologyPacsThumbnailItems = (rad: any) => {
    const pacsImages = Array.isArray(rad?.pacs_images) ? rad.pacs_images.filter(Boolean) : [];
    const pacsSeries = Array.isArray(rad?.pacs_series) ? rad.pacs_series.filter(Boolean) : [];
    const modality = String(rad?.pacs_modality || pacsSeries[0]?.modality || pacsImages[0]?.modality || '').toUpperCase();
    const totalImages = Math.max(Number(rad?.pacs_total_images) || 0, pacsImages.length);

    if (modality === 'CT' && pacsImages.length > 0) {
      return {
        modality,
        displayImages: [pacsImages[0]],
        modalImages: pacsImages,
        totalImages
      };
    }

    return {
      modality,
      displayImages: pacsImages.slice(0, 6),
      modalImages: pacsImages,
      totalImages
    };
  };

  const getRadiologyModalityLabel = (rad: any) => {
    const enrichedRad = getRadiologyWithLazyPacs(rad);
    return String(enrichedRad?.pacs_modality || enrichedRad?.pacs_series?.[0]?.modality || '').trim().toUpperCase();
  };

  const renderRadiologyModalityBadge = (rad: any) => {
    const modality = getRadiologyModalityLabel(rad);
    if (!modality) {
      return null;
    }

    return (
      <span className="inline-flex items-center rounded-full border bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary">
        {modality}
      </span>
    );
  };

  const handleCtWheelNavigation = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!isCtPacsPreview || pacsPreviewModal.images.length <= 1) {
      return;
    }

    event.preventDefault();
    setIsPacsPlaying(false);

    const direction = event.deltaY > 0 ? 1 : -1;
    const step = event.shiftKey ? 5 : 1;
    goToPacsImage(pacsPreviewModal.currentIndex + (direction * step));
  };

  const getPacsImageUrl = (
    instanceId: string,
    options?: {
      modality?: string;
      width?: number;
      preferPreview?: boolean;
    }
  ) => {
    const normalizedModality = String(options?.modality || '').toUpperCase();
    const preferPreview = options?.preferPreview || normalizedModality === 'CT';
    const basePath = preferPreview ? '/api/pacs/preview' : '/api/pacs/rendered';
    const encodedInstanceId = encodeURIComponent(instanceId);

    if (preferPreview) {
      return `${API_CONFIG.BASE_URL_WITHOUT_API}${basePath}/${encodedInstanceId}`;
    }

    const width = options?.width || 500;
    return `${API_CONFIG.BASE_URL_WITHOUT_API}${basePath}/${encodedInstanceId}?width=${width}`;
  };

  const zoomOutPacsPreview = () => {
    setPacsZoomLevel((previous) => Math.max(1, Number((previous - 0.25).toFixed(2))));
  };

  const zoomInPacsPreview = () => {
    setPacsZoomLevel((previous) => Math.min(4, Number((previous + 0.25).toFixed(2))));
  };

  const resetPacsZoom = () => {
    setPacsZoomLevel(1);
  };

  const renderRadiologyPacsImages = (rad: any) => {
    const pacsKey = getRadiologyPacsKey(rad);
    const hasLoadedPacs = Object.prototype.hasOwnProperty.call(radiologyPacsByKey, pacsKey);
    const isLoadingPacs = loadingRadiologyPacsKeys[pacsKey] === true;
    const pacsError = radiologyPacsErrorKeys[pacsKey];
    const enrichedRad = getRadiologyWithLazyPacs(rad);
    const { modality, displayImages, modalImages, totalImages } = getRadiologyPacsThumbnailItems(enrichedRad);
    if (modalImages.length === 0) {
      return (
        <div className="mt-4 border-t pt-4">
          <div className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4">
            <div>
              <p className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Foto Radiologi PACS
              </p>
              <p className="text-xs text-muted-foreground">
                {isLoadingPacs
                  ? 'Sedang memuat thumbnail PACS...'
                  : pacsError
                    ? pacsError
                    : hasLoadedPacs
                  ? 'Tidak ada gambar PACS yang cocok untuk pemeriksaan ini.'
                  : 'Hasil radiologi sudah tampil dari database. Foto PACS dimuat saat diperlukan.'}
              </p>
            </div>
          </div>
        </div>
      );
    }
    const uniqueDescriptions = Array.from(
      new Set(
        modalImages
          .map((image: any) => String(image?.description || '').trim())
          .filter(Boolean)
      )
    );

    return (
      <div className="mt-4 border-t pt-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Foto Radiologi PACS
            </p>
            {uniqueDescriptions.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {uniqueDescriptions.join(' | ')}
              </p>
            ) : null}
          </div>
          {modality === 'CT' ? (
            <p className="text-xs text-muted-foreground">
              CT scan: {totalImages} slice, klik thumbnail untuk memuat lengkap
            </p>
          ) : totalImages > displayImages.length ? (
            <p className="text-xs text-muted-foreground">
              Menampilkan {displayImages.length} dari {totalImages} gambar
            </p>
          ) : null}
        </div>

        <div className={cn(
          "gap-3",
          modality === 'CT' ? "grid grid-cols-1 max-w-sm" : "grid grid-cols-2 md:grid-cols-3"
        )}>
          {displayImages.map((image: any, index: number) => {
            const previewUrl = getPacsImageUrl(image.instance_id, {
              modality,
              width: 600,
              preferPreview: modality === 'CT'
            });

            return (
              <button
                type="button"
                key={`${image.instance_id}-${index}`}
                className="group relative overflow-hidden rounded-lg border bg-muted/20"
                onClick={() => openPacsPreviewModal(enrichedRad, modalImages, index, modality)}
              >
                <img
                  src={previewUrl}
                  alt={`Foto Radiologi ${rad?.pemeriksaan || index + 1}`}
                  loading="lazy"
                  className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                {modality === 'CT' && totalImages > 1 ? (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2 text-xs text-white">
                    <span>{totalImages} slice</span>
                    <span className="flex items-center gap-1">
                      <Play className="h-3.5 w-3.5" />
                      Play
                    </span>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleSaveForm = async (type: string) => {
    try {
      if (type === 'Pemeriksaan') {
        const normalizedTime = examinationForm.jam_rawat
          ? examinationForm.jam_rawat.split(':').length === 2
            ? `${examinationForm.jam_rawat}:00`
            : examinationForm.jam_rawat
          : '';
        const effectiveNoRawat = editingExamination?.no_rawat || formattedNoRawat;
        const effectiveStatusRawat = editingExamination?.status_lanjut || statusRawat;
        
        const requestBody = {
          no_rawat: effectiveNoRawat,
          status_rawat: effectiveStatusRawat,
          tgl_perawatan: examinationForm.tgl_perawatan,
          jam_rawat: normalizedTime,
          suhu: examinationForm.suhu,
          tensi: examinationForm.tensi,
          nadi: examinationForm.nadi,
          respirasi: examinationForm.respirasi,
          tinggi: examinationForm.tinggi,
          berat: examinationForm.berat,
          spo2: examinationForm.spo2,
          gcs: examinationForm.gcs,
          kesadaran: examinationForm.kesadaran,
          keluhan: examinationForm.keluhan,
          pemeriksaan: examinationForm.pemeriksaan,
          rtl: examinationForm.rtl,
          penilaian: examinationForm.penilaian,
          instruksi: examinationForm.instruksi,
          evaluasi: examinationForm.evaluasi,
          nip: user?.username || '' // Get nip from auth user username
        };

        const isEditing = Boolean(editingExamination);
        const response = await fetch(
          isEditing ? API_URLS.UPDATE_EXAMINATION : API_URLS.SAVE_EXAMINATION,
          {
            method: isEditing ? 'PUT' : 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(
              isEditing
                ? {
                    ...requestBody,
                    original_date: editingExamination?.tgl_perawatan,
                    original_time: editingExamination?.jam_rawat,
                    username: currentUsername,
                  }
                : requestBody
            )
          }
        );

        const responseJson = await response.json().catch(() => null);

        if (!response.ok || !responseJson?.success) {
          throw new Error(
            responseJson?.details ||
            responseJson?.error ||
            `HTTP error! status: ${response.status}`
          );
        }

        toast({
          title: "Berhasil",
          description: isEditing
            ? `Data ${type} berhasil diperbarui`
            : `Data ${type} berhasil disimpan`,
        });
        setActiveTab('examinations');
        
        // Reset form and editing state
        setEditingExamination(null);
        setExaminationForm(getDefaultExaminationForm());
        setStatusRawat(defaultExaminationStatusRawat);

        // Refresh medical record data
        fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
      } else if (type === 'Tindakan') {
        if (!formattedNoRawat) {
          throw new Error('Pilih kunjungan pasien terlebih dahulu');
        }

        const validProcedures = procedures
          .map((procedure) => ({
            kode: procedure.kode.trim(),
            nama: procedure.nama.trim(),
            hasil: procedure.hasil.trim()
          }))
          .filter((procedure) => procedure.kode && procedure.nama);

        if (!validProcedures.length) {
          throw new Error('Pilih minimal satu tindakan yang valid');
        }

        const response = await fetch(API_URLS.SAVE_PROCEDURES, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            no_rawat: formattedNoRawat,
            status_rawat: procedureStatusRawat,
            username: user?.username || '',
            procedures: validProcedures
          })
        });

        const responseJson = await response.json().catch(() => null);

        if (!response.ok || !responseJson?.success) {
          throw new Error(
            responseJson?.details ||
            responseJson?.error ||
            `HTTP error! status: ${response.status}`
          );
        }
        toast({
          title: "Berhasil",
          description: `${responseJson.data?.inserted || validProcedures.length} tindakan berhasil disimpan`,
        });

        resetProcedureForm();
        setActiveTab('procedures');
        await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
      } else if (type === 'Laboratorium') {
        const effectiveNoRawat = labFormNoRawat || formattedNoRawat;

        if (!effectiveNoRawat) {
          throw new Error('Pilih kunjungan pasien terlebih dahulu');
        }

        if (!user?.username) {
          throw new Error('User login tidak ditemukan');
        }

        const validLabRequests = labTests
          .map((test) => ({
            kd_jenis_prw: test.kode?.trim() || '',
            nama: test.pemeriksaan?.trim() || ''
          }))
          .filter((test) => test.kd_jenis_prw && test.nama);

        const validLabRequestDetails = labTests.flatMap((test, index) => {
          const kdJenisPrw = test.kode?.trim() || '';
          const templates = labTemplatesByIndex[index] || [];

          if (!kdJenisPrw || templates.length === 0) {
            return [];
          }

          return templates.map((template) => ({
            kd_jenis_prw: kdJenisPrw,
            id_template: template.id_template
          }));
        });

        if (!validLabRequests.length) {
          throw new Error('Pilih minimal satu pemeriksaan laboratorium yang valid');
        }

        const isEditingLabRequest = Boolean(editingLabRequestNo);
        const response = await fetch(`${API_URLS.LABORATORY_DATA}?action=${isEditingLabRequest ? 'update_lab_request' : 'create_lab_request'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            no_rawat: effectiveNoRawat,
            dokter_perujuk: user.username,
            status_rawat: labStatusRawat,
            klinis: labKlinis.trim(),
            noorder: editingLabRequestNo,
            username: currentUsername,
            examinations: validLabRequests,
            details: validLabRequestDetails
          })
        });

        const responseJson = await response.json().catch(() => null);

        if (!response.ok || !responseJson?.success) {
          throw new Error(
            responseJson?.details ||
            responseJson?.error ||
            `HTTP error! status: ${response.status}`
          );
        }

        toast({
          title: "Berhasil",
          description: isEditingLabRequest
            ? `Permintaan laboratorium ${editingLabRequestNo} berhasil diperbarui`
            : `${validLabRequests.length} permintaan laboratorium berhasil disimpan`,
        });

        resetLabForm();
        setActiveTab('laboratory');
        await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
      } else if (type === 'Radiologi') {
        const effectiveNoRawat = radiologyFormNoRawat || formattedNoRawat;

        if (!effectiveNoRawat) {
          throw new Error('Pilih kunjungan pasien terlebih dahulu');
        }

        if (!user?.username) {
          throw new Error('User login tidak ditemukan');
        }

        const validRadiologyRequests = radiologies
          .map((radiology) => ({
            kd_jenis_prw: radiology.kode.trim(),
            nama: radiology.pemeriksaan.trim()
          }))
          .filter((radiology) => radiology.kd_jenis_prw && radiology.nama);

        if (!validRadiologyRequests.length) {
          throw new Error('Pilih minimal satu pemeriksaan radiologi yang valid');
        }

        const isEditingRadiologyRequest = Boolean(editingRadiologyRequestNo);
        const response = await fetch(`${API_URLS.RADIOLOGY_DATA}?action=${isEditingRadiologyRequest ? 'update_radiology_request' : 'create_radiology_request'}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            no_rawat: effectiveNoRawat,
            dokter_perujuk: user.username,
            status_rawat: radiologyStatusRawat,
            klinis: radiologyKlinis.trim(),
            noorder: editingRadiologyRequestNo,
            username: currentUsername,
            examinations: validRadiologyRequests
          })
        });

        const responseJson = await response.json().catch(() => null);

        if (!response.ok || !responseJson?.success) {
          throw new Error(
            responseJson?.details ||
            responseJson?.error ||
            `HTTP error! status: ${response.status}`
          );
        }

        toast({
          title: "Berhasil",
          description: isEditingRadiologyRequest
            ? `Permintaan radiologi ${editingRadiologyRequestNo} berhasil diperbarui`
            : `${validRadiologyRequests.length} permintaan radiologi berhasil disimpan`,
        });

        resetRadiologyForm();
        setActiveTab('radiology');
        await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
      } else if (type === 'Resep Racikan') {
        if (!formattedNoRawat) {
          throw new Error('Pilih kunjungan pasien terlebih dahulu');
        }

        if (!user?.username) {
          throw new Error('User login tidak ditemukan');
        }

        const validCompounds = compoundPrescriptions
          .map((compound) => ({
            tanggal: compound.tanggal,
            nama_racik: compound.nama_racikan.trim(),
            jumlah: compound.jumlah.trim(),
            kd_racik: compound.kd_racik.trim(),
            aturan_pakai: compound.aturan_pakai.trim(),
            keterangan: compound.keterangan.trim(),
            details: compound.komposisi
              .map((item) => ({
                kode_brng: String(item.kode_brng ?? '').trim(),
                nama: String(item.nama ?? '').trim(),
                kandungan: String(item.jumlah ?? '').trim()
              }))
              .filter((item) => item.kode_brng && item.nama && item.kandungan)
          }))
          .filter((compound) => (
            compound.tanggal &&
            compound.nama_racik &&
            compound.jumlah &&
            compound.kd_racik &&
            compound.aturan_pakai &&
            compound.details.length > 0
          ));

        if (!validCompounds.length) {
          throw new Error('Lengkapi minimal satu racikan yang valid');
        }

        const shouldContinueCompoundSave = await warnIfAllergicMedicationCodes(
          validCompounds.flatMap((compound) => compound.details.map((item) => item.kode_brng))
        );
        if (!shouldContinueCompoundSave) {
          return;
        }

        const referenceDate = validCompounds[0].tanggal;
        const hasDifferentDate = validCompounds.some((compound) => compound.tanggal !== referenceDate);
        if (hasDifferentDate) {
          throw new Error('Tanggal resep racikan harus sama dalam satu kali simpan');
        }

        const response = await fetch(API_URLS.PRESCRIPTION_DATA, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'create_prescription',
            no_rawat: formattedNoRawat,
            kd_dokter: user.username,
            prescription_date: referenceDate,
            prescription_status: statusRawat === 'Ranap' ? 'Ranap' : 'Ralan',
            medicines: [],
            compounds: validCompounds
          })
        });

        const responseJson = await response.json().catch(() => null);

        if (!response.ok || !responseJson?.success) {
          throw new Error(
            responseJson?.details ||
            responseJson?.error ||
            `HTTP error! status: ${response.status}`
          );
        }

        toast({
          title: "Berhasil",
          description: responseJson?.reused_existing
            ? `Racikan berhasil ditambahkan ke resep aktif ${responseJson?.no_resep}`
            : `Racikan berhasil disimpan dengan nomor resep ${responseJson?.no_resep}`,
        });

        resetCompoundForm();
        setActiveTab('medications');
        await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
      } else if (type === 'Resep') {
        if (!formattedNoRawat) {
          throw new Error('Pilih kunjungan pasien terlebih dahulu');
        }

        if (!user?.username) {
          throw new Error('User login tidak ditemukan');
        }

        const validPrescriptions = medications
          .map((medication) => ({
            tanggal: medication.tanggal,
            status: medication.status,
            medicines: medication.obat
              .map((obat) => ({
                kode_brng: String(obat.kode_brng ?? '').trim(),
                nama: String(obat.nama ?? '').trim(),
                jml: String(obat.jumlah ?? '').trim(),
                aturan_pakai: String(obat.aturan_pakai ?? '').trim()
              }))
              .filter((obat) => obat.kode_brng && obat.nama && obat.jml)
          }))
          .filter((medication) => medication.tanggal && medication.medicines.length > 0);

        if (!validPrescriptions.length) {
          throw new Error('Pilih minimal satu resep dengan obat yang valid');
        }

        const shouldContinuePrescriptionSave = await warnIfAllergicMedicationCodes(
          validPrescriptions.flatMap((prescription) => prescription.medicines.map((obat) => obat.kode_brng))
        );
        if (!shouldContinuePrescriptionSave) {
          return;
        }

        if (editingPrescriptionNo && validPrescriptions.length !== 1) {
          throw new Error('Mode edit hanya mendukung satu resep dalam satu kali simpan');
        }

        if (editingPrescriptionNo) {
          const prescription = validPrescriptions[0];
          const response = await fetch(API_URLS.PRESCRIPTION_DATA, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'update_prescription',
              no_resep: editingPrescriptionNo,
              username: currentUsername,
              prescription_date: prescription.tanggal,
              prescription_status: prescription.status,
              medicines: prescription.medicines,
              compounds: []
            })
          });

          const responseJson = await response.json().catch(() => null);

          if (!response.ok || !responseJson?.success) {
            throw new Error(
              responseJson?.details ||
              responseJson?.error ||
              `HTTP error! status: ${response.status}`
            );
          }

          toast({
            title: "Berhasil",
            description: `Resep ${editingPrescriptionNo} berhasil diperbarui`,
          });
        } else {
          for (const prescription of validPrescriptions) {
            const response = await fetch(API_URLS.PRESCRIPTION_DATA, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                action: 'create_prescription',
                no_rawat: formattedNoRawat,
                kd_dokter: user.username,
                prescription_date: prescription.tanggal,
                prescription_status: prescription.status,
                medicines: prescription.medicines,
                compounds: []
              })
            });

            const responseJson = await response.json().catch(() => null);

            if (!response.ok || !responseJson?.success) {
              throw new Error(
                responseJson?.details ||
                responseJson?.error ||
                `HTTP error! status: ${response.status}`
              );
            }
          }

          toast({
            title: "Berhasil",
            description: `${validPrescriptions.length} resep berhasil disimpan`,
          });
        }

        resetMedicationForm();
        setActiveTab('medications');
        await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
      } else {
        toast({
          title: "Berhasil",
          description: `Data ${type} berhasil disimpan`,
        });
      }
    } catch (error) {
      console.error(`Error saving ${type}:`, error);
      const message = error instanceof Error ? error.message : `Gagal menyimpan data ${type}`;
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    }
  };
  const handleSaveIgdTriage = async () => {
    const normalizedNoRawat = activeIgdTriageNoRawat;
    if (!normalizedNoRawat) {
      toast({
        title: 'No. Rawat belum tersedia',
        description: 'Pilih kunjungan pasien IGD terlebih dahulu sebelum menyimpan triase.',
        variant: 'destructive'
      });
      return;
    }

    const normalizedTime = igdTriageForm.jam_rawat
      ? igdTriageForm.jam_rawat.split(':').length === 2
        ? `${igdTriageForm.jam_rawat}:00`
        : igdTriageForm.jam_rawat
      : '';

    try {
      setSavingIgdTriage(true);

      const response = await fetch(API_URLS.TRIAGE_IGD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rawat: normalizedNoRawat,
          tanggal: igdTriageForm.tgl_perawatan,
          jam: normalizedTime,
          kd_dokter: currentUsername,
          kd_petugas: currentUsername,
          tinggi: examinationForm.tinggi,
          berat: examinationForm.berat,
          ...igdTriageForm
        })
      });
      const responseJson = await response.json().catch(() => null);

      if (!response.ok || !responseJson?.success) {
        throw new Error(
          responseJson?.details ||
          responseJson?.error ||
          'Gagal menyimpan Triase IGD'
        );
      }

      toast({
        title: 'Berhasil',
        description: 'Data Triase IGD berhasil disimpan'
      });
      setIsIgdTriageFormOpen(false);
      await fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
      await loadIgdTriageDetail(normalizedNoRawat);
    } catch (error) {
      console.error('Error saving triase IGD:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal menyimpan Triase IGD',
        variant: 'destructive'
      });
    } finally {
      setSavingIgdTriage(false);
    }
  };

  const currentPatient = medicalData?.patient || {
    nama: "",
    no_rm: no_rkm_medis || "",
    tanggal_lahir: "",
    jenis_kelamin: "",
    alamat: "",
    telepon: "",
    golongan_darah: "",
    alergi: "",
    prb: "",
    prb_program: ""
  };

  const prbInfoList = [currentPatient.prb, currentPatient.prb_program]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .flatMap((value) => value.split(',').map((item) => item.trim()).filter(Boolean));
  const prbInfoText = prbInfoList.join(', ');

  const dummySearchResults = [
    {
      id: "000001",
      mrNumber: "000001",
      name: "Sarah Johnson",
      birthDate: "15/03/1985",
      gender: "Perempuan",
      address: "Jl. Mawar No. 28, Malang"
    }
  ];

  // Handle search mode display
  if (routeSearchQuery) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Hasil Pencarian</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Mencari...</div>
            ) : searchResults.length > 0 ? (
              <PatientTable
                patients={searchResults.map(patient => ({
                  id: patient.id,
                  name: patient.name,
                  visits: 0,
                  status: 'active'
                }))}
                type="active"
                columns={[
                  { header: 'No. RM', accessor: 'mrNumber' },
                  { header: 'Nama', accessor: 'name' },
                  { header: 'Tanggal Lahir', accessor: 'birthDate' },
                  { header: 'Jenis Kelamin', accessor: 'gender' },
                  { header: 'Alamat', accessor: 'address' }
                ]}
              />
            ) : (
              <div className="text-center py-4 text-gray-500">
                Tidak ada hasil yang ditemukan. Silahkan coba dengan kata kunci lain.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 space-y-6 md:space-y-8 w-full mx-auto animate-fade-in shadow-md bg-gray-50 rounded-lg">
      <Card className="mb-6">
        <CardHeader className="border-b p-3 md:p-4">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 mr-2" />
              Data Pasien
            </div>
            {formattedNoRawat && (
              <div className="flex items-center text-muted-foreground text-sm">
                <span className="font-medium">No. Rawat: </span>
                <span className="ml-1">{formattedNoRawat}</span>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Nama</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{currentPatient.nama}</p>
                    {defaultExaminationStatusRawat === 'Ralan' && prbInfoText ? (
                      <p
                        className="text-xs text-amber-700"
                        title={prbInfoText}
                      >
                        (PRB : {prbInfoText})
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Building className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">No. RM</p>
                  <p className="font-medium">{currentPatient.no_rm}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Lahir</p>
                  <p className="font-medium">{currentPatient.tanggal_lahir || '-'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Jenis Kelamin</p>
                  <p className="font-medium">{currentPatient.jenis_kelamin}</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Alamat</p>
                  <p className="font-medium">{currentPatient.alamat}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Phone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Telepon</p>
                  <a
                    href="#"
                    className="font-medium text-green-600 hover:text-green-700 hover:underline"
                    onClick={(event) => {
                      event.preventDefault();
                      setWhatsappNumber(String(medicalData?.patient?.telepon || '').trim());
                      setIsWhatsappModalOpen(true);
                    }}
                  >
                    {currentPatient.telepon || 'Input nomor WhatsApp'}
                  </a>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Heart className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Golongan Darah</p>
                  <p className="font-medium">{currentPatient.golongan_darah || '-'}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Activity className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Alergi</p>
                    <Button
                      className="h-6 px-2 text-xs bg-red-600 hover:bg-red-700 text-white flex items-center gap-1"
                      onClick={() => {
                        setIsAllergyModalOpen(true);
                        void fetchAllergyHistory();
                      }}
                    >
                      <BadgeAlert className="h-3 w-3" />
                      Input Alergi
                    </Button>
                  </div>
                  <p className="font-medium">{currentPatient.alergi || '-'}</p>
                </div>
              </div>          
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="visits">
            <Calendar className="mr-2 h-4 w-4" />
            Kunjungan
          </TabsTrigger>
          <TabsTrigger value="examinations">
            <Stethoscope className="mr-2 h-4 w-4" />
            Pemeriksaan
          </TabsTrigger>
          <TabsTrigger value="procedures">
            <Syringe className="mr-2 h-4 w-4" />
            Tindakan
          </TabsTrigger>
          <TabsTrigger value="medications">
            <Pill className="mr-2 h-4 w-4" />
            Resep
          </TabsTrigger>
          <TabsTrigger value="laboratory">
            <FlaskConical className="mr-2 h-4 w-4" />
            Laboratorium
          </TabsTrigger>
          <TabsTrigger value="radiology">
            <Radio className="mr-2 h-4 w-4" />
            Radiologi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <Card>
            <CardHeader className="p-3 md:p-4">
              <CardTitle>Riwayat Kunjungan</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
              <Tabs value={visitHistoryTab} onValueChange={(value) => setVisitHistoryTab(value as VisitHistoryTabValue)} className="mt-2">
                <TabsList className="mb-4">
                  <TabsTrigger value="outpatient">
                    <User className="mr-2 h-4 w-4" />
                    Rawat Jalan
                  </TabsTrigger>
                  <TabsTrigger value="inpatient">
                    <BedDouble className="mr-2 h-4 w-4" />
                    Rawat Inap
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="outpatient">
                  {sortedOutpatientVisits.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Tidak ada data kunjungan rawat jalan
                    </div>
                  ) : (
                    sortedOutpatientVisits.map((visit: any, index) => (
                    <div key={index} className="mb-8 rounded-lg p-0 shadow-sm">
                      <div
                        className="bg-muted p-2 rounded-t-lg mb-4 cursor-pointer"
                        onClick={() => handleToggleVisitExpansion(visit)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleToggleVisitExpansion(visit);
                          }
                        }}
                        aria-expanded={Boolean(expandedVisitKeys[visit.no_rawat])}
                      >
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                            <div>
                              <p className="text-sm text-muted-foreground">Tanggal</p>
                              <p className="font-medium">{formatLongDateSafe(visit.tanggal)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Poliklinik</p>
                              <p className="font-medium">{visit.poliklinik}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Diagnosa (ICD 10)</p>
                              <p className="font-medium">{visit.diagnosa_icd10 || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Dokter</p>
                              <p className="font-medium">{visit.dokter}</p>
                            </div>
                          </div>
                          <div className="ml-4 flex flex-col gap-2 md:flex-row">
                            <Button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAiScribe(visit);
                              }}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={!visit.details_loaded}
                            >
                              <Brain className="h-4 w-4" />
                              {/* AI Scribe */}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {expandedVisitKeys[visit.no_rawat] ? (
                      loadingVisitDetailsKeys[visit.no_rawat] ? (
                        <div className="rounded-lg border border-dashed bg-white/70 px-4 py-5 text-sm text-muted-foreground">
                          Memuat detail kunjungan...
                        </div>
                      ) : visit.details_loaded ? (
                      <div className="space-y-6">
                        {renderVisitIgdTriageDetails(visit)}

                        {/* Pemeriksaan */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Stethoscope className="h-5 w-5 mr-2" />
                            Pemeriksaan
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(visit.examinations || []).map((exam, examIndex) => (
                              <div key={examIndex} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="flex flex-col space-y-4">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center space-x-2">
                                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{formatDateSafe(exam.tanggal)}</span>
                                      <User className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{exam.pegawai}</span>                                      
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">{visit.no_rawat}</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <h4 className="font-medium flex items-center">
                                        <Activity className="h-4 w-4 mr-2" />
                                        Tanda Vital
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span>Tekanan Darah:</span>
                                          <span className="font-medium">{exam.tekanan_darah}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Nadi:</span>
                                          <span className="font-medium">{exam.nadi}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Respirasi:</span>
                                          <span className="font-medium">{exam.respirasi}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Suhu:</span>
                                          <span className="font-medium">{exam.suhu}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>GCS:</span>
                                          <span className="font-medium">{exam.gcs}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <h4 className="font-medium flex items-center">
                                        <ClipboardList className="h-4 w-4 mr-2" />
                                        SOAPIE
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="font-medium">S (Subjektif):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.s)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">O (Objektif):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.o)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">A (Assessment):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.a)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">P (Planning):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.p)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {renderVisitIcdDetails(visit)}

                        {/* Tindakan */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Syringe className="h-5 w-5 mr-2" />
                            Tindakan
                          </h3>
                          {renderCompactVisitProcedures(visit.procedures || [], visit.no_rawat)}
                        </div>

                        {/* Resep Obat */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Pill className="h-5 w-5 mr-2" />
                            Resep Obat
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(visit.medications || []).map((med, medIndex) => (
                              <div key={medIndex} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="mb-2">
                                  <p className="text-sm text-muted-foreground">Tanggal</p>
                                   <p className="font-medium">{formatDateSafe(med.tanggal)}</p>
                                </div>
                                <div className="space-y-2">
                                  {med.obat.map((obat, obatIndex) => (
                                    <div key={obatIndex} className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Nama:</span>
                                        <span className="ml-2 font-medium">{obat.nama}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Jumlah:</span>
                                        <span className="ml-2">{obat.jumlah}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Aturan:</span>
                                        <span className="ml-2">{obat.aturan_pakai}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Laboratorium */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <FlaskConical className="h-5 w-5 mr-2" />
                            Laboratorium
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {renderVisitLaboratoryHistory((visit.laboratory || []) as LabData[], visit.no_rawat, 'Rawat Jalan')}
                          </div>
                        </div>

                        {/* Radiologi */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Radio className="h-5 w-5 mr-2" />
                            Radiologi
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(visit.radiology || []).map((rad, radIndex) => (
                              <div key={radIndex} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Tanggal</p>
                                     <p className="font-medium">{formatDateSafe(rad.tanggal)}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Pemeriksaan</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{rad.pemeriksaan}</p>
                                      {renderRadiologyModalityBadge(rad)}
                                    </div>
                                  </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Hasil</p>
                                    <p className="font-medium whitespace-pre-wrap break-words">{rad.hasil || '-'}</p>
                                  </div>
                                </div>
                                {renderRadiologyPacsImages(rad)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      ) : (
                        <div className="rounded-lg border border-dashed bg-white/70 px-4 py-5 text-sm text-muted-foreground">
                          Klik sekali lagi jika detail belum tampil.
                        </div>
                      )
                      ) : null}
                    </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="inpatient">
                  {sortedInpatientVisits.map((visit: any, index) => (
                    <div key={index} className="mb-8 rounded-lg p-0 shadow-sm">
                      <div
                        className="bg-muted p-2 rounded-t-lg mb-4 cursor-pointer"
                        onClick={() => handleToggleVisitExpansion(visit)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            handleToggleVisitExpansion(visit);
                          }
                        }}
                        aria-expanded={Boolean(expandedVisitKeys[visit.no_rawat])}
                      >
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                            <div>
                              <p className="text-sm text-muted-foreground">Tanggal</p>
                              <p className="font-medium">{formatLongDateSafe(visit.tanggal_masuk)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Poliklinik</p>
                              <p className="font-medium">{visit.poliklinik}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Diagnosa (ICD 10)</p>
                              <p className="font-medium">{visit.diagnosa_icd10 || '-'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Dokter</p>
                              <p className="font-medium">{visit.dokter}</p>
                            </div>
                          </div>
                          <div className="ml-4 flex flex-col gap-2 md:flex-row">
                            <Button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleAiScribe(visit);
                              }}
                              variant="outline"
                              size="sm"
                              className="flex items-center gap-2"
                              disabled={!visit.details_loaded}
                            >
                              <Brain className="h-4 w-4" />
                              {/* AI Scribe */}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {expandedVisitKeys[visit.no_rawat] ? (
                      loadingVisitDetailsKeys[visit.no_rawat] ? (
                        <div className="rounded-lg border border-dashed bg-white/70 px-4 py-5 text-sm text-muted-foreground">
                          Memuat detail kunjungan...
                        </div>
                      ) : visit.details_loaded ? (
                      <div className="space-y-6">
                        {renderVisitIgdTriageDetails(visit)}

                        {/* Pemeriksaan */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Stethoscope className="h-5 w-5 mr-2" />
                            Pemeriksaan
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(visit.examinations || []).map((exam, examIndex) => (
                              <div key={examIndex} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="flex flex-col space-y-4">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center space-x-2">
                                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{formatDateSafe(exam.tanggal)}</span>
                                      <User className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">{exam.pegawai}</span>                                      
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <FileText className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm text-muted-foreground">{visit.no_rawat}</span>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-3">
                                      <h4 className="font-medium flex items-center">
                                        <Activity className="h-4 w-4 mr-2" />
                                        Tanda Vital
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span>Tekanan Darah:</span>
                                          <span className="font-medium">{exam.tekanan_darah}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Nadi:</span>
                                          <span className="font-medium">{exam.nadi}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Respirasi:</span>
                                          <span className="font-medium">{exam.respirasi}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>Suhu:</span>
                                          <span className="font-medium">{exam.suhu}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>GCS:</span>
                                          <span className="font-medium">{exam.gcs}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <h4 className="font-medium flex items-center">
                                        <ClipboardList className="h-4 w-4 mr-2" />
                                        SOAPIE
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div>
                                          <span className="font-medium">S (Subjektif):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.s)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">O (Objektif):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.o)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">A (Assessment):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.a)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">P (Planning):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.p)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">I (Implementation):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.i)}</p>
                                        </div>
                                        <div>
                                          <span className="font-medium">E (Evaluation):</span>
                                          <p className="mt-1 whitespace-pre-line break-words text-muted-foreground">{formatMultilineText(exam.e)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {renderVisitIcdDetails(visit)}

                        {/* Tindakan */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Syringe className="h-5 w-5 mr-2" />
                            Tindakan
                          </h3>
                          {renderCompactVisitProcedures(visit.procedures || [], visit.no_rawat)}
                        </div>

                        {/* Resep Obat */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Pill className="h-5 w-5 mr-2" />
                            Resep Obat
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(visit.medications || []).map((med, medIndex) => (
                              <div key={medIndex} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="mb-2">
                                  <p className="text-sm text-muted-foreground">Tanggal</p>
                                   <p className="font-medium">{formatDateSafe(med.tanggal)}</p>
                                </div>
                                <div className="space-y-2">
                                  {med.obat.map((obat, obatIndex) => (
                                    <div key={obatIndex} className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                      <div>
                                        <span className="text-muted-foreground">Nama:</span>
                                        <span className="ml-2 font-medium">{obat.nama}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Jumlah:</span>
                                        <span className="ml-2">{obat.jumlah}</span>
                                      </div>
                                      <div>
                                        <span className="text-muted-foreground">Aturan:</span>
                                        <span className="ml-2">{obat.aturan_pakai}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Laboratorium */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <FlaskConical className="h-5 w-5 mr-2" />
                            Laboratorium
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {renderVisitLaboratoryHistory((visit.laboratory || []) as LabData[], visit.no_rawat, 'Rawat Inap')}
                          </div>
                        </div>

                        {/* Radiologi */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Radio className="h-5 w-5 mr-2" />
                            Radiologi
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {(visit.radiology || []).map((rad, radIndex) => (
                              <div key={radIndex} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Tanggal</p>
                                     <p className="font-medium">{formatDateSafe(rad.tanggal)}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Pemeriksaan</p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <p className="font-medium">{rad.pemeriksaan}</p>
                                      {renderRadiologyModalityBadge(rad)}
                                    </div>
                                  </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Hasil</p>
                                    <p className="font-medium whitespace-pre-wrap break-words">{rad.hasil || '-'}</p>
                                  </div>
                                </div>
                                {renderRadiologyPacsImages(rad)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      ) : (
                        <div className="rounded-lg border border-dashed bg-white/70 px-4 py-5 text-sm text-muted-foreground">
                          Klik sekali lagi jika detail belum tampil.
                        </div>
                      )
                      ) : null}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="examinations">
          <Card>
            <CardHeader className="p-3 md:p-4">
              <CardTitle className="flex items-center justify-between">
                Riwayat Pemeriksaan
                {/* <Button onClick={() => handleSaveForm('Pemeriksaan')} className="ml-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Pemeriksaan
                </Button> */}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
              {formattedNoRawat && (
                <div className="space-y-4 mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Grafik Tanda Vital</h3>
                    <p className="text-sm text-muted-foreground">
                      Tren tanda vital berdasarkan nomor rawat {formattedNoRawat}
                    </p>
                  </div>

                  {vitalChartData.length > 0 ? (
                    <div className="border rounded-lg p-4 bg-card space-y-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <h4 className="font-medium">Tren Tanda-Tanda Vital</h4>
                          <p className="text-xs text-muted-foreground">
                            Tampilkan atau sembunyikan jenis TTV sesuai kebutuhan
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {vitalChartSeries.map((series) => {
                            const hasData = vitalChartData.some((item) => item[series.key] !== null);

                            return (
                              <Button
                                key={series.key}
                                type="button"
                                variant={visibleVitalSeries[series.key] ? 'default' : 'outline'}
                                size="sm"
                                disabled={!hasData}
                                onClick={() => setVisibleVitalSeries((previous) => ({
                                  ...previous,
                                  [series.key]: !previous[series.key]
                                }))}
                                className="gap-2"
                              >
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: series.color }}
                                />
                                {series.title}
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      {activeVitalSeries.some((series) => vitalChartData.some((item) => item[series.key] !== null)) ? (
                        <ResponsiveContainer width="100%" height={340}>
                          <LineChart data={vitalChartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tick={{ fontSize: 12 }} minTickGap={24} />
                            <YAxis tick={{ fontSize: 12 }} width={40} />
                            <Tooltip
                              labelFormatter={(label, payload) => {
                                const point = payload?.[0]?.payload;
                                return point ? `${point.fullDate} ${point.fullTime}` : label;
                              }}
                              formatter={(value: number | string | Array<number | string>, name: string) => {
                                const activeSeries = vitalChartSeries.find((series) => series.title === name);
                                return [`${value} ${activeSeries?.unit || ''}`.trim(), name];
                              }}
                            />
                            <Legend />
                            {activeVitalSeries.map((series) => (
                              <Line
                                key={series.key}
                                type="monotone"
                                dataKey={series.key}
                                name={series.title}
                                stroke={series.color}
                                strokeWidth={2}
                                dot={{ r: 3 }}
                                connectNulls
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[340px] flex items-center justify-center text-sm text-muted-foreground border border-dashed rounded-md">
                          Pilih minimal satu jenis TTV yang memiliki data untuk ditampilkan.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
                      Belum ada data pemeriksaan untuk ditampilkan pada grafik tanda vital.
                    </div>
                  )}
                </div>
              )}

              {shouldShowIgdTriageSection && (
                <Collapsible open={isIgdTriageFormOpen} onOpenChange={setIsIgdTriageFormOpen}>
                  <div className={cn(
                    "border rounded-lg p-4 mb-6 transition-colors",
                    activeIgdTriageSectionClasses.container
                  )}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-primary transition-colors">
                        <div className="flex items-center">
                          <BadgeAlert className="h-5 w-5 mr-2" />
                          Form Triase IGD
                        </div>
                        {isIgdTriageFormOpen ? (
                          <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                        ) : (
                          <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 animate-accordion-down">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className={cn("text-sm", activeIgdTriageSectionClasses.subtle)}>
                            Form triase terpisah untuk kunjungan pasien IGD. Status rawat pemeriksaan tetap mengikuti `Ralan`.
                          </p>
                          <p className={cn("text-xs", activeIgdTriageSectionClasses.subtle)}>
                            No. Rawat: {activeIgdTriageNoRawat || '-'}
                          </p>
                        </div>
                        {loadingIgdTriage ? (
                          <p className={cn("text-xs", activeIgdTriageSectionClasses.subtle)}>Memuat data triase...</p>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div>
                          <Label htmlFor="triase-tgl-perawatan">Tanggal Triase</Label>
                          <DatePickerPopover
                            triggerId="triase-tgl-perawatan"
                            mode="single"
                            selected={igdTriageForm.tgl_perawatan ? new Date(igdTriageForm.tgl_perawatan) : undefined}
                            onSelect={(date) => setIgdTriageForm((prev) => ({
                              ...prev,
                              tgl_perawatan: date ? format(date, "yyyy-MM-dd") : ""
                            }))}
                            displayValue={igdTriageForm.tgl_perawatan ? format(new Date(igdTriageForm.tgl_perawatan), "dd/MM/yyyy") : undefined}
                          />
                        </div>
                        <div>
                          <Label htmlFor="triase-jam-rawat">Jam Triase</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-start text-left font-normal">
                                <Clock className="mr-2 h-4 w-4" />
                                {igdTriageForm.jam_rawat || "Pilih jam"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <div className="p-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Jam</Label>
                                    <Select
                                      value={igdTriageForm.jam_rawat?.split(':')[0] || ''}
                                      onValueChange={(hour) => {
                                        const minute = igdTriageForm.jam_rawat?.split(':')[1] || '00';
                                        setIgdTriageForm((prev) => ({ ...prev, jam_rawat: `${hour}:${minute}` }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Jam" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({length: 24}, (_, i) => (
                                          <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                            {String(i).padStart(2, '0')}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Menit</Label>
                                    <Select
                                      value={igdTriageForm.jam_rawat?.split(':')[1] || ''}
                                      onValueChange={(minute) => {
                                        const hour = igdTriageForm.jam_rawat?.split(':')[0] || '00';
                                        setIgdTriageForm((prev) => ({ ...prev, jam_rawat: `${hour}:${minute}` }));
                                      }}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Menit" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from({length: 60}, (_, i) => (
                                          <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                            {String(i).padStart(2, '0')}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label htmlFor="triase-level">Level Triase</Label>
                          <Select
                            value={igdTriageForm.kd_level}
                            onValueChange={(value) => setIgdTriageForm((prev) => ({
                              ...prev,
                              kd_level: value,
                              selected_tindakan: []
                            }))}
                          >
                            <SelectTrigger id="triase-level">
                              <SelectValue placeholder="Pilih level triase" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(new Map(
                                igdTriageMasterOptions.map((item) => [item.kd_level, item])
                              ).values()).map((level) => (
                                <SelectItem key={level.kd_level} value={level.kd_level}>
                                  {level.nm_level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="triase-namakasus">Jenis Kasus</Label>
                          <Select
                            value={igdTriageForm.namakasus}
                            onValueChange={(value) => setIgdTriageForm((prev) => ({ ...prev, namakasus: value }))}
                          >
                            <SelectTrigger id="triase-namakasus">
                              <SelectValue placeholder="Pilih jenis kasus" />
                            </SelectTrigger>
                            <SelectContent>
                              {igdCaseOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                          <Label htmlFor="triase-skala-nyeri">Skala Nyeri</Label>
                          <Input
                            id="triase-skala-nyeri"
                            placeholder="0-10"
                            value={igdTriageForm.skala_nyeri}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, skala_nyeri: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="triase-diantar">Status Diantar</Label>
                          <Select
                            value={igdTriageForm.stts_diantar}
                            onValueChange={(value) => setIgdTriageForm((prev) => ({ ...prev, stts_diantar: value }))}
                          >
                            <SelectTrigger id="triase-diantar">
                              <SelectValue placeholder="Pilih status diantar" />
                            </SelectTrigger>
                            <SelectContent>
                              {igdArrivalStatusOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="triase-transportasi">Transportasi</Label>
                          <Select
                            value={igdTriageForm.transportasi}
                            onValueChange={(value) => setIgdTriageForm((prev) => ({ ...prev, transportasi: value }))}
                          >
                            <SelectTrigger id="triase-transportasi">
                              <SelectValue placeholder="Pilih transportasi" />
                            </SelectTrigger>
                            <SelectContent>
                              {igdTransportationOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="triase-fungsional">Status Fungsional</Label>
                          <Select
                            value={igdTriageForm.stts_fungsional}
                            onValueChange={(value) => setIgdTriageForm((prev) => ({ ...prev, stts_fungsional: value }))}
                          >
                            <SelectTrigger id="triase-fungsional">
                              <SelectValue placeholder="Pilih status fungsional" />
                            </SelectTrigger>
                            <SelectContent>
                              {igdFunctionalStatusOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="triase-psikologis">Status Psikologis</Label>
                          <Select
                            value={igdTriageForm.psikologis}
                            onValueChange={(value) => setIgdTriageForm((prev) => ({ ...prev, psikologis: value }))}
                          >
                            <SelectTrigger id="triase-psikologis">
                              <SelectValue placeholder="Pilih status psikologis" />
                            </SelectTrigger>
                            <SelectContent>
                              {igdPsychologicalStatusOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="triase-tinggal">Status Tinggal</Label>
                          <Select
                            value={igdTriageForm.stts_tinggal}
                            onValueChange={(value) => setIgdTriageForm((prev) => ({ ...prev, stts_tinggal: value }))}
                          >
                            <SelectTrigger id="triase-tinggal">
                              <SelectValue placeholder="Pilih status tinggal" />
                            </SelectTrigger>
                            <SelectContent>
                              {igdLivingStatusOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="triase-saturasi">Saturasi Oksigen (%)</Label>
                          <Input
                            id="triase-saturasi"
                            placeholder="98"
                            value={igdTriageForm.saturasi}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, saturasi: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="triase-resiko-jatuh">Risiko Jatuh</Label>
                          <Input
                            id="triase-resiko-jatuh"
                            placeholder="Contoh: Dewasa (skala morse)"
                            value={igdTriageForm.resiko_jatuh}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, resiko_jatuh: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="triase-keluhan-utama">Keluhan Utama</Label>
                          <Textarea
                            id="triase-keluhan-utama"
                            placeholder="Keluhan utama pasien saat datang ke IGD"
                            value={igdTriageForm.keluhan_utama}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, keluhan_utama: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="triase-riwayat-penyakit">Riwayat Penyakit</Label>
                          <Textarea
                            id="triase-riwayat-penyakit"
                            placeholder="Riwayat penyakit yang relevan"
                            value={igdTriageForm.riwayat_penyakit}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, riwayat_penyakit: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="triase-periksa-fisik">Pemeriksaan Fisik Triase</Label>
                          <Textarea
                            id="triase-periksa-fisik"
                            placeholder="Temuan pemeriksaan fisik awal"
                            value={igdTriageForm.periksafisik}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, periksafisik: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="triase-keterangan">Keterangan Tambahan</Label>
                          <Textarea
                            id="triase-keterangan"
                            placeholder="Keterangan tambahan triase"
                            value={igdTriageForm.keterangan}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, keterangan: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="triase-diagnosis">Diagnosis Awal</Label>
                          <Input
                            id="triase-diagnosis"
                            placeholder="Diagnosis awal triase"
                            value={igdTriageForm.diagnosis}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                          />
                        </div>
                        <div>
                          <Label htmlFor="triase-tindakan">Tindakan Awal</Label>
                          <Input
                            id="triase-tindakan"
                            placeholder="Tindakan awal yang dilakukan"
                            value={igdTriageForm.tindakan}
                            onChange={(e) => setIgdTriageForm((prev) => ({ ...prev, tindakan: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label>Tindakan Triase</Label>
                          <p className="text-xs text-muted-foreground">
                            Pilih tindakan berdasarkan level triase yang aktif.
                          </p>
                        </div>
                        {igdTriageForm.kd_level ? (
                          selectedIgdTriageOptions.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                              {selectedIgdTriageOptions.map((option) => {
                                const checked = igdTriageForm.selected_tindakan.includes(option.kd_tindakan);

                                return (
                                  <label
                                    key={option.kd_tindakan}
                                    className="flex items-start gap-3 rounded-md border bg-white p-3 text-sm"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      onCheckedChange={(value) => setIgdTriageForm((prev) => ({
                                        ...prev,
                                        selected_tindakan: value
                                          ? [...prev.selected_tindakan, option.kd_tindakan]
                                          : prev.selected_tindakan.filter((item) => item !== option.kd_tindakan)
                                      }))}
                                    />
                                    <div>
                                      <p className="font-medium">{option.nm_tindakan}</p>
                                      <p className="text-xs text-muted-foreground">{option.kd_tindakan}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                              Belum ada tindakan triase aktif untuk level ini.
                            </div>
                          )
                        ) : (
                          <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
                            Pilih level triase terlebih dahulu.
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIgdTriageForm(getDefaultIgdTriageForm())}
                        >
                          Reset Triase
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSaveIgdTriage}
                          disabled={savingIgdTriage || loadingIgdTriage}
                        >
                          {savingIgdTriage ? 'Menyimpan...' : 'Simpan Triase'}
                        </Button>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {/* Form Tambah Pemeriksaan */}
              <Collapsible open={isExaminationFormOpen} onOpenChange={setIsExaminationFormOpen}>
                <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-primary transition-colors">
                      <div className="flex items-center">
                        <Plus className="h-5 w-5 mr-2" />
                        {editingExamination ? 'Form Edit Pemeriksaan' : 'Form Tambah Pemeriksaan'}
                      </div>
                      {isExaminationFormOpen ? (
                        <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 animate-accordion-down"
                    style={{
                      overflow: 'hidden',
                      transition: 'height 0.2s ease-out, opacity 0.2s ease-out'
                    }}
                  >
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                   <div>
                     <Label htmlFor="tgl-perawatan">Tanggal Perawatan</Label>
                    <DatePickerPopover
                      triggerId="tgl-perawatan"
                      mode="single"
                      selected={examinationForm.tgl_perawatan ? new Date(examinationForm.tgl_perawatan) : undefined}
                      onSelect={(date) => setExaminationForm({...examinationForm, tgl_perawatan: date ? format(date, "yyyy-MM-dd") : ""})}
                      displayValue={examinationForm.tgl_perawatan ? format(new Date(examinationForm.tgl_perawatan), "dd/MM/yyyy") : undefined}
                    />
                   </div>
                   <div>
                     <Label htmlFor="jam-rawat">Jam Rawat</Label>
                     <Popover>
                       <PopoverTrigger asChild>
                         <Button
                           variant="outline"
                           className="w-full justify-start text-left font-normal"
                         >
                           <Clock className="mr-2 h-4 w-4" />
                           {examinationForm.jam_rawat || "Pilih jam"}
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0" align="start">
                         <div className="p-3">
                           <div className="grid grid-cols-2 gap-2">
                             <div>
                               <Label className="text-xs">Jam</Label>
                               <Select value={examinationForm.jam_rawat?.split(':')[0] || ''} onValueChange={(hour) => {
                                 const minute = examinationForm.jam_rawat?.split(':')[1] || '00';
                                 setExaminationForm({...examinationForm, jam_rawat: `${hour}:${minute}`});
                               }}>
                                 <SelectTrigger className="h-8">
                                   <SelectValue placeholder="Jam" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {Array.from({length: 24}, (_, i) => (
                                     <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                       {String(i).padStart(2, '0')}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             </div>
                             <div>
                               <Label className="text-xs">Menit</Label>
                               <Select value={examinationForm.jam_rawat?.split(':')[1] || ''} onValueChange={(minute) => {
                                 const hour = examinationForm.jam_rawat?.split(':')[0] || '00';
                                 setExaminationForm({...examinationForm, jam_rawat: `${hour}:${minute}`});
                               }}>
                                 <SelectTrigger className="h-8">
                                   <SelectValue placeholder="Menit" />
                                 </SelectTrigger>
                                 <SelectContent>
                                   {Array.from({length: 60}, (_, i) => (
                                     <SelectItem key={i} value={String(i).padStart(2, '0')}>
                                       {String(i).padStart(2, '0')}
                                     </SelectItem>
                                   ))}
                                 </SelectContent>
                               </Select>
                             </div>
                           </div>
                         </div>
                       </PopoverContent>
                     </Popover>
                   </div>
                   <div>
                     <Label htmlFor="no-rawat">No. Rawat</Label>
                     <Input id="no-rawat" value={formattedNoRawat} readOnly className="bg-muted" />
                   </div>
                   <div>
                     <Label htmlFor="status-rawat">Status Rawat</Label>
                     <Select value={statusRawat} onValueChange={setStatusRawat}>
                       <SelectTrigger>
                         <SelectValue placeholder="Pilih status rawat" />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="Ralan">Rawat Jalan</SelectItem>
                         <SelectItem value="Ranap">Rawat Inap</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                 </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                  {/* Tanda Vital */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center">
                      <Activity className="h-4 w-4 mr-2" />
                      Tanda Vital
                    </h4>
                     <div className="grid grid-cols-2 gap-4">
                       <div>
                         <Label htmlFor="tensi">Tekanan Darah</Label>
                         <Input 
                           id="tensi" 
                           placeholder="120/80"
                           value={examinationForm.tensi}
                           onChange={(e) => setExaminationForm({...examinationForm, tensi: e.target.value})}
                         />
                       </div>
                       <div>
                         <Label htmlFor="nadi">Nadi (x/menit)</Label>
                         <Input 
                           id="nadi" 
                           placeholder="80"
                           value={examinationForm.nadi}
                           onChange={(e) => setExaminationForm({...examinationForm, nadi: e.target.value})}
                         />
                       </div>
                       <div>
                         <Label htmlFor="respirasi">Respirasi (x/menit)</Label>
                         <Input 
                           id="respirasi" 
                           placeholder="20"
                           value={examinationForm.respirasi}
                           onChange={(e) => setExaminationForm({...examinationForm, respirasi: e.target.value})}
                         />
                       </div>
                       <div>
                         <Label htmlFor="suhu">Suhu (°C)</Label>
                         <Input 
                           id="suhu" 
                           placeholder="36.5"
                           value={examinationForm.suhu}
                           onChange={(e) => setExaminationForm({...examinationForm, suhu: e.target.value})}
                         />
                       </div>
                       <div>
                         <Label htmlFor="gcs">GCS</Label>
                         <Input 
                           id="gcs" 
                           placeholder="456"
                           value={examinationForm.gcs}
                           onChange={(e) => setExaminationForm({...examinationForm, gcs: e.target.value})}
                         />
                       </div>
{/*                         {statusRawat === 'Ranap' && (
                          <div>
                            <Label htmlFor="kesadaran">Kesadaran</Label>
                            <Input 
                              id="kesadaran" 
                              placeholder="Compos Mentis"
                              value={examinationForm.kesadaran}
                              onChange={(e) => setExaminationForm({...examinationForm, kesadaran: e.target.value})}
                            />
                          </div>
                        )} */}
                        <div>
                          <Label htmlFor="tinggi">Tinggi Badan (cm)</Label>
                          <Input 
                            id="tinggi" 
                            placeholder="170"
                            value={examinationForm.tinggi}
                            onChange={(e) => setExaminationForm({...examinationForm, tinggi: e.target.value})}
                          />
                        </div>
                       <div>
                         <Label htmlFor="berat">Berat Badan (kg)</Label>
                         <Input 
                           id="berat" 
                           placeholder="70"
                           value={examinationForm.berat}
                           onChange={(e) => setExaminationForm({...examinationForm, berat: e.target.value})}
                         />
                       </div>
                      {statusRawat === 'Ranap' && (
                         <div>
                           <Label htmlFor="spo2">SpO2 (%)</Label>
                           <Input 
                             id="spo2" 
                             placeholder="98"
                             value={examinationForm.spo2}
                             onChange={(e) => setExaminationForm({...examinationForm, spo2: e.target.value})}
                           />
                         </div>  
                       )}
                     </div>
                  </div>

                  {/* SOAPIE */}
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center">
                      <ClipboardList className="h-4 w-4 mr-2" />
                      SOAPIE
                    </h4>
                     <div className="space-y-3">
                       <div>
                         <Label htmlFor="keluhan">S (Subjektif/Keluhan)</Label>
                         <Textarea 
                           id="keluhan" 
                           placeholder="Keluhan pasien..."
                           value={examinationForm.keluhan}
                           onChange={(e) => setExaminationForm({...examinationForm, keluhan: e.target.value})}
                         />
                       </div>
                       <div>
                         <Label htmlFor="pemeriksaan">O (Objektif/Pemeriksaan)</Label>
                         <Textarea 
                           id="pemeriksaan" 
                           placeholder="Hasil pemeriksaan..."
                           value={examinationForm.pemeriksaan}
                           onChange={(e) => setExaminationForm({...examinationForm, pemeriksaan: e.target.value})}
                         />
                       </div>
                       <div>
                         <Label htmlFor="penilaian">A (Assessment/Penilaian)</Label>
                         <Textarea 
                           id="penilaian" 
                           placeholder="Diagnosa..."
                           value={examinationForm.penilaian}
                           onChange={(e) => setExaminationForm({...examinationForm, penilaian: e.target.value})}
                         />
                       </div>
                        <div>
                          <Label htmlFor="rtl">P (Planning/RTL)</Label>
                          <Textarea 
                            id="rtl" 
                            placeholder="Rencana terapi..."
                            value={examinationForm.rtl}
                            onChange={(e) => setExaminationForm({...examinationForm, rtl: e.target.value})}
                          />
                        </div>
                        {statusRawat === 'Ranap' && (
                          <div>
                            <Label htmlFor="instruksi">I (Implementation/Instruksi)</Label>
                            <Textarea 
                              id="instruksi" 
                              placeholder="Tindakan yang dilakukan..."
                              value={examinationForm.instruksi}
                              onChange={(e) => setExaminationForm({...examinationForm, instruksi: e.target.value})}
                            />
                          </div>
                        )}
                        {statusRawat === 'Ranap' && (
                          <div>
                            <Label htmlFor="evaluasi">E (Evaluation/Evaluasi)</Label>
                            <Textarea 
                              id="evaluasi" 
                              placeholder="Evaluasi hasil..."
                              value={examinationForm.evaluasi}
                              onChange={(e) => setExaminationForm({...examinationForm, evaluasi: e.target.value})}
                            />
                          </div>
                        )}
                     </div>
                  </div>
                </div>

                 <div className="flex justify-end space-x-2">
                   <Button 
                     variant="outline" 
                    onClick={() => {
                      setExaminationForm(getDefaultExaminationForm());
                      setStatusRawat(defaultExaminationStatusRawat);
                    }}
                   >
                     Reset
                   </Button>
                    <Button onClick={() => handleSaveForm('Pemeriksaan')}>
                      {editingExamination ? 'Update Pemeriksaan' : 'Simpan Pemeriksaan'}
                    </Button>
                    {editingExamination && (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setEditingExamination(null);
                          setExaminationForm(getDefaultExaminationForm());
                          setStatusRawat(defaultExaminationStatusRawat);
                        }}
                      >
                        Batal Edit
                      </Button>
                    )}
                 </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Data Existing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data Pemeriksaan</h3>
                <Tabs
                  value={examinationHistoryTab}
                  onValueChange={(value) => setExaminationHistoryTab(value as ExaminationHistoryTabValue)}
                  className="mt-2"
                >
                  <TabsList className="mb-4">
                    <TabsTrigger value="outpatient">
                      <User className="mr-2 h-4 w-4" />
                      Rawat Jalan
                    </TabsTrigger>
                    <TabsTrigger value="inpatient">
                      <BedDouble className="mr-2 h-4 w-4" />
                      Rawat Inap
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="outpatient">
                    {isFocusedExaminationsLoaded ? (
                      rehabMedikAccess ? (
                        <Tabs
                          value={outpatientExaminationSectionTab}
                          onValueChange={(value) => setOutpatientExaminationSectionTab(value as OutpatientExaminationSectionTabValue)}
                          className="space-y-4"
                        >
                          <TabsList>
                            <TabsTrigger value="examinations">Pemeriksaan</TabsTrigger>
                            <TabsTrigger value="rehab-medik">Assesmen Rehab Medik</TabsTrigger>
                          </TabsList>

                          <TabsContent value="examinations" className="space-y-4">
                            {renderExaminationRoleFilter()}
                            {renderExaminationCards(filteredOutpatientExaminationHistory)}
                          </TabsContent>

                          <TabsContent value="rehab-medik" className="space-y-4">
                            {renderRehabMedikSection()}
                          </TabsContent>
                        </Tabs>
                      ) : (
                        <div className="space-y-4">
                          {renderExaminationRoleFilter()}
                          {renderExaminationCards(filteredOutpatientExaminationHistory)}
                        </div>
                      )
                    ) : renderDeferredTabState('pemeriksaan')}
                  </TabsContent>

                  <TabsContent value="inpatient">
                    {isFocusedExaminationsLoaded ? (
                      <Tabs
                        value={inpatientExaminationSectionTab}
                        onValueChange={(value) => setInpatientExaminationSectionTab(value as InpatientExaminationSectionTabValue)}
                        className="space-y-4"
                      >
                        <TabsList>
                          <TabsTrigger value="examinations">Pemeriksaan</TabsTrigger>
                          <TabsTrigger value="balance-cairan">Balance Cairan</TabsTrigger>
                          <TabsTrigger value="ekstrapiramidal">Ekstrapiramidal</TabsTrigger>
                          {rehabMedikAccess && (
                            <TabsTrigger value="rehab-medik">Assesmen Rehab Medik</TabsTrigger>
                          )}
                        </TabsList>

                        <TabsContent value="examinations" className="space-y-4">
                          {renderExaminationRoleFilter()}
                          {renderExaminationCards(filteredInpatientExaminationHistory)}
                        </TabsContent>

                        <TabsContent value="balance-cairan" className="space-y-4">
                          {!formattedNoRawat ? (
                            <div className="border border-dashed rounded-lg p-6 text-sm text-muted-foreground bg-muted/20">
                              Pilih kunjungan rawat inap terlebih dahulu untuk melihat balance cairan.
                            </div>
                          ) : (
                            <>
                              <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <h4 className="font-medium">Form Balance Cairan</h4>
                                    <p className="text-sm text-muted-foreground">
                                      Pilih data intake pada tabel, lalu isi outtake pasien.
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void fetchBalanceCairan()}
                                    disabled={balanceCairanLoading}
                                  >
                                    {balanceCairanLoading ? 'Memuat...' : 'Refresh'}
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="bc-no-rawat">No. Rawat</Label>
                                    <Input id="bc-no-rawat" value={formattedNoRawat} readOnly className="bg-muted" />
                                  </div>
                                  <div>
                                    <Label htmlFor="bc-selected-intake">Intake Terpilih</Label>
                                    <Input
                                      id="bc-selected-intake"
                                      value={selectedBalanceCairanEntry ? `${selectedBalanceCairanEntry.tanggal} ${selectedBalanceCairanEntry.bc_ke}` : 'Belum dipilih'}
                                      readOnly
                                      className="bg-muted"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div>
                                    <Label htmlFor="bc-muntah">Muntah</Label>
                                    <Input
                                      id="bc-muntah"
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={balanceCairanForm.muntah}
                                      onChange={(event) => setBalanceCairanForm((previous) => ({
                                        ...previous,
                                        muntah: event.target.value
                                      }))}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="bc-urine">Urine</Label>
                                    <Input
                                      id="bc-urine"
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={balanceCairanForm.urine}
                                      onChange={(event) => setBalanceCairanForm((previous) => ({
                                        ...previous,
                                        urine: event.target.value
                                      }))}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="bc-bab">BAB</Label>
                                    <Input
                                      id="bc-bab"
                                      type="number"
                                      min="0"
                                      placeholder="0"
                                      value={balanceCairanForm.bab}
                                      onChange={(event) => setBalanceCairanForm((previous) => ({
                                        ...previous,
                                        bab: event.target.value
                                      }))}
                                    />
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedBalanceCairanId(null);
                                      setBalanceCairanForm({
                                        muntah: '',
                                        urine: '',
                                        bab: ''
                                      });
                                    }}
                                    disabled={savingBalanceCairan}
                                  >
                                    Reset
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={() => void handleSaveBalanceCairan()}
                                    disabled={savingBalanceCairan || !selectedBalanceCairanId}
                                  >
                                    {savingBalanceCairan ? 'Menyimpan...' : 'Simpan Balance Cairan'}
                                  </Button>
                                </div>
                              </div>

                              <div className="border rounded-lg">
                                <div className="border-b p-4">
                                  <h4 className="font-medium">Riwayat Balance Cairan</h4>
                                </div>
                                {balanceCairanLoading ? (
                                  <div className="p-6 text-sm text-muted-foreground">Memuat data balance cairan...</div>
                                ) : balanceCairanEntries.length === 0 ? (
                                  <div className="p-6 text-sm text-muted-foreground">Belum ada data balance cairan untuk nomor rawat ini.</div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-muted/40">
                                        <tr className="text-left">
                                          <th className="px-3 py-2 font-medium">Tanggal</th>
                                          <th className="px-3 py-2 font-medium">Jam</th>
                                          <th className="px-3 py-2 font-medium">Minum</th>
                                          <th className="px-3 py-2 font-medium">Makan</th>
                                          <th className="px-3 py-2 font-medium">Infus</th>
                                          <th className="px-3 py-2 font-medium">Total In</th>
                                          <th className="px-3 py-2 font-medium">Muntah</th>
                                          <th className="px-3 py-2 font-medium">Urine</th>
                                          <th className="px-3 py-2 font-medium">BAB</th>
                                          <th className="px-3 py-2 font-medium">Total Out</th>
                                          <th className="px-3 py-2 font-medium">BC</th>
                                          <th className="px-3 py-2 font-medium">Petugas</th>
                                          <th className="px-3 py-2 font-medium">Aksi</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {balanceCairanEntries.map((entry) => (
                                          <tr key={entry.id} className="border-t">
                                            <td className="px-3 py-2">{entry.tanggal || '-'}</td>
                                            <td className="px-3 py-2">{entry.bc_ke || '-'}</td>
                                            <td className="px-3 py-2">{entry.minum ?? 0}</td>
                                            <td className="px-3 py-2">{entry.makan ?? 0}</td>
                                            <td className="px-3 py-2">{entry.infus ?? 0}</td>
                                            <td className="px-3 py-2">{entry.total_in ?? 0}</td>
                                            <td className="px-3 py-2">{entry.muntah ?? 0}</td>
                                            <td className="px-3 py-2">{entry.urine ?? 0}</td>
                                            <td className="px-3 py-2">{entry.bab ?? 0}</td>
                                            <td className="px-3 py-2">{entry.total_out ?? 0}</td>
                                            <td className="px-3 py-2 font-medium">{entry.balance ?? 0}</td>
                                            <td className="px-3 py-2">{entry.user || '-'}</td>
                                            <td className="px-3 py-2">
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant={selectedBalanceCairanId === entry.id ? 'default' : 'outline'}
                                                onClick={() => setSelectedBalanceCairanId(entry.id)}
                                              >
                                                {selectedBalanceCairanId === entry.id ? 'Dipilih' : 'Pilih'}
                                              </Button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </TabsContent>

                        <TabsContent value="ekstrapiramidal" className="space-y-4">
                          {renderEkstrapiramidalSection()}
                        </TabsContent>

                        {rehabMedikAccess && (
                          <TabsContent value="rehab-medik" className="space-y-4">
                            {renderRehabMedikSection()}
                          </TabsContent>
                        )}
                      </Tabs>
                    ) : renderDeferredTabState('pemeriksaan')}
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procedures">
          <Card>
            <CardHeader className="p-3 md:p-4">
              <CardTitle className="flex items-center justify-between">
                Riwayat Tindakan
                {/* <Button onClick={() => handleSaveForm('Tindakan')} className="ml-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah Tindakan
                </Button> */}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
              {/* Form Tambah Tindakan */}
              <Collapsible open={isProcedureFormOpen} onOpenChange={setIsProcedureFormOpen}>
                <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-primary transition-colors">
                      <div className="flex items-center">
                        <Plus className="h-5 w-5 mr-2" />
                        Form Tambah Tindakan
                      </div>
                      {isProcedureFormOpen ? (
                        <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 animate-accordion-down"
                    style={{
                      overflow: 'hidden',
                      transition: 'height 0.2s ease-out, opacity 0.2s ease-out'
                    }}
                  >
                <div className="grid grid-cols-1 gap-4 mb-4 md:max-w-sm">
                  <div className="space-y-2">
                    <Label htmlFor="procedure-status-rawat">Status Rawat</Label>
                    <Select
                      value={procedureStatusRawat}
                      onValueChange={(value: ProcedureStatusRawat) => handleProcedureStatusRawatChange(value)}
                    >
                      <SelectTrigger id="procedure-status-rawat">
                        <SelectValue placeholder="Pilih status rawat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ralan">Rawat Jalan</SelectItem>
                        <SelectItem value="Ranap">Rawat Inap</SelectItem>
                        <SelectItem value="IGD">IGD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {procedures.map((procedure, index) => (
                  <div key={index} className="border rounded-lg p-4 mb-4 bg-background">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`proc-nama-${index}`}>Cari Tindakan</Label>
                        <Popover
                          open={!!procedureSearchOpen[index]}
                          onOpenChange={(open) => {
                            setProcedureSearchOpen((previous) => ({ ...previous, [index]: open }));
                            if (open) {
                              const currentSearch = procedureSearchQuery[index] ?? procedure.nama ?? '';
                              void fetchProcedureOptions(index, currentSearch);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              id={`proc-nama-${index}`}
                              variant="outline"
                              role="combobox"
                              aria-expanded={!!procedureSearchOpen[index]}
                              className="w-full justify-between"
                              disabled={!formattedNoRawat}
                            >
                              <span className="truncate text-left">
                                {procedure.nama || (formattedNoRawat ? 'Cari dan pilih tindakan' : 'Pilih kunjungan/no_rawat dulu')}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0 md:w-[500px]" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Cari kode atau nama tindakan..."
                                value={procedureSearchQuery[index] ?? procedure.nama}
                                onValueChange={(value) => {
                                  setProcedureSearchQuery((previous) => ({ ...previous, [index]: value }));
                                  void fetchProcedureOptions(index, value);
                                }}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {procedureSearchLoading[index] ? 'Mencari tindakan...' : 'Tidak ada tindakan ditemukan.'}
                                </CommandEmpty>
                                <CommandGroup>
                                  {(procedureOptions[index] || []).map((option) => (
                                    <CommandItem
                                      key={`${option.kode}-${option.nama}`}
                                      value={`${option.kode} ${option.nama}`}
                                      onSelect={() => {
                                        updateProcedure(index, {
                                          kode: option.kode,
                                          nama: option.nama
                                        });
                                        setProcedureSearchQuery((previous) => ({
                                          ...previous,
                                          [index]: option.nama
                                        }));
                                        setProcedureSearchOpen((previous) => ({
                                          ...previous,
                                          [index]: false
                                        }));
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          procedure.kode === option.kode ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{option.nama}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {option.kode}
                                          {typeof option.biaya_rawat === 'number' ? ` • Rp ${option.biaya_rawat.toLocaleString('id-ID')}` : ''}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor={`proc-kode-${index}`}>Kode Tindakan</Label>
                        <div className="flex items-end gap-2">
                          <Input
                            id={`proc-kode-${index}`}
                            placeholder="Terisi otomatis"
                            value={procedure.kode}
                            readOnly
                            className="flex-1"
                          />
                          {procedures.length > 1 && (
                            <Button variant="destructive" size="sm" onClick={() => removeProcedure(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center">
                  <Button variant="outline" onClick={addProcedure}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Tindakan
                  </Button>
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={resetProcedureForm}>Reset</Button>
                    <Button onClick={() => handleSaveForm('Tindakan')}>Simpan Tindakan</Button>
                  </div>
                 </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Data Existing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data Tindakan</h3>
                <Tabs key={`procedures-${preferredCareSectionTab}`} defaultValue={preferredCareSectionTab} className="mt-2">
                  <TabsList className="mb-4">
                    <TabsTrigger value="outpatient">
                      <User className="mr-2 h-4 w-4" />
                      Rawat Jalan
                    </TabsTrigger>
                    <TabsTrigger value="inpatient">
                      <BedDouble className="mr-2 h-4 w-4" />
                      Rawat Inap
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="outpatient">
                    {isFocusedProceduresLoaded ? (
                      <div className="space-y-4">{renderProcedureCards(outpatientProcedures)}</div>
                    ) : renderDeferredTabState('tindakan')}
                  </TabsContent>
                  <TabsContent value="inpatient">
                    {isFocusedProceduresLoaded ? (
                      <div className="space-y-4">{renderProcedureCards(inpatientProcedures)}</div>
                    ) : renderDeferredTabState('tindakan')}
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medications">
          <Card>
            <CardHeader className="p-3 md:p-4">
              <CardTitle className="flex items-center justify-between">
                Riwayat Resep Obat
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
              {/* Form Tambah Resep */}
              <Collapsible open={isMedicationFormOpen} onOpenChange={setIsMedicationFormOpen}>
                <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-primary transition-colors">
                      <div className="flex items-center">
                        <Plus className="h-5 w-5 mr-2" />
                        {editingPrescriptionNo ? 'Form Edit Resep Obat' : 'Form Tambah Resep Obat'}
                      </div>
                      {isMedicationFormOpen ? (
                        <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 animate-accordion-down"
                    style={{
                      overflow: 'hidden',
                      transition: 'height 0.2s ease-out, opacity 0.2s ease-out'
                    }}
                  >
                
                {medications.map((medication, medIndex) => (
                  <div key={medIndex} className="border rounded-lg p-4 mb-4 bg-background">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h4 className="font-medium">Resep {medIndex + 1}</h4>
                        {editingPrescriptionNo ? (
                          <p className="text-xs text-muted-foreground">
                            Mode edit untuk nomor resep {editingPrescriptionNo}
                          </p>
                        ) : null}
                      </div>
                      {medications.length > 1 && (
                        <Button variant="destructive" size="sm" onClick={() => removeMedication(medIndex)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 mb-4 md:max-w-xl md:grid-cols-2">
                      <div>
                        <Label htmlFor={`med-date-${medIndex}`}>Tanggal Resep</Label>
                        <DatePickerPopover
                          triggerId={`med-date-${medIndex}`}
                          mode="single"
                          selected={medication.tanggal ? new Date(medication.tanggal) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            setMedications((previous) => previous.map((item, index) => (
                              index === medIndex
                                ? { ...item, tanggal: format(date, 'yyyy-MM-dd') }
                                : item
                            )));
                          }}
                          displayValue={medication.tanggal ? format(new Date(medication.tanggal), "dd/MM/yyyy") : undefined}
                          placeholder="Pilih tanggal resep"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`med-status-${medIndex}`}>Status Rawat</Label>
                        <Select
                          value={medication.status}
                          onValueChange={(value: PrescriptionStatus) => {
                            setMedications((previous) => previous.map((item, index) => (
                              index === medIndex
                                ? { ...item, status: value }
                                : item
                            )));
                          }}
                        >
                          <SelectTrigger id={`med-status-${medIndex}`} disabled={!!editingPrescriptionNo}>
                            <SelectValue placeholder="Pilih status rawat" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ralan">Rawat Jalan</SelectItem>
                            <SelectItem value="Ranap">Rawat Inap</SelectItem>
                            <SelectItem value="Pulang">Obat Pulang</SelectItem>
                            <SelectItem value="IBS">IBS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h5 className="font-medium">Daftar Obat:</h5>
                      {medication.obat.map((obat, obatIndex) => {
                        const fieldKey = getMedicineFieldKey(medIndex, obatIndex);

                        return (
                          <div key={obatIndex} className="grid grid-cols-1 gap-4 p-3 border rounded bg-muted/20 md:grid-cols-4">
                            <div className="md:col-span-2">
                              <Label htmlFor={`obat-nama-${medIndex}-${obatIndex}`}>Nama Obat</Label>
                              <Popover
                                open={!!medicineSearchOpen[fieldKey]}
                                onOpenChange={(open) => {
                                  setMedicineSearchOpen((previous) => ({ ...previous, [fieldKey]: open }));
                                  if (open) {
                                    const currentSearch = medicineSearchQuery[fieldKey] ?? obat.nama ?? '';
                                    void fetchMedicineOptions(medIndex, obatIndex, currentSearch);
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    id={`obat-nama-${medIndex}-${obatIndex}`}
                                    variant="outline"
                                    role="combobox"
                                    className="w-full justify-between"
                                    aria-expanded={!!medicineSearchOpen[fieldKey]}
                                  >
                                    <span className="truncate text-left">
                                      {obat.nama || 'Cari dan pilih obat'}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[350px] p-0 md:w-[500px]" align="start">
                                  <Command shouldFilter={false}>
                                    <CommandInput
                                      placeholder="Cari kode atau nama obat..."
                                      value={medicineSearchQuery[fieldKey] ?? obat.nama}
                                      onValueChange={(value) => {
                                        setMedicineSearchQuery((previous) => ({ ...previous, [fieldKey]: value }));
                                        void fetchMedicineOptions(medIndex, obatIndex, value);
                                      }}
                                    />
                                    <CommandList>
                                      <CommandEmpty>
                                        {medicineSearchLoading[fieldKey] ? 'Mencari obat...' : 'Tidak ada obat ditemukan.'}
                                      </CommandEmpty>
                                      <CommandGroup>
                                        {(medicineOptions[fieldKey] || []).map((option) => (
                                          <CommandItem
                                            key={`${option.kode_brng}-${fieldKey}`}
                                            value={`${option.kode_brng} ${option.nama_brng}`}
                                            onSelect={() => {
                                              updateMedicationItem(medIndex, obatIndex, {
                                                kode_brng: option.kode_brng,
                                                nama: option.nama_brng,
                                                satuan: option.satuan || '',
                                                stok: Number(option.stok) || 0
                                              });
                                              setMedicineSearchQuery((previous) => ({
                                                ...previous,
                                                [fieldKey]: option.nama_brng
                                              }));
                                              setMedicineSearchOpen((previous) => ({
                                                ...previous,
                                                [fieldKey]: false
                                              }));
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                obat.kode_brng === option.kode_brng ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col">
                                              <span>{option.nama_brng}</span>
                                              <span className="text-xs text-muted-foreground">
                                                {option.kode_brng}
                                                {option.satuan ? ` • ${option.satuan}` : ''}
                                                {typeof option.stok === 'number' ? ` • Stok ${option.stok}` : ''}
                                              </span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              {(obat.kode_brng || obat.stok) ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {obat.kode_brng || '-'}
                                  {obat.satuan ? ` • ${obat.satuan}` : ''}
                                  {typeof obat.stok === 'number' ? ` • Stok ${obat.stok}` : ''}
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <Label htmlFor={`obat-jumlah-${medIndex}-${obatIndex}`}>Jumlah</Label>
                              <Input
                                id={`obat-jumlah-${medIndex}-${obatIndex}`}
                                placeholder="10"
                                value={obat.jumlah}
                                onChange={(e) => updateMedicationItem(medIndex, obatIndex, { jumlah: e.target.value })}
                              />
                            </div>
                            <div>
                              <Label htmlFor={`obat-aturan-${medIndex}-${obatIndex}`}>Aturan Pakai</Label>
                              <div className="flex items-end gap-2">
                                <Input
                                  id={`obat-aturan-${medIndex}-${obatIndex}`}
                                  placeholder="3x1"
                                  value={obat.aturan_pakai}
                                  onChange={(e) => updateMedicationItem(medIndex, obatIndex, { aturan_pakai: e.target.value })}
                                />
                                {medication.obat.length > 1 && (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                      setMedications((previous) => previous.map((item, index) => (
                                        index === medIndex
                                          ? {
                                              ...item,
                                              obat: item.obat.filter((_, i) => i !== obatIndex)
                                            }
                                          : item
                                      )));
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const newMedications = [...medications];
                          newMedications[medIndex].obat.push({
                            kode_brng: '',
                            nama: '',
                            jumlah: '',
                            aturan_pakai: '',
                            satuan: '',
                            stok: 0
                          });
                          setMedications(newMedications);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Obat
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center">
                  <Button variant="outline" onClick={addMedication} disabled={!!editingPrescriptionNo}>
                    <Plus className="h-4 w-4 mr-2" />
                    {editingPrescriptionNo ? 'Mode Edit Aktif' : 'Tambah Resep'}
                  </Button>
                  <div className="flex space-x-2">
                    <Button variant="outline" onClick={resetMedicationForm}>Reset</Button>
                    <Button onClick={() => handleSaveForm('Resep')}>
                      {editingPrescriptionNo ? 'Update Resep' : 'Simpan Resep'}
                    </Button>
                  </div>
                 </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Form Resep Racikan */}
              <Collapsible open={isCompoundFormOpen} onOpenChange={setIsCompoundFormOpen}>
                <div className="border rounded-lg p-4 mb-6 bg-blue-50/50">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-blue-600 transition-colors text-blue-700">
                      <div className="flex items-center">
                        <Plus className="h-5 w-5 mr-2" />
                        Form Resep Racikan
                      </div>
                      {isCompoundFormOpen ? (
                        <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 animate-accordion-down"
                    style={{
                      overflow: 'hidden',
                      transition: 'height 0.2s ease-out, opacity 0.2s ease-out'
                    }}
                  >
                 
                 {compoundPrescriptions.map((compound, compoundIndex) => (
                   <div key={compoundIndex} className="border rounded-lg p-4 mb-4 bg-background">
                     <div className="flex justify-between items-center mb-4">
                       <h4 className="font-medium text-blue-700">Resep Racikan {compoundIndex + 1}</h4>
                       {compoundPrescriptions.length > 1 && (
                         <Button variant="destructive" size="sm" onClick={() => removeCompoundPrescription(compoundIndex)}>
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       )}
                     </div>
                    <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2 xl:grid-cols-3">
                       <div>
                         <Label htmlFor={`racikan-date-${compoundIndex}`}>Tanggal Resep</Label>
                        <DatePickerPopover
                          triggerId={`racikan-date-${compoundIndex}`}
                          mode="single"
                          selected={compound.tanggal ? new Date(compound.tanggal) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            setCompoundPrescriptions((previous) => previous.map((item, index) => (
                              index === compoundIndex
                                ? { ...item, tanggal: format(date, 'yyyy-MM-dd') }
                                : item
                            )));
                          }}
                          displayValue={compound.tanggal ? format(new Date(compound.tanggal), "dd/MM/yyyy") : undefined}
                          placeholder="Pilih tanggal resep"
                        />
                       </div>
                       <div>
                         <Label htmlFor={`racikan-nama-${compoundIndex}`}>Nama Racikan</Label>
                         <Input 
                           id={`racikan-nama-${compoundIndex}`} 
                           placeholder="Nama racikan"
                           value={compound.nama_racikan}
                           onChange={(e) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].nama_racikan = e.target.value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
                         />
                       </div>
                       <div>
                         <Label htmlFor={`racikan-jml-${compoundIndex}`}>Jumlah Racikan</Label>
                         <Input
                           id={`racikan-jml-${compoundIndex}`}
                           placeholder="10"
                           value={compound.jumlah}
                           onChange={(e) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].jumlah = e.target.value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
                         />
                       </div>
                       <div>
                         <Label htmlFor={`racikan-metode-${compoundIndex}`}>Metode Racik</Label>
                         <Select
                           value={compound.kd_racik}
                           onValueChange={(value) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].kd_racik = value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
                         >
                           <SelectTrigger id={`racikan-metode-${compoundIndex}`}>
                             <SelectValue placeholder="Pilih metode racik" />
                           </SelectTrigger>
                           <SelectContent>
                             {compoundMethods.map((method) => (
                               <SelectItem key={method.kd_racik} value={method.kd_racik}>
                                 {method.nm_racik}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div>
                         <Label htmlFor={`racikan-aturan-${compoundIndex}`}>Aturan Pakai</Label>
                         <Input
                           id={`racikan-aturan-${compoundIndex}`}
                           placeholder="3x1"
                           value={compound.aturan_pakai}
                           onChange={(e) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].aturan_pakai = e.target.value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
                         />
                       </div>
                       <div className="md:col-span-2 xl:col-span-3">
                         <Label htmlFor={`racikan-keterangan-${compoundIndex}`}>Keterangan</Label>
                         <Input
                           id={`racikan-keterangan-${compoundIndex}`}
                           placeholder="Keterangan racikan"
                           value={compound.keterangan}
                           onChange={(e) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].keterangan = e.target.value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
                         />
                       </div>
                     </div>

                 <div className="space-y-4">
                   <h5 className="font-medium text-blue-700">Komposisi Racikan:</h5>
                  {compound.komposisi.map((racikan, racikanIndex) => {
                    const fieldKey = getCompoundMedicineFieldKey(compoundIndex, racikanIndex);

                    return (
                    <div key={racikanIndex} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border rounded bg-blue-50/30">
                      <div>
                         <Label htmlFor={`racikan-obat-${compoundIndex}-${racikanIndex}`}>Nama Obat</Label>
                        <Popover
                          open={!!compoundMedicineSearchOpen[fieldKey]}
                          onOpenChange={(open) => {
                            setCompoundMedicineSearchOpen((previous) => ({ ...previous, [fieldKey]: open }));
                            if (open) {
                              const currentSearch = compoundMedicineSearchQuery[fieldKey] ?? racikan.nama ?? '';
                              void fetchCompoundMedicineOptions(compoundIndex, racikanIndex, currentSearch);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              id={`racikan-obat-${compoundIndex}-${racikanIndex}`}
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                              aria-expanded={!!compoundMedicineSearchOpen[fieldKey]}
                            >
                              <span className="truncate text-left">
                                {racikan.nama || 'Cari dan pilih obat'}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[350px] p-0 md:w-[500px]" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Cari kode atau nama obat..."
                                value={compoundMedicineSearchQuery[fieldKey] ?? racikan.nama}
                                onValueChange={(value) => {
                                  setCompoundMedicineSearchQuery((previous) => ({ ...previous, [fieldKey]: value }));
                                  void fetchCompoundMedicineOptions(compoundIndex, racikanIndex, value);
                                }}
                              />
                              <CommandList>
                                <CommandEmpty>
                                  {compoundMedicineSearchLoading[fieldKey] ? 'Mencari obat...' : 'Tidak ada obat ditemukan.'}
                                </CommandEmpty>
                                <CommandGroup>
                                  {(compoundMedicineOptions[fieldKey] || []).map((option) => (
                                    <CommandItem
                                      key={`${option.kode_brng}-${fieldKey}`}
                                      value={`${option.kode_brng} ${option.nama_brng}`}
                                      onSelect={() => {
                                        updateCompoundMedicineItem(compoundIndex, racikanIndex, {
                                          kode_brng: option.kode_brng,
                                          nama: option.nama_brng,
                                          satuan: option.satuan || '',
                                          stok: Number(option.stok) || 0
                                        });
                                        setCompoundMedicineSearchQuery((previous) => ({
                                          ...previous,
                                          [fieldKey]: option.nama_brng
                                        }));
                                        setCompoundMedicineSearchOpen((previous) => ({
                                          ...previous,
                                          [fieldKey]: false
                                        }));
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          racikan.kode_brng === option.kode_brng ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <div className="flex flex-col">
                                        <span>{option.nama_brng}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {option.kode_brng}
                                          {option.satuan ? ` • ${option.satuan}` : ''}
                                          {typeof option.stok === 'number' ? ` • Stok ${option.stok}` : ''}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {(racikan.kode_brng || racikan.stok) ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {racikan.kode_brng || '-'}
                            {racikan.satuan ? ` • ${racikan.satuan}` : ''}
                            {typeof racikan.stok === 'number' ? ` • Stok ${racikan.stok}` : ''}
                          </p>
                        ) : null}
                       </div>
                       <div>
                         <Label htmlFor={`racikan-jumlah-${compoundIndex}-${racikanIndex}`}>Kandungan</Label>
                         <Input 
                           id={`racikan-jumlah-${compoundIndex}-${racikanIndex}`}
                           placeholder="500 / 1/2 / 250mg"
                           value={racikan.jumlah}
                          onChange={(e) => updateCompoundMedicineItem(compoundIndex, racikanIndex, { jumlah: e.target.value })}
                         />
                       </div>
                       <div className="flex items-end">
                         {compound.komposisi.length > 1 && (
                           <Button variant="destructive" size="sm" onClick={() => removeRacikanMedicine(compoundIndex, racikanIndex)}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         )}
                       </div>
                     </div>
                    );
                  })}
                   <Button variant="outline" size="sm" onClick={() => addRacikanMedicine(compoundIndex)}>
                     <Plus className="h-4 w-4 mr-2" />
                     Tambah Komposisi
                   </Button>
                 </div>
               </div>
             ))}

             <div className="flex justify-between items-center">
               <Button variant="outline" onClick={addCompoundPrescription}>
                 <Plus className="h-4 w-4 mr-2" />
                 Tambah Resep Racikan
               </Button>
               <div className="flex space-x-2">
                <Button variant="outline" onClick={resetCompoundForm}>Reset</Button>
                 <Button onClick={() => handleSaveForm('Resep Racikan')} className="bg-blue-600 hover:bg-blue-700">
                   Simpan Resep Racikan
                 </Button>
               </div>
             </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {statusRawat === 'Ralan' || statusRawat === 'Ranap' ? (
                <Collapsible open={isPackageFormOpen} onOpenChange={setIsPackageFormOpen}>
                  <div className="border rounded-lg p-4 mb-6 bg-emerald-50/40">
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-emerald-700 transition-colors text-emerald-800">
                        <div className="flex items-center">
                          <Plus className="h-5 w-5 mr-2" />
                          Form Paket Obat & BHP
                        </div>
                        {isPackageFormOpen ? (
                          <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                        ) : (
                          <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                        )}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent
                      className="space-y-4 animate-accordion-down"
                      style={{
                        overflow: 'hidden',
                        transition: 'height 0.2s ease-out, opacity 0.2s ease-out'
                      }}
                    >
                      <div className="flex flex-col gap-3 rounded-md border border-emerald-200 bg-emerald-100/40 p-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium text-emerald-900">Paket Obat & BHP</p>
                          <p className="text-xs text-emerald-800/80">
                            Centang Paket IBS untuk ambil stok depo IBS dan simpan resep ke alur IBS.
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={packageIsIbs}
                            onChange={(event) => setPackageIsIbs(event.target.checked)}
                            disabled={!!editingPrescriptionNo}
                          />
                          Paket IBS
                        </label>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
                        <div className="md:col-span-2">
                          <Label htmlFor="package-select">Nama Paket Obat & BHP</Label>
                          <Popover
                            open={packageSearchOpen}
                            onOpenChange={(open) => {
                              setPackageSearchOpen(open);
                              if (open) {
                                void fetchPackageOptions(packageSearchQuery);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                id="package-select"
                                variant="outline"
                                role="combobox"
                                className="w-full justify-between"
                                aria-expanded={packageSearchOpen}
                                disabled={!!editingPrescriptionNo}
                              >
                                <span className="truncate text-left">
                                  {selectedPackageId
                                    ? (selectedPackageText || selectedPackageId)
                                    : 'Cari dan pilih paket'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0 md:w-[500px]" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Cari kode atau nama paket..."
                                  value={packageSearchQuery}
                                  onValueChange={(value) => {
                                    setPackageSearchQuery(value);
                                    void fetchPackageOptions(value);
                                  }}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {packageSearchLoading ? 'Mencari paket...' : 'Tidak ada paket ditemukan.'}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {packageOptions.map((option) => (
                                      <CommandItem
                                        key={option.id}
                                        value={option.text}
                                        onSelect={() => {
                                          setSelectedPackageId(String(option.id));
                                          setSelectedPackageText(option.text);
                                          setPackageItems([]);
                                          setPackageSearchOpen(false);
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedPackageId === String(option.id) ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col">
                                          <span>{option.text}</span>
                                          <span className="text-xs text-muted-foreground">{option.id}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void loadPackageItems()}
                            disabled={!selectedPackageId || packageItemsLoading || !!editingPrescriptionNo}
                          >
                            {packageItemsLoading ? 'Loading...' : 'Pilih Paket'}
                          </Button>
                          <Button
                            type="button"
                            onClick={applyPackageItemsToMedicationForm}
                            disabled={!packageItems.length || !!editingPrescriptionNo}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Masukkan ke Resep
                          </Button>
                        </div>
                      </div>

                      {packageItems.length ? (
                        <div className="overflow-x-auto border rounded bg-background">
                          <table className="w-full text-sm">
                            <thead className="bg-muted/40">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Nama</th>
                                <th className="px-3 py-2 text-left font-medium">Jumlah</th>
                                <th className="px-3 py-2 text-left font-medium">Aturan</th>
                                <th className="px-3 py-2 text-left font-medium">Stok</th>
                              </tr>
                            </thead>
                            <tbody>
                              {packageItems.map((item, index) => (
                                <tr key={`${item.kode_brng}-${index}`} className="border-t">
                                  <td className="px-3 py-2">
                                    <div className="flex flex-col">
                                      <span className="font-medium">{item.nama_brng}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {item.kode_brng}
                                        {item.satuan ? ` • ${item.satuan}` : ''}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2">{String(item.jumlah ?? '')}</td>
                                  <td className="px-3 py-2">{item.aturan_pakai || '-'}</td>
                                  <td className="px-3 py-2">{typeof item.stok === 'number' ? item.stok : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ) : null}

              {/* Data Existing */}
              <Tabs defaultValue="history" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="current">Data Resep Obat</TabsTrigger>
                  <TabsTrigger value="history">Riwayat Pemberian Obat</TabsTrigger>
                </TabsList>

                {/* Tab Data Resep Obat */}
                <TabsContent value="current">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Resep Obat</h3>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'umum', label: 'Umum' },
                        { value: 'racikan', label: 'Racikan' },
                        ...(medicationCurrentCareTab === 'inpatient'
                          ? [
                              { value: 'pulang', label: 'Obat Pulang' },
                              { value: 'ibs', label: 'Obat IBS' }
                            ]
                          : []),
                        { value: 'package', label: 'Paket Obat & BHP' }
                      ].map((filterOption) => (
                        <Button
                          key={filterOption.value}
                          type="button"
                          variant={medicationRequestFilter === filterOption.value ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMedicationRequestFilter(filterOption.value as MedicationRequestFilterValue)}
                        >
                          {filterOption.label}
                        </Button>
                      ))}
                    </div>
                    <Tabs
                      key={`medications-current-${preferredCareSectionTab}`}
                      value={medicationCurrentCareTab}
                      onValueChange={(value) => setMedicationCurrentCareTab(value as CareSectionTabValue)}
                      className="mt-2"
                    >
                      <TabsList className="mb-4">
                        <TabsTrigger value="outpatient">
                          <User className="mr-2 h-4 w-4" />
                          Rawat Jalan
                        </TabsTrigger>
                        <TabsTrigger value="inpatient">
                          <BedDouble className="mr-2 h-4 w-4" />
                          Rawat Inap
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="outpatient">
                        {isFocusedMedicationsLoaded ? (
                          <div className="space-y-4">
                            {renderMedicationCards(displayedOutpatientMedicationRequests, true)}
                            {!showAllOutpatientMedicationRequests && hasMoreOutpatientMedicationRequests ? (
                              <div className="flex justify-center pt-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void handleLoadAllOutpatientMedicationRequests()}
                                  disabled={loadingAllOutpatientMedicationRequests}
                                >
                                  {loadingAllOutpatientMedicationRequests ? 'Loading...' : 'See More'}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : renderDeferredTabState('resep')}
                      </TabsContent>
                      <TabsContent value="inpatient">
                        {isFocusedMedicationsLoaded ? (
                          <div className="space-y-4">
                            {renderMedicationCards(displayedInpatientMedicationRequests, true)}
                            {!showAllInpatientMedicationRequests && hasMoreInpatientMedicationRequests ? (
                              <div className="flex justify-center pt-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => void handleLoadAllInpatientMedicationRequests()}
                                  disabled={loadingAllInpatientMedicationRequests}
                                >
                                  {loadingAllInpatientMedicationRequests ? 'Loading...' : 'See More'}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        ) : renderDeferredTabState('resep')}
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                {/* Tab Riwayat Resep Obat */}
                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Pemberian Obat</h3>
                    <Tabs key={`medications-history-${preferredCareSectionTab}`} defaultValue={preferredCareSectionTab} className="mt-2">
                      <TabsList className="mb-4">
                        <TabsTrigger value="outpatient">
                          <User className="mr-2 h-4 w-4" />
                          Rawat Jalan
                        </TabsTrigger>
                        <TabsTrigger value="inpatient">
                          <BedDouble className="mr-2 h-4 w-4" />
                          Rawat Inap
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="outpatient">
                        {isFocusedMedicationsLoaded ? (
                          <div className="space-y-4">{renderMedicationCards(outpatientMedicationHistory, false)}</div>
                        ) : renderDeferredTabState('riwayat pemberian obat')}
                      </TabsContent>
                      <TabsContent value="inpatient">
                        {isFocusedMedicationsLoaded ? (
                          <div className="space-y-4">{renderMedicationCards(inpatientMedicationHistory, false)}</div>
                        ) : renderDeferredTabState('riwayat pemberian obat')}
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

              </Tabs>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="laboratory">
          <Card>
            <CardHeader className="p-3 md:p-4">
              <CardTitle className="flex items-center justify-between">
                Riwayat Laboratorium
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
              {/* Form Tambah Lab */}
              <Collapsible open={isLabFormOpen} onOpenChange={setIsLabFormOpen}>
                <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-primary transition-colors">
                      <div className="flex items-center">
                        <Plus className="h-5 w-5 mr-2" />
                        {editingLabRequestNo ? `Form Edit Laboratorium (${editingLabRequestNo})` : 'Form Tambah Laboratorium'}
                      </div>
                      {isLabFormOpen ? (
                        <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 animate-accordion-down"
                    style={{
                      overflow: 'hidden',
                      transition: 'height 0.2s ease-out, opacity 0.2s ease-out'
                    }}
                  >
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label htmlFor="lab-request-date">Tanggal Permintaan</Label>
                    <Input
                      id="lab-request-date"
                      value={format(new Date(), 'yyyy-MM-dd HH:mm')}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lab-norawat">No. Rawat</Label>
                    <Input id="lab-norawat" value={labFormNoRawat || formattedNoRawat} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label htmlFor="lab-status-rawat">Status Rawat</Label>
                    <Select
                      value={labStatusRawat}
                      onValueChange={(value: LabStatusRawat) => handleLabStatusRawatChange(value)}
                    >
                      <SelectTrigger id="lab-status-rawat">
                        <SelectValue placeholder="Pilih status rawat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ralan">Rawat Jalan</SelectItem>
                        <SelectItem value="Ranap">Rawat Inap</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mb-4">
                  <Label htmlFor="lab-klinis">Klinis</Label>
                  <Input
                    id="lab-klinis"
                    value={labKlinis}
                    onChange={(event) => setLabKlinis(event.target.value)}
                    placeholder="Masukkan keterangan klinis"
                  />
                </div>

                <div className="space-y-4">
                  <h5 className="font-medium">Permintaan Pemeriksaan Laboratorium:</h5>
                  {labTests.map((test, index) => (
                    <div key={index} className="border rounded-lg p-4 bg-background">
                      <div className="flex justify-between items-center mb-4">
                        <h6 className="font-medium">Pemeriksaan {index + 1}</h6>
                        {labTests.length > 1 && (
                          <Button variant="destructive" size="sm" onClick={() => removeLabTest(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-3">
                          <Label htmlFor={`lab-nama-${index}`}>Cari Pemeriksaan</Label>
                          <Popover
                            open={!!labServiceSearchOpen[index]}
                            onOpenChange={(open) => {
                              setLabServiceSearchOpen((previous) => ({ ...previous, [index]: open }));
                              if (open && labServiceOptions.length === 0) {
                                void fetchLabServiceOptions();
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                id={`lab-nama-${index}`}
                                variant="outline"
                                role="combobox"
                                aria-expanded={!!labServiceSearchOpen[index]}
                                className="w-full justify-between"
                                disabled={!formattedNoRawat}
                              >
                                <span className="truncate text-left">
                                  {test.pemeriksaan || (formattedNoRawat ? 'Cari dan pilih pemeriksaan laboratorium' : 'Pilih kunjungan/no_rawat dulu')}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0 md:w-[500px]" align="start">
                              <Command>
                                <CommandInput
                                  placeholder="Cari kode atau nama pemeriksaan..."
                                  value={labServiceSearchQuery[index] ?? test.pemeriksaan}
                                  onValueChange={(value) => {
                                    setLabServiceSearchQuery((previous) => ({ ...previous, [index]: value }));
                                  }}
                                />
                                <CommandList>
                                  <CommandEmpty>
                                    {labServiceSearchLoading ? 'Memuat pemeriksaan...' : 'Tidak ada pemeriksaan ditemukan.'}
                                  </CommandEmpty>
                                  <CommandGroup>
                                    {labServiceOptions.map((option) => (
                                      <CommandItem
                                        key={option.kd_jenis_prw}
                                        value={`${option.kd_jenis_prw} ${option.nm_perawatan}`}
                                        onSelect={() => {
                                          setLabTests((previous) => previous.map((item, itemIndex) => (
                                            itemIndex === index
                                              ? {
                                                  ...item,
                                                  kode: option.kd_jenis_prw,
                                                  pemeriksaan: option.nm_perawatan,
                                                  hasil: '',
                                                  rujukan: '',
                                                  keterangan: ''
                                                }
                                              : item
                                          )));
                                          void fetchLabTemplates(index, option.kd_jenis_prw);
                                          setLabServiceSearchQuery((previous) => ({
                                            ...previous,
                                            [index]: option.nm_perawatan
                                          }));
                                          setLabServiceSearchOpen((previous) => ({
                                            ...previous,
                                            [index]: false
                                          }));
                                        }}
                                      >
                                        <Check
                                          className={cn(
                                            "mr-2 h-4 w-4",
                                            test.kode === option.kd_jenis_prw ? "opacity-100" : "opacity-0"
                                          )}
                                        />
                                        <div className="flex flex-col">
                                          <span>{option.nm_perawatan}</span>
                                          <span className="text-xs text-muted-foreground">
                                            {option.kd_jenis_prw}
                                            {typeof option.total_byr === 'number' ? ` • Rp ${option.total_byr.toLocaleString('id-ID')}` : ''}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <Label htmlFor={`lab-kode-${index}`}>Kode Pemeriksaan</Label>
                          <Input
                            id={`lab-kode-${index}`}
                            placeholder="Terisi otomatis"
                            value={test.kode || ''}
                            readOnly
                            className="bg-muted"
                          />
                        </div>
                      </div>
                      {test.kode ? (
                        <div className="mt-4 rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <h6 className="font-medium text-sm">Template Pemeriksaan</h6>
                            {labTemplateLoadingByIndex[index] ? (
                              <span className="text-xs text-muted-foreground">Memuat template...</span>
                            ) : null}
                          </div>
                          {labTemplatesByIndex[index]?.length ? (
                            <div className="mt-3 space-y-2">
                              {labTemplatesByIndex[index].map((template) => (
                                <div
                                  key={`${template.id_template}-${template.Pemeriksaan}`}
                                  className="rounded border bg-background p-3"
                                >
                                  <p className="font-medium">{template.Pemeriksaan}</p>
                                  {/* <p className="text-xs text-muted-foreground">
                                    ID Template: {template.id_template}
                                    {template.satuan ? ` • Satuan: ${template.satuan}` : ''}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Rujukan LD: {template.nilai_rujukan_ld || '-'}
                                    {' • '}
                                    LA: {template.nilai_rujukan_la || '-'}
                                    {' • '}
                                    PD: {template.nilai_rujukan_pd || '-'}
                                    {' • '}
                                    PA: {template.nilai_rujukan_pa || '-'}
                                  </p> */}
                                </div>
                              ))}
                            </div>
                          ) : !labTemplateLoadingByIndex[index] ? (
                            <p className="mt-2 text-sm italic text-muted-foreground">
                              Template laboratorium untuk pemeriksaan ini belum tersedia.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <Button variant="outline" onClick={addLabTest}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Pemeriksaan
                  </Button>
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline" onClick={resetLabForm}>Reset</Button>
                  <Button onClick={() => handleSaveForm('Laboratorium')}>
                    {editingLabRequestNo ? 'Update Permintaan Lab' : 'Simpan Permintaan Lab'}
                  </Button>
                 </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Drag & Drop Canvas */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 bg-gray-50/50">
                <h4 className="text-lg font-semibold mb-4 text-center">
                  🧪 Drag & Drop Lab Results Canvas
                </h4>
                <div 
                  className="min-h-[200px] bg-white border rounded-lg p-4"
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingLab) {
                      addLaboratoryResultToCanvas(draggingLab);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {canvasItems.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      Drop lab results here...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {canvasItems.filter(item => item.type === 'laboratory').map((item, index) => (
                        <div key={index} className="border rounded-lg p-3 bg-blue-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{formatDateSafe(item.content.tanggal)}</p>
                              <div className="space-y-1 mt-2">
                                {Array.isArray((item.content as any).perawatans) && (item.content as any).perawatans.length > 0 ? 
                                  (item.content as any).perawatans.map((lab: any, labIndex: number) => (
                                    <div key={labIndex} className="mb-2">
                                      <p className="font-semibold text-primary">{lab.nm_perawatan}</p>
                                      {Array.isArray(lab.hasil) && lab.hasil.length > 0 ? (
                                        lab.hasil.map((test: any, testIndex: number) => (
                                          <div
                                            key={testIndex}
                                            className={cn(
                                              "text-sm ml-4 rounded px-2 py-1",
                                              test.keterangan === 'H' && "bg-red-100 text-red-900",
                                              test.keterangan === 'L' && "bg-yellow-100 text-yellow-900"
                                            )}
                                          >
                                            <span className="font-medium">{test.pemeriksaan}:</span> {test.nilai} ({test.nilai_rujukan})
                                            {test.keterangan ? ` - ${test.keterangan}` : ''}
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm italic text-muted-foreground ml-4">Tidak ada hasil pemeriksaan.</div>
                                      )}
                                    </div>
                                  )) :
                                  Array.isArray((item.content as any).pemeriksaan) && (item.content as any).pemeriksaan.length > 0 ? (
                                    Object.entries(
                                      ((item.content as any).pemeriksaan as LabTest[]).reduce<Record<string, LabTest[]>>((groups, test) => {
                                        const key = test.nama?.trim() || '-';
                                        if (!groups[key]) {
                                          groups[key] = [];
                                        }
                                        groups[key].push(test);
                                        return groups;
                                      }, {})
                                    ).map(([groupName, tests], groupIndex) => (
                                      <div key={`${groupName}-${groupIndex}`} className="mb-2 rounded border bg-background p-2">
                                        <p className="font-semibold text-primary">{groupName}</p>
                                        <div className="mt-2 space-y-1">
                                          {tests.map((test, testIndex) => (
                                            <div
                                              key={`${groupName}-${testIndex}`}
                                              className={cn(
                                                "text-sm rounded px-2 py-1",
                                                test.keterangan === 'H' && "bg-red-100 text-red-900",
                                                test.keterangan === 'L' && "bg-yellow-100 text-yellow-900"
                                              )}
                                            >
                                              <span className="font-medium">{test.pemeriksaan || '-'}</span>: {test.hasil || '-'} ({test.rujukan || '-'})
                                              {test.keterangan ? ` - ${test.keterangan}` : ''}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-sm italic text-muted-foreground">Tidak ada hasil pemeriksaan.</div>
                                  )
                                }
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                const actualIndex = canvasItems.findIndex(canvasItem => 
                                  canvasItem.type === 'laboratory' && 
                                  canvasItem.content.tanggal === item.content.tanggal &&
                                  canvasItem.content.jam === item.content.jam &&
                                  JSON.stringify(canvasItem.content.hasil) === JSON.stringify(item.content.hasil)
                                );
                                
                                if (actualIndex !== -1) {
                                  setCanvasItems(canvasItems.filter((_, i) => i !== actualIndex));
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Data Existing - Draggable */}
              <Tabs defaultValue="history" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="current">Permintaan Laboratorium</TabsTrigger>
                  <TabsTrigger value="history">Hasil Laboratorium</TabsTrigger>
                </TabsList>

                {/* Tab Data Permintaan Lab */}
                <TabsContent value="current">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Data Permintaan Laboratorium</h3>
                    <Tabs key={`laboratory-current-${preferredCareSectionTab}`} defaultValue={preferredCareSectionTab} className="mt-2">
                      <TabsList className="mb-4">
                        <TabsTrigger value="outpatient">
                          <User className="mr-2 h-4 w-4" />
                          Rawat Jalan
                        </TabsTrigger>
                        <TabsTrigger value="inpatient">
                          <BedDouble className="mr-2 h-4 w-4" />
                          Rawat Inap
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="outpatient">
                        {isFocusedLaboratoryLoaded ? (
                          <div className="space-y-4">{renderLaboratoryRequestCards(outpatientLaboratoryRequests)}</div>
                        ) : renderDeferredTabState('permintaan laboratorium')}
                      </TabsContent>
                      <TabsContent value="inpatient">
                        {isFocusedLaboratoryLoaded ? (
                          <div className="space-y-4">{renderLaboratoryRequestCards(inpatientLaboratoryRequests)}</div>
                        ) : renderDeferredTabState('permintaan laboratorium')}
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                {/* Tab Riwayat Pemeriksaan Lab */}
                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Pemeriksaan Laboratorium (Draggable)</h3>
                    <Tabs key={`laboratory-history-${preferredCareSectionTab}`} defaultValue={preferredCareSectionTab} className="mt-2">
                      <TabsList className="mb-4">
                        <TabsTrigger value="outpatient">
                          <User className="mr-2 h-4 w-4" />
                          Rawat Jalan
                        </TabsTrigger>
                        <TabsTrigger value="inpatient">
                          <BedDouble className="mr-2 h-4 w-4" />
                          Rawat Inap
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="outpatient">
                        {isFocusedLaboratoryLoaded ? (
                          <div className="space-y-4">{renderLaboratoryHistoryCards(outpatientLaboratoryHistory)}</div>
                        ) : renderDeferredTabState('hasil laboratorium')}
                      </TabsContent>
                      <TabsContent value="inpatient">
                        {isFocusedLaboratoryLoaded ? (
                          <div className="space-y-4">{renderLaboratoryHistoryCards(laboratoryHistoryInpatientView)}</div>
                        ) : renderDeferredTabState('hasil laboratorium')}
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

              </Tabs>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="radiology">
          <Card>
            <CardHeader className="p-3 md:p-4">
              <CardTitle>Riwayat Radiologi</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-4">
              {/* Form Tambah Radiologi */}
              <Collapsible open={isRadiologyFormOpen} onOpenChange={setIsRadiologyFormOpen}>
                <div className="border rounded-lg p-4 mb-6 bg-muted/30">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-lg font-semibold mb-4 hover:text-primary transition-colors">
                      <div className="flex items-center">
                        <Plus className="h-5 w-5 mr-2" />
                        {editingRadiologyRequestNo ? `Form Edit Radiologi (${editingRadiologyRequestNo})` : 'Form Tambah Radiologi'}
                      </div>
                      {isRadiologyFormOpen ? (
                        <ChevronUp className="h-5 w-5 transition-transform duration-200" />
                      ) : (
                        <ChevronDown className="h-5 w-5 transition-transform duration-200" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 animate-accordion-down"
                    style={{
                      overflow: 'hidden',
                      transition: 'height 0.2s ease-out, opacity 0.2s ease-out'
                    }}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <Label htmlFor="rad-request-date">Tanggal Permintaan</Label>
                        <Input
                          id="rad-request-date"
                          value={format(new Date(), 'yyyy-MM-dd HH:mm')}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                      <div>
                        <Label htmlFor="rad-norawat">No. Rawat</Label>
                        <Input id="rad-norawat" value={radiologyFormNoRawat || formattedNoRawat} readOnly className="bg-muted" />
                      </div>
                      <div>
                        <Label htmlFor="rad-status-rawat">Status Rawat</Label>
                        <Select
                          value={radiologyStatusRawat}
                          onValueChange={(value: RadiologyStatusRawat) => handleRadiologyStatusRawatChange(value)}
                        >
                          <SelectTrigger id="rad-status-rawat">
                            <SelectValue placeholder="Pilih status rawat" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ralan">Rawat Jalan</SelectItem>
                            <SelectItem value="Ranap">Rawat Inap</SelectItem>
                            <SelectItem value="IGD">IGD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mb-4">
                      <Label htmlFor="rad-klinis">Klinis</Label>
                      <Input
                        id="rad-klinis"
                        value={radiologyKlinis}
                        onChange={(event) => setRadiologyKlinis(event.target.value)}
                        placeholder="Masukkan keterangan klinis"
                      />
                    </div>

                    {radiologies.map((radiology, index) => (
                      <div key={index} className="border rounded-lg p-4 mb-4 bg-background">
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="font-medium">Pemeriksaan Radiologi {index + 1}</h4>
                          {radiologies.length > 1 && (
                            <Button variant="destructive" size="sm" onClick={() => removeRadiology(index)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="md:col-span-3">
                            <Label htmlFor={`rad-pemeriksaan-${index}`}>Cari Pemeriksaan</Label>
                            <Popover
                              open={!!radiologySearchOpen[index]}
                              onOpenChange={(open) => {
                                setRadiologySearchOpen((previous) => ({ ...previous, [index]: open }));
                                if (open && radiologyServiceOptions.length === 0) {
                                  void fetchRadiologyServiceOptions();
                                }
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  id={`rad-pemeriksaan-${index}`}
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={!!radiologySearchOpen[index]}
                                  className="w-full justify-between"
                                  disabled={!formattedNoRawat}
                                >
                                  <span className="truncate text-left">
                                    {radiology.pemeriksaan || (formattedNoRawat ? 'Cari dan pilih pemeriksaan radiologi' : 'Pilih kunjungan/no_rawat dulu')}
                                  </span>
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[350px] p-0 md:w-[500px]" align="start">
                                <Command>
                                  <CommandInput
                                    placeholder="Cari kode atau nama pemeriksaan..."
                                    value={radiologySearchQuery[index] ?? radiology.pemeriksaan}
                                    onValueChange={(value) => {
                                      setRadiologySearchQuery((previous) => ({ ...previous, [index]: value }));
                                    }}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      {radiologySearchLoading ? 'Memuat pemeriksaan...' : 'Tidak ada pemeriksaan ditemukan.'}
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {radiologyServiceOptions.map((option) => (
                                        <CommandItem
                                          key={option.kd_jenis_prw}
                                          value={`${option.kd_jenis_prw} ${option.nm_perawatan}`}
                                          onSelect={() => {
                                            setRadiologies((previous) => previous.map((item, itemIndex) => (
                                              itemIndex === index
                                                ? {
                                                    ...item,
                                                    kode: option.kd_jenis_prw,
                                                    pemeriksaan: option.nm_perawatan
                                                  }
                                                : item
                                            )));
                                            setRadiologySearchQuery((previous) => ({
                                              ...previous,
                                              [index]: option.nm_perawatan
                                            }));
                                            setRadiologySearchOpen((previous) => ({
                                              ...previous,
                                              [index]: false
                                            }));
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              radiology.kode === option.kd_jenis_prw ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          <div className="flex flex-col">
                                            <span>{option.nm_perawatan}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {option.kd_jenis_prw}
                                              {typeof option.total_byr === 'number' ? ` • Rp ${option.total_byr.toLocaleString('id-ID')}` : ''}
                                            </span>
                                          </div>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div>
                            <Label htmlFor={`rad-kode-${index}`}>Kode Pemeriksaan</Label>
                            <Input
                              id={`rad-kode-${index}`}
                              placeholder="Terisi otomatis"
                              value={radiology.kode}
                              readOnly
                              className="bg-muted"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-between items-center">
                      <Button variant="outline" onClick={addRadiology}>
                        <Plus className="h-4 w-4 mr-2" />
                        Tambah Pemeriksaan
                      </Button>
                      <div className="flex space-x-2">
                        <Button variant="outline" onClick={resetRadiologyForm}>Reset</Button>
                        <Button onClick={() => handleSaveForm('Radiologi')}>
                          {editingRadiologyRequestNo ? 'Update Permintaan Radiologi' : 'Simpan Permintaan Radiologi'}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Drag & Drop Canvas */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 mb-6 bg-gray-50/50">
                <h4 className="text-lg font-semibold mb-4 text-center">
                  🏥 Drag & Drop Radiology Results Canvas
                </h4>
                <div 
                  className="min-h-[200px] bg-white border rounded-lg p-4"
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggingRad) {
                      addRadiologyResultToCanvas(draggingRad);
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {canvasItems.filter(item => item.type === 'radiology').length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      Drop radiology results here...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {canvasItems.filter(item => item.type === 'radiology').map((item, index) => (
                        <div key={`${(item.content as any).tanggal}-${(item.content as any).pemeriksaan}-${index}`} className="border rounded-lg p-3 bg-blue-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{formatDateSafe((item.content as any).tanggal)}</p>
                              <div className="space-y-1 mt-2">
                                <div className="text-sm">
                                  <span className="font-medium">Pemeriksaan:</span> {(item.content as any).pemeriksaan}
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">Hasil:</span> {(item.content as any).hasil}
                                </div>
                                {(item.content as any).keterangan && (
                                  <div className="text-sm">
                                    <span className="font-medium">Keterangan:</span> {(item.content as any).keterangan}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                // Find the actual index in the original canvasItems array
                                const actualIndex = canvasItems.findIndex(canvasItem => 
                                  canvasItem.type === 'radiology' && 
                                  (canvasItem.content as any).tanggal === (item.content as any).tanggal &&
                                  (canvasItem.content as any).pemeriksaan === (item.content as any).pemeriksaan &&
                                  (canvasItem.content as any).hasil === (item.content as any).hasil
                                );
                                
                                if (actualIndex !== -1) {
                                  setCanvasItems(canvasItems.filter((_, i) => i !== actualIndex));
                                }
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Tabs defaultValue="history" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="current">Permintaan Radiologi</TabsTrigger>
                  <TabsTrigger value="history">Hasil Radiologi</TabsTrigger>
                </TabsList>

                <TabsContent value="current">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Data Permintaan Radiologi</h3>
                    <Tabs key={`radiology-current-${preferredCareSectionTab}`} defaultValue={preferredCareSectionTab} className="mt-2">
                      <TabsList className="mb-4">
                        <TabsTrigger value="outpatient">
                          <User className="mr-2 h-4 w-4" />
                          Rawat Jalan
                        </TabsTrigger>
                        <TabsTrigger value="inpatient">
                          <BedDouble className="mr-2 h-4 w-4" />
                          Rawat Inap
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="outpatient">
                        {isFocusedRadiologyLoaded ? (
                          <div className="space-y-4">{renderRadiologyRequestCards(outpatientRadiologyRequests)}</div>
                        ) : renderDeferredTabState('permintaan radiologi')}
                      </TabsContent>
                      <TabsContent value="inpatient">
                        {isFocusedRadiologyLoaded ? (
                          <div className="space-y-4">{renderRadiologyRequestCards(inpatientRadiologyRequests)}</div>
                        ) : renderDeferredTabState('permintaan radiologi')}
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Radiologi (Draggable)</h3>
                    <Tabs key={`radiology-history-${preferredCareSectionTab}`} defaultValue={preferredCareSectionTab} className="mt-2">
                      <TabsList className="mb-4">
                        <TabsTrigger value="outpatient">
                          <User className="mr-2 h-4 w-4" />
                          Rawat Jalan
                        </TabsTrigger>
                        <TabsTrigger value="inpatient">
                          <BedDouble className="mr-2 h-4 w-4" />
                          Rawat Inap
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="outpatient">
                        {isFocusedRadiologyLoaded ? (
                          <div className="space-y-4">{renderRadiologyHistoryCards(outpatientRadiologyHistory)}</div>
                        ) : renderDeferredTabState('hasil radiologi')}
                      </TabsContent>
                      <TabsContent value="inpatient">
                        {isFocusedRadiologyLoaded ? (
                          <div className="space-y-4">{renderRadiologyHistoryCards(radiologyHistoryInpatientView)}</div>
                        ) : renderDeferredTabState('hasil radiologi')}
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {activeTab === 'visits' ? (
        <div
          ref={loadMoreRef}
          className="rounded-lg border border-dashed bg-white/70 px-4 py-5 text-center text-sm text-muted-foreground"
        >
          {loadingMoreVisits ? (
            <div className="flex items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary"></div>
              <span>Memuat riwayat {visitHistoryTab === 'outpatient' ? 'rawat jalan' : 'rawat inap'} berikutnya...</span>
            </div>
          ) : hasMoreCurrentVisitTab ? (
            <span>Gulir ke bawah untuk memuat riwayat {visitHistoryTab === 'outpatient' ? 'rawat jalan' : 'rawat inap'} berikutnya.</span>
          ) : medicalData ? (
            <span>Semua riwayat {visitHistoryTab === 'outpatient' ? 'rawat jalan' : 'rawat inap'} yang tersedia sudah dimuat.</span>
          ) : (
            <span>Belum ada data riwayat untuk ditampilkan.</span>
          )}
        </div>
      ) : activeTab === 'examinations' && !formattedNoRawat ? (
        <div
          ref={loadMoreExaminationRef}
          className="rounded-lg border border-dashed bg-white/70 px-4 py-5 text-center text-sm text-muted-foreground"
        >
          {loadingMoreExaminations ? (
            <div className="flex items-center justify-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary"></div>
              <span>Memuat data pemeriksaan {examinationHistoryTab === 'outpatient' ? 'rawat jalan' : 'rawat inap'} berikutnya...</span>
            </div>
          ) : hasMoreCurrentExaminationTab ? (
            <span>Gulir ke bawah untuk memuat data pemeriksaan {examinationHistoryTab === 'outpatient' ? 'rawat jalan' : 'rawat inap'} berikutnya.</span>
          ) : (
            <span>Semua data pemeriksaan {examinationHistoryTab === 'outpatient' ? 'rawat jalan' : 'rawat inap'} yang tersedia sudah dimuat.</span>
          )}
        </div>
      ) : null}

      <Dialog
        open={Boolean(fullscreenLabHistory)}
        onOpenChange={(open) => {
          if (!open) {
            setFullscreenLabHistory(null);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Hasil Laboratorium Sesuai Tanggal
            </DialogTitle>
          </DialogHeader>

          {fullscreenLabHistory ? (
            <div className="max-h-[calc(90vh-88px)] space-y-4 overflow-y-auto px-6 py-4 pr-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal</p>
                  <p className="font-medium">{formatDateSafe(fullscreenLabHistory.tanggal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">No. Rawat</p>
                  <p className="font-medium">{fullscreenLabHistory.no_rawat}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sumber</p>
                  <p className="font-medium">{fullscreenLabHistory.source}</p>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Pemeriksaan:</h4>
                {renderLaboratoryHistoryDetails(fullscreenLabHistory)}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={pacsPreviewModal.open}
        onOpenChange={(open) => {
          setPacsPreviewModal((previous) => ({ ...previous, open, loading: open ? previous.loading : false }));
          if (!open) {
            pacsPreviewRequestRef.current += 1;
            setIsPacsPlaying(false);
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                {pacsPreviewModal.title}
              </span>
              {pacsPreviewModal.images.length > 0 ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {isCtPacsPreview ? 'Slice' : 'Gambar'} {pacsPreviewModal.currentIndex + 1} dari {pacsPreviewModal.images.length}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 p-6">
            {activePacsImage ? (
              <>
                {!isCtPacsPreview ? (
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">Kontrol Gambar PACS</p>
                        <p className="text-sm text-muted-foreground">
                          Gunakan zoom untuk memperbesar atau memperkecil gambar, lalu unduh bila diperlukan.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={zoomOutPacsPreview}
                          disabled={pacsZoomLevel <= 1}
                          className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                          aria-label="Zoom Out"
                          title="Zoom Out"
                        >
                          <ZoomOut className="h-4 w-4 sm:mr-2" />
                          <span className="sr-only sm:not-sr-only">Zoom Out</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={resetPacsZoom}
                          disabled={pacsZoomLevel === 1}
                          className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                          aria-label="Reset"
                          title="Reset"
                        >
                          <RotateCcw className="h-4 w-4 sm:mr-2" />
                          <span className="sr-only sm:not-sr-only">Reset</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={zoomInPacsPreview}
                          disabled={pacsZoomLevel >= 4}
                          className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                          aria-label="Zoom In"
                          title="Zoom In"
                        >
                          <ZoomIn className="h-4 w-4 sm:mr-2" />
                          <span className="sr-only sm:not-sr-only">Zoom In</span>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          disabled={!activePacsImage?.instance_id}
                          className="h-9 w-9 p-0 sm:w-auto sm:px-3"
                        >
                          <a
                            href={activePacsImage?.instance_id
                              ? getPacsImageUrl(activePacsImage.instance_id, {
                                  modality: pacsPreviewModal.modality,
                                  width: 1800
                                })
                              : '#'}
                            target="_blank"
                            rel="noreferrer"
                            download={`pacs-${activePacsImage?.instance_id || pacsPreviewModal.currentIndex + 1}.jpg`}
                            aria-label="Download"
                            title="Download"
                          >
                            <Download className="h-4 w-4 sm:mr-2" />
                            <span className="sr-only sm:not-sr-only">Download</span>
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Zoom: {Math.round(pacsZoomLevel * 100)}%
                    </div>
                  </div>
                ) : null}

                <div className="relative rounded-lg border bg-black/5 p-4">
                  <div onWheel={handleCtWheelNavigation}>
                    <div className="flex max-h-[60vh] w-full items-center justify-center overflow-auto">
                      <img
                        src={getPacsImageUrl(activePacsImage.instance_id, {
                          modality: pacsPreviewModal.modality,
                          width: 1800,
                          preferPreview: isCtPacsPreview
                        })}
                        alt={`Preview PACS ${pacsPreviewModal.currentIndex + 1}`}
                        className="mx-auto max-h-[60vh] w-auto rounded-md object-contain transition-transform duration-200"
                        style={!isCtPacsPreview ? {
                          transform: `scale(${pacsZoomLevel})`,
                          transformOrigin: 'center center'
                        } : undefined}
                      />
                    </div>
                  </div>

                  {pacsPreviewModal.loading ? (
                    <div className="absolute inset-x-4 top-4 rounded-md bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-sm">
                      Memuat seluruh slice CT dari server PACS...
                    </div>
                  ) : null}

                  {pacsPreviewModal.images.length > 1 ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/90"
                        onClick={() => goToPacsImage(pacsPreviewModal.currentIndex - 1)}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/90"
                        onClick={() => goToPacsImage(pacsPreviewModal.currentIndex + 1)}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  ) : null}
                </div>

                {isCtPacsPreview ? (
                  <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">CT Stack Player</p>
                        <p className="text-sm text-muted-foreground">
                          {pacsPreviewModal.loading
                            ? 'Sedang memuat seluruh slice CT dari server PACS.'
                            : 'Klik play untuk menelusuri slice secara otomatis. Scroll mouse untuk pindah slice, `Shift + scroll` untuk lompat lebih cepat.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pacsPreviewModal.loading || pacsPreviewModal.images.length <= 1}
                          onClick={() => setIsPacsPlaying((previous) => !previous)}
                        >
                          {isPacsPlaying ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Play
                            </>
                          )}
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          {pacsPreviewModal.images.length} slice
                        </span>
                        <Select
                          value={String(pacsPlaybackSpeed)}
                          onValueChange={(value) => setPacsPlaybackSpeed(Number(value))}
                        >
                          <SelectTrigger className="w-[170px]">
                            <SelectValue placeholder="Kecepatan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="320">Lambat</SelectItem>
                            <SelectItem value="180">Normal</SelectItem>
                            <SelectItem value="90">Cepat</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Slice 1</span>
                      <span>Slice {pacsPreviewModal.currentIndex + 1}</span>
                      <span>Slice {pacsPreviewModal.images.length}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(pacsPreviewModal.images.length - 1, 0)}
                      step={1}
                      value={pacsPreviewModal.currentIndex}
                      onChange={(e) => {
                        setIsPacsPlaying(false);
                        goToPacsImage(Number(e.target.value));
                      }}
                      className="w-full accent-primary"
                    />
                  </div>
                ) : null}

                {activePacsImage.description ? (
                  <p className="text-sm text-muted-foreground">
                    {activePacsImage.description}
                  </p>
                ) : null}

                {pacsPreviewModal.images.length > 1 && !isCtPacsPreview ? (
                  <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                    <div className="flex gap-3 p-3">
                      {pacsPreviewModal.images.map((image: any, index: number) => (
                        <button
                          key={`${image.instance_id}-modal-${index}`}
                          type="button"
                          onClick={() => goToPacsImage(index)}
                          className={cn(
                            "overflow-hidden rounded-md border bg-muted/30",
                            index === pacsPreviewModal.currentIndex && "ring-2 ring-primary"
                          )}
                        >
                          <img
                            src={getPacsImageUrl(image.instance_id, {
                              modality: pacsPreviewModal.modality,
                              width: 300
                            })}
                            alt={`Thumbnail PACS ${index + 1}`}
                            className="h-20 w-28 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                ) : null}
              </>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada gambar PACS untuk ditampilkan.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAllergyModalOpen}
        onOpenChange={(open) => {
          setIsAllergyModalOpen(open);
          if (open) {
            void fetchAllergyHistory();
          }
          if (!open) {
            resetAllergyForm();
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Input Alergi</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="allergy-category">Kategori</Label>
                  <Select
                    value={allergyCategory}
                    onValueChange={(value: AllergyCategory) => {
                      setAllergyCategory(value);
                      setSelectedAllergyOption(null);
                      setAllergySearchQuery('');
                      setAllergyOptions([]);
                      setManualFoodAllergy('');
                      setManualEnvironmentAllergy('');
                    }}
                  >
                    <SelectTrigger id="allergy-category">
                      <SelectValue placeholder="Pilih kategori alergi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lingkungan">Lingkungan</SelectItem>
                      <SelectItem value="Makanan">Makanan</SelectItem>
                      <SelectItem value="Obat">Obat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="allergy-selected">Pilihan Alergi</Label>
                  <Popover
                    open={allergySearchOpen}
                    onOpenChange={(open) => {
                      setAllergySearchOpen(open);
                      if (open && allergyCategory) {
                        void fetchAllergyOptions(allergyCategory, allergySearchQuery);
                      }
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        id="allergy-selected"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                        aria-expanded={allergySearchOpen}
                        disabled={!allergyCategory}
                      >
                        <span className="truncate text-left">
                          {selectedAllergyOption?.text || 'Cari dan pilih alergi'}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0 md:w-[500px]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Cari data alergi..."
                          value={allergySearchQuery}
                          onValueChange={(value) => {
                            setAllergySearchQuery(value);
                            if (allergyCategory) {
                              void fetchAllergyOptions(allergyCategory, value);
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {allergySearchLoading ? 'Mencari alergi...' : 'Tidak ada data ditemukan.'}
                          </CommandEmpty>
                          <CommandGroup>
                            {allergyOptions.map((option) => (
                              <CommandItem
                                key={`${option.id}-${option.text}`}
                                value={`${option.id} ${option.text}`}
                                onSelect={() => {
                                  setSelectedAllergyOption(option);
                                  setAllergySearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedAllergyOption?.id === option.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{option.text}</span>
                                  <span className="text-xs text-muted-foreground">{option.id}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {allergyCategory === 'Makanan' ? (
                <div>
                  <Label htmlFor="manual-food-allergy">Atau tulis alergi makanan</Label>
                  <Input
                    id="manual-food-allergy"
                    placeholder="Contoh: Telur, Kacang, Susu"
                    value={manualFoodAllergy}
                    onChange={(e) => setManualFoodAllergy(e.target.value)}
                  />
                </div>
              ) : null}

              {allergyCategory === 'Lingkungan' ? (
                <div>
                  <Label htmlFor="manual-environment-allergy">Atau tulis alergi lingkungan</Label>
                  <Input
                    id="manual-environment-allergy"
                    placeholder="Contoh: Debu, Dingin, Bulu kucing"
                    value={manualEnvironmentAllergy}
                    onChange={(e) => setManualEnvironmentAllergy(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    resetAllergyForm();
                    setIsAllergyModalOpen(false);
                  }}
                >
                  Tutup
                </Button>
                <Button onClick={() => void handleSaveAllergy()} disabled={savingAllergy}>
                  {savingAllergy ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Riwayat Alergi</h4>
                  <span className="text-sm text-muted-foreground">
                    {allergyHistory.length} data
                  </span>
                </div>

                {allergyHistoryLoading ? (
                  <div className="text-sm text-muted-foreground">Memuat riwayat alergi...</div>
                ) : allergyHistory.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Belum ada data alergi.</div>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Tgl / Jam</th>
                          <th className="px-3 py-2 text-left font-medium">Alergi</th>
                          <th className="px-3 py-2 text-left font-medium">Kategori</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allergyHistory.map((item) => (
                          <tr key={String(item.id)} className="border-t">
                            <td className="px-3 py-2">{item.created_at || '-'}</td>
                            <td className="px-3 py-2">{item.nama || '-'}</td>
                            <td className="px-3 py-2">{item.kategori || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isWhatsappModalOpen}
        onOpenChange={(open) => {
          setIsWhatsappModalOpen(open);
          if (open) {
            setWhatsappNumber(String(medicalData?.patient?.telepon || '').trim());
            setWhatsappMessage('');
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patient-whatsapp">Nomor WhatsApp</Label>
              <div className="flex gap-2">
                <Input
                  id="patient-whatsapp"
                  placeholder="Contoh: 08123456789"
                  value={whatsappNumber}
                  onChange={(event) => setWhatsappNumber(event.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => void handleSaveWhatsapp()}
                  disabled={savingWhatsapp || sendingWhatsappMessage}
                >
                  {savingWhatsapp ? 'Menyimpan...' : 'Ubah'}
                </Button>
              </div>
            </div>
            <div className="border-t pt-4 space-y-3">
              <div>
                <Label htmlFor="patient-whatsapp-message">Kirim Pesan</Label>
                <Textarea
                  id="patient-whatsapp-message"
                  placeholder="Tulis pesan WhatsApp untuk pasien"
                  value={whatsappMessage}
                  onChange={(event) => setWhatsappMessage(event.target.value)}
                  rows={5}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSendWhatsappMessage()}
                  disabled={sendingWhatsappMessage}
                >
                  {sendingWhatsappMessage ? 'Mengirim...' : 'Kirim Pesan'}
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsWhatsappModalOpen(false)}
                disabled={savingWhatsapp || sendingWhatsappMessage}
              >
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* AI Scribe Modal */}
      <Dialog open={aiScribeModal} onOpenChange={setAiScribeModal}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Scribe - Saran Medis
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              {aiScribeLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-2">Menganalisis data medis...</span>
                </div>
              ) : aiScribeResult ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
                    <h4 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      Saran AI:
                    </h4>
                    <div className="text-blue-800 whitespace-pre-wrap leading-relaxed text-sm">
                      {aiScribeResult}
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">⚠️ Penting:</p>
                      <p>Saran ini dibuat oleh AI dan harus diverifikasi oleh tenaga medis profesional sebelum diterapkan.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Tidak ada data untuk dianalisis</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Floating Buttons for CRUD Operations */}
      {formattedNoRawat && (
        <FloatingButtonsModal
          noRawat={formattedNoRawat}
          defaultStatusRawat={defaultExaminationStatusRawat as 'Ralan' | 'Ranap'}
        />
      )}
    </div>
  );
};

export default MedicalRecord;
