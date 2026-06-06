import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PatientTable from "@/components/PatientTable";
import { FloatingButtonsModal } from '@/components/FloatingButtonsModal';

import { 
  User, Calendar, Stethoscope, Syringe, Pill, FlaskConical, Radio, 
  Activity, ClipboardList, BedDouble, UserCircle, Building, MapPin, 
  Phone, Heart, CalendarDays, FileText, Plus, X, Trash2, Image as ImageIcon, Clock,
  Calendar as CalendarIcon, Copy, ChevronDown, ChevronUp, Brain
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTimeWIB } from "@/lib/date-utils";
import { format } from "date-fns";
import { API_URLS } from '@/config/api';

interface Medication {
  tanggal: string;
  obat: {
    nama: string;
    jumlah: string;
    aturan_pakai: string;
  }[];
}

interface RacikanMedicine {
  nama: string;
  jumlah: string;
}

interface CompoundPrescription {
  tanggal: string;
  nama_racikan: string;
  komposisi: RacikanMedicine[];
}

interface LabTest {
  nama?: string;
  pemeriksaan?: string;
  hasil: string;
  rujukan: string;
  keterangan: string;
}

interface LabData {
  tanggal: string;
  pemeriksaan: LabTest[];
}

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

const mapStatusLanjutToStatusRawat = (statusLanjut?: string | null) => {
  return statusLanjut === 'Ranap' || statusLanjut === 'Dirawat' ? 'Ranap' : 'Ralan';
};

const formatMultilineText = (value?: string | null) => {
  const normalizedValue = value?.replace(/\r\n/g, '\n').trim();
  return normalizedValue || '-';
};

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
  const [medications, setMedications] = useState<Medication[]>([{
    tanggal: '',
    obat: [{
      nama: '',
      jumlah: '',
      aturan_pakai: ''
    }]
  }]);

  const [compoundPrescriptions, setCompoundPrescriptions] = useState<CompoundPrescription[]>([{
    tanggal: '',
    nama_racikan: '',
    komposisi: [{
      nama: '',
      jumlah: ''
    }]
  }]);

  const [labTests, setLabTests] = useState<LabTest[]>([{
    pemeriksaan: '',
    hasil: '',
    rujukan: '',
    keterangan: ''
  }]);

  const [procedures, setProcedures] = useState([{
    kode: '',
    nama: '',
    hasil: ''
  }]);

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
  const [radiologies, setRadiologies] = useState([{ kode: '', pemeriksaan: '', hasil: '', keterangan: '' }]);
  const [isExaminationFormOpen, setIsExaminationFormOpen] = useState(false);
  const [isProcedureFormOpen, setIsProcedureFormOpen] = useState(false);
  const [isMedicationFormOpen, setIsMedicationFormOpen] = useState(false);
  const [isCompoundFormOpen, setIsCompoundFormOpen] = useState(false);
  const [isLabFormOpen, setIsLabFormOpen] = useState(false);
  const [isRadiologyFormOpen, setIsRadiologyFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('visits');
  const [pagination, setPagination] = useState<MedicalRecordPagination>({
    outpatient: DEFAULT_PAGINATION_META,
    inpatient: DEFAULT_PAGINATION_META
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const hasMoreRecords = pagination.outpatient.hasMore || pagination.inpatient.hasMore;
  const allOutpatientVisits = medicalData?.outpatient_visits || [];
  const allInpatientVisits = medicalData?.inpatient_visits || [];
  const scopedOutpatientVisits = formattedNoRawat
    ? allOutpatientVisits.filter((visit) => visit.no_rawat === formattedNoRawat)
    : allOutpatientVisits;
  const scopedInpatientVisits = formattedNoRawat
    ? allInpatientVisits.filter((visit) => visit.no_rawat === formattedNoRawat)
    : allInpatientVisits;
  
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
            )
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
  const addMedication = () => {
    setMedications([...medications, {
      tanggal: '',
      obat: [{
        nama: '',
        jumlah: '',
        aturan_pakai: ''
      }]
    }]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleCopyResep = (med: any) => {
    const isFirstEmpty = medications.length === 1 && 
      medications[0].tanggal === '' && 
      medications[0].obat.length === 1 && 
      medications[0].obat[0].nama === '';

    const newMedication: Medication = {
      tanggal: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      obat: med.obat.map((o: any) => ({
        nama: o.nama,
        jumlah: o.jumlah,
        aturan_pakai: o.aturan_pakai
      }))
    };

    if (isFirstEmpty) {
      setMedications([newMedication]);
    } else {
      setMedications([...medications, newMedication]);
    }

    setIsMedicationFormOpen(true);
    
    toast({
      title: "Resep Disalin",
      description: "Data resep berhasil disalin ke form tambah resep.",
    });
  };

  const addCompoundPrescription = () => {
    setCompoundPrescriptions([...compoundPrescriptions, {
      tanggal: '',
      nama_racikan: '',
      komposisi: [{
        nama: '',
        jumlah: ''
      }]
    }]);
  };

  const removeCompoundPrescription = (index: number) => {
    setCompoundPrescriptions(compoundPrescriptions.filter((_, i) => i !== index));
  };

  const addRacikanMedicine = (prescriptionIndex: number) => {
    const newPrescriptions = [...compoundPrescriptions];
    newPrescriptions[prescriptionIndex].komposisi.push({ nama: '', jumlah: '' });
    setCompoundPrescriptions(newPrescriptions);
  };

  const removeRacikanMedicine = (prescriptionIndex: number, medicineIndex: number) => {
    const newPrescriptions = [...compoundPrescriptions];
    newPrescriptions[prescriptionIndex].komposisi = newPrescriptions[prescriptionIndex].komposisi.filter((_, i) => i !== medicineIndex);
    setCompoundPrescriptions(newPrescriptions);
  };

  const addLabTest = () => {
    setLabTests([...labTests, {
      pemeriksaan: '',
      hasil: '',
      rujukan: '',
      keterangan: ''
    }]);
  };

  const removeLabTest = (index: number) => {
    setLabTests(labTests.filter((_, i) => i !== index));
  };

  const addProcedure = () => {
    setProcedures([...procedures, {
      kode: '',
      nama: '',
      hasil: ''
    }]);
  };

  const removeProcedure = (index: number) => {
    setProcedures(procedures.filter((_, i) => i !== index));
  };

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
    setRadiologies([...radiologies, { kode: '', pemeriksaan: '', hasil: '', keterangan: '' }]);
  };

  const removeRadiology = (index: number) => {
    setRadiologies(radiologies.filter((_, i) => i !== index));
  };

  const handleEditExamination = (examination: any, visit: any) => {
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
          jam_rawat: examination.jam_rawat
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
      } else {
        toast({
          title: "Berhasil",
          description: `Data ${type} berhasil disimpan`,
        });
      }
    } catch (error) {
      console.error(`Error saving ${type}:`, error);
      toast({
        title: "Error",
        description: `Gagal menyimpan data ${type}`,
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
                  {allOutpatientVisits.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Tidak ada data kunjungan rawat jalan
                    </div>
                  ) : (
                    allOutpatientVisits.map((visit: any, index) => (
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
                                    <p className="font-medium">{rad.pemeriksaan}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Hasil</p>
                                    <p className="font-medium">{rad.hasil}</p>
                                  </div>
                                </div>
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
                  {allInpatientVisits.map((visit: any, index) => (
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
                                    <p className="font-medium">{rad.pemeriksaan}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Hasil</p>
                                    <p className="font-medium">{rad.hasil}</p>
                                  </div>
                                </div>
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
                {/* Outpatient Examinations */}
                {scopedOutpatientVisits.map((visit) => 
                  visit.examinations?.map((exam, examIndex) => (
                    <div key={examIndex} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                          <div>
                            <p className="text-sm text-muted-foreground">Tanggal & Jam</p>
                            <p className="font-medium">{exam.tgl_perawatan} {exam.jam_rawat}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">No. Rawat</p>
                            <p className="font-medium">{visit.no_rawat}</p>
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
                          >
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDeleteExamination(exam, visit)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium">Tanda Vital</h4>
                          <p className="text-sm">Tekanan Darah: {exam.tensi || '-'}</p>
                          <p className="text-sm">Nadi: {exam.nadi || '-'}</p>
                          <p className="text-sm">Respirasi: {exam.respirasi || '-'}</p>
                          <p className="text-sm">Suhu: {exam.suhu_tubuh || '-'}</p>
                          <p className="text-sm">GCS: {exam.gcs || '-'}</p>
                          <p className="text-sm">SpO2: {exam.spo2 || '-'}</p>
                          <p className="text-sm">Tinggi: {exam.tinggi || '-'} cm</p>
                          <p className="text-sm">Berat: {exam.berat || '-'} kg</p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium">SOAPIE</h4>
                          <p className="text-sm"><strong>Keluhan:</strong> {exam.keluhan || '-'}</p>
                          <p className="text-sm"><strong>Pemeriksaan:</strong> {exam.pemeriksaan || '-'}</p>
                          <p className="text-sm"><strong>RTL:</strong> {exam.rtl || '-'}</p>
                          <p className="text-sm"><strong>Penilaian:</strong> {exam.penilaian || '-'}</p>
                          <p className="text-sm"><strong>Instruksi:</strong> {exam.instruksi || '-'}</p>
                          <p className="text-sm"><strong>Evaluasi:</strong> {exam.evaluasi || '-'}</p>
                          <p className="text-sm"><strong>Petugas:</strong> {exam.nip || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {/* Inpatient Examinations */}
                {scopedInpatientVisits.map((visit) => 
                  visit.examinations?.map((exam, examIndex) => (
                    <div key={`inpatient-${examIndex}`} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                          <div>
                            <p className="text-sm text-muted-foreground">Tanggal & Jam</p>
                            <p className="font-medium">{exam.tgl_perawatan} {exam.jam_rawat}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">No. Rawat</p>
                            <p className="font-medium">{visit.no_rawat}</p>
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
                          >
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDeleteExamination(exam, visit)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <h4 className="font-medium">Tanda Vital</h4>
                          <p className="text-sm">Tekanan Darah: {exam.tekanan_darah || exam.tensi || '-'}</p>
                          <p className="text-sm">Nadi: {exam.nadi || '-'}</p>
                          <p className="text-sm">Respirasi: {exam.respirasi || '-'}</p>
                          <p className="text-sm">Suhu: {exam.suhu || '-'}</p>
                          <p className="text-sm">GCS: {exam.gcs || '-'}</p>
                          <p className="text-sm">SpO2: {exam.spo2 || '-'}</p>
                          <p className="text-sm">Tinggi: {exam.tinggi || '-'} cm</p>
                          <p className="text-sm">Berat: {exam.berat || '-'} kg</p>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium">SOAPIE</h4>
                          <p className="text-sm"><strong>S (Subjektif):</strong> {exam.s || exam.keluhan || '-'}</p>
                          <p className="text-sm"><strong>O (Objektif):</strong> {exam.o || exam.pemeriksaan || '-'}</p>
                          <p className="text-sm"><strong>A (Assessment):</strong> {exam.a || exam.penilaian || '-'}</p>
                          <p className="text-sm"><strong>P (Planning):</strong> {exam.p || exam.rtl || '-'}</p>
                          <p className="text-sm"><strong>I (Implementation):</strong> {exam.i || exam.instruksi || '-'}</p>
                          <p className="text-sm"><strong>E (Evaluation):</strong> {exam.e || exam.evaluasi || '-'}</p>
                          <p className="text-sm"><strong>Petugas:</strong> {exam.pegawai || exam.nip || '-'}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                
                {procedures.map((procedure, index) => (
                  <div key={index} className="border rounded-lg p-4 mb-4 bg-background">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium">Tindakan {index + 1}</h4>
                      {procedures.length > 1 && (
                        <Button variant="destructive" size="sm" onClick={() => removeProcedure(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor={`proc-kode-${index}`}>Kode Tindakan</Label>
                        <Input 
                          id={`proc-kode-${index}`} 
                          placeholder="TDK001"
                          value={procedure.kode}
                          onChange={(e) => {
                            const newProcedures = [...procedures];
                            newProcedures[index].kode = e.target.value;
                            setProcedures(newProcedures);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`proc-nama-${index}`}>Nama Tindakan</Label>
                        <Input 
                          id={`proc-nama-${index}`} 
                          placeholder="Nama tindakan"
                          value={procedure.nama}
                          onChange={(e) => {
                            const newProcedures = [...procedures];
                            newProcedures[index].nama = e.target.value;
                            setProcedures(newProcedures);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`proc-hasil-${index}`}>Hasil</Label>
                        <Input 
                          id={`proc-hasil-${index}`} 
                          placeholder="Hasil tindakan"
                          value={procedure.hasil}
                          onChange={(e) => {
                            const newProcedures = [...procedures];
                            newProcedures[index].hasil = e.target.value;
                            setProcedures(newProcedures);
                          }}
                        />
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
                    <Button variant="outline">Reset</Button>
                    <Button onClick={() => handleSaveForm('Tindakan')}>Simpan Tindakan</Button>
                  </div>
                 </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>

              {/* Data Existing */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data Tindakan</h3>
                {(() => {
                  const allProcedures = [
                    ...scopedOutpatientVisits.flatMap((visit) =>
                      (visit.procedures || []).map((proc) => ({
                        ...proc,
                        no_rawat: visit.no_rawat,
                        source: 'Rawat Jalan'
                      }))
                    ),
                    ...scopedInpatientVisits.flatMap((visit) =>
                      (visit.procedures || []).map((proc) => ({
                        ...proc,
                        no_rawat: visit.no_rawat,
                        source: 'Rawat Inap'
                      }))
                    )
                  ];

                  const sortedProcedures = allProcedures.sort((a, b) => {
                    const dateA = new Date(a.tanggal || 0).getTime();
                    const dateB = new Date(b.tanggal || 0).getTime();
                    return dateB - dateA;
                  });

                  if (sortedProcedures.length === 0) {
                    return (
                      <p className="text-sm italic text-muted-foreground">
                        Belum ada data tindakan pada batch riwayat yang sudah dimuat.
                      </p>
                    );
                  }

                  const groupedProcedures = sortedProcedures.reduce((groups, proc) => {
                    const groupKey = proc.tanggal || '-';
                    if (!groups[groupKey]) {
                      groups[groupKey] = [];
                    }
                    groups[groupKey].push(proc);
                    return groups;
                  }, {} as Record<string, any[]>);

                  return (Object.entries(groupedProcedures) as Array<[string, any[]]>).map(([tanggal, procedures]) => (
                    <div key={tanggal} className="border rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">Tanggal & Jam</p>
                          <p className="font-semibold">{formatDateSafe(tanggal)}</p>
                        </div>

                        <div className="text-left md:text-right">
                          <p className="font-medium">{procedures[0]?.source || '-'}</p>
                          <p className="font-medium">{procedures[0]?.no_rawat || '-'}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {procedures.map((proc, procIndex) => (
                          <div
                            key={`${proc.no_rawat}-${tanggal}-${proc.nm_perawatan}-${procIndex}`}
                            className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-md border bg-muted/20 p-3"
                          >
                            <div>
                              <p className="text-sm text-muted-foreground">Nama Perawatan</p>
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
                  ));
                })()}
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
                        Form Tambah Resep Obat
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
                      <h4 className="font-medium">Resep {medIndex + 1}</h4>
                      {medications.length > 1 && (
                        <Button variant="destructive" size="sm" onClick={() => removeMedication(medIndex)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <Label htmlFor={`med-date-${medIndex}`}>Tanggal Resep</Label>
                        <Input 
                          id={`med-date-${medIndex}`} 
                          type="datetime-local"
                          value={medication.tanggal}
                          onChange={(e) => {
                            const newMedications = [...medications];
                            newMedications[medIndex].tanggal = e.target.value;
                            setMedications(newMedications);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="med-norawat">No. Rawat</Label>
                        <Input id="med-norawat" value={formattedNoRawat} readOnly className="bg-muted" />
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h5 className="font-medium">Daftar Obat:</h5>
                      {medication.obat.map((obat, obatIndex) => (
                        <div key={obatIndex} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-3 border rounded bg-muted/20">
                          <div>
                            <Label htmlFor={`obat-nama-${medIndex}-${obatIndex}`}>Nama Obat</Label>
                            <Input 
                              id={`obat-nama-${medIndex}-${obatIndex}`}
                              placeholder="Nama obat"
                              value={obat.nama}
                              onChange={(e) => {
                                const newMedications = [...medications];
                                newMedications[medIndex].obat[obatIndex].nama = e.target.value;
                                setMedications(newMedications);
                              }}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`obat-jumlah-${medIndex}-${obatIndex}`}>Jumlah</Label>
                            <Input 
                              id={`obat-jumlah-${medIndex}-${obatIndex}`}
                              placeholder="10"
                              value={obat.jumlah}
                              onChange={(e) => {
                                const newMedications = [...medications];
                                newMedications[medIndex].obat[obatIndex].jumlah = e.target.value;
                                setMedications(newMedications);
                              }}
                            />
                          </div>
                          <div>
                            <Label htmlFor={`obat-aturan-${medIndex}-${obatIndex}`}>Aturan Pakai</Label>
                            <Input 
                              id={`obat-aturan-${medIndex}-${obatIndex}`}
                              placeholder="3x1"
                              value={obat.aturan_pakai}
                              onChange={(e) => {
                                const newMedications = [...medications];
                                newMedications[medIndex].obat[obatIndex].aturan_pakai = e.target.value;
                                setMedications(newMedications);
                              }}
                            />
                          </div>
                          <div className="flex items-end">
                            {medication.obat.length > 1 && (
                              <Button 
                                variant="destructive" 
                                size="sm" 
                                onClick={() => {
                                  const newMedications = [...medications];
                                  newMedications[medIndex].obat = newMedications[medIndex].obat.filter((_, i) => i !== obatIndex);
                                  setMedications(newMedications);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const newMedications = [...medications];
                          newMedications[medIndex].obat.push({ nama: '', jumlah: '', aturan_pakai: '' });
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
                  <Button variant="outline" onClick={addMedication}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Resep
                  </Button>
                  <div className="flex space-x-2">
                    <Button variant="outline">Reset</Button>
                    <Button onClick={() => handleSaveForm('Resep')}>Simpan Resep</Button>
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
                         <Input 
                           id={`racikan-date-${compoundIndex}`} 
                           type="datetime-local"
                           value={compound.tanggal}
                           onChange={(e) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].tanggal = e.target.value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
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
                     </div>

                 <div className="space-y-4">
                   <h5 className="font-medium text-blue-700">Komposisi Racikan:</h5>
                   {compound.komposisi.map((racikan, racikanIndex) => (
                     <div key={racikanIndex} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 border rounded bg-blue-50/30">
                       <div>
                         <Label htmlFor={`racikan-obat-${compoundIndex}-${racikanIndex}`}>Nama Obat</Label>
                         <Input 
                           id={`racikan-obat-${compoundIndex}-${racikanIndex}`}
                           placeholder="Nama obat"
                           value={racikan.nama}
                           onChange={(e) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].komposisi[racikanIndex].nama = e.target.value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
                         />
                       </div>
                       <div>
                         <Label htmlFor={`racikan-jumlah-${compoundIndex}-${racikanIndex}`}>Jumlah/Dosis</Label>
                         <Input 
                           id={`racikan-jumlah-${compoundIndex}-${racikanIndex}`}
                           placeholder="mg/ml"
                           value={racikan.jumlah}
                           onChange={(e) => {
                             const newPrescriptions = [...compoundPrescriptions];
                             newPrescriptions[compoundIndex].komposisi[racikanIndex].jumlah = e.target.value;
                             setCompoundPrescriptions(newPrescriptions);
                           }}
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
                   ))}
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
                 <Button variant="outline">Reset</Button>
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

                    {(() => {
                      const allMedications = [
                        ...scopedOutpatientVisits.flatMap((visit) =>
                          (visit.medicationsRequest || []).map((med) => ({
                            ...med,
                            no_rawat: visit.no_rawat,
                            source: "Rawat Jalan",
                          }))
                        ),
                        ...scopedInpatientVisits.flatMap((visit) => {
                          const ranap = (visit.medicationsRequest || []).map((med) => ({
                            ...med,
                            no_rawat: visit.no_rawat,
                            source: "Rawat Inap",
                          }));
                          const pulang = (visit.medicationsRequestPulang || []).map((med) => ({
                            ...med,
                            no_rawat: visit.no_rawat,
                            source: "Obat Pulang",
                          }));
                          const ibs = (visit.medicationsRequestIbs || []).map((med) => ({
                            ...med,
                            no_rawat: visit.no_rawat,
                            source: "IBS",
                          }));
                          return [...ranap, ...pulang, ...ibs];
                        }),
                      ];

                      const sortedMedications = allMedications.sort((a, b) => {
                        const dateA = new Date(`${a.tanggal}T${a.jam || "00:00:00"}`);
                        const dateB = new Date(`${b.tanggal}T${b.jam || "00:00:00"}`);
                        return dateB.getTime() - dateA.getTime(); // newest first
                      });

                      if (sortedMedications.length === 0) {
                        return <p className="text-sm italic text-muted-foreground">Belum ada data riwayat resep obat.</p>;
                      }

                      return sortedMedications.map((med, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Nomor Resep</p>
                              <p className="font-medium">{med.no_resep}</p>
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyResep(med)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Resep
                              </Button>
                            </div>
                            {med.obat.map((obat, i) => (
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
                      ));
                    })()}
                  </div>
                </TabsContent>

                {/* Tab Riwayat Resep Obat */}
                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Pemberian Obat</h3>

                    {(() => {
                      const allMedications = [
                        ...scopedOutpatientVisits.flatMap((visit) =>
                          (visit.medications || []).map((med) => ({
                            ...med,
                            no_rawat: visit.no_rawat,
                            source: "Rawat Jalan",
                          }))
                        ),
                        ...scopedInpatientVisits.flatMap((visit) =>
                          (visit.medications || []).map((med) => ({
                            ...med,
                            no_rawat: visit.no_rawat,
                            source: "Rawat Inap",
                          }))
                        ),
                      ];

                      const sortedMedications = allMedications.sort((a, b) => {
                        const dateA = new Date(`${a.tanggal}T${a.jam || "00:00:00"}`);
                        const dateB = new Date(`${b.tanggal}T${b.jam || "00:00:00"}`);
                        return dateB.getTime() - dateA.getTime(); // newest first
                      });

                      if (sortedMedications.length === 0) {
                        return <p className="text-sm italic text-muted-foreground">Belum ada data riwayat pemberian obat.</p>;
                      }

                      return sortedMedications.map((med, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Nomor Resep</p>
                              <p className="font-medium">{med.no_resep}</p>
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
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCopyResep(med)}
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                Copy Resep
                              </Button>
                            </div>
                            {med.obat.map((obat, i) => (
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
                      ));
                    })()}
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
                        Form Tambah Laboratorium
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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label htmlFor="lab-date">Tanggal Pemeriksaan</Label>
                    <Input id="lab-date" type="datetime-local" />
                  </div>
                  <div>
                    <Label htmlFor="lab-norawat">No. Rawat</Label>
                    <Input id="lab-norawat" value={formattedNoRawat} readOnly className="bg-muted" />
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="font-medium">Pemeriksaan Laboratorium:</h5>
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
                        <div>
                          <Label htmlFor={`lab-nama-${index}`}>Nama Pemeriksaan</Label>
                          <Input 
                            id={`lab-nama-${index}`}
                            placeholder="Hemoglobin"
                            value={test.pemeriksaan}
                            onChange={(e) => {
                              const newLabTests = [...labTests];
                              newLabTests[index].pemeriksaan = e.target.value;
                              setLabTests(newLabTests);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`lab-hasil-${index}`}>Hasil</Label>
                          <Input 
                            id={`lab-hasil-${index}`}
                            placeholder="13.5"
                            value={test.hasil}
                            onChange={(e) => {
                              const newLabTests = [...labTests];
                              newLabTests[index].hasil = e.target.value;
                              setLabTests(newLabTests);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`lab-rujukan-${index}`}>Nilai Rujukan</Label>
                          <Input 
                            id={`lab-rujukan-${index}`}
                            placeholder="12-16"
                            value={test.rujukan}
                            onChange={(e) => {
                              const newLabTests = [...labTests];
                              newLabTests[index].rujukan = e.target.value;
                              setLabTests(newLabTests);
                            }}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`lab-keterangan-${index}`}>Keterangan</Label>
                          <Input 
                            id={`lab-keterangan-${index}`}
                            placeholder="Normal"
                            value={test.keterangan}
                            onChange={(e) => {
                              const newLabTests = [...labTests];
                              newLabTests[index].keterangan = e.target.value;
                              setLabTests(newLabTests);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" onClick={addLabTest}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Pemeriksaan
                  </Button>
                </div>

                <div className="flex justify-end space-x-2 mt-4">
                  <Button variant="outline">Reset</Button>
                  <Button onClick={() => handleSaveForm('Laboratorium')}>Simpan Laboratorium</Button>
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
                                {Array.isArray(item.content.perawatans) && item.content.perawatans.length > 0 ? 
                                  item.content.perawatans.map((lab, labIndex) => (
                                    <div key={labIndex} className="mb-2">
                                      <p className="font-semibold text-primary">{lab.nm_perawatan}</p>
                                      {Array.isArray(lab.hasil) && lab.hasil.length > 0 ? (
                                        lab.hasil.map((test, testIndex) => (
                                          <div key={testIndex} className="text-sm ml-4">
                                            <span className="font-medium">{test.pemeriksaan}:</span> {test.nilai} ({test.nilai_rujukan})
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm italic text-muted-foreground ml-4">Tidak ada hasil pemeriksaan.</div>
                                      )}
                                    </div>
                                  )) :
                                  <div className="text-sm italic text-muted-foreground">Tidak ada hasil pemeriksaan.</div>
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
                    <div className="space-y-4">
                      {scopedOutpatientVisits.map((visit) => 
                        visit.laboratoryRequest?.map((lab, labIndex) => (
                          <div 
                            key={labIndex} 
                            className="border rounded-lg p-4 cursor-move hover:shadow-lg transition-shadow"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm text-muted-foreground">Tanggal</p>
                                <p className="font-medium">{formatDateSafe(lab.tanggal)}</p>
                              </div>
                              <div>
                                <p className="text-sm text-muted-foreground">No. Rawat</p>
                                <p className="font-medium">{visit.no_rawat}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-medium">Pemeriksaan:</h4>
                              {lab.pemeriksaan.map((test, testIndex) => (
                                <div key={testIndex} className="grid grid-cols-1 md:grid-cols-1 gap-4 border-l-2 border-primary pl-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Nama</p>
                                    <p className="font-medium">{test.nama}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Tab Riwayat Pemeriksaan Lab */}
                <TabsContent value="history">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Riwayat Pemeriksaan Laboratorium (Draggable)</h3>
                    <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                      <div className="space-y-4">
                        {scopedOutpatientVisits.map((visit) => {
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
                                setDraggingLab(group as LabData);
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

                              {(group as any).perawatans?.map((lab: any, labIndex: number) => (
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
                    </ScrollArea>
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
                        Form Tambah Radiologi
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
                
                {radiologies.map((radiology, index) => (
                  <div key={index} className="border rounded-lg p-4 mb-4 bg-background">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium">Radiologi {index + 1}</h4>
                      {radiologies.length > 1 && (
                        <Button variant="destructive" size="sm" onClick={() => removeRadiology(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`rad-kode-${index}`}>Kode Radiologi</Label>
                        <Input 
                          id={`rad-kode-${index}`} 
                          placeholder="RAD001"
                          value={radiology.kode}
                          onChange={(e) => {
                            const newRadiologies = [...radiologies];
                            newRadiologies[index].kode = e.target.value;
                            setRadiologies(newRadiologies);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`rad-pemeriksaan-${index}`}>Jenis Pemeriksaan</Label>
                        <Input 
                          id={`rad-pemeriksaan-${index}`} 
                          placeholder="Rontgen Thorax"
                          value={radiology.pemeriksaan}
                          onChange={(e) => {
                            const newRadiologies = [...radiologies];
                            newRadiologies[index].pemeriksaan = e.target.value;
                            setRadiologies(newRadiologies);
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <Label htmlFor={`rad-hasil-${index}`}>Hasil Pemeriksaan</Label>
                        <Textarea 
                          id={`rad-hasil-${index}`} 
                          placeholder="Hasil pemeriksaan radiologi"
                          value={radiology.hasil}
                          onChange={(e) => {
                            const newRadiologies = [...radiologies];
                            newRadiologies[index].hasil = e.target.value;
                            setRadiologies(newRadiologies);
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`rad-keterangan-${index}`}>Keterangan</Label>
                        <Textarea 
                          id={`rad-keterangan-${index}`} 
                          placeholder="Keterangan tambahan"
                          value={radiology.keterangan}
                          onChange={(e) => {
                            const newRadiologies = [...radiologies];
                            newRadiologies[index].keterangan = e.target.value;
                            setRadiologies(newRadiologies);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center">
                  <Button variant="outline" onClick={addRadiology}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Radiologi
                  </Button>
                  <div className="flex space-x-2">
                    <Button variant="outline">Reset</Button>
                    <Button onClick={() => handleSaveForm('Radiologi')}>Simpan Radiologi</Button>
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
                        <div key={`${item.content.tanggal}-${item.content.pemeriksaan}-${index}`} className="border rounded-lg p-3 bg-blue-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{formatDateSafe(item.content.tanggal)}</p>
                              <div className="space-y-1 mt-2">
                                <div className="text-sm">
                                  <span className="font-medium">Pemeriksaan:</span> {item.content.pemeriksaan}
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">Hasil:</span> {item.content.hasil}
                                </div>
                                {item.content.keterangan && (
                                  <div className="text-sm">
                                    <span className="font-medium">Keterangan:</span> {item.content.keterangan}
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
                                  canvasItem.content.tanggal === item.content.tanggal &&
                                  canvasItem.content.pemeriksaan === item.content.pemeriksaan &&
                                  canvasItem.content.hasil === item.content.hasil
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
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data Radiologi (Draggable)</h3>
                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                  <div className="space-y-4">
                    {scopedOutpatientVisits.map((visit) => 
                      visit.radiology?.map((rad, radIndex) => (
                        <div 
                          key={radIndex} 
                          className="border rounded-lg p-4 cursor-move hover:shadow-lg transition-shadow"
                          draggable
                          onDragStart={(e) => {
                            setDraggingRad(rad);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                        >
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Tanggal</p>
                              <p className="font-medium">{formatDateSafe(rad.tanggal)}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">No. Rawat</p>
                              <p className="font-medium">{visit.no_rawat}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Pemeriksaan</p>
                              <p className="font-medium">{rad.pemeriksaan}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Hasil</p>
                              <p className="font-medium">{rad.hasil}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
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
