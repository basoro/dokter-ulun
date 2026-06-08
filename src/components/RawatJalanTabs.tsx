import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Calendar, 
  User, 
  Clock, 
  List, 
  Filter,
  X,
  CalendarIcon
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import PatientTable from '@/components/PatientTable';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { formatDateWIB, formatDateTimeWIB } from '@/lib/date-utils';
import { API_URLS } from '@/config/api';

// Updated columns with new structure
const rawatJalanColumns = [
  { accessor: 'no_reg', header: 'No. Reg' },
  { accessor: 'no_rkm_medis', header: 'No. RM' },
  { accessor: 'no_rawat', header: 'Nomor Rawat' },
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'poliklinik', header: 'Poliklinik' },
  { accessor: 'status', header: 'Status' },
  { accessor: 'insurance', header: 'Asuransi' },
  { accessor: 'tgl_registrasi', header: 'Tanggal Registrasi' },
  { accessor: 'paymentStatus', header: 'Status Bayar' },
];

const RawatJalanTabs = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'hari-ini');
  
  // Date range state - use current date without timezone conversion
  const [date, setDate] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [statusBayarFilter, setStatusBayarFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("");
  const [doctorOptions, setDoctorOptions] = useState<Array<{ kd_dokter: string; nm_dokter: string }>>([]);
  const [rawatJalanPatients, setRawatJalanPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const effectiveDoctorFilter = doctorFilter || user?.username || "all";
  const requestDoctorFilter = doctorFilter === "all"
    ? "all"
    : (doctorFilter || user?.username || undefined);
  
  const fetchRawatJalanPatients = async (tabFilter?: string) => {
    if (!user?.kd_poli || !date?.from || !date?.to) {
      console.log('Missing required data:', { kd_poli: user?.kd_poli, date });
      return;
    }
    
    setLoading(true);
    try {
      let requestBody: any = {
        kd_poli: user.kd_poli,
        startDate: formatDateWIB(date.from),
        endDate: formatDateWIB(date.to),
        username: user.username,
        status: statusFilter,
        statusBayar: statusBayarFilter,
        kd_dokter: requestDoctorFilter,
        tabFilter: tabFilter || activeTab,
        page: currentPage.toString(),
        itemsPerPage: itemsPerPage.toString()
      };

      console.log('Request dates (WIB):', {
        startDate: formatDateWIB(date.from),
        endDate: formatDateWIB(date.to),
        originalDates: { from: date.from, to: date.to }
      });

      console.log('Fetching rawat jalan patients with filters:', requestBody);
      
      const response = await fetch(API_URLS.RAWAT_JALAN_PATIENTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching rawat jalan patients:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      console.log('Raw response from rawat-jalan-patients:', data);

      if (!data.success) {
        console.error('Error fetching rawat jalan patients:', data.error);
        throw new Error(data.error);
      }

      if (data?.success) {
        console.log('Received patient data:', data.data);
        setRawatJalanPatients(Array.isArray(data.data) ? data.data : []);
        setDoctorOptions(Array.isArray(data.doctors) ? data.doctors : []);
        setTotal(data.total || 0);
      } else {
        console.error('Failed to fetch patients:', data);
        setRawatJalanPatients([]);
        setDoctorOptions([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error fetching rawat jalan patients:', error);
      setRawatJalanPatients([]);
      setDoctorOptions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (date?.from && date?.to) {
      fetchRawatJalanPatients();
    }
  }, [user?.kd_poli, date?.from, date?.to, activeTab, currentPage, itemsPerPage]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  
  const handleFilterApply = () => {
    setCurrentPage(1);
    if (date?.from && date?.to) {
      fetchRawatJalanPatients();
    }
  };

  const handleClearFilters = () => {
    setDate({
      from: new Date(),
      to: new Date()
    });
    setStatusFilter("all");
    setStatusBayarFilter("all");
    setDoctorFilter("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
    setCurrentPage(1);
    if (date?.from && date?.to) {
      fetchRawatJalanPatients(newTab);
    }
  };
  
  const filteredRawatJalanData = (Array.isArray(rawatJalanPatients) ? rawatJalanPatients : []).filter(patient => {
    let passesSearch = true;
    let passesStatus = true;
    
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      passesSearch = 
        patient.nm_pasien?.toLowerCase().includes(searchLower) ||
        patient.nm_dokter?.toLowerCase().includes(searchLower) ||
        patient.nm_poli?.toLowerCase().includes(searchLower) ||
        patient.png_jawab?.toLowerCase().includes(searchLower) ||
        patient.no_rkm_medis?.toString().includes(searchQuery);
    }
    
    if (statusFilter && statusFilter !== "all") {
      passesStatus = patient.status?.toLowerCase() === statusFilter.toLowerCase();
    }
    
    return passesSearch && passesStatus;
  }).map(patient => ({
    id: patient.no_rawat,
    no_rkm_medis: patient.no_rkm_medis,
    no_reg: patient.no_reg,
    no_rawat: patient.no_rawat,
    name: patient.nm_pasien,
    age: patient.tgl_lahir ? new Date().getFullYear() - new Date(patient.tgl_lahir).getFullYear() : '-',
    gender: patient.jk === 'L' ? 'Laki-laki' : 'Perempuan',
    doctor: patient.nm_dokter,
    poliklinik: patient.nm_poli,
    status: patient.status,
    insurance: patient.png_jawab || 'Umum',
    tgl_registrasi: (() => {
      if (!patient.tgl_registrasi) return '-';
      
      try {
        // Handle different date formats that might come from MySQL
        let dateValue = patient.tgl_registrasi;
        
        // If it's already a Date object
        if (dateValue instanceof Date) {
          return formatDateTimeWIB(dateValue);
        }
        
        // If it's a string, try to parse it
        if (typeof dateValue === 'string') {
          // Handle MySQL datetime format (YYYY-MM-DD HH:MM:SS)
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            return formatDateTimeWIB(parsedDate);
          }
        }
        
        console.error('Invalid date format for tgl_registrasi:', dateValue);
        return 'Invalid Date';
      } catch (error) {
        console.error('Error formatting tgl_registrasi:', error, 'Value:', patient.tgl_registrasi);
        return 'Error Date';
      }
    })(),
    phone: patient.no_tlp,
    address: patient.alamat,
    paymentStatus: patient.payment_status || 'Belum Bayar'
  }));

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="hari-ini">
          <Clock className="mr-2 h-4 w-4" />
          <span>Hari Ini</span>
        </TabsTrigger>
        <TabsTrigger value="pagi">
          <Calendar className="mr-2 h-4 w-4" />
          <span>Sesi Pagi</span>
        </TabsTrigger>
        <TabsTrigger value="sore">
          <Calendar className="mr-2 h-4 w-4" />
          <span>Sesi Sore</span>
        </TabsTrigger>
        <TabsTrigger value="rujukan_internal">
          <User className="mr-2 h-4 w-4" />
          <span>Rujukan Internal</span>
        </TabsTrigger>
        <TabsTrigger value="pasien_lanjutan">
          <List className="mr-2 h-4 w-4" />
          <span>Pasien Lanjutan</span>
        </TabsTrigger>
      </TabsList>
      
      {['hari-ini', 'pagi', 'sore', 'rujukan_internal', 'pasien_lanjutan'].map((tabValue) => (
        <TabsContent key={tabValue} value={tabValue} className="space-y-4">
          <Card>
            <CardHeader className="pb-2 w-full">
              <CardTitle>
                {tabValue === 'hari-ini' && 'Daftar Pasien Hari Ini'}
                {tabValue === 'pagi' && 'Daftar Pasien Pagi'}
                {tabValue === 'sore' && 'Daftar Pasien Sore'}
                {tabValue === 'rujukan_internal' && 'Rujukan Internal'}
                {tabValue === 'pasien_lanjutan' && 'Pasien Lanjutan'}
              </CardTitle>
              <div className="flex flex-col lg:flex-row gap-2 items-start mb-4 w-full">
                <div className="relative w-full sm:w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Cari pasien..."
                    className="w-full pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                          "w-[350px] justify-start text-left font-normal",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                          date.to ? (
                            <>
                              {format(date.from, "LLL dd, y")} -{" "}
                              {format(date.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(date.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pilih rentang tanggal</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={2}
                        className="p-3 pointer-events-auto min-w-[600px]"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Status Pasien" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="Belum">Belum</SelectItem>
                      <SelectItem value="Sudah">Sudah</SelectItem>
                      <SelectItem value="Batal">Batal</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={statusBayarFilter} onValueChange={setStatusBayarFilter}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Status Bayar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status Bayar</SelectItem>
                      <SelectItem value="Sudah Bayar">Sudah Bayar</SelectItem>
                      <SelectItem value="Belum Bayar">Belum Bayar</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={effectiveDoctorFilter} onValueChange={setDoctorFilter}>
                    <SelectTrigger className="w-full sm:w-56">
                      <SelectValue placeholder="Dokter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Dokter</SelectItem>
                      {doctorOptions.map((doctor) => (
                        <SelectItem key={doctor.kd_dokter} value={doctor.kd_dokter}>
                          {doctor.nm_dokter}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                  <Button variant="secondary" onClick={handleFilterApply} className="w-full sm:w-auto">
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                  </Button>
                  <Button variant="outline" onClick={handleClearFilters} className="w-full sm:w-auto">
                    <X className="mr-2 h-4 w-4" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="text-muted-foreground">Memuat data pasien...</div>
                </div>
              ) : (
                <PatientTable 
                  patients={filteredRawatJalanData} 
                  columns={rawatJalanColumns}
                  pagination={{
                    currentPage,
                    totalPages: Math.ceil(total / itemsPerPage),
                    totalItems: total,
                    itemsPerPage,
                    onPageChange: (page) => {
                      setCurrentPage(page);
                    },
                    onItemsPerPageChange: (newItemsPerPage) => {
                      setItemsPerPage(newItemsPerPage);
                      setCurrentPage(1);
                    }
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default RawatJalanTabs;
