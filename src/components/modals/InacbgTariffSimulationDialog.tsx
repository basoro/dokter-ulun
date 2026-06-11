import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { API_URLS } from '@/config/api';
import { useToast } from "@/hooks/use-toast";
import { Calculator, Clock, FileText, Loader2, Trash2, Unlock } from 'lucide-react';
import { format } from 'date-fns';
import { DatePickerPopover } from '@/components/DatePickerPopover';

type SearchType = 'idrg_diagnosa' | 'idrg_prosedur' | 'inacbg_diagnosa' | 'inacbg_prosedur';

interface CodeRow {
  code: string;
  description: string;
  valid?: boolean;
}

interface SimulationDefaults {
  patient: {
    nomor_sep: string;
    nomor_rm: string;
    nomor_kartu: string;
    nama_pasien: string;
    tgl_lahir: string;
    gender: string;
    jenis_rawat: string;
    kelas_rawat: string;
    tgl_masuk: string;
    tgl_pulang: string;
    kode_tarif: string;
    payor_id: string;
    payor_cd: string;
    cob_cd: string;
    coder_nik: string;
    pasien_id: string;
  };
  optional: {
    biaya_bedah: string;
    biaya_obat: string;
    biaya_bmhp: string;
    biaya_alkes: string;
    adl_sub_acute: string;
    adl_chronic: string;
    icu_indikator: string;
    icu_los: string;
    ventilator_hour: string;
  };
  idrg: {
    diagnosa: CodeRow[];
    prosedur: CodeRow[];
  };
  inacbg: {
    diagnosa: CodeRow[];
    prosedur: CodeRow[];
  };
}

interface SearchOption {
  code: string;
  description: string;
}

interface DebugLogEntry {
  id: number;
  method: string;
  payload: unknown;
  response: unknown;
  timestamp: string;
}

interface InacbgTariffSimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noRawat?: string;
  defaultStatusRawat?: 'Ralan' | 'Ranap';
}

interface InacbgTariffSimulationContentProps {
  noRawat?: string;
  defaultStatusRawat?: 'Ralan' | 'Ranap';
}

const EMPTY_DEFAULTS: SimulationDefaults = {
  patient: {
    nomor_sep: '',
    nomor_rm: '',
    nomor_kartu: '',
    nama_pasien: '',
    tgl_lahir: '',
    gender: '1',
    jenis_rawat: '2',
    kelas_rawat: '3',
    tgl_masuk: '',
    tgl_pulang: '',
    kode_tarif: 'CP',
    payor_id: '3',
    payor_cd: 'JKN',
    cob_cd: '0',
    coder_nik: '',
    pasien_id: ''
  },
  optional: {
    biaya_bedah: '0',
    biaya_obat: '0',
    biaya_bmhp: '0',
    biaya_alkes: '0',
    adl_sub_acute: '0',
    adl_chronic: '0',
    icu_indikator: '0',
    icu_los: '0',
    ventilator_hour: '0'
  },
  idrg: {
    diagnosa: [],
    prosedur: []
  },
  inacbg: {
    diagnosa: [],
    prosedur: []
  }
};

export const InacbgTariffSimulationDialog: React.FC<InacbgTariffSimulationDialogProps> = ({
  open,
  onOpenChange,
  noRawat,
  defaultStatusRawat = 'Ralan'
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Simulasi Tarif INACBG's</DialogTitle>
        </DialogHeader>
        {open ? <InacbgTariffSimulationContent noRawat={noRawat} defaultStatusRawat={defaultStatusRawat} /> : null}
      </DialogContent>
    </Dialog>
  );
};

const SEARCH_LABELS: Record<SearchType, string> = {
  idrg_diagnosa: 'Cari Diagnosa (iDRG)',
  idrg_prosedur: 'Cari Prosedur (iDRG)',
  inacbg_diagnosa: 'Cari Diagnosa (INACBG)',
  inacbg_prosedur: 'Cari Prosedur (INACBG)'
};

const SEARCH_PLACEHOLDERS: Record<SearchType, string> = {
  idrg_diagnosa: 'Ketik kode atau nama diagnosa...',
  idrg_prosedur: 'Ketik kode atau nama prosedur...',
  inacbg_diagnosa: 'Ketik kode atau nama diagnosa...',
  inacbg_prosedur: 'Ketik kode atau nama prosedur...'
};

const formatDateInput = (value: string) => String(value || '').slice(0, 10);

const getCurrentDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const formatDateTimeInput = (value: string) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return '';
  return normalizedValue.replace(' ', 'T').slice(0, 16);
};

const formatDateTimeForApi = (value: string, fallbackTime = '00:00:00') => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return '';

  const withSpace = normalizedValue.replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2}$/.test(withSpace)) {
    return `${withSpace} ${fallbackTime}`;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(withSpace)) {
    return `${withSpace}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(withSpace)) {
    return withSpace;
  }

  return '';
};

const parseDateFromDateTime = (value: string) => {
  const normalized = formatDateTimeForApi(value);
  if (!normalized) return undefined;
  const [datePart] = normalized.split(' ');
  return new Date(`${datePart}T00:00:00`);
};

const getTimePart = (value: string, fallback = '00:00') => {
  const normalized = formatDateTimeForApi(value);
  if (!normalized) return fallback;
  return normalized.split(' ')[1]?.slice(0, 5) || fallback;
};

const buildDateTimeString = (dateValue?: Date, timeValue = '00:00') => {
  if (!dateValue) return '';
  const datePart = format(dateValue, 'yyyy-MM-dd');
  const normalizedTime = /^\d{2}:\d{2}$/.test(timeValue) ? `${timeValue}:00` : '00:00:00';
  return `${datePart} ${normalizedTime}`;
};

const formatNumber = (value: number, fractionDigits = 2) => (
  new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(Number.isFinite(value) ? value : 0)
);

const formatCurrency = (value: number) => (
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0)
);

const formatProcedureCodeDisplay = (value: string) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.includes('.')) {
    return normalizedValue;
  }

  if (normalizedValue.length <= 2) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, 2)}.${normalizedValue.slice(2)}`;
};

const formatProcedureCodeForPayload = (value: string) => {
  return formatProcedureCodeDisplay(value);
};

const mapStatusRawatToJenisRawat = (statusRawat?: 'Ralan' | 'Ranap') => (
  statusRawat === 'Ranap' ? '1' : '2'
);

export const InacbgTariffSimulationContent: React.FC<InacbgTariffSimulationContentProps> = ({
  noRawat,
  defaultStatusRawat = 'Ralan'
}) => {
  noRawat
  const fallbackJenisRawat = useMemo(
    () => mapStatusRawatToJenisRawat(defaultStatusRawat),
    [defaultStatusRawat]
  );
  const [defaults, setDefaults] = useState<SimulationDefaults>(EMPTY_DEFAULTS);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [patientForm, setPatientForm] = useState(EMPTY_DEFAULTS.patient);
  const [optionalForm, setOptionalForm] = useState(EMPTY_DEFAULTS.optional);
  const [idrgDiagnosa, setIdrgDiagnosa] = useState<CodeRow[]>([]);
  const [idrgProsedur, setIdrgProsedur] = useState<CodeRow[]>([]);
  const [inacbgDiagnosa, setInacbgDiagnosa] = useState<CodeRow[]>([]);
  const [inacbgProsedur, setInacbgProsedur] = useState<CodeRow[]>([]);
  const [searchQueryByType, setSearchQueryByType] = useState<Record<SearchType, string>>({
    idrg_diagnosa: '',
    idrg_prosedur: '',
    inacbg_diagnosa: '',
    inacbg_prosedur: ''
  });
  const [searchResultsByType, setSearchResultsByType] = useState<Record<SearchType, SearchOption[]>>({
    idrg_diagnosa: [],
    idrg_prosedur: [],
    inacbg_diagnosa: [],
    inacbg_prosedur: []
  });
  const [searchLoadingByType, setSearchLoadingByType] = useState<Record<SearchType, boolean>>({
    idrg_diagnosa: false,
    idrg_prosedur: false,
    inacbg_diagnosa: false,
    inacbg_prosedur: false
  });
  const [idrgResult, setIdrgResult] = useState<any>(null);
  const [inacbgResult, setInacbgResult] = useState<any>(null);
  const [selectedIdrgCmg, setSelectedIdrgCmg] = useState('');
  const [selectedInacbgCmg, setSelectedInacbgCmg] = useState('');
  const [globalStatus, setGlobalStatus] = useState('READY');
  const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const canGroupIdrg = useMemo(() => Boolean(patientForm.nomor_sep), [patientForm.nomor_sep]);
  const canGroupInacbg = useMemo(
    () => Boolean(idrgResult || inacbgDiagnosa.length || inacbgProsedur.length),
    [idrgResult, inacbgDiagnosa.length, inacbgProsedur.length]
  );

  const addDebugLog = (method: string, payload: unknown, response: unknown) => {
    setDebugLogs((prev) => [
      {
        id: prev.length + 1,
        method,
        payload,
        response,
        timestamp: new Date().toLocaleTimeString('id-ID')
      },
      ...prev
    ]);
  };

  const resetWorkflowState = () => {
    setIdrgResult(null);
    setInacbgResult(null);
    setSelectedIdrgCmg('');
    setSelectedInacbgCmg('');
    setGlobalStatus('READY');
    setDebugLogs([]);
    setSearchQueryByType({
      idrg_diagnosa: '',
      idrg_prosedur: '',
      inacbg_diagnosa: '',
      inacbg_prosedur: ''
    });
    setSearchResultsByType({
      idrg_diagnosa: [],
      idrg_prosedur: [],
      inacbg_diagnosa: [],
      inacbg_prosedur: []
    });
  };

  const applyDefaults = (data: SimulationDefaults) => {
    const currentDateTime = getCurrentDateTimeString();
    const nextPatient = {
      ...data.patient,
      nomor_sep: data.patient?.nomor_sep || '',
      tgl_lahir: formatDateInput(data.patient?.tgl_lahir || '') || getCurrentDateString(),
      jenis_rawat: data.patient?.jenis_rawat || fallbackJenisRawat,
      tgl_masuk: data.patient?.tgl_masuk || currentDateTime,
      tgl_pulang: data.patient?.tgl_pulang || currentDateTime
    };

    setDefaults(data);
    setPatientForm(nextPatient);
    setOptionalForm(data.optional);
    setIdrgDiagnosa(Array.isArray(data.idrg?.diagnosa) ? data.idrg.diagnosa : []);
    setIdrgProsedur(Array.isArray(data.idrg?.prosedur) ? data.idrg.prosedur : []);
    setInacbgDiagnosa(Array.isArray(data.inacbg?.diagnosa) ? data.inacbg.diagnosa : []);
    setInacbgProsedur(Array.isArray(data.inacbg?.prosedur) ? data.inacbg.prosedur : []);
    resetWorkflowState();
  };

  const loadDefaults = async () => {
    setLoadingDefaults(true);
    try {
      const requestUrl = noRawat
        ? `${API_URLS.INACBG_SIMULATION}/${encodeURIComponent(noRawat)}/defaults`
        : `${API_URLS.INACBG_SIMULATION}/defaults`;
      const response = await fetch(requestUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      applyDefaults(result.data || EMPTY_DEFAULTS);
    } catch (error) {
      console.error('Error loading INACBG defaults:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat default simulasi INACBG',
        variant: 'destructive'
      });
      applyDefaults(EMPTY_DEFAULTS);
    } finally {
      setLoadingDefaults(false);
    }
  };

  useEffect(() => {
    void loadDefaults();
  }, [fallbackJenisRawat, noRawat]);

  const apiCall = async (method: string, data: Record<string, unknown> = {}) => {
    const response = await fetch(`${API_URLS.INACBG_SIMULATION}/api-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        method,
        data,
        nomor_sep: patientForm.nomor_sep
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    addDebugLog(method, result.payload, result.response);
    return result.response;
  };

  const handleSearch = (type: SearchType, value: string) => {
    setSearchQueryByType((prev) => ({ ...prev, [type]: value }));

    if (debounceRefs.current[type]) {
      clearTimeout(debounceRefs.current[type] as ReturnType<typeof setTimeout>);
    }

    if (value.trim().length < 2) {
      setSearchResultsByType((prev) => ({ ...prev, [type]: [] }));
      setSearchLoadingByType((prev) => ({ ...prev, [type]: false }));
      return;
    }

    debounceRefs.current[type] = setTimeout(async () => {
      setSearchLoadingByType((prev) => ({ ...prev, [type]: true }));
      try {
        const response = await fetch(`${API_URLS.INACBG_SIMULATION}/search?q=${encodeURIComponent(value)}&type=${type}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setSearchResultsByType((prev) => ({ ...prev, [type]: result.results || [] }));
      } catch (error) {
        console.error('Error searching INACBG code:', error);
        setSearchResultsByType((prev) => ({ ...prev, [type]: [] }));
      } finally {
        setSearchLoadingByType((prev) => ({ ...prev, [type]: false }));
      }
    }, 300);
  };

  const addToRows = (
    rows: CodeRow[],
    nextItem: CodeRow,
    setter: React.Dispatch<React.SetStateAction<CodeRow[]>>,
    type: SearchType
  ) => {
    if (rows.some((item) => item.code === nextItem.code)) {
      return;
    }

    setter([...rows, nextItem]);
    setSearchQueryByType((prev) => ({ ...prev, [type]: '' }));
    setSearchResultsByType((prev) => ({ ...prev, [type]: [] }));
  };

  const importCodesToInacbgTable = async (codes: string, type: 'diagnosa' | 'prosedur') => {
    const normalizedCodes = String(codes || '')
      .split('#')
      .map((item) => item.trim())
      .filter(Boolean);

    const nextItems: CodeRow[] = [];
    for (const code of normalizedCodes) {
      const response = await fetch(`${API_URLS.INACBG_SIMULATION}/code-info?code=${encodeURIComponent(code)}&type=inacbg`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      nextItems.push({
        code,
        description: result.description || 'Deskripsi tidak ditemukan',
        valid: Boolean(result.valid)
      });
    }

    if (type === 'diagnosa') {
      setInacbgDiagnosa(nextItems);
      return;
    }

    setInacbgProsedur(nextItems);
  };

  const getCodesAsPayload = (rows: CodeRow[], isProcedure = false) => (
    rows
      .map((item) => isProcedure ? formatProcedureCodeForPayload(item.code) : item.code)
      .join('#')
  );

  const handleInitClaim = async () => {
    if (!patientForm.nomor_sep.trim()) {
      toast({ title: 'Validasi', description: 'Nomor SEP wajib diisi', variant: 'destructive' });
      return;
    }

    if (!patientForm.tgl_lahir) {
      toast({ title: 'Validasi', description: 'Tanggal lahir wajib diisi', variant: 'destructive' });
      return;
    }

    const formattedTglMasuk = formatDateTimeForApi(patientForm.tgl_masuk, '00:00:01');
    const formattedTglPulang = formatDateTimeForApi(patientForm.tgl_pulang, '23:59:59');

    if (!formattedTglMasuk) {
      toast({ title: 'Validasi', description: 'Tanggal masuk tidak valid', variant: 'destructive' });
      return;
    }

    if (!formattedTglPulang) {
      toast({ title: 'Validasi', description: 'Tanggal pulang tidak valid', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const fullDob = `${formatDateInput(patientForm.tgl_lahir)} 00:00:00`;

      await apiCall('reedit_claim');
      await apiCall('idrg_grouper_reedit');
      await apiCall('new_claim', {
        nomor_sep: patientForm.nomor_sep,
        nomor_rm: patientForm.nomor_rm || defaults.patient.nomor_rm,
        nomor_kartu: patientForm.nomor_kartu || defaults.patient.nomor_kartu,
        nama_pasien: patientForm.nama_pasien || defaults.patient.nama_pasien,
        tgl_lahir: fullDob,
        gender: patientForm.gender
      });

      const setResult = await apiCall('set_claim_data', {
        nomor_sep: patientForm.nomor_sep,
        nomor_kartu: patientForm.nomor_kartu,
        tgl_masuk: formattedTglMasuk,
        tgl_pulang: formattedTglPulang,
        cara_masuk: 'gp',
        jenis_rawat: patientForm.jenis_rawat,
        kelas_rawat: patientForm.kelas_rawat,
        adl_sub_acute: optionalForm.adl_sub_acute || '0',
        adl_chronic: optionalForm.adl_chronic || '0',
        icu_indikator: optionalForm.icu_indikator || '0',
        icu_los: optionalForm.icu_los || '0',
        ventilator_hour: optionalForm.ventilator_hour || '0',
        ventilator: { use_ind: '0', start_dttm: '', stop_dttm: '' },
        upgrade_class_ind: '0',
        birth_weight: '0',
        sistole: 120,
        diastole: 80,
        discharge_status: '1',
        tarif_rs: {
          prosedur_non_bedah: '0',
          prosedur_bedah: optionalForm.biaya_bedah || '0',
          konsultasi: '0',
          tenaga_ahli: '0',
          keperawatan: '0',
          penunjang: '0',
          radiologi: '0',
          laboratorium: '0',
          pelayanan_darah: '0',
          rehabilitasi: '0',
          kamar: '0',
          rawat_intensif: '0',
          obat: optionalForm.biaya_obat || '0',
          obat_kronis: '0',
          obat_kemoterapi: '0',
          alkes: optionalForm.biaya_alkes || '0',
          bmhp: optionalForm.biaya_bmhp || '0',
          sewa_alat: '0'
        },
        nama_dokter: 'Dokter Simulasi',
        kode_tarif: patientForm.kode_tarif || defaults.patient.kode_tarif || 'CP',
        payor_id: patientForm.payor_id || '3',
        payor_cd: patientForm.payor_cd || 'JKN',
        cob_cd: patientForm.cob_cd || '0',
        coder_nik: patientForm.coder_nik || defaults.patient.coder_nik
      });

      if (setResult?.metadata?.code !== 200) {
        throw new Error(setResult?.metadata?.message || 'Gagal inisialisasi klaim');
      }

      setGlobalStatus('CLAIM INITIALIZED');
      toast({ title: 'Berhasil', description: 'Klaim berhasil diinisialisasi' });
    } catch (error) {
      console.error('Error initializing claim:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal inisialisasi klaim',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUnfinalClaim = async () => {
    if (!patientForm.nomor_sep.trim()) {
      toast({ title: 'Validasi', description: 'Nomor SEP wajib diisi', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const result = await apiCall('reedit_claim');
      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Gagal membuka klaim');
      }

      setGlobalStatus('CLAIM OPENED');
      toast({ title: 'Berhasil', description: 'Klaim berhasil dibuka kembali' });
    } catch (error) {
      console.error('Error unfinal claim:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal membuka klaim',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleGroupIdrg = async () => {
    if (!canGroupIdrg) {
      toast({ title: 'Validasi', description: 'Inisialisasi klaim terlebih dahulu', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      await apiCall('idrg_diagnosa_set', { diagnosa: '#' });
      const diagnosa = getCodesAsPayload(idrgDiagnosa);
      if (diagnosa) {
        await apiCall('idrg_diagnosa_set', { diagnosa });
      }

      await apiCall('idrg_procedure_set', { procedure: '#' });
      const prosedur = getCodesAsPayload(idrgProsedur, true);
      if (prosedur) {
        await apiCall('idrg_procedure_set', { procedure: prosedur });
      }

      const result = await apiCall('grouper', {
        nomor_sep: patientForm.nomor_sep,
        grouper: 'idrg',
        stage: '1'
      });

      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Grouping iDRG gagal');
      }

      setIdrgResult(result.response_idrg);
      setSelectedIdrgCmg('');
      setGlobalStatus('iDRG GROUPED');
      toast({ title: 'Berhasil', description: 'Grouping iDRG selesai' });
    } catch (error) {
      console.error('Error grouping iDRG:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Grouping iDRG gagal',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReeditIdrg = async () => {
    setProcessing(true);
    try {
      const result = await apiCall('idrg_grouper_reedit');
      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Gagal re-edit iDRG');
      }

      setIdrgResult(null);
      setInacbgResult(null);
      setInacbgDiagnosa([]);
      setInacbgProsedur([]);
      setGlobalStatus('RE-EDITING iDRG');
      toast({ title: 'Berhasil', description: 'iDRG siap diedit ulang' });
    } catch (error) {
      console.error('Error reediting iDRG:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal re-edit iDRG',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyIdrgStage2 = async (cmg: string) => {
    setSelectedIdrgCmg(cmg);
    if (!cmg) return;

    setProcessing(true);
    try {
      const result = await apiCall('grouper', {
        nomor_sep: patientForm.nomor_sep,
        stage: '2',
        grouper: 'idrg',
        special_cmg: cmg
      });

      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Stage 2 iDRG gagal');
      }

      setIdrgResult(result.response_idrg);
      toast({ title: 'Berhasil', description: 'Top-up iDRG diterapkan' });
    } catch (error) {
      console.error('Error applying idrg stage 2:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Stage 2 iDRG gagal',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalIdrgAndImport = async () => {
    setProcessing(true);
    try {
      await apiCall('idrg_grouper_final');
      const importResult = await apiCall('idrg_to_inacbg_import');

      if (importResult?.metadata?.code !== 200) {
        throw new Error(importResult?.metadata?.message || 'Import ke INACBG gagal');
      }

      const diagnosaCodes = importResult?.data?.diagnosa
        ? (typeof importResult.data.diagnosa === 'string' ? importResult.data.diagnosa : importResult.data.diagnosa.string)
        : (importResult?.diagnosa || '');
      const prosedurCodes = importResult?.data?.procedure
        ? (typeof importResult.data.procedure === 'string' ? importResult.data.procedure : importResult.data.procedure.string)
        : (importResult?.procedure || '');

      await importCodesToInacbgTable(diagnosaCodes, 'diagnosa');
      await importCodesToInacbgTable(prosedurCodes, 'prosedur');

      setGlobalStatus('iDRG FINALIZED');
      toast({ title: 'Berhasil', description: 'iDRG final dan berhasil diimport ke INACBG' });
    } catch (error) {
      console.error('Error finalizing iDRG:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Final iDRG gagal',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleGroupInacbg = async () => {
    setProcessing(true);
    try {
      await apiCall('inacbg_diagnosa_set', { diagnosa: '#' });
      const diagnosa = getCodesAsPayload(inacbgDiagnosa);
      if (diagnosa) {
        await apiCall('inacbg_diagnosa_set', { diagnosa });
      }

      await apiCall('inacbg_procedure_set', { procedure: '#' });
      const prosedur = getCodesAsPayload(inacbgProsedur, true);
      if (prosedur) {
        await apiCall('inacbg_procedure_set', { procedure: prosedur });
      }

      const result = await apiCall('grouper', {
        nomor_sep: patientForm.nomor_sep,
        grouper: 'inacbg',
        stage: '1'
      });

      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Grouping INACBG gagal');
      }

      setInacbgResult(result);
      setSelectedInacbgCmg('');
      setGlobalStatus('INACBG GROUPED');
      toast({ title: 'Berhasil', description: 'Grouping INACBG selesai' });
    } catch (error) {
      console.error('Error grouping INACBG:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Grouping INACBG gagal',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReeditInacbg = async () => {
    setProcessing(true);
    try {
      const result = await apiCall('inacbg_grouper_reedit');
      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Gagal re-edit INACBG');
      }

      setInacbgResult(null);
      setGlobalStatus('RE-EDITING INACBG');
      toast({ title: 'Berhasil', description: 'INACBG siap diedit ulang' });
    } catch (error) {
      console.error('Error reediting INACBG:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Gagal re-edit INACBG',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyInacbgStage2 = async (cmg: string) => {
    setSelectedInacbgCmg(cmg);
    if (!cmg) return;

    setProcessing(true);
    try {
      const result = await apiCall('grouper', {
        nomor_sep: patientForm.nomor_sep,
        stage: '2',
        grouper: 'inacbg',
        special_cmg: cmg
      });

      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Stage 2 INACBG gagal');
      }

      setInacbgResult(result);
      toast({ title: 'Berhasil', description: 'Top-up INACBG diterapkan' });
    } catch (error) {
      console.error('Error applying inacbg stage 2:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Stage 2 INACBG gagal',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleFinalClaim = async () => {
    setProcessing(true);
    try {
      await apiCall('inacbg_grouper_final');
      const result = await apiCall('claim_final', {
        coder_nik: patientForm.coder_nik || defaults.patient.coder_nik
      });

      if (result?.metadata?.code !== 200) {
        throw new Error(result?.metadata?.message || 'Final klaim gagal');
      }

      setGlobalStatus('CLAIM FINALIZED');
      toast({ title: 'Berhasil', description: 'Klaim berhasil difinalisasi' });
    } catch (error) {
      console.error('Error final claim:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Final klaim gagal',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const renderCodeTable = (
    rows: CodeRow[],
    setter: React.Dispatch<React.SetStateAction<CodeRow[]>>,
    type: SearchType
  ) => {
    const isProcedureType = type === 'idrg_prosedur' || type === 'inacbg_prosedur';

    return (
    <div className="space-y-2">
      <Label>{SEARCH_LABELS[type]}</Label>
      <div className="relative">
        <Input
          value={searchQueryByType[type]}
          placeholder={SEARCH_PLACEHOLDERS[type]}
          onChange={(event) => handleSearch(type, event.target.value)}
        />
        {searchQueryByType[type].trim().length >= 2 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-background shadow-md">
            {searchLoadingByType[type] ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">Mencari data...</div>
            ) : searchResultsByType[type].length > 0 ? (
              searchResultsByType[type].map((item) => (
                <button
                  key={`${type}-${item.code}`}
                  type="button"
                  className="block w-full border-b px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    const nextItem: CodeRow = { code: item.code, description: item.description, valid: true };
                    if (type === 'idrg_diagnosa') {
                      addToRows(idrgDiagnosa, nextItem, setIdrgDiagnosa, type);
                    } else if (type === 'idrg_prosedur') {
                      addToRows(idrgProsedur, nextItem, setIdrgProsedur, type);
                    } else if (type === 'inacbg_diagnosa') {
                      addToRows(inacbgDiagnosa, nextItem, setInacbgDiagnosa, type);
                    } else {
                      addToRows(inacbgProsedur, nextItem, setInacbgProsedur, type);
                    }
                  }}
                >
                  <div className="font-mono text-xs text-primary">
                    {isProcedureType ? formatProcedureCodeDisplay(item.code) : item.code}
                  </div>
                  <div>{item.description}</div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">Tidak ditemukan</div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Kode</TableHead>
              <TableHead>Deskripsi</TableHead>
              <TableHead className="w-16 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Belum ada data
                </TableCell>
              </TableRow>
            ) : rows.map((item) => (
              <TableRow key={`${type}-${item.code}`}>
                <TableCell className="font-mono">
                  {isProcedureType ? formatProcedureCodeDisplay(item.code) : item.code}
                </TableCell>
                <TableCell>
                  {item.description}
                  {item.valid === false && (
                    <span className="ml-2 text-xs font-semibold text-red-600">(IM tidak berlaku)</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => setter((prev) => prev.filter((row) => row.code !== item.code))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )};

  const renderIdrgResult = () => {
    if (!idrgResult) return null;

    const topups = idrgResult.special_cmg_option || idrgResult.topup_options || [];
    const selectedTopup = topups.find((item: any) => item.code === selectedIdrgCmg);
    const costWeight = Number(idrgResult.cost_weight || 0);
    const topupWeight = Number(selectedTopup?.cost_weight || idrgResult.special_cmg_weight || 0);
    const totalCostWeight = Number(idrgResult.total_cost_weight || (costWeight + topupWeight));
    const nbr = Number(String(idrgResult.nbr || '0').replace(/,/g, ''));
    const totalClaim = nbr * totalCostWeight;

    return (
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Hasil Grouping iDRG</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">MDC</div>
            <div>{idrgResult.mdc_description || '-'} {idrgResult.mdc_number ? `(${idrgResult.mdc_number})` : ''}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">DRG</div>
            <div>{idrgResult.drg_description || '-'}</div>
            <div className="font-mono text-xs text-muted-foreground">{idrgResult.drg_code || '-'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">Cost Weight</div>
            <div>{formatNumber(costWeight)}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">Total Klaim</div>
            <div className="font-semibold text-primary">{formatCurrency(totalClaim)}</div>
          </div>
        </div>

        {topups.length > 0 && (
          <div className="space-y-2">
            <Label>Top-up iDRG</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedIdrgCmg}
              onChange={(event) => void handleApplyIdrgStage2(event.target.value)}
            >
              <option value="">- Pilih Topup -</option>
              {topups.map((item: any) => (
                <option key={item.code} value={item.code}>{item.description}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => void handleReeditIdrg()} disabled={processing}>
            Edit Ulang iDRG
          </Button>
          <Button type="button" onClick={() => void handleFinalIdrgAndImport()} disabled={processing}>
            Final iDRG & Import ke INACBG
          </Button>
        </div>
      </div>
    );
  };

  const renderInacbgResult = () => {
    if (!inacbgResult) return null;

    const data = inacbgResult.response_inacbg || {};
    const cbg = data.cbg || {};
    const topups = inacbgResult.special_cmg_option || [];

    return (
      <div className="space-y-4 rounded-lg border p-4">
        <h3 className="font-semibold">Hasil Grouping INACBG</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">CBG</div>
            <div>{cbg.description || '-'}</div>
            <div className="font-mono text-xs text-muted-foreground">{cbg.code || '-'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">Status</div>
            <div>{data.status_cd || 'normal'}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">Tarif Dasar</div>
            <div>{formatCurrency(Number(data.base_tariff || 0))}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-sm text-muted-foreground">Total Tarif</div>
            <div className="font-semibold text-primary">{formatCurrency(Number(data.tariff || 0))}</div>
          </div>
        </div>

        {topups.length > 0 && (
          <div className="space-y-2">
            <Label>Top-up INACBG</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedInacbgCmg}
              onChange={(event) => void handleApplyInacbgStage2(event.target.value)}
            >
              <option value="">- Pilih Topup -</option>
              {topups.map((item: any) => (
                <option key={item.code} value={item.code}>
                  {item.code} - {item.description} ({item.type})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => void handleReeditInacbg()} disabled={processing}>
            Edit Ulang INACBG
          </Button>
          <Button type="button" onClick={() => void handleFinalClaim()} disabled={processing}>
            Finalisasi Klaim
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
            <div>
              <div className="font-medium">Status Workflow</div>
              <div className="text-sm text-muted-foreground">No. Rawat: {noRawat || '-'}</div>
            </div>
            <div className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {processing ? 'PROCESSING...' : globalStatus}
            </div>
          </div>

          {loadingDefaults ? (
            <div className="flex items-center justify-center rounded-lg border py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Memuat default simulasi...
            </div>
          ) : (
            <>
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <h3 className="font-semibold">1. Informasi Pasien & Klaim</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <Label>Nomor SEP</Label>
                    <Input value={patientForm.nomor_sep} onChange={(e) => setPatientForm((prev) => ({ ...prev, nomor_sep: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Nomor RM</Label>
                    <Input value={patientForm.nomor_rm} onChange={(e) => setPatientForm((prev) => ({ ...prev, nomor_rm: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Nomor Kartu</Label>
                    <Input value={patientForm.nomor_kartu} onChange={(e) => setPatientForm((prev) => ({ ...prev, nomor_kartu: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Nama Pasien</Label>
                    <Input value={patientForm.nama_pasien} onChange={(e) => setPatientForm((prev) => ({ ...prev, nama_pasien: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Tanggal Lahir</Label>
                    <DatePickerPopover
                      mode="single"
                      selected={patientForm.tgl_lahir ? new Date(`${formatDateInput(patientForm.tgl_lahir)}T00:00:00`) : undefined}
                      onSelect={(date) => setPatientForm((prev) => ({ ...prev, tgl_lahir: date ? format(date, 'yyyy-MM-dd') : '' }))}
                      displayValue={patientForm.tgl_lahir ? format(new Date(`${formatDateInput(patientForm.tgl_lahir)}T00:00:00`), 'dd/MM/yyyy') : undefined}
                    />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={patientForm.gender} onChange={(e) => setPatientForm((prev) => ({ ...prev, gender: e.target.value }))}>
                      <option value="1">Laki-Laki</option>
                      <option value="2">Perempuan</option>
                    </select>
                  </div>
                  <div>
                    <Label>Jenis Rawat</Label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={patientForm.jenis_rawat} onChange={(e) => setPatientForm((prev) => ({ ...prev, jenis_rawat: e.target.value }))}>
                      <option value="2">Rawat Jalan</option>
                      <option value="1">Rawat Inap</option>
                    </select>
                  </div>
                  <div>
                    <Label>Kelas Rawat</Label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={patientForm.kelas_rawat} onChange={(e) => setPatientForm((prev) => ({ ...prev, kelas_rawat: e.target.value }))}>
                      <option value="1">Kelas 1</option>
                      <option value="2">Kelas 2</option>
                      <option value="3">Kelas 3</option>
                    </select>
                  </div>
                  <div>
                    <Label>Tgl Masuk</Label>
                    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                      <DatePickerPopover
                        mode="single"
                        selected={parseDateFromDateTime(patientForm.tgl_masuk)}
                        onSelect={(date) => setPatientForm((prev) => ({
                          ...prev,
                          tgl_masuk: buildDateTimeString(date, getTimePart(prev.tgl_masuk, '00:00'))
                        }))}
                        displayValue={patientForm.tgl_masuk ? format(parseDateFromDateTime(patientForm.tgl_masuk) || new Date(), 'dd/MM/yyyy') : undefined}
                      />
                      <div className="relative">
                        <Clock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          className="pl-9"
                          value={getTimePart(patientForm.tgl_masuk, '00:00')}
                          onChange={(e) => setPatientForm((prev) => ({
                            ...prev,
                            tgl_masuk: buildDateTimeString(parseDateFromDateTime(prev.tgl_masuk) || new Date(), e.target.value)
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Tgl Pulang</Label>
                    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2">
                      <DatePickerPopover
                        mode="single"
                        selected={parseDateFromDateTime(patientForm.tgl_pulang)}
                        onSelect={(date) => setPatientForm((prev) => ({
                          ...prev,
                          tgl_pulang: buildDateTimeString(date, getTimePart(prev.tgl_pulang, '00:00'))
                        }))}
                        displayValue={patientForm.tgl_pulang ? format(parseDateFromDateTime(patientForm.tgl_pulang) || new Date(), 'dd/MM/yyyy') : undefined}
                      />
                      <div className="relative">
                        <Clock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="time"
                          className="pl-9"
                          value={getTimePart(patientForm.tgl_pulang, '00:00')}
                          onChange={(e) => setPatientForm((prev) => ({
                            ...prev,
                            tgl_pulang: buildDateTimeString(parseDateFromDateTime(prev.tgl_pulang) || new Date(), e.target.value)
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Kode Tarif</Label>
                    <Input value={patientForm.kode_tarif} onChange={(e) => setPatientForm((prev) => ({ ...prev, kode_tarif: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Coder NIK</Label>
                    <Input value={patientForm.coder_nik} onChange={(e) => setPatientForm((prev) => ({ ...prev, coder_nik: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <Label>Prosedur Bedah</Label>
                    <Input type="number" value={optionalForm.biaya_bedah} onChange={(e) => setOptionalForm((prev) => ({ ...prev, biaya_bedah: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Obat</Label>
                    <Input type="number" value={optionalForm.biaya_obat} onChange={(e) => setOptionalForm((prev) => ({ ...prev, biaya_obat: e.target.value }))} />
                  </div>
                  <div>
                    <Label>BMHP</Label>
                    <Input type="number" value={optionalForm.biaya_bmhp} onChange={(e) => setOptionalForm((prev) => ({ ...prev, biaya_bmhp: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Alkes</Label>
                    <Input type="number" value={optionalForm.biaya_alkes} onChange={(e) => setOptionalForm((prev) => ({ ...prev, biaya_alkes: e.target.value }))} />
                  </div>
                  <div>
                    <Label>ADL Sub Acute</Label>
                    <Input type="number" value={optionalForm.adl_sub_acute} onChange={(e) => setOptionalForm((prev) => ({ ...prev, adl_sub_acute: e.target.value }))} />
                  </div>
                  <div>
                    <Label>ADL Chronic</Label>
                    <Input type="number" value={optionalForm.adl_chronic} onChange={(e) => setOptionalForm((prev) => ({ ...prev, adl_chronic: e.target.value }))} />
                  </div>
                  <div>
                    <Label>ICU Indikator</Label>
                    <Input type="number" value={optionalForm.icu_indikator} onChange={(e) => setOptionalForm((prev) => ({ ...prev, icu_indikator: e.target.value }))} />
                  </div>
                  <div>
                    <Label>ICU LOS</Label>
                    <Input type="number" value={optionalForm.icu_los} onChange={(e) => setOptionalForm((prev) => ({ ...prev, icu_los: e.target.value }))} />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => void handleUnfinalClaim()} disabled={processing}>
                    <Unlock className="mr-2 h-4 w-4" />
                    Unfinal Klaim
                  </Button>
                  <Button type="button" onClick={() => void handleInitClaim()} disabled={processing}>
                    {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                    Mulai Klaim Baru
                  </Button>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">2. iDRG Coding (ICD-10-IM & ICD-9CM-IM)</h3>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {renderCodeTable(idrgDiagnosa, setIdrgDiagnosa, 'idrg_diagnosa')}
                  {renderCodeTable(idrgProsedur, setIdrgProsedur, 'idrg_prosedur')}
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => void handleGroupIdrg()} disabled={processing || !canGroupIdrg}>
                    Grouping iDRG
                  </Button>
                </div>
              </div>

              {renderIdrgResult()}

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold">3. INACBG Coding (ICD-10 & ICD-9) - Cek Kesesuaian IM</h3>
                <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Silakan cek kesesuaian kode hasil import dari iDRG sebelum melakukan grouping INACBG.
                </div>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {renderCodeTable(inacbgDiagnosa, setInacbgDiagnosa, 'inacbg_diagnosa')}
                  {renderCodeTable(inacbgProsedur, setInacbgProsedur, 'inacbg_prosedur')}
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => void handleGroupInacbg()} disabled={processing || !canGroupInacbg}>
                    Grouping INACBG
                  </Button>
                </div>
              </div>

              {renderInacbgResult()}

              <div className="space-y-3 rounded-lg border p-4">
                <h3 className="font-semibold">Debug Logs</h3>
                {debugLogs.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Belum ada log payload/response.</div>
                ) : debugLogs.map((log) => (
                  <details key={log.id} className="rounded border p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Step {log.id}: {log.method} - {log.timestamp}
                    </summary>
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs font-semibold text-muted-foreground">Payload</div>
                        <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(log.payload, null, 2)}</pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs font-semibold text-muted-foreground">Response</div>
                        <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(log.response, null, 2)}</pre>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}
    </div>
  );
};
