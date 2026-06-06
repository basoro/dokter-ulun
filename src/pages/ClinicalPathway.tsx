import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Save, Printer, User, Calendar, DollarSign, Target, AlertTriangle, Activity, Stethoscope, Plus, X, Database, Brain, Search, Filter, ArrowUp, ArrowDown, Clipboard } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaginationControls } from '@/components/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import { API_URLS } from '@/config/api';

interface PathwayItem {
  category: string;
  items: {
    name: string;
    days: boolean[];
    notes: string;
    variance?: string;
  }[];
}

const ClinicalPathway = () => {
  const { toast } = useToast();
  const { no_rkm_medis, no_rawat } = useParams<{ no_rkm_medis: string; no_rawat: string }>();
  const [loading, setLoading] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [dataMiningLoading, setDataMiningLoading] = useState(false);
  
  // Identifikasi Pasien
  const [patientName, setPatientName] = useState('');
  const [medicalRecordNumber, setMedicalRecordNumber] = useState(no_rkm_medis || '');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [roomBed, setRoomBed] = useState('');
  const [noRawat, setNoRawat] = useState(no_rawat || '');
  const [formattedNoRawat, setFormattedNoRawat] = useState('');
  
  // Diagnosis
  const [initialDiagnosis, setInitialDiagnosis] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  
  // Rencana Perawatan
  const [medicalPlan, setMedicalPlan] = useState('');
  const [nursingPlan, setNursingPlan] = useState('');
  
  // Perkiraan Biaya
  const [estimatedCost, setEstimatedCost] = useState('');
  const [medicationCost, setMedicationCost] = useState('');
  const [procedureCost, setProcedureCost] = useState('');
  
  // Hasil Akhir dan Kriteria Keluaran
  const [treatmentOutcome, setTreatmentOutcome] = useState('');
  const [dischargeCriteria, setDischargeCriteria] = useState('');
  
  // Linimasa
  const [estimatedLOS, setEstimatedLOS] = useState('');
  const [actualLOS, setActualLOS] = useState('');
  
  // Catatan Varians
  const [varianceNotes, setVarianceNotes] = useState('');
  
  // ICD Codes
  const [icd10Primary, setIcd10Primary] = useState({ code: '', description: '' });
  const [icd10Secondary, setIcd10Secondary] = useState([{ code: '', description: '' }]);
  const [icd9Primary, setIcd9Primary] = useState({ code: '', description: '' });
  const [icd9Secondary, setIcd9Secondary] = useState([{ code: '', description: '' }]);
  
  // ICD Modal States
  const [isIcdModalOpen, setIsIcdModalOpen] = useState(false);
  const [icdModalType, setIcdModalType] = useState<'icd10' | 'icd9'>('icd10');
  const [icdModalTarget, setIcdModalTarget] = useState<{type: 'icd10Primary' | 'icd10Secondary' | 'icd9Primary' | 'icd9Secondary', index?: number}>({ type: 'icd10Primary' });
  const [icdSearchQuery, setIcdSearchQuery] = useState('');
  const [icdSearchResults, setIcdSearchResults] = useState<any[]>([]);
  const [icdLoading, setIcdLoading] = useState(false);
  const [icdHasSearched, setIcdHasSearched] = useState(false);
  const [icdActiveTab, setIcdActiveTab] = useState('icd10');
  const [icdSortField, setIcdSortField] = useState('code');
  const [icdSortDirection, setIcdSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Data Mining Modal States
  const [isDataMiningModalOpen, setIsDataMiningModalOpen] = useState(false);
  const [dataMiningResults, setDataMiningResults] = useState<any>(null);
  
  // AI Generation Modal States
  const [isAIGenerationModalOpen, setIsAIGenerationModalOpen] = useState(false);
  const [aiGenerationResults, setAIGenerationResults] = useState<any>(null);
  
  const { paginationState: icdPaginationState, handlePageChange: handleIcdPageChange, handleItemsPerPageChange: handleIcdItemsPerPageChange, updatePagination: updateIcdPagination } = usePagination({
    initialItemsPerPage: 10
  });
  
  // Verifikasi
  const [doctorSignature, setDoctorSignature] = useState('');
  const [nurseSignature, setNurseSignature] = useState('');
  const [pharmacistSignature, setPharmacistSignature] = useState('');

  // Template konstanta untuk clinical pathway
  const template = {
    categories: [
      {
        name: 'ASESMEN',
        items: [
          'Asesmen awal medis',
          'Asesmen awal keperawatan',
          'Asesmen nyeri',
          'Asesmen risiko jatuh',
          'Asesmen gizi',
          'EKG/Pemeriksaan penunjang',
          'Laboratorium'
        ]
      },
      {
        name: 'KONSULTASI',
        items: [
          'Konsultasi spesialis terkait',
          'Konsultasi gizi',
          'Konsultasi farmasi',
          'Konsultasi rehabilitasi medik'
        ]
      },
      {
        name: 'TINDAKAN MEDIS',
        items: [
          'Persiapan tindakan medis',
          'Tindakan diagnostik',
          'Tindakan terapeutik',
          'Monitoring post tindakan'
        ]
      },
      {
        name: 'TINDAKAN KEPERAWATAN',
        items: [
          'Pemasangan infus',
          'Monitoring vital sign',
          'Perawatan luka',
          'Mobilisasi',
          'Edukasi pasien & keluarga'
        ]
      },
      {
        name: 'TINDAKAN FARMASI',
        items: [
          'Rekonsiliasi obat',
          'Pemberian obat',
          'Monitoring efek samping',
          'Edukasi penggunaan obat'
        ]
      },
      {
        name: 'AKTIVITAS HARIAN',
        items: [
          'Diet/Nutrisi',
          'Aktivitas/Mobilisasi',
          'Istirahat/Tidur',
          'Personal hygiene',
          'Eliminasi'
        ]
      },
      {
        name: 'DISCHARGE PLANNING',
        items: [
          'Asesmen discharge planning',
          'Edukasi pulang',
          'Resep pulang',
          'Jadwal kontrol',
          'Rujukan lanjutan'
        ]
      }
    ],
    days: ['Hari 1', 'Hari 2', 'Hari 3', 'Hari 4', 'Hari 5', 'Hari 6', 'Hari 7']
  };

  // Inisialisasi pathwayData dengan template
  const initializePathwayData = () => {
    return template.categories.map(category => ({
      category: category.name,
      items: category.items.map(item => ({
        name: item,
        days: new Array(template.days.length).fill(false),
        notes: '',
        variance: ''
      }))
    }));
  };

  const [pathwayData, setPathwayData] = useState<PathwayItem[]>(initializePathwayData());

  // Format no_rawat with slashes
  useEffect(() => {
    if (no_rawat) {
      const year = no_rawat.substring(0, 4);
      const month = no_rawat.substring(4, 6);
      const day = no_rawat.substring(6, 8);
      const sequence = no_rawat.substring(8);
      const formatted = `${year}/${month}/${day}/${sequence}`;
      setFormattedNoRawat(formatted);
    }
  }, [no_rawat]);

  // Fetch patient data when component mounts
  useEffect(() => {
    if (no_rkm_medis && no_rawat) {
      fetchPatientData();
    }
  }, [no_rkm_medis, no_rawat]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/${no_rkm_medis}/${no_rawat}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch patient data');
      }
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const responseData = data.data;
        
        // Set patient information from patient_info
        if (responseData.patient_info) {
          setPatientName(responseData.patient_info.nm_pasien || '');
          setAge(responseData.patient_info.umur?.toString() || '');
          setGender(responseData.patient_info.jk || '');
        }
        
        // Set weight and height from latest examination vital signs
        if (responseData.examinations && responseData.examinations.length > 0) {
          const latestExam = responseData.examinations[0]; // Latest examination
          if (latestExam.vital_signs) {
            setWeight(latestExam.vital_signs.berat?.toString() || '');
            setHeight(latestExam.vital_signs.tinggi?.toString() || '');
          }
        }
        
        // Set room/bed from inpatient info if available
        if (responseData.inpatient_info && responseData.inpatient_info.nm_kamar) {
          setRoomBed(responseData.inpatient_info.nm_kamar || '');
        }
        
        // Set diagnosis from diagnoses array
        if (responseData.diagnoses && responseData.diagnoses.length > 0) {
          const primaryDiagnosis = responseData.diagnoses.find(d => d.prioritas === 1) || responseData.diagnoses[0];
          setInitialDiagnosis(primaryDiagnosis.nm_penyakit || '');
        }
        
        toast({
          title: "Berhasil",
          description: "Data pasien berhasil dimuat",
        });
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data pasien",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (categoryIndex: number, itemIndex: number, dayIndex: number, checked: boolean) => {
    const newData = [...pathwayData];
    newData[categoryIndex].items[itemIndex].days[dayIndex] = checked;
    setPathwayData(newData);
  };

  const handleNotesChange = (categoryIndex: number, itemIndex: number, notes: string) => {
    const newData = [...pathwayData];
    newData[categoryIndex].items[itemIndex].notes = notes;
    setPathwayData(newData);
  };

  const handleVarianceChange = (categoryIndex: number, itemIndex: number, variance: string) => {
    const newData = [...pathwayData];
    newData[categoryIndex].items[itemIndex].variance = variance;
    setPathwayData(newData);
  };

  // ICD Helper Functions
  const addIcdEntry = (type: 'icd10Secondary' | 'icd9Secondary') => {
    const newEntry = { code: '', description: '' };
    switch (type) {
      case 'icd10Secondary':
        setIcd10Secondary([...icd10Secondary, newEntry]);
        break;
      case 'icd9Secondary':
        setIcd9Secondary([...icd9Secondary, newEntry]);
        break;
    }
  };

  const removeIcdEntry = (type: 'icd10Secondary' | 'icd9Secondary', index: number) => {
    switch (type) {
      case 'icd10Secondary':
        if (icd10Secondary.length > 1) {
          setIcd10Secondary(icd10Secondary.filter((_, i) => i !== index));
        }
        break;
      case 'icd9Secondary':
        if (icd9Secondary.length > 1) {
          setIcd9Secondary(icd9Secondary.filter((_, i) => i !== index));
        }
        break;
    }
  };

  const updateIcdEntry = (type: 'icd10Primary' | 'icd10Secondary' | 'icd9Primary' | 'icd9Secondary', index: number | undefined, field: 'code' | 'description', value: string) => {
    switch (type) {
      case 'icd10Primary':
        setIcd10Primary({ ...icd10Primary, [field]: value });
        break;
      case 'icd10Secondary':
        if (index !== undefined) {
          const newIcd10Secondary = [...icd10Secondary];
          newIcd10Secondary[index][field] = value;
          setIcd10Secondary(newIcd10Secondary);
        }
        break;
      case 'icd9Primary':
        setIcd9Primary({ ...icd9Primary, [field]: value });
        break;
      case 'icd9Secondary':
        if (index !== undefined) {
          const newIcd9Secondary = [...icd9Secondary];
          newIcd9Secondary[index][field] = value;
          setIcd9Secondary(newIcd9Secondary);
        }
        break;
    }
  };

  // ICD Modal Functions
  const openIcdModal = (type: 'icd10Primary' | 'icd10Secondary' | 'icd9Primary' | 'icd9Secondary', index?: number) => {
    setIcdModalTarget({ type, index });
    setIcdModalType(type.startsWith('icd10') ? 'icd10' : 'icd9');
    setIcdActiveTab(type.startsWith('icd10') ? 'icd10' : 'icd9');
    setIsIcdModalOpen(true);
    setIcdSearchQuery('');
    setIcdSearchResults([]);
    setIcdHasSearched(false);
    updateIcdPagination({ page: 1 });
  };

  const fetchIcdData = async (icdType: string, search: string = '') => {
    setIcdLoading(true);
    try {
      const response = await fetch(API_URLS.ICD_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: icdPaginationState.currentPage,
          itemsPerPage: icdPaginationState.itemsPerPage,
          search: search,
          icdType: icdType
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      setIcdSearchResults(data.data || []);
      updateIcdPagination({
        total: data.total,
        totalPages: data.totalPages
      });
      setIcdHasSearched(true);
    } catch (error) {
      console.error('Error fetching ICD data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data ICD",
        variant: "destructive"
      });
      setIcdSearchResults([]);
      setIcdHasSearched(true);
    } finally {
      setIcdLoading(false);
    }
  };

  const handleIcdSearch = () => {
    updateIcdPagination({ page: 1 });
    fetchIcdData(icdActiveTab, icdSearchQuery);
  };

  const handleIcdClearSearch = () => {
    setIcdSearchQuery('');
    setIcdSearchResults([]);
    setIcdHasSearched(false);
    updateIcdPagination({ page: 1 });
  };
  
  const handleIcdTabChange = (value: string) => {
    setIcdActiveTab(value);
    setIcdSearchResults([]);
    setIcdHasSearched(false);
    setIcdSearchQuery('');
    updateIcdPagination({ page: 1 });
  };

  const handleIcdSelect = (item: any) => {
    const { type, index } = icdModalTarget;
    
    if (icdActiveTab === 'icd10') {
      const code = item.kd_penyakit;
      const description = item.nm_penyakit;
      
      if (type === 'icd10Primary') {
        setIcd10Primary({ code, description });
      } else if (type === 'icd10Secondary' && index !== undefined) {
        const newIcd10Secondary = [...icd10Secondary];
        newIcd10Secondary[index] = { code, description };
        setIcd10Secondary(newIcd10Secondary);
      }
    } else {
      const code = item.kode;
      const description = item.deskripsi_pendek;
      
      if (type === 'icd9Primary') {
        setIcd9Primary({ code, description });
      } else if (type === 'icd9Secondary' && index !== undefined) {
        const newIcd9Secondary = [...icd9Secondary];
        newIcd9Secondary[index] = { code, description };
        setIcd9Secondary(newIcd9Secondary);
      }
    }
    
    setIsIcdModalOpen(false);
    toast({
      title: "Berhasil",
      description: "Kode ICD berhasil dipilih",
    });
  };

  const handleIcdSort = (field: string) => {
    if (icdSortField === field) {
      setIcdSortDirection(icdSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setIcdSortField(field);
      setIcdSortDirection('asc');
    }
    
    const sorted = [...icdSearchResults].sort((a, b) => {
      let aValue, bValue;
      
      if (field === 'code') {
        aValue = icdActiveTab === 'icd10' ? a.kd_penyakit : a.kode;
        bValue = icdActiveTab === 'icd10' ? b.kd_penyakit : b.kode;
      } else if (field === 'name_id') {
        aValue = icdActiveTab === 'icd10' ? a.nm_penyakit : a.deskripsi_pendek;
        bValue = icdActiveTab === 'icd10' ? b.nm_penyakit : b.deskripsi_pendek;
      } else {
        aValue = a[field];
        bValue = b[field];
      }
      
      if (icdSortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setIcdSearchResults(sorted);
  };

  const IcdSortIcon = ({ field }: { field: string }) => {
    if (field !== icdSortField) return null;
    return icdSortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  useEffect(() => {
    if (icdHasSearched) {
      fetchIcdData(icdActiveTab, icdSearchQuery);
    }
  }, [icdPaginationState.currentPage, icdPaginationState.itemsPerPage]);

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const clinicalPathwayData = {
        no_rkm_medis: medicalRecordNumber,
        no_rawat: noRawat,
        patient_name: patientName,
        age,
        gender,
        weight,
        height,
        room_bed: roomBed,
        icd10_primary: icd10Primary,
        icd10_secondary: icd10Secondary,
        icd9_primary: icd9Primary,
        icd9_secondary: icd9Secondary,
        initial_diagnosis: initialDiagnosis,
        final_diagnosis: finalDiagnosis,
        medical_plan: medicalPlan,
        nursing_plan: nursingPlan,
        estimated_cost: estimatedCost,
        medication_cost: medicationCost,
        procedure_cost: procedureCost,
        treatment_outcome: treatmentOutcome,
        discharge_criteria: dischargeCriteria,
        estimated_los: estimatedLOS,
        actual_los: actualLOS,
        variance_notes: varianceNotes,
        doctor_signature: doctorSignature,
        nurse_signature: nurseSignature,
        pharmacist_signature: pharmacistSignature,
        pathway_data: pathwayData
      };
      
      console.log('=== Frontend Data Before Send ===');
      console.log('icd10_secondary:', JSON.stringify(icd10Secondary, null, 2));
      console.log('icd9_secondary:', JSON.stringify(icd9Secondary, null, 2));
      console.log('Full data:', JSON.stringify(clinicalPathwayData, null, 2));
      
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clinicalPathwayData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save clinical pathway');
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Berhasil",
          description: "Clinical Pathway berhasil disimpan",
        });
      } else {
        throw new Error(result.message || 'Failed to save clinical pathway');
      }
    } catch (error) {
      console.error('Error saving clinical pathway:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan Clinical Pathway",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGenerate = async () => {
    try {
      setGenerateLoading(true);
      
      // Prepare patient data for AI generation
      const patientData = {
        no_rkm_medis: medicalRecordNumber,
        no_rawat: noRawat,
        patient_name: patientName,
        age,
        gender,
        weight,
        height,
        room_bed: roomBed,
        initial_diagnosis: initialDiagnosis,
        final_diagnosis: finalDiagnosis,
        icd10_primary: icd10Primary,
        icd10_secondary: icd10Secondary,
        icd9_primary: icd9Primary,
        icd9_secondary: icd9Secondary
      };

      console.log(patientData);
      
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patientData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate clinical pathway');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const generatedData = result.data;
        
        // Store AI generation results for modal display
        setAIGenerationResults(generatedData);
        setIsAIGenerationModalOpen(true);
        
        toast({
          title: "Berhasil",
          description: "AI Generation berhasil dilakukan. Lihat hasil di modal.",
        });
      } else {
        throw new Error(result.message || 'Failed to generate clinical pathway');
      }
    } catch (error) {
      console.error('Error generating clinical pathway:', error);
      toast({
        title: "Error",
        description: "Gagal generate Clinical Pathway menggunakan AI",
        variant: "destructive",
      });
    } finally {
       setGenerateLoading(false);
     }
   };

  const handleDataMining = async () => {
    try {
      setDataMiningLoading(true);
      
      // Prepare patient data for data mining
      const patientData = {
        no_rkm_medis: medicalRecordNumber,
        patient_name: patientName,
        initial_diagnosis: initialDiagnosis,
        final_diagnosis: finalDiagnosis,
        icd10_primary: icd10Primary,
        icd10_secondary: icd10Secondary,
        icd9_primary: icd9Primary,
        icd9_secondary: icd9Secondary
      };
      
      const response = await fetch(`${API_URLS.CLINICAL_PATHWAY}/data-mining`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patientData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate clinical pathway from data mining');
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const generatedData = result.data;
        
        // Store data mining results for modal display
        setDataMiningResults(generatedData);
        setIsDataMiningModalOpen(true);
        
        toast({
          title: "Berhasil",
          description: "Data mining berhasil dilakukan. Lihat hasil di modal.",
        });
      } else {
        throw new Error(result.message || 'Failed to generate clinical pathway from data mining');
      }
    } catch (error) {
      console.error('Error generating clinical pathway from data mining:', error);
      toast({
        title: "Error",
        description: "Gagal generate Clinical Pathway dari data mining",
        variant: "destructive",
      });
    } finally {
       setDataMiningLoading(false);
     }
    };

  const applyDataMiningResults = () => {
    if (dataMiningResults) {
      // Update pathway data from data mining results
      if (dataMiningResults.pathwayData && Array.isArray(dataMiningResults.pathwayData)) {
        setPathwayData(dataMiningResults.pathwayData);
      }
      
      // Update other fields if available
      if (dataMiningResults.estimatedLOS) {
        setEstimatedLOS(dataMiningResults.estimatedLOS);
      }
      
      if (dataMiningResults.estimatedCost) {
        setEstimatedCost(dataMiningResults.estimatedCost);
      }
      
      setIsDataMiningModalOpen(false);
      
      toast({
        title: "Berhasil",
        description: "Hasil data mining telah diterapkan ke clinical pathway",
      });
    }
  };

  const applyMedicationToMedicalPlan = (medicationName: string) => {
    const currentPlan = medicalPlan;
    const newMedication = `Obat: ${medicationName}`;
    
    if (currentPlan) {
      // Add medication to existing plan
      setMedicalPlan(currentPlan + '\n' + newMedication);
    } else {
      // Set as new plan
      setMedicalPlan(newMedication);
    }
    
    toast({
      title: "Berhasil",
      description: `Obat "${medicationName}" telah ditambahkan ke Rencana Perawatan Medis`,
    });
  };

  const applyAIGenerationResults = () => {
    if (aiGenerationResults) {
      // Update diagnosis
      if (aiGenerationResults.diagnosis) {
        if (aiGenerationResults.diagnosis.primary) {
          setInitialDiagnosis(aiGenerationResults.diagnosis.primary);
          setFinalDiagnosis(aiGenerationResults.diagnosis.primary);
        }
      }
      
      // Update ICD codes
      if (aiGenerationResults.icd10Primary) {
        setIcd10Primary(aiGenerationResults.icd10Primary);
      }
      if (aiGenerationResults.icd10Secondary && Array.isArray(aiGenerationResults.icd10Secondary)) {
        setIcd10Secondary(aiGenerationResults.icd10Secondary);
      }
      if (aiGenerationResults.icd9Primary) {
        setIcd9Primary(aiGenerationResults.icd9Primary);
      }
      if (aiGenerationResults.icd9Secondary && Array.isArray(aiGenerationResults.icd9Secondary)) {
        setIcd9Secondary(aiGenerationResults.icd9Secondary);
      }
      
      // Update treatment plan
      if (aiGenerationResults.treatmentPlan) {
        if (aiGenerationResults.treatmentPlan.goals && Array.isArray(aiGenerationResults.treatmentPlan.goals)) {
          setMedicalPlan(aiGenerationResults.treatmentPlan.goals.join(', '));
        }
        if (aiGenerationResults.treatmentPlan.expectedOutcome) {
          setTreatmentOutcome(aiGenerationResults.treatmentPlan.expectedOutcome);
        }
        if (aiGenerationResults.treatmentPlan.estimatedLength) {
          setEstimatedLOS(aiGenerationResults.treatmentPlan.estimatedLength);
        }
      }
      
      // Update pathway data
      if (aiGenerationResults.pathwayData && Array.isArray(aiGenerationResults.pathwayData)) {
        setPathwayData(aiGenerationResults.pathwayData);
      }
      
      // Update estimated costs
      if (aiGenerationResults.estimatedCosts) {
        const totalCost = Object.values(aiGenerationResults.estimatedCosts).reduce((sum: number, cost: any) => sum + (Number(cost) || 0), 0);
        setEstimatedCost(totalCost.toString());
        setMedicationCost(aiGenerationResults.estimatedCosts.medication?.toString() || '0');
        setProcedureCost(aiGenerationResults.estimatedCosts.medical?.toString() || '0');
      }
      
      setIsAIGenerationModalOpen(false);
      
      toast({
        title: "Berhasil",
        description: "Hasil AI Generation telah diterapkan ke clinical pathway",
      });
    }
  };

  const applyAIItemToForm = (type: string, value: any) => {
    switch (type) {
      case 'diagnosis':
        setInitialDiagnosis(value);
        setFinalDiagnosis(value);
        break;
      case 'icd10Primary':
        setIcd10Primary(value);
        break;
      case 'medicalPlan':
        setMedicalPlan(value);
        break;
      case 'treatmentOutcome':
        setTreatmentOutcome(value);
        break;
      case 'estimatedLOS':
        setEstimatedLOS(value);
        break;
      default:
        break;
    }
    
    toast({
      title: "Berhasil",
      description: `${type} telah diterapkan ke form`,
    });
  };

  return (
    <div className="w-full p-4">
      {/* Header */}
      <Card className="mb-6">
        <CardHeader className="bg-green-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center">
                <FileText className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">CLINICAL PATHWAYS</h1>
                <p className="text-lg">Format Umum Clinical Pathway</p>
              </div>
            </div>
            <div className="text-right flex space-x-2">
              <Button 
                variant="outline" 
                className="font-semibold bg-blue-600 text-white hover:bg-blue-700"
                onClick={handleDataMining}
                disabled={dataMiningLoading || !patientName || !medicalRecordNumber}
              >
                <Database className="w-4 h-4 mr-2" />
                {dataMiningLoading ? 'Mining...' : 'Data Mining'}
              </Button>
              <Button 
                 variant="outline" 
                 className="font-semibold bg-red-600 text-white hover:bg-red-700"
                 onClick={handleGenerate}
                 disabled={generateLoading || !patientName || !medicalRecordNumber}
               >
                 <Brain className="w-4 h-4 mr-2" />
                 {generateLoading ? 'AI Generating...' : 'AI Generate'}
               </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Identifikasi Pasien */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="w-5 h-5" />
            <span>Identifikasi Pasien</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="patientName">Nama Pasien</Label>
              <Input
                id="patientName"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Masukkan nama pasien"
              />
            </div>
            <div>
              <Label htmlFor="medicalRecord">No. Rekam Medis</Label>
              <Input
                id="medicalRecord"
                value={medicalRecordNumber}
                onChange={(e) => setMedicalRecordNumber(e.target.value)}
                placeholder="Masukkan no. rekam medis"
              />
            </div>
            <div>
              <Label htmlFor="noRawat">No. Rawat</Label>
              <Input
                id="noRawat"
                value={formattedNoRawat}
                readOnly
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="age">Umur</Label>
              <Input
                id="age"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Masukkan umur"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="gender">Jenis Kelamin</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis kelamin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L">Laki-laki</SelectItem>
                  <SelectItem value="P">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="weight">Berat Badan (kg)</Label>
              <Input
                id="weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="BB"
              />
            </div>
            <div>
              <Label htmlFor="height">Tinggi Badan (cm)</Label>
              <Input
                id="height"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="TB"
              />
            </div>
            <div>
              <Label htmlFor="roomBed">Ruang/Tempat Tidur</Label>
              <Input
                id="roomBed"
                value={roomBed}
                onChange={(e) => setRoomBed(e.target.value)}
                placeholder="Ruang/TT"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ICD Codes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Kode ICD</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* ICD-10 Column */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-center">ICD-10</h3>
              
              {/* ICD-10 Primary */}
              <div className="mb-6">
                <Label className="text-sm font-semibold mb-3 block">ICD-10 Primer</Label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Kode ICD-10"
                    value={icd10Primary.code}
                    onChange={(e) => updateIcdEntry('icd10Primary', undefined, 'code', e.target.value)}
                    className="w-32"
                  />
                  <Input
                    placeholder="Deskripsi"
                    value={icd10Primary.description}
                    onChange={(e) => updateIcdEntry('icd10Primary', undefined, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openIcdModal('icd10Primary')}
                    className="px-3"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ICD-10 Secondary */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">ICD-10 Sekunder</Label>
                {icd10Secondary.map((icd, index) => (
                  <div key={index} className="flex gap-2 mb-3">
                    <Input
                      placeholder="Kode ICD-10"
                      value={icd.code}
                      onChange={(e) => updateIcdEntry('icd10Secondary', index, 'code', e.target.value)}
                      className="w-32"
                    />
                    <Input
                      placeholder="Deskripsi"
                      value={icd.description}
                      onChange={(e) => updateIcdEntry('icd10Secondary', index, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openIcdModal('icd10Secondary', index)}
                      className="px-3"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeIcdEntry('icd10Secondary', index)}
                      disabled={icd10Secondary.length === 1}
                      className="ml-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addIcdEntry('icd10Secondary')}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah ICD-10 Sekunder
                </Button>
              </div>
            </div>

            {/* ICD-9 Column */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-center">ICD-9</h3>
              
              {/* ICD-9 Primary */}
              <div className="mb-6">
                <Label className="text-sm font-semibold mb-3 block">ICD-9 Primer</Label>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Kode ICD-9"
                    value={icd9Primary.code}
                    onChange={(e) => updateIcdEntry('icd9Primary', undefined, 'code', e.target.value)}
                    className="w-32"
                  />
                  <Input
                    placeholder="Deskripsi"
                    value={icd9Primary.description}
                    onChange={(e) => updateIcdEntry('icd9Primary', undefined, 'description', e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openIcdModal('icd9Primary')}
                    className="px-3"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ICD-9 Secondary */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">ICD-9 Sekunder</Label>
                {icd9Secondary.map((icd, index) => (
                  <div key={index} className="flex gap-2 mb-3">
                    <Input
                      placeholder="Kode ICD-9"
                      value={icd.code}
                      onChange={(e) => updateIcdEntry('icd9Secondary', index, 'code', e.target.value)}
                      className="w-32"
                    />
                    <Input
                      placeholder="Deskripsi"
                      value={icd.description}
                      onChange={(e) => updateIcdEntry('icd9Secondary', index, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openIcdModal('icd9Secondary', index)}
                      className="px-3"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeIcdEntry('icd9Secondary', index)}
                      disabled={icd9Secondary.length === 1}
                      className="ml-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addIcdEntry('icd9Secondary')}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah ICD-9 Sekunder
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Stethoscope className="w-5 h-5" />
            <span>Diagnosis</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="initialDiagnosis">Diagnosis Awal</Label>
              <Textarea
                id="initialDiagnosis"
                value={initialDiagnosis}
                onChange={(e) => setInitialDiagnosis(e.target.value)}
                placeholder="Masukkan diagnosis awal"
                className="h-24"
              />
            </div>
            <div>
              <Label htmlFor="finalDiagnosis">Diagnosis Akhir</Label>
              <Textarea
                id="finalDiagnosis"
                value={finalDiagnosis}
                onChange={(e) => setFinalDiagnosis(e.target.value)}
                placeholder="Masukkan diagnosis akhir"
                className="h-24"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rencana Perawatan */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Rencana Perawatan</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="medicalPlan">Rencana Perawatan Medis</Label>
              <Textarea
                id="medicalPlan"
                value={medicalPlan}
                onChange={(e) => setMedicalPlan(e.target.value)}
                placeholder="Tindakan medis, obat-obatan, pemeriksaan penunjang"
                className="h-32"
              />
            </div>
            <div>
              <Label htmlFor="nursingPlan">Rencana Asuhan Keperawatan</Label>
              <Textarea
                id="nursingPlan"
                value={nursingPlan}
                onChange={(e) => setNursingPlan(e.target.value)}
                placeholder="Rencana asuhan keperawatan"
                className="h-32"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Linimasa */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5" />
            <span>Linimasa Perawatan</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="estimatedLOS">Perkiraan Lama Rawat (hari)</Label>
              <Input
                id="estimatedLOS"
                value={estimatedLOS}
                onChange={(e) => setEstimatedLOS(e.target.value)}
                placeholder="Perkiraan hari rawat"
              />
            </div>
            <div>
              <Label htmlFor="actualLOS">Lama Rawat Aktual (hari)</Label>
              <Input
                id="actualLOS"
                value={actualLOS}
                onChange={(e) => setActualLOS(e.target.value)}
                placeholder="Lama rawat aktual"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Perkiraan Biaya */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Perkiraan Biaya</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="estimatedCost">Total Perkiraan Biaya</Label>
              <Input
                id="estimatedCost"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
                placeholder="Rp. 0"
              />
            </div>
            <div>
              <Label htmlFor="medicationCost">Biaya Obat-obatan</Label>
              <Input
                id="medicationCost"
                value={medicationCost}
                onChange={(e) => setMedicationCost(e.target.value)}
                placeholder="Rp. 0"
              />
            </div>
            <div>
              <Label htmlFor="procedureCost">Biaya Tindakan</Label>
              <Input
                id="procedureCost"
                value={procedureCost}
                onChange={(e) => setProcedureCost(e.target.value)}
                placeholder="Rp. 0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Pathway Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="w-5 h-5" />
            <span>Kategori Perawatan & Aktivitas Harian</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left font-semibold min-w-[200px]">URAIAN KEGIATAN</th>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <th key={day} className="border border-gray-300 p-3 text-center font-semibold w-16">
                      Hari {day}
                    </th>
                  ))}
                  <th className="border border-gray-300 p-3 text-left font-semibold min-w-[150px]">KETERANGAN</th>
                  <th className="border border-gray-300 p-3 text-left font-semibold min-w-[150px]">VARIANS</th>
                </tr>
              </thead>
              <tbody>
                {pathwayData.map((category, categoryIndex) => (
                  <React.Fragment key={categoryIndex}>
                    <tr className="bg-yellow-100">
                      <td className="border border-gray-300 p-3 font-semibold" colSpan={10}>
                        {category.category}
                      </td>
                    </tr>
                    {category.items.map((item, itemIndex) => (
                      <tr key={itemIndex} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3">{item.name}</td>
                        {item.days.map((checked, dayIndex) => (
                          <td key={dayIndex} className="border border-gray-300 p-3 text-center">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(checked) => 
                                handleDayChange(categoryIndex, itemIndex, dayIndex, checked as boolean)
                              }
                            />
                          </td>
                        ))}
                        <td className="border border-gray-300 p-3">
                          <Input
                            value={item.notes}
                            onChange={(e) => handleNotesChange(categoryIndex, itemIndex, e.target.value)}
                            placeholder="Keterangan"
                            className="border-0 bg-transparent text-sm"
                          />
                        </td>
                        <td className="border border-gray-300 p-3">
                          <Input
                            value={item.variance || ''}
                            onChange={(e) => handleVarianceChange(categoryIndex, itemIndex, e.target.value)}
                            placeholder="Catatan varians"
                            className="border-0 bg-transparent text-sm"
                          />
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Hasil Akhir & Kriteria Keluaran */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="w-5 h-5" />
            <span>Hasil Akhir Perawatan & Kriteria Keluaran</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="treatmentOutcome">Hasil Akhir Perawatan</Label>
              <Textarea
                id="treatmentOutcome"
                value={treatmentOutcome}
                onChange={(e) => setTreatmentOutcome(e.target.value)}
                placeholder="Kesembuhan, perbaikan kondisi, rujukan, dll"
                className="h-24"
              />
            </div>
            <div>
              <Label htmlFor="dischargeCriteria">Kriteria Keluaran</Label>
              <Textarea
                id="dischargeCriteria"
                value={dischargeCriteria}
                onChange={(e) => setDischargeCriteria(e.target.value)}
                placeholder="Kriteria keberhasilan jangka pendek dan panjang"
                className="h-24"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catatan Varians */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5" />
            <span>Catatan Varians</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div>
            <Label htmlFor="varianceNotes">Catatan Penyimpangan dari Rencana</Label>
            <Textarea
              id="varianceNotes"
              value={varianceNotes}
              onChange={(e) => setVarianceNotes(e.target.value)}
              placeholder="Catatan mengenai penyimpangan dari rencana perawatan, alasan penyimpangan, dan tindakan yang diambil"
              className="h-32 mt-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Verifikasi */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Verifikasi Tenaga Medis</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="doctorSignature">Dokter Penanggung Jawab</Label>
              <Textarea
                id="doctorSignature"
                value={doctorSignature}
                onChange={(e) => setDoctorSignature(e.target.value)}
                placeholder="Tanda tangan dan nama dokter"
                className="mt-2 h-24"
              />
            </div>
            <div>
              <Label htmlFor="nurseSignature">Perawat Penanggung Jawab</Label>
              <Textarea
                id="nurseSignature"
                value={nurseSignature}
                onChange={(e) => setNurseSignature(e.target.value)}
                placeholder="Tanda tangan dan nama perawat"
                className="mt-2 h-24"
              />
            </div>
            <div>
              <Label htmlFor="pharmacistSignature">Apoteker</Label>
              <Textarea
                id="pharmacistSignature"
                value={pharmacistSignature}
                onChange={(e) => setPharmacistSignature(e.target.value)}
                placeholder="Tanda tangan dan nama apoteker"
                className="mt-2 h-24"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-yellow-300 border border-gray-400"></div>
              <span>Yang harus dilaksanakan</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-gray-300 border border-gray-400"></div>
              <span>Rujukan bila tidak sesuai</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-white border border-gray-400"></div>
              <span>Bila tidak sesuai pathway</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-200 border-2 border-red-500"></div>
              <span>Varians dari rencana</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Button onClick={handlePrint} variant="outline" className="flex items-center space-x-2" disabled={loading}>
          <Printer className="w-4 h-4" />
          <span>Cetak</span>
        </Button>
        <Button onClick={handleSave} className="flex items-center space-x-2" disabled={loading}>
          <Save className="w-4 h-4" />
          <span>{loading ? 'Menyimpan...' : 'Simpan'}</span>
        </Button>
      </div>

      {/* ICD Modal */}
      <Dialog open={isIcdModalOpen} onOpenChange={setIsIcdModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pilih Data ICD</DialogTitle>
            <DialogDescription>
              Cari dan pilih data ICD untuk dimasukkan ke form
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={icdActiveTab} onValueChange={handleIcdTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="icd10">ICD-10</TabsTrigger>
              <TabsTrigger value="icd9">ICD-9-CM</TabsTrigger>
            </TabsList>
            
            <TabsContent value="icd10" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Pencarian ICD-10
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Masukkan kata kunci pencarian..."
                      value={icdSearchQuery}
                      onChange={(e) => setIcdSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleIcdSearch} disabled={icdLoading}>
                      <Search className="h-4 w-4 mr-2" />
                      {icdLoading ? 'Mencari...' : 'Cari'}
                    </Button>
                    <Button onClick={handleIcdClearSearch} variant="outline">
                      <Filter className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                  
                  {icdHasSearched && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleIcdSort('code')}>
                                <div className="flex items-center gap-1">
                                  Kode
                                  <IcdSortIcon field="code" />
                                </div>
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleIcdSort('name_id')}>
                                <div className="flex items-center gap-1">
                                  Nama Penyakit
                                  <IcdSortIcon field="name_id" />
                                </div>
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Aksi
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {icdSearchResults.length > 0 ? (
                              icdSearchResults.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {icdActiveTab === 'icd10' ? item.kd_penyakit : item.kode}
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-900">
                                    {icdActiveTab === 'icd10' ? item.nm_penyakit : item.deskripsi_pendek}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <Button
                                      size="sm"
                                      onClick={() => handleIcdSelect(item)}
                                      className="mr-2"
                                    >
                                      Pilih
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                  {icdLoading ? 'Mencari data...' : 'Tidak ada hasil ditemukan'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      
                      {icdSearchResults.length > 0 && (
                        <div className="px-4 py-3 border-t">
                          <PaginationControls
                             currentPage={icdPaginationState.currentPage}
                             totalPages={icdPaginationState.totalPages}
                             itemsPerPage={icdPaginationState.itemsPerPage}
                             totalItems={icdPaginationState.totalItems}
                             onPageChange={handleIcdPageChange}
                             onItemsPerPageChange={handleIcdItemsPerPageChange}
                           />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="icd9" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Pencarian ICD-9-CM
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Masukkan kata kunci pencarian..."
                      value={icdSearchQuery}
                      onChange={(e) => setIcdSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={handleIcdSearch} disabled={icdLoading}>
                      <Search className="h-4 w-4 mr-2" />
                      {icdLoading ? 'Mencari...' : 'Cari'}
                    </Button>
                    <Button onClick={handleIcdClearSearch} variant="outline">
                      <Filter className="h-4 w-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                  
                  {icdHasSearched && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleIcdSort('code')}>
                                <div className="flex items-center gap-1">
                                  Kode
                                  <IcdSortIcon field="code" />
                                </div>
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleIcdSort('name_id')}>
                                <div className="flex items-center gap-1">
                                  Nama Penyakit
                                  <IcdSortIcon field="name_id" />
                                </div>
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Aksi
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {icdSearchResults.length > 0 ? (
                              icdSearchResults.map((item, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {icdActiveTab === 'icd10' ? item.kd_penyakit : item.kode}
                                  </td>
                                  <td className="px-4 py-4 text-sm text-gray-900">
                                    {icdActiveTab === 'icd10' ? item.nm_penyakit : item.deskripsi_pendek}
                                  </td>
                                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                    <Button
                                      size="sm"
                                      onClick={() => handleIcdSelect(item)}
                                      className="mr-2"
                                    >
                                      Pilih
                                    </Button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                  {icdLoading ? 'Mencari data...' : 'Tidak ada hasil ditemukan'}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      
                      {icdSearchResults.length > 0 && (
                        <div className="px-4 py-3 border-t">
                          <PaginationControls
                             currentPage={icdPaginationState.currentPage}
                             totalPages={icdPaginationState.totalPages}
                             itemsPerPage={icdPaginationState.itemsPerPage}
                             totalItems={icdPaginationState.totalItems}
                             onPageChange={handleIcdPageChange}
                             onItemsPerPageChange={handleIcdItemsPerPageChange}
                           />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Data Mining Results Modal */}
      <Dialog open={isDataMiningModalOpen} onOpenChange={setIsDataMiningModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span>Hasil Data Mining</span>
            </DialogTitle>
            <DialogDescription>
              Hasil analisis data mining dari kasus serupa dalam 1 tahun terakhir
            </DialogDescription>
          </DialogHeader>
          
          {dataMiningResults && (
            <div className="space-y-6">
              {/* Summary Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ringkasan Analisis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {dataMiningResults.analysisMetadata?.total_cases_analyzed || 0}
                      </div>
                      <div className="text-sm text-gray-600">Total Kasus Dianalisis</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {dataMiningResults.estimatedLOS || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Estimasi LOS (hari)</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {dataMiningResults.estimatedCost ? `Rp ${Number(dataMiningResults.estimatedCost).toLocaleString('id-ID')}` : 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Estimasi Biaya</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Patient Details */}
              {dataMiningResults.historicalData && dataMiningResults.historicalData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detail Pasien Serupa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">No. RM</th>
                            <th className="text-left p-2">JK</th>
                            <th className="text-left p-2">Tgl Lahir</th>
                            <th className="text-left p-2">Tgl Masuk</th>
                            <th className="text-left p-2">Tgl Keluar</th>
                            <th className="text-left p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataMiningResults.historicalData.slice(0, 5).map((patient: any, index: number) => (
                            <tr key={index} className="border-b hover:bg-gray-50">
                              <td className="p-2">{patient.no_rkm_medis}</td>
                              <td className="p-2">{patient.jk}</td>
                              <td className="p-2">{patient.tgl_lahir ? new Date(patient.tgl_lahir).toLocaleDateString('id-ID') : '-'}</td>
                              <td className="p-2">{patient.tgl_masuk ? new Date(patient.tgl_masuk).toLocaleDateString('id-ID') : '-'}</td>
                              <td className="p-2">{patient.tgl_keluar ? new Date(patient.tgl_keluar).toLocaleDateString('id-ID') : '-'}</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  patient.stts_pulang === 'Sembuh' ? 'bg-green-100 text-green-800' :
                                  patient.stts_pulang === 'Membaik' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {patient.stts_pulang || 'Tidak diketahui'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Treatment History */}
              {dataMiningResults.historicalData && dataMiningResults.historicalData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Riwayat Tindakan & Obat</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {dataMiningResults.historicalData.slice(0, 5).map((patient: any, index: number) => (
                        <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                          <div className="font-medium">Pasien {patient.no_rkm_medis}</div>
                          <div className="text-sm text-gray-600 space-y-1">
                            {patient.nama_tindakan && (
                              <div><strong>Tindakan:</strong> {patient.nama_tindakan}</div>
                            )}
                            {patient.nama_obat && (
                              <div><strong>Obat:</strong> {patient.nama_obat}</div>
                            )}
                            <div><strong>Diagnosis:</strong> {patient.nm_penyakit || 'Tidak tersedia'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Medication Mining Results */}
              {(() => {
                // Extract unique medications from historical data
                const medications = dataMiningResults.historicalData ? 
                  dataMiningResults.historicalData
                    .filter((patient: any) => patient.nama_obat)
                    .flatMap((patient: any) => patient.nama_obat.split(','))
                    .map((obat: string) => obat.trim())
                    .filter((obat: string) => obat && obat !== '')
                    .reduce((acc: any[], obat: string) => {
                      const existing = acc.find(item => item.nama_obat === obat);
                      if (existing) {
                        existing.frequency += 1;
                      } else {
                        acc.push({ nama_obat: obat, frequency: 1 });
                      }
                      return acc;
                    }, [])
                    .sort((a: any, b: any) => b.frequency - a.frequency) : [];
                
                return medications.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Hasil Mining Obat</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {medications.slice(0, 15).map((medication: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                            <div>
                              <div className="font-medium text-green-800">{medication.nama_obat}</div>
                              <div className="text-sm text-green-600">
                                Frekuensi: {medication.frequency} kali dalam {dataMiningResults.historicalData?.length || 0} kasus
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-300 text-green-700 hover:bg-green-100"
                              onClick={() => applyMedicationToMedicalPlan(medication.nama_obat)}
                            >
                              Terapkan
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDataMiningModalOpen(false)}
                >
                  Tutup
                </Button>
                <Button 
                  onClick={applyDataMiningResults}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Clipboard className="w-4 h-4 mr-2" />
                  Terapkan ke Clinical Pathway
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Generation Results Modal */}
      <Dialog open={isAIGenerationModalOpen} onOpenChange={setIsAIGenerationModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <span>Hasil AI Generation</span>
            </DialogTitle>
            <DialogDescription>
              Hasil AI generation untuk clinical pathway berdasarkan data pasien
            </DialogDescription>
          </DialogHeader>
          
          {aiGenerationResults && (
            <div className="space-y-6">
              {/* Diagnosis Section */}
              {aiGenerationResults.diagnosis && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Diagnosis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {aiGenerationResults.diagnosis.primary && (
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div>
                            <div className="font-medium text-blue-800">Diagnosis Primer</div>
                            <div className="text-sm text-blue-600">{aiGenerationResults.diagnosis.primary}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-100"
                            onClick={() => applyAIItemToForm('diagnosis', aiGenerationResults.diagnosis.primary)}
                          >
                            Terapkan
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ICD Codes Section */}
              {(aiGenerationResults.icd10Primary || (aiGenerationResults.icd10Secondary && aiGenerationResults.icd10Secondary.length > 0)) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Kode ICD-10</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {aiGenerationResults.icd10Primary && (
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                          <div>
                            <div className="font-medium text-green-800">ICD-10 Primer</div>
                            <div className="text-sm text-green-600">
                              {aiGenerationResults.icd10Primary.code} - {aiGenerationResults.icd10Primary.description}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-100"
                            onClick={() => applyAIItemToForm('icd10Primary', aiGenerationResults.icd10Primary)}
                          >
                            Terapkan
                          </Button>
                        </div>
                      )}
                      {aiGenerationResults.icd10Secondary && aiGenerationResults.icd10Secondary.map((icd: any, index: number) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                          <div>
                            <div className="font-medium text-green-800">ICD-10 Sekunder {index + 1}</div>
                            <div className="text-sm text-green-600">
                              {icd.code} - {icd.description}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-100"
                            onClick={() => {
                              const newIcd10Secondary = [...icd10Secondary];
                              newIcd10Secondary[index] = icd;
                              setIcd10Secondary(newIcd10Secondary);
                              toast({ title: "Berhasil", description: "ICD-10 Sekunder telah diterapkan" });
                            }}
                          >
                            Terapkan
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Treatment Plan Section */}
              {aiGenerationResults.treatmentPlan && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rencana Perawatan</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {aiGenerationResults.treatmentPlan.goals && Array.isArray(aiGenerationResults.treatmentPlan.goals) && (
                        <div className="flex justify-between items-start p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div className="flex-1">
                            <div className="font-medium text-orange-800">Tujuan Perawatan</div>
                            <div className="text-sm text-orange-600">
                              <ul className="list-disc list-inside space-y-1">
                                {aiGenerationResults.treatmentPlan.goals.map((goal: string, index: number) => (
                                  <li key={index}>{goal}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-100 ml-3"
                            onClick={() => applyAIItemToForm('medicalPlan', aiGenerationResults.treatmentPlan.goals.join(', '))}
                          >
                            Terapkan
                          </Button>
                        </div>
                      )}
                      {aiGenerationResults.treatmentPlan.expectedOutcome && (
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div>
                            <div className="font-medium text-orange-800">Hasil yang Diharapkan</div>
                            <div className="text-sm text-orange-600">{aiGenerationResults.treatmentPlan.expectedOutcome}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-100"
                            onClick={() => applyAIItemToForm('treatmentOutcome', aiGenerationResults.treatmentPlan.expectedOutcome)}
                          >
                            Terapkan
                          </Button>
                        </div>
                      )}
                      {aiGenerationResults.treatmentPlan.estimatedLength && (
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg border border-orange-200">
                          <div>
                            <div className="font-medium text-orange-800">Estimasi Lama Perawatan</div>
                            <div className="text-sm text-orange-600">{aiGenerationResults.treatmentPlan.estimatedLength} hari</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-orange-300 text-orange-700 hover:bg-orange-100"
                            onClick={() => applyAIItemToForm('estimatedLOS', aiGenerationResults.treatmentPlan.estimatedLength)}
                          >
                            Terapkan
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Estimated Costs Section */}
              {aiGenerationResults.estimatedCosts && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Estimasi Biaya</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          Rp {Number(aiGenerationResults.estimatedCosts.medication).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Biaya Obat</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          Rp {Number(aiGenerationResults.estimatedCosts.medical).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Biaya Tindakan</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          Rp {Object.values(aiGenerationResults.estimatedCosts).reduce((sum: number, cost: any) => sum + (Number(cost) || 0), 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Total Estimasi</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Pathway Data Section */}
              {aiGenerationResults.pathwayData && Array.isArray(aiGenerationResults.pathwayData) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Clinical Pathway</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {aiGenerationResults.pathwayData.map((category: any, categoryIndex: number) => (
                        <div key={categoryIndex} className="border rounded-lg p-4">
                          <h4 className="font-semibold text-gray-800 mb-3">{category.category}</h4>
                          <div className="space-y-2">
                            {category.items.slice(0, 3).map((item: any, itemIndex: number) => (
                              <div key={itemIndex} className="text-sm text-gray-600">
                                • {item.name}
                              </div>
                            ))}
                            {category.items.length > 3 && (
                              <div className="text-sm text-gray-500">... dan {category.items.length - 3} item lainnya</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAIGenerationModalOpen(false)}
                >
                  Tutup
                </Button>
                <Button 
                  onClick={applyAIGenerationResults}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Clipboard className="w-4 h-4 mr-2" />
                  Terapkan Semua ke Clinical Pathway
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClinicalPathway;