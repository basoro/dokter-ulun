import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Calendar as CalendarIcon, Copy, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Brain, Check, ChevronsUpDown, Pause, Pencil, Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
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
  komposisi: RacikanMedicine[];
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
type LabStatusRawat = 'Ralan' | 'Ranap';
type RadiologyStatusRawat = 'Ralan' | 'Ranap';

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
    status_lanjut?: string;
  };
  outpatient_visits: any[];
  inpatient_visits: any[];
  focused_examinations?: {
    ralan?: any[];
    ranap?: any[];
  };
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

const PAGE_SIZE = 5;

const DEFAULT_PAGINATION_META: PaginationMeta = {
  page: 1,
  limit: PAGE_SIZE,
  total: 0,
  hasMore: false
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
  return statusLanjut === 'Ranap' || statusLanjut === 'Dirawat' ? 'Ranap' : 'Ralan';
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

const mapRequestSourceToStatusRawat = (source?: string | null): ProcedureStatusRawat => {
  return String(source || '').trim().toLowerCase() === 'rawat inap' ? 'Ranap' : 'Ralan';
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

const mergeVisitsByNoRawat = (existingVisits: any[] = [], incomingVisits: any[] = []) => {
  const existingNoRawat = new Set(existingVisits.map((visit) => visit.no_rawat));
  return [
    ...existingVisits,
    ...incomingVisits.filter((visit) => !existingNoRawat.has(visit.no_rawat))
  ];
};

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
      no_rawat: noRawat,
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

const MedicalRecord = () => {
  const { no_rkm_medis, no_rawat: rawatParam } = useParams();
  const [searchParams] = useSearchParams();
  const formattedNoRawat = formatRouteNoRawat(rawatParam);
  const [medicalData, setMedicalData] = useState<MedicalRecordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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

  // Form states
  const [medications, setMedications] = useState<Medication[]>(() => getDefaultMedicationForm('Ralan'));
  const [medicineOptions, setMedicineOptions] = useState<Record<string, MedicineOption[]>>({});
  const [medicineSearchOpen, setMedicineSearchOpen] = useState<Record<string, boolean>>({});
  const [medicineSearchQuery, setMedicineSearchQuery] = useState<Record<string, string>>({});
  const [medicineSearchLoading, setMedicineSearchLoading] = useState<Record<string, boolean>>({});

  const [compoundPrescriptions, setCompoundPrescriptions] = useState<CompoundPrescription[]>([createDefaultCompoundPrescription()]);
  const [compoundMedicineOptions, setCompoundMedicineOptions] = useState<Record<string, MedicineOption[]>>({});
  const [compoundMedicineSearchOpen, setCompoundMedicineSearchOpen] = useState<Record<string, boolean>>({});
  const [compoundMedicineSearchQuery, setCompoundMedicineSearchQuery] = useState<Record<string, string>>({});
  const [compoundMedicineSearchLoading, setCompoundMedicineSearchLoading] = useState<Record<string, boolean>>({});

  const [labTests, setLabTests] = useState<LabTest[]>(getDefaultLabRequestForm);
  const [labServiceOptions, setLabServiceOptions] = useState<LabServiceOption[]>([]);
  const [labServiceSearchOpen, setLabServiceSearchOpen] = useState<Record<number, boolean>>({});
  const [labServiceSearchQuery, setLabServiceSearchQuery] = useState<Record<number, string>>({});
  const [labServiceSearchLoading, setLabServiceSearchLoading] = useState(false);
  const [labTemplatesByIndex, setLabTemplatesByIndex] = useState<Record<number, LabTemplateOption[]>>({});
  const [labTemplateLoadingByIndex, setLabTemplateLoadingByIndex] = useState<Record<number, boolean>>({});
  const [labStatusRawat, setLabStatusRawat] = useState<LabStatusRawat>('Ralan');

  const [procedures, setProcedures] = useState<ProcedureFormItem[]>(getDefaultProcedureForm);
  const [procedureOptions, setProcedureOptions] = useState<Record<number, ProcedureOption[]>>({});
  const [procedureSearchOpen, setProcedureSearchOpen] = useState<Record<number, boolean>>({});
  const [procedureSearchQuery, setProcedureSearchQuery] = useState<Record<number, string>>({});
  const [procedureSearchLoading, setProcedureSearchLoading] = useState<Record<number, boolean>>({});
  const [deletingProcedureKey, setDeletingProcedureKey] = useState<string | null>(null);
  const [procedureStatusRawat, setProcedureStatusRawat] = useState<ProcedureStatusRawat>('Ralan');
  const [editingPrescriptionNo, setEditingPrescriptionNo] = useState<string | null>(null);
  const [deletingPrescriptionNo, setDeletingPrescriptionNo] = useState<string | null>(null);
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

  const [draggingLab, setDraggingLab] = useState<LabData | null>(null);
  const [canvasItems, setCanvasItems] = useState<Array<{ type: string; content: any; position: { x: number; y: number } }>>([]);
  const [draggingRad, setDraggingRad] = useState<any>(null);
  const [radiologies, setRadiologies] = useState<RadiologyFormItem[]>(getDefaultRadiologyRequestForm);
  const [radiologyServiceOptions, setRadiologyServiceOptions] = useState<RadiologyServiceOption[]>([]);
  const [radiologySearchOpen, setRadiologySearchOpen] = useState<Record<number, boolean>>({});
  const [radiologySearchQuery, setRadiologySearchQuery] = useState<Record<number, string>>({});
  const [radiologySearchLoading, setRadiologySearchLoading] = useState(false);
  const [radiologyStatusRawat, setRadiologyStatusRawat] = useState<RadiologyStatusRawat>('Ralan');
  const [isExaminationFormOpen, setIsExaminationFormOpen] = useState(false);
  const [isProcedureFormOpen, setIsProcedureFormOpen] = useState(false);
  const [isMedicationFormOpen, setIsMedicationFormOpen] = useState(false);
  const [isCompoundFormOpen, setIsCompoundFormOpen] = useState(false);
  const [isLabFormOpen, setIsLabFormOpen] = useState(false);
  const [isRadiologyFormOpen, setIsRadiologyFormOpen] = useState(false);
  const [pacsPreviewModal, setPacsPreviewModal] = useState<{
    open: boolean;
    title: string;
    images: any[];
    currentIndex: number;
    modality: string;
  }>({
    open: false,
    title: '',
    images: [],
    currentIndex: 0,
    modality: ''
  });
  const [isPacsPlaying, setIsPacsPlaying] = useState(false);
  const [pacsPlaybackSpeed, setPacsPlaybackSpeed] = useState(180);
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
  const [pagination, setPagination] = useState<MedicalRecordPagination>({
    outpatient: DEFAULT_PAGINATION_META,
    inpatient: DEFAULT_PAGINATION_META
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasMoreRecords = pagination.outpatient.hasMore || pagination.inpatient.hasMore;
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
  const vitalChartData = React.useMemo(() => {
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
  }, [scopedInpatientVisits, scopedOutpatientVisits]);
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

    return buildExaminationHistory(scopedOutpatientVisits, 'Ralan');
  }, [formattedNoRawat, medicalData?.focused_examinations?.ralan, scopedOutpatientVisits]);
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

    return buildExaminationHistory(scopedInpatientVisits, 'Ranap');
  }, [formattedNoRawat, medicalData?.focused_examinations?.ranap, scopedInpatientVisits]);
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
      return buildFocusedItems(
        medicalData?.focused_laboratory?.ralan || [],
        formattedNoRawat,
        'Rawat Jalan'
      );
    }

    return buildFocusedItems(
      scopedOutpatientVisits.flatMap((visit) => ((visit.laboratory || []) as LabData[]).map((lab) => ({ ...lab, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Jalan'
    );
  }, [formattedNoRawat, medicalData?.focused_laboratory?.ralan, scopedOutpatientVisits]);
  const inpatientLaboratoryHistory = React.useMemo(() => {
    if (formattedNoRawat) {
      return buildFocusedItems(
        medicalData?.focused_laboratory?.ranap || [],
        formattedNoRawat,
        'Rawat Inap'
      );
    }

    return buildFocusedItems(
      scopedInpatientVisits.flatMap((visit) => ((visit.laboratory || []) as LabData[]).map((lab) => ({ ...lab, no_rawat: visit.no_rawat }))),
      '',
      'Rawat Inap'
    );
  }, [formattedNoRawat, medicalData?.focused_laboratory?.ranap, scopedInpatientVisits]);
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
  const activeVitalSeries = vitalChartSeries.filter((series) => visibleVitalSeries[series.key]);
  const currentUsername = String(user?.username || '').trim();
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

      return (
      <div key={key} className="border rounded-lg p-4">
        <div className="flex justify-between items-start mb-4">
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
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleCopyExamination(exam, visit)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleEditExamination(exam, visit)}
              disabled={!canEditExamination(exam)}
            >
              {canEditExamination(exam) ? 'Edit' : 'Bukan Data Anda'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleDeleteExamination(exam, visit)}
              disabled={!allowedToDelete}
            >
              {allowedToDelete ? 'Hapus' : 'Bukan Data Anda'}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
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
          <div className="space-y-2">
            <h4 className="font-medium">SOAPIE</h4>
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
            <div className="text-sm">
              <strong>I (Implementation):</strong>
              <p className="whitespace-pre-line break-words">{formatMultilineText(exam.i || exam.instruksi || '-')}</p>
            </div>
            <div className="text-sm">
              <strong>E (Evaluation):</strong>
              <p className="whitespace-pre-line break-words">{formatMultilineText(exam.e || exam.evaluasi || '-')}</p>
            </div>
            <p className="text-sm"><strong>Petugas:</strong> {exam.pegawai || exam.nip || '-'}</p>
          </div>
        </div>
      </div>
    )});
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

      return (
      <div key={`${med.no_resep || med.tanggal}-${index}`} className="border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Nomor Resep</p>
            <p className="font-medium">{med.no_resep || '-'}</p>
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
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Obat:</h4>
            <div className="flex flex-wrap gap-2">
              {isRequestTab ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditResep(med)}
                    disabled={!canEditPrescription(med)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {canEditPrescription(med) ? 'Edit Resep' : 'Bukan Data Anda'}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteResep(med)}
                    disabled={!allowedToDelete || deletingPrescriptionNo === med.no_resep}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deletingPrescriptionNo === med.no_resep ? 'Menghapus...' : (allowedToDelete ? 'Hapus' : 'Bukan Data Anda')}
                  </Button>
                </>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => handleCopyResep(med)}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Resep
              </Button>
            </div>
          </div>
          {(med.obat || []).map((obat: any, i: number) => (
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

      return (
      <div key={`${lab.no_rawat}-${lab.noorder}-${labIndex}`} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditLabRequest(lab)}
            disabled={!canEditLabRequest(lab)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {canEditLabRequest(lab) ? 'Edit' : 'Bukan Data Anda'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopyLabRequest(lab)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDeleteLabRequest(lab)}
            disabled={!allowedToDelete || deletingLabRequestNo === lab.noorder}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deletingLabRequestNo === lab.noorder ? 'Menghapus...' : (allowedToDelete ? 'Hapus' : 'Bukan Data Anda')}
          </Button>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
        <div className="space-y-2">
          <h4 className="font-medium">Pemeriksaan:</h4>
          {Array.isArray(labGroup.pemeriksaan) && labGroup.pemeriksaan.length > 0 ? (
            (() => {
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
            })()
          ) : (
            <p className="text-sm italic text-muted-foreground">Tidak ada hasil pemeriksaan</p>
          )}
        </div>
      </div>
    ));
  };
  const renderRadiologyRequestCards = (items: any[]) => {
    if (items.length === 0) {
      return <p className="text-sm italic text-muted-foreground">Belum ada data permintaan radiologi.</p>;
    }

    return items.map((rad, radIndex) => {
      const allowedToDelete = canDeleteRadiologyRequest(rad);

      return (
      <div key={`${rad.no_rawat}-${rad.noorder}-${radIndex}`} className="border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleEditRadiologyRequest(rad)}
            disabled={!canEditRadiologyRequest(rad)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {canEditRadiologyRequest(rad) ? 'Edit' : 'Bukan Data Anda'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopyRadiologyRequest(rad)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => handleDeleteRadiologyRequest(rad)}
            disabled={!allowedToDelete || deletingRadiologyRequestNo === rad.noorder}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deletingRadiologyRequestNo === rad.noorder ? 'Menghapus...' : (allowedToDelete ? 'Hapus' : 'Bukan Data Anda')}
          </Button>
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
          <div>
            <p className="text-sm text-muted-foreground">Hasil</p>
            <p className="font-medium">{rad.hasil || '-'}</p>
          </div>
        </div>
        {renderRadiologyPacsImages(rad)}
      </div>
    ));
  };
  
  useEffect(() => {
    const searchQuery = searchParams.get('search');
    if (searchQuery) {
      searchPatients(searchQuery);
    }
  }, [searchParams]);

  const fetchMedicalRecord = useCallback(async ({
    reset = false,
    outpatientPage = 1,
    inpatientPage = 1
  }: {
    reset?: boolean;
    outpatientPage?: number;
    inpatientPage?: number;
  } = {}) => {
    try {
      if (!no_rkm_medis) {
        return;
      }

      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
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
          focus_no_rawat: formattedNoRawat || undefined
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseJson = await response.json();
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
            focused_procedures: responseData.focused_procedures || previousData.focused_procedures,
            focused_medications_request: responseData.focused_medications_request || previousData.focused_medications_request,
            focused_medications: responseData.focused_medications || previousData.focused_medications,
            focused_laboratory_request: responseData.focused_laboratory_request || previousData.focused_laboratory_request,
            focused_laboratory: responseData.focused_laboratory || previousData.focused_laboratory,
            focused_radiology_request: responseData.focused_radiology_request || previousData.focused_radiology_request,
            focused_radiology: responseData.focused_radiology || previousData.focused_radiology
          };
        });

        if (responsePagination) {
          setPagination(responsePagination);
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
      console.error('Error fetching medical record:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [formattedNoRawat, no_rkm_medis]);

  useEffect(() => {
    if (no_rkm_medis) {
      fetchMedicalRecord({ reset: true, outpatientPage: 1, inpatientPage: 1 });
    }
  }, [fetchMedicalRecord, no_rkm_medis]);

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
    setLabStatusRawat(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');
  }, [statusRawat]);

  useEffect(() => {
    setRadiologyStatusRawat(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');
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

  const loadMoreMedicalRecord = useCallback(() => {
    if (loading || loadingMore || !hasMoreRecords) {
      return;
    }

    fetchMedicalRecord({
      reset: false,
      outpatientPage: pagination.outpatient.hasMore ? pagination.outpatient.page + 1 : pagination.outpatient.page,
      inpatientPage: pagination.inpatient.hasMore ? pagination.inpatient.page + 1 : pagination.inpatient.page
    });
  }, [fetchMedicalRecord, hasMoreRecords, loading, loadingMore, pagination]);

  useEffect(() => {
    const currentTarget = loadMoreRef.current;

    if (!currentTarget || !no_rkm_medis) {
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
  }, [loadMoreMedicalRecord, no_rkm_medis]);

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
        return `Tanggal: ${rad.tanggal || ''}\nRadiologi: ${rad.pemeriksaan || ''} - ${rad.hasil || 'Belum ada hasil'} ${rad.keterangan ? '- ' + rad.keterangan : ''}`;
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
      obat: med.obat.map((o: any) => ({
        kode_brng: o.kode_brng || '',
        nama: o.nama,
        jumlah: o.jumlah,
        aturan_pakai: o.aturan_pakai,
        satuan: o.satuan || '',
        stok: Number(o.stok) || 0
      }))
    };

    if (isFirstEmpty) {
      setMedications([newMedication]);
    } else {
      setMedications([...medications, newMedication]);
    }

    setEditingPrescriptionNo(null);
    setIsMedicationFormOpen(true);
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
    setLabStatusRawat(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');
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
    setProcedureStatusRawat(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');
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

    try {
      setMedicineSearchLoading((previous) => ({ ...previous, [key]: true }));

      const params = new URLSearchParams({
        action: 'search_medicines',
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
  }, []);

  const fetchCompoundMedicineOptions = useCallback(async (compoundIndex: number, racikanIndex: number, searchText = '') => {
    const key = getCompoundMedicineFieldKey(compoundIndex, racikanIndex);

    try {
      setCompoundMedicineSearchLoading((previous) => ({ ...previous, [key]: true }));

      const params = new URLSearchParams({
        action: 'search_medicines',
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
  }, []);

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
    setRadiologyStatusRawat(statusRawat === 'Ranap' ? 'Ranap' : 'Ralan');
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
      status_lanjut: visit.status_lanjut
    });
    
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

  const handleCopyExamination = (examination: any, visit: any) => {
    setActiveTab('examinations');
    setIsExaminationFormOpen(true);
    // Copy examination data to form with current date/time as default
    setExaminationForm({
      tgl_perawatan: format(new Date(), 'yyyy-MM-dd'),
      jam_rawat: format(new Date(), 'HH:mm'),
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
    
    // Clear editing state since this is a copy, not an edit
    setEditingExamination(null);
    
    // Show toast notification
    toast({
      title: "Data Disalin",
      description: "Data pemeriksaan telah disalin ke form tambah pemeriksaan",
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

  const openPacsPreviewModal = (rad: any, images: any[], currentIndex = 0, modality = '') => {
    setPacsPreviewModal({
      open: true,
      title: rad?.pemeriksaan || 'Foto Radiologi PACS',
      images,
      currentIndex,
      modality
    });
    setIsPacsPlaying(String(modality || '').toUpperCase() === 'CT');
  };

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

    if (modality === 'CT' && pacsImages.length > 0) {
      return {
        modality,
        displayImages: [pacsImages[0]],
        modalImages: pacsImages
      };
    }

    return {
      modality,
      displayImages: pacsImages.slice(0, 6),
      modalImages: pacsImages
    };
  };

  const getRadiologyModalityLabel = (rad: any) => {
    return String(rad?.pacs_modality || rad?.pacs_series?.[0]?.modality || '').trim().toUpperCase();
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

  const renderRadiologyPacsImages = (rad: any) => {
    const { modality, displayImages, modalImages } = getRadiologyPacsThumbnailItems(rad);
    if (modalImages.length === 0) {
      return null;
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
              CT scan: {modalImages.length} slice, klik untuk play
            </p>
          ) : modalImages.length > displayImages.length ? (
            <p className="text-xs text-muted-foreground">
              Menampilkan {displayImages.length} dari {modalImages.length} gambar
            </p>
          ) : null}
        </div>

        <div className={cn(
          "gap-3",
          modality === 'CT' ? "grid grid-cols-1 max-w-sm" : "grid grid-cols-2 md:grid-cols-3"
        )}>
          {displayImages.map((image: any, index: number) => {
            const previewUrl = `${API_CONFIG.BASE_URL_WITHOUT_API}/api/pacs/rendered/${encodeURIComponent(image.instance_id)}?width=600`;

            return (
              <button
                type="button"
                key={`${image.instance_id}-${index}`}
                className="group relative overflow-hidden rounded-lg border bg-muted/20"
                onClick={() => openPacsPreviewModal(rad, modalImages, index, modality)}
              >
                <img
                  src={previewUrl}
                  alt={`Foto Radiologi ${rad?.pemeriksaan || index + 1}`}
                  loading="lazy"
                  className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                />
                {modality === 'CT' ? (
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-black/60 px-3 py-2 text-xs text-white">
                    <span>{modalImages.length} slice</span>
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
                kode_brng: obat.kode_brng?.trim() || '',
                nama: obat.nama?.trim() || '',
                jml: obat.jumlah?.trim() || '',
                aturan_pakai: obat.aturan_pakai?.trim() || ''
              }))
              .filter((obat) => obat.kode_brng && obat.nama && obat.jml)
          }))
          .filter((medication) => medication.tanggal && medication.medicines.length > 0);

        if (!validPrescriptions.length) {
          throw new Error('Pilih minimal satu resep dengan obat yang valid');
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

  const currentPatient = medicalData?.patient || {
    nama: "",
    no_rm: no_rkm_medis || "",
    tanggal_lahir: "",
    jenis_kelamin: "",
    alamat: "",
    telepon: "",
    golongan_darah: "",
    alergi: ""
  };

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
  if (searchParams.get('search')) {
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
            <div className="flex items-center">
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
                  <p className="font-medium">{currentPatient.nama}</p>
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
                  <p className="font-medium">{currentPatient.telepon}</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <Heart className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Golongan Darah</p>
                  <p className="font-medium">{currentPatient.golongan_darah}</p>
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
              <Tabs defaultValue="outpatient" className="mt-2">
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
                      <div className="bg-muted p-2 rounded-t-lg mb-4">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                            <div>
                              <p className="text-sm text-muted-foreground">No. Rawat</p>
                              <p className="font-medium">{visit.no_rawat}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Tanggal</p>
                              <p className="font-medium">{formatDateSafe(visit.tanggal)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Poliklinik</p>
                              <p className="font-medium">{visit.poliklinik}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Dokter</p>
                              <p className="font-medium">{visit.dokter}</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAiScribe(visit)}
                            variant="outline"
                            size="sm"
                            className="ml-4 flex items-center gap-2"
                          >
                            <Brain className="h-4 w-4" />
                            AI Scribe
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-6">
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

                        {/* Tindakan */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Syringe className="h-5 w-5 mr-2" />
                            Tindakan
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {Object.entries(
                              (visit.procedures || []).reduce((groups: Record<string, any[]>, proc: any) => {
                                const groupKey = proc.tanggal || '-';
                                if (!groups[groupKey]) {
                                  groups[groupKey] = [];
                                }
                                groups[groupKey].push(proc);
                                return groups;
                              }, {})
                            ).map(([tanggal, procedures]: [string, any[]]) => (
                              <div key={tanggal} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="mb-4 border-b pb-2">
                                  <p className="text-sm text-muted-foreground">Tanggal & Jam</p>
                                  <p className="font-medium">{formatDateSafe(tanggal)}</p>
                                </div>

                                <div className="space-y-3">
                                  {procedures.map((proc, procIndex) => (
                                    <div
                                      key={`${visit.no_rawat}-${tanggal}-${proc.nama}-${procIndex}`}
                                      className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border bg-muted/20 p-3"
                                    >
                                      <div>
                                        <p className="text-sm text-muted-foreground">Nama Tindakan</p>
                                        <p className="font-medium">{proc.nm_perawatan || proc.nama || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Nama Pelaksana</p>
                                        <p className="font-medium">{proc.nama_pelaksana || proc.hasil || '-'}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
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
                            {allOutpatientVisits.map((visit) => {
                              const groupedLabs: any = {};

                              for (const lab of (visit.laboratory || []) as any[]) {
                                const key = `${lab.tanggal} ${lab.jam}`;
                                if (!groupedLabs[key]) {
                                  groupedLabs[key] = {
                                    tanggal: lab.tanggal,
                                    jam: lab.jam,
                                    no_rawat: visit.no_rawat,
                                    perawatans: [],
                                  };
                                }
                                groupedLabs[key].perawatans.push(lab);
                              }

                              return Object.values(groupedLabs).map((group: any, index) => (
                                <div
                                  key={`${group.no_rawat}-${group.tanggal}-${group.jam}-${index}`}
                                  className="border rounded-lg p-4 hover:bg-muted/50 hover:shadow-lg transition-shadow"
                                >
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                      <p className="text-sm text-muted-foreground">Tanggal</p>
                                      <p className="font-medium">{formatDateSafe((group as any).tanggal)}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm text-muted-foreground">No. Rawat</p>
                                      <p className="font-medium">{(group as any).no_rawat}</p>
                                    </div>
                                  </div>

                                  {((group as any).perawatans as any[]).map((lab: any, labIndex) => (
                                    <div key={labIndex} className="mb-4">
                                      <h4 className="text-md font-semibold text-primary">{lab.nm_perawatan}</h4>
                                      <div className="space-y-2">
                                        {Array.isArray(lab.hasil) && lab.hasil.length > 0 ? (
                                          lab.hasil.map((test, testIndex) => (
                                            <div key={testIndex} className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm border-l-2 border-primary pl-4">
                                              <div>
                                                <span className="text-muted-foreground">Nama:</span>
                                                <span className="ml-2 font-medium">{test.pemeriksaan}</span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Hasil:</span>
                                                <span className="ml-2">{test.nilai}</span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Rujukan:</span>
                                                <span className="ml-2">{test.nilai_rujukan}</span>
                                              </div>
                                              <div>
                                                <span className="text-muted-foreground">Keterangan:</span>
                                                <span className="ml-2">{test.keterangan}</span>
                                              </div>
                                            </div>
                                          ))
                                        ) : (
                                          <p className="text-sm italic text-muted-foreground">Tidak ada hasil pemeriksaan.</p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ));
                            })}
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                  <div>
                                    <p className="text-sm text-muted-foreground">Hasil</p>
                                    <p className="font-medium">{rad.hasil}</p>
                                  </div>
                                </div>
                                {renderRadiologyPacsImages(rad)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="inpatient">
                  {sortedInpatientVisits.map((visit: any, index) => (
                    <div key={index} className="mb-8 rounded-lg p-0 shadow-sm">
                      <div className="bg-muted p-2 rounded-t-lg mb-4">
                        <div className="flex justify-between items-start">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                            <div>
                              <p className="text-sm text-muted-foreground">No. Rawat</p>
                              <p className="font-medium">{visit.no_rawat}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Tanggal Masuk</p>
                              <p className="font-medium">{formatDateSafe(visit.tanggal_masuk)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Ruangan</p>
                              <p className="font-medium">{visit.ruangan}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Dokter</p>
                              <p className="font-medium">{visit.dokter}</p>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleAiScribe(visit)}
                            variant="outline"
                            size="sm"
                            className="ml-4 flex items-center gap-2"
                          >
                            <Brain className="h-4 w-4" />
                            AI Scribe
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-6">
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

                        {/* Tindakan */}
                        <div className="border rounded-lg p-2">
                          <h3 className="text-lg font-semibold mb-3 flex items-center">
                            <Syringe className="h-5 w-5 mr-2" />
                            Tindakan
                          </h3>
                          <div className="grid grid-cols-1 gap-4">
                            {Object.entries(
                              (visit.procedures || []).reduce((groups: Record<string, any[]>, proc: any) => {
                                const groupKey = proc.tanggal || '-';
                                if (!groups[groupKey]) {
                                  groups[groupKey] = [];
                                }
                                groups[groupKey].push(proc);
                                return groups;
                              }, {})
                            ).map(([tanggal, procedures]: [string, any[]]) => (
                              <div key={tanggal} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="mb-4 border-b pb-2">
                                  <p className="text-sm text-muted-foreground">Tanggal & Jam</p>
                                  <p className="font-medium">{formatDateSafe(tanggal)}</p>
                                </div>

                                <div className="space-y-3">
                                  {procedures.map((proc, procIndex) => (
                                    <div
                                      key={`${visit.no_rawat}-${tanggal}-${proc.nama}-${procIndex}`}
                                      className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border bg-muted/20 p-3"
                                    >
                                      <div>
                                        <p className="text-sm text-muted-foreground">Nama Tindakan</p>
                                        <p className="font-medium">{proc.nm_perawatan || proc.nama || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-sm text-muted-foreground">Nama Pelaksana</p>
                                        <p className="font-medium">{proc.nama_pelaksana || proc.hasil || '-'}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
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
                            {((visit.laboratory || []) as any[]).map((lab: any, labIndex) => (
                              <div key={labIndex} className="border rounded-lg p-4 hover:bg-muted/50">
                                <div className="mb-2">
                                  <p className="text-sm text-muted-foreground">Tanggal</p>
                                   <p className="font-medium">{formatDateSafe(lab.tanggal)}</p>
                                </div>
                                <div className="space-y-2">
                                  {allInpatientVisits.map((visit) => {
                                    // Grouping berdasarkan tanggal + jam
                                    const groupedLaboratory = {};

                                    for (const lab of visit.laboratory || []) {
                                      const key = `${lab.tanggal} ${lab.jam}`;
                                      if (!groupedLaboratory[key]) {
                                        groupedLaboratory[key] = {
                                          tanggal: lab.tanggal,
                                          jam: lab.jam,
                                          no_rawat: visit.no_rawat,
                                          nm_perawatan: lab.nm_perawatan,
                                          perawatans: [],
                                        };
                                      }
                                      groupedLaboratory[key].perawatans.push(lab);
                                    }

                                    return Object.values(groupedLaboratory).map((group, groupIndex) => (
                                      <div
                                        key={groupIndex}
                                        className="border rounded-lg p-4 cursor-move hover:shadow-lg transition-shadow"
                                        draggable
                                        onDragStart={(e) => {
                                          setDraggingLab(group as any);
                                          e.dataTransfer.effectAllowed = 'move';
                                        }}
                                      >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                          <div>
                                            <p className="text-sm text-muted-foreground">Tanggal</p>
                                            <p className="font-medium">
                                              {formatDateSafe((group as any).tanggal)}
                                            </p>
                                          </div>
                                          <div>
                                            <p className="text-sm text-muted-foreground">No. Rawat</p>
                                            <p className="font-medium">{(group as any).no_rawat}</p>
                                          </div>
                                        </div>

                                        {((group as any).perawatans as any[]).map((lab: any, labIndex) => (
                                          <div key={labIndex} className="mb-4">
                                            <h4 className="text-md font-semibold text-primary">{lab.nm_perawatan}</h4>

                                            <div className="space-y-2">
                                              <h4 className="font-medium">Pemeriksaan:</h4>
                                              {Array.isArray(lab.hasil) && lab.hasil.length > 0 ? (
                                                lab.hasil.map((test, testIndex) => (
                                                  <div
                                                    key={testIndex}
                                                    className="grid grid-cols-1 md:grid-cols-4 gap-4 border-l-2 border-primary pl-4"
                                                  >
                                                    <div>
                                                      <p className="text-sm text-muted-foreground">Nama</p>
                                                      <p className="font-medium">{test.pemeriksaan}</p>
                                                    </div>
                                                    <div>
                                                      <p className="text-sm text-muted-foreground">Hasil</p>
                                                      <p className="font-medium">{test.nilai}</p>
                                                    </div>
                                                    <div>
                                                      <p className="text-sm text-muted-foreground">Rujukan</p>
                                                      <p className="font-medium">{test.nilai_rujukan}</p>
                                                    </div>
                                                    <div>
                                                      <p className="text-sm text-muted-foreground">Keterangan</p>
                                                      <p className="font-medium">{test.keterangan}</p>
                                                    </div>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="text-sm italic text-muted-foreground">
                                                  Tidak ada hasil pemeriksaan
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ));
                                  })}
                                </div>
                              </div>
                            ))}
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                  <div>
                                    <p className="text-sm text-muted-foreground">Hasil</p>
                                    <p className="font-medium">{rad.hasil}</p>
                                  </div>
                                </div>
                                {renderRadiologyPacsImages(rad)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
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
                     <Popover>
                       <PopoverTrigger asChild>
                         <Button
                           variant="outline"
                           className="w-full justify-start text-left font-normal"
                         >
                           <CalendarIcon className="mr-2 h-4 w-4" />
                           {examinationForm.tgl_perawatan ? format(new Date(examinationForm.tgl_perawatan), "dd/MM/yyyy") : "Pilih tanggal"}
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-96 p-0" align="start">
                         <CalendarComponent
                           mode="single"
                           selected={examinationForm.tgl_perawatan ? new Date(examinationForm.tgl_perawatan) : undefined}
                           onSelect={(date) => setExaminationForm({...examinationForm, tgl_perawatan: date ? format(date, "yyyy-MM-dd") : ""})}
                           initialFocus
                         />
                       </PopoverContent>
                     </Popover>
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
                    onClick={() => setExaminationForm(getDefaultExaminationForm())}
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
                <Tabs defaultValue="outpatient" className="mt-2">
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
                    <div className="space-y-4">
                      {renderExaminationCards(outpatientExaminationHistory)}
                    </div>
                  </TabsContent>

                  <TabsContent value="inpatient">
                    <div className="space-y-4">
                      {renderExaminationCards(inpatientExaminationHistory)}
                    </div>
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
                <Tabs defaultValue="outpatient" className="mt-2">
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
                    <div className="space-y-4">{renderProcedureCards(outpatientProcedures)}</div>
                  </TabsContent>
                  <TabsContent value="inpatient">
                    <div className="space-y-4">{renderProcedureCards(inpatientProcedures)}</div>
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
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id={`med-date-${medIndex}`}
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {medication.tanggal ? format(new Date(medication.tanggal), "dd/MM/yyyy") : "Pilih tanggal resep"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 p-0" align="start">
                            <CalendarComponent
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
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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
                          <SelectTrigger id={`med-status-${medIndex}`}>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                       <div>
                         <Label htmlFor={`racikan-date-${compoundIndex}`}>Tanggal Resep</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              id={`racikan-date-${compoundIndex}`}
                              variant="outline"
                              className="w-full justify-start text-left font-normal"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {compound.tanggal ? format(new Date(compound.tanggal), "dd/MM/yyyy") : "Pilih tanggal resep"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-96 p-0" align="start">
                            <CalendarComponent
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
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
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
                         <Label htmlFor={`racikan-jumlah-${compoundIndex}-${racikanIndex}`}>Jumlah/Dosis</Label>
                         <Input 
                           id={`racikan-jumlah-${compoundIndex}-${racikanIndex}`}
                           placeholder="mg/ml"
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

              {/* Data Existing */}
              <Tabs defaultValue="current" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="current">Data Resep Obat</TabsTrigger>
                  <TabsTrigger value="history">Riwayat Pemberian Obat</TabsTrigger>
                </TabsList>

                {/* Tab Data Resep Obat */}
                <TabsContent value="current">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Resep Obat</h3>
                    <Tabs defaultValue="outpatient" className="mt-2">
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
                        <div className="space-y-4">{renderMedicationCards(outpatientMedicationRequests, true)}</div>
                      </TabsContent>
                      <TabsContent value="inpatient">
                        <div className="space-y-4">{renderMedicationCards(inpatientMedicationRequests, true)}</div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                {/* Tab Riwayat Resep Obat */}
                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Pemberian Obat</h3>
                    <Tabs defaultValue="outpatient" className="mt-2">
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
                        <div className="space-y-4">{renderMedicationCards(outpatientMedicationHistory, false)}</div>
                      </TabsContent>
                      <TabsContent value="inpatient">
                        <div className="space-y-4">{renderMedicationCards(inpatientMedicationHistory, false)}</div>
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
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      
                      const newItem = {
                        type: 'laboratory',
                        content: draggingLab,
                        position: { x, y }
                      };
                      
                      setCanvasItems([...canvasItems, newItem]);
                      setDraggingLab(null);
                      toast({
                        title: "Lab Result Added",
                        description: "Lab result berhasil ditambahkan ke canvas",
                      });
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
              <Tabs defaultValue="current" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="current">Permintaan Laboratorium</TabsTrigger>
                  <TabsTrigger value="history">Pemeriksaan Laboratorium</TabsTrigger>
                </TabsList>

                {/* Tab Data Permintaan Lab */}
                <TabsContent value="current">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Data Permintaan Laboratorium</h3>
                    <Tabs defaultValue="outpatient" className="mt-2">
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
                        <div className="space-y-4">{renderLaboratoryRequestCards(outpatientLaboratoryRequests)}</div>
                      </TabsContent>
                      <TabsContent value="inpatient">
                        <div className="space-y-4">{renderLaboratoryRequestCards(inpatientLaboratoryRequests)}</div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                {/* Tab Riwayat Pemeriksaan Lab */}
                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Pemeriksaan Laboratorium (Draggable)</h3>
                    <Tabs defaultValue="outpatient" className="mt-2">
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
                        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                          <div className="space-y-4">{renderLaboratoryHistoryCards(outpatientLaboratoryHistory)}</div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="inpatient">
                        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                          <div className="space-y-4">{renderLaboratoryHistoryCards(inpatientLaboratoryHistory)}</div>
                        </ScrollArea>
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
                          </SelectContent>
                        </Select>
                      </div>
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
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      
                      const newItem = {
                        type: 'radiology',
                        content: draggingRad,
                        position: { x, y }
                      };
                      
                      setCanvasItems([...canvasItems, newItem]);
                      setDraggingRad(null);
                      toast({
                        title: "Radiology Result Added",
                        description: "Hasil radiologi berhasil ditambahkan ke canvas",
                      });
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

              <Tabs defaultValue="current" className="space-y-4">
                <TabsList>
                  <TabsTrigger value="current">Data Permintaan Radiologi</TabsTrigger>
                  <TabsTrigger value="history">Riwayat Radiologi</TabsTrigger>
                </TabsList>

                <TabsContent value="current">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Data Permintaan Radiologi</h3>
                    <Tabs defaultValue="outpatient" className="mt-2">
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
                        <div className="space-y-4">{renderRadiologyRequestCards(outpatientRadiologyRequests)}</div>
                      </TabsContent>
                      <TabsContent value="inpatient">
                        <div className="space-y-4">{renderRadiologyRequestCards(inpatientRadiologyRequests)}</div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>

                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Radiologi (Draggable)</h3>
                    <Tabs defaultValue="outpatient" className="mt-2">
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
                        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                          <div className="space-y-4">{renderRadiologyHistoryCards(outpatientRadiologyHistory)}</div>
                        </ScrollArea>
                      </TabsContent>
                      <TabsContent value="inpatient">
                        <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                          <div className="space-y-4">{renderRadiologyHistoryCards(inpatientRadiologyHistory)}</div>
                        </ScrollArea>
                      </TabsContent>
                    </Tabs>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div
        ref={loadMoreRef}
        className="rounded-lg border border-dashed bg-white/70 px-4 py-5 text-center text-sm text-muted-foreground"
      >
        {loadingMore ? (
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary"></div>
            <span>Memuat riwayat berikutnya...</span>
          </div>
        ) : hasMoreRecords ? (
          <span>Gulir ke bawah untuk memuat riwayat rekam medik berikutnya.</span>
        ) : medicalData ? (
          <span>Semua riwayat yang tersedia sudah dimuat.</span>
        ) : (
          <span>Belum ada data riwayat untuk ditampilkan.</span>
        )}
      </div>

      <Dialog
        open={pacsPreviewModal.open}
        onOpenChange={(open) => {
          setPacsPreviewModal((previous) => ({ ...previous, open }));
          if (!open) {
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
                <div className="relative rounded-lg border bg-black/5 p-4">
                  <div onWheel={handleCtWheelNavigation}>
                    <img
                      src={`${API_CONFIG.BASE_URL_WITHOUT_API}/api/pacs/rendered/${encodeURIComponent(activePacsImage.instance_id)}?width=1800`}
                      alt={`Preview PACS ${pacsPreviewModal.currentIndex + 1}`}
                      className="mx-auto max-h-[60vh] w-auto rounded-md object-contain"
                    />
                  </div>

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
                          Klik play untuk menelusuri slice secara otomatis. Scroll mouse untuk pindah slice, `Shift + scroll` untuk lompat lebih cepat.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
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
                            src={`${API_CONFIG.BASE_URL_WITHOUT_API}/api/pacs/rendered/${encodeURIComponent(image.instance_id)}?width=300`}
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
        <FloatingButtonsModal noRawat={formattedNoRawat} />
      )}
    </div>
  );
};

export default MedicalRecord;
