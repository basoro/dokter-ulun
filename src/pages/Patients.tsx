import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { formatNoRawat } from '@/App';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Calendar, 
  User, 
  Clock, 
  Check, 
  List, 
  Image, 
  MessageSquare, 
  Home, 
  File, 
  Phone, 
  MapPin, 
  AlarmClock,
  Filter,
  X,
  CalendarIcon,
  ChevronsUpDown,
  CheckIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  MoreHorizontal
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, addDays, differenceInDays, subMonths } from 'date-fns';
import { indonesianLocale } from '@/lib/date-utils';
import PatientTable from '@/components/PatientTable';
import { useIsMobile } from '@/hooks/use-mobile';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import RawatJalanTabs from '@/components/RawatJalanTabs';
import HemodialisaTabs from '@/components/HemodialisaTabs';
import { API_URLS } from '@/config/api';
import MedicalRecord from './MedicalRecord';
import { OPEN_MEDICAL_RECORD_TAB_EVENT, type OpenMedicalRecordTabDetail } from '@/lib/medical-record-tabs';

const parseDateParam = (value: string | null, fallback: Date) => {
  if (!value) return fallback;

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const formatWorkspaceNoRawat = (value: string) => {
  if (!value || value.includes('/')) {
    return value;
  }

  if (value.length < 9) {
    return value;
  }

  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}/${value.slice(8)}`;
};

interface MedicalRecordWorkspaceTab {
  id: string;
  noRkmMedis: string;
  noRawat: string;
  patientName: string;
  sourcePath?: string;
}

const LIST_PASIEN_TAB_ID = 'list-pasien';

// Patients data
const rawatJalanData = [
  {
    id: '000001',
    name: 'Ahmad Fauzi',
    age: 45,
    gender: 'Laki-laki',
    doctor: 'dr. Amir Mahmud, Sp.PD',
    poliklinik: 'Poli Penyakit Dalam',
    status: 'Menunggu',
    insurance: 'BPJS',
    arrivalTime: '08:15',
  },
  {
    id: '000002',
    name: 'Siti Rahmah',
    age: 32,
    gender: 'Perempuan',
    doctor: 'dr. Dian Pertiwi, Sp.A',
    poliklinik: 'Poli Anak',
    status: 'Diperiksa',
    insurance: 'BPJS',
    arrivalTime: '08:30',
  },
  {
    id: '000003',
    name: 'Budi Santoso',
    age: 55,
    gender: 'Laki-laki',
    doctor: 'dr. Hendra Wijaya, Sp.JP',
    poliklinik: 'Poli Jantung',
    status: 'Menunggu',
    insurance: 'Umum',
    arrivalTime: '09:00',
  },
  {
    id: '000004',
    name: 'Dewi Lestari',
    age: 28,
    gender: 'Perempuan',
    doctor: 'dr. Sinta Dewi, Sp.KK',
    poliklinik: 'Poli Kulit',
    status: 'Selesai',
    insurance: 'BPJS',
    arrivalTime: '09:15',
  },
  {
    id: '000005',
    name: 'Hadi Sulistyo',
    age: 60,
    gender: 'Laki-laki',
    doctor: 'dr. Bambang Suryanto, Sp.PD',
    poliklinik: 'Poli Penyakit Dalam',
    status: 'Menunggu',
    insurance: 'BPJS',
    arrivalTime: '10:30',
  }
];

const BookingTabs = () => {
  const [bookingPagi, setBookingPagi] = useState([]);
  const [bookingSore, setBookingSore] = useState([]);
  const [activeTab, setActiveTab] = useState<'pagi' | 'sore'>('pagi');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [doctorFilter, setDoctorFilter] = useState<string>("all");
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPagi, setTotalPagi] = useState(0);
  const [totalSore, setTotalSore] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchBookingData = async (tabValue: 'pagi' | 'sore' = activeTab) => {
    setLoading(true);
    try {
      const requestBody = {
        action: 'getAll',
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        status: statusFilter,
        sessionFilter: tabValue,
        page: currentPage.toString(),
        itemsPerPage: itemsPerPage.toString()
      };

      console.log('Fetching booking data with:', requestBody);

      const response = await fetch(API_URLS.BOOKING_REGISTRASI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...requestBody,
          kd_dokter: doctorFilter !== 'all' ? doctorFilter : undefined
        })
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', responseText);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
      }

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch booking data');
      }

      const bookings = Array.isArray(data.bookings) ? data.bookings : [];
      setTotal(data.total || 0);

      if (tabValue === 'pagi') {
        setBookingPagi(bookings);
      } else {
        setBookingSore(bookings);
      }

      setTotalPagi(Number(data?.tabCounts?.pagi || 0));
      setTotalSore(Number(data?.tabCounts?.sore || 0));
    } catch (error) {
      console.error('Error fetching booking data:', error);
      if (tabValue === 'pagi') {
        setBookingPagi([]);
      } else {
        setBookingSore([]);
      }
      setTotal(0);
      setTotalPagi(0);
      setTotalSore(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = () => {
    setCurrentPage(1);
    fetchBookingData();
  };

  const fetchDoctors = async () => {
    try {
      const response = await fetch(API_URLS.BOOKING_REGISTRASI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ action: 'getDoctors' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch doctors');
      }

      setDoctors(data?.doctors || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleClearFilters = () => {
    setDateRange({
      from: new Date(),
      to: new Date()
    });
    setStatusFilter("all");
    setDoctorFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
    fetchBookingData();
  };

  const handleTabChange = (value: string) => {
    const nextTab = value === 'sore' ? 'sore' : 'pagi';
    setActiveTab(nextTab);
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchBookingData();
    fetchDoctors();
  }, [currentPage, itemsPerPage, activeTab]);

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-4">
        <TabsTrigger value="pagi">
          <AlarmClock className="mr-2 h-4 w-4" />
          <span>Pagi ({totalPagi})</span>
        </TabsTrigger>
        <TabsTrigger value="sore">
          <Clock className="mr-2 h-4 w-4" />
          <span>Sore ({totalSore})</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="pagi" className="space-y-4">
        <Card>
          <CardHeader className="pb-2 w-full">
            <CardTitle>Booking Pasien - Sesi Pagi</CardTitle>
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
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
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
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={indonesianLocale}
                      className="p-3 pointer-events-auto min-w-[600px]"
                    />
                  </PopoverContent>
                </Popover>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="Terdaftar">Terdaftar</SelectItem>
                    <SelectItem value="Belum">Belum</SelectItem>
                    <SelectItem value="Batal">Batal</SelectItem>
                    <SelectItem value="Dokter Berhalangan">Dokter Berhalangan</SelectItem>
                  </SelectContent>
                </Select>
                
                <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={doctorOpen}
                      className="w-full sm:w-48 justify-between"
                    >
                      {doctorFilter !== "all"
                        ? doctors.find((doctor) => doctor.kd_dokter === doctorFilter)?.nm_dokter
                        : "Pilih Dokter"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Cari dokter..." />
                      <CommandList>
                        <CommandEmpty>Tidak ada dokter ditemukan.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setDoctorFilter("all");
                              setDoctorOpen(false);
                            }}
                          >
                            <CheckIcon
                              className={cn(
                                "mr-2 h-4 w-4",
                                doctorFilter === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Semua Dokter
                          </CommandItem>
                          {doctors.map((doctor) => (
                            <CommandItem
                              key={doctor.kd_dokter}
                              value={doctor.nm_dokter}
                              onSelect={() => {
                                setDoctorFilter(doctor.kd_dokter);
                                setDoctorOpen(false);
                              }}
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  doctorFilter === doctor.kd_dokter ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {doctor.nm_dokter}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                <div className="text-muted-foreground">Memuat data booking...</div>
              </div>
            ) : (
              <PatientTable 
                patients={bookingPagi.filter(booking => {
                  if (!searchQuery) return true;
                  const searchLower = searchQuery.toLowerCase();
                  return (
                    booking.nm_pasien?.toLowerCase().includes(searchLower) ||
                    booking.no_rkm_medis?.toLowerCase().includes(searchLower) ||
                    booking.no_tlp?.toLowerCase().includes(searchLower) ||
                    booking.email?.toLowerCase().includes(searchLower) ||
                    booking.nm_poli?.toLowerCase().includes(searchLower) ||
                    booking.nm_dokter?.toLowerCase().includes(searchLower)
                  );
                })}
                columns={bookingColumns} 
                loading={loading}
                 pagination={{
                  currentPage,
                  totalPages: Math.ceil(totalPagi / itemsPerPage),
                  totalItems: totalPagi,
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
      <TabsContent value="sore" className="space-y-4">
        <Card>
          <CardHeader className="pb-2 w-full">
            <CardTitle>Booking Pasien - Sesi Sore</CardTitle>
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
                        !dateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} -{" "}
                            {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
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
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                      locale={indonesianLocale}
                      className="p-3 pointer-events-auto min-w-[600px]"
                    />
                  </PopoverContent>
                </Popover>
                
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="Terdaftar">Terdaftar</SelectItem>
                    <SelectItem value="Belum">Belum</SelectItem>
                    <SelectItem value="Batal">Batal</SelectItem>
                    <SelectItem value="Dokter Berhalangan">Dokter Berhalangan</SelectItem>
                  </SelectContent>
                </Select>
                
                <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={doctorOpen}
                      className="w-full sm:w-48 justify-between"
                    >
                      {doctorFilter !== "all"
                        ? doctors.find((doctor) => doctor.kd_dokter === doctorFilter)?.nm_dokter
                        : "Pilih Dokter"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Cari dokter..." />
                      <CommandList>
                        <CommandEmpty>Tidak ada dokter ditemukan.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="all"
                            onSelect={() => {
                              setDoctorFilter("all");
                              setDoctorOpen(false);
                            }}
                          >
                            <CheckIcon
                              className={cn(
                                "mr-2 h-4 w-4",
                                doctorFilter === "all" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Semua Dokter
                          </CommandItem>
                          {doctors.map((doctor) => (
                            <CommandItem
                              key={doctor.kd_dokter}
                              value={doctor.nm_dokter}
                              onSelect={() => {
                                setDoctorFilter(doctor.kd_dokter);
                                setDoctorOpen(false);
                              }}
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  doctorFilter === doctor.kd_dokter ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {doctor.nm_dokter}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
                <div className="text-muted-foreground">Memuat data booking...</div>
              </div>
            ) : (
              <PatientTable 
                patients={bookingSore.filter(booking => {
                  if (!searchQuery) return true;
                  const searchLower = searchQuery.toLowerCase();
                  return (
                    booking.nm_pasien?.toLowerCase().includes(searchLower) ||
                    booking.no_rkm_medis?.toLowerCase().includes(searchLower) ||
                    booking.no_tlp?.toLowerCase().includes(searchLower) ||
                    booking.email?.toLowerCase().includes(searchLower) ||
                    booking.nm_poli?.toLowerCase().includes(searchLower) ||
                    booking.nm_dokter?.toLowerCase().includes(searchLower)
                  );
                })}
                columns={bookingColumns} 
                loading={loading}
                 pagination={{
                  currentPage,
                  totalPages: Math.ceil(totalSore / itemsPerPage),
                  totalItems: totalSore,
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
    </Tabs>
  );
};

// Sample data for IGD 
const igdTriaseData = [
  {
    id: 'T001',
    name: 'Abdul Rahman',
    age: 58,
    gender: 'Laki-laki',
    arrivalTime: '14:25',
    complaint: 'Nyeri dada akut',
    priority: 'Merah',
    vitalSigns: 'TD: 160/95, HR: 112, RR: 24, SpO2: 92%',
    status: 'Menunggu Dokter',
  },
  {
    id: 'T002',
    name: 'Nina Suryani',
    age: 22,
    gender: 'Perempuan',
    arrivalTime: '15:10',
    complaint: 'Demam tinggi, muntah',
    priority: 'Kuning',
    vitalSigns: 'TD: 110/70, HR: 100, RR: 20, SpO2: 98%',
    status: 'Menunggu Tindakan',
  },
  {
    id: 'T003',
    name: 'Budi Prasetyo',
    age: 41,
    gender: 'Laki-laki',
    arrivalTime: '15:45',
    complaint: 'Luka bakar ringan',
    priority: 'Hijau',
    vitalSigns: 'TD: 120/80, HR: 85, RR: 18, SpO2: 99%',
    status: 'Sudah Ditangani',
  },
];

const igdObservasiData = [
  {
    id: 'O001',
    name: 'Sari Oktaviani',
    age: 67,
    gender: 'Perempuan',
    admissionTime: '12:30',
    diagnosis: 'Hipertensi Stage 2',
    doctor: 'dr. Rahman Putra, Sp.PD',
    status: 'Observasi',
    bed: 'Bed-1',
  },
  {
    id: 'O002',
    name: 'Joko Santoso',
    age: 54,
    gender: 'Laki-laki',
    admissionTime: '13:15',
    diagnosis: 'Angina Pectoris',
    doctor: 'dr. Lisa Permata, Sp.JP',
    status: 'Observasi',
    bed: 'Bed-2',
  },
];

const igdTindakanData = [
  {
    id: 'TI001',
    name: 'Rina Susanti',
    age: 31,
    gender: 'Perempuan',
    treatmentTime: '16:20',
    procedure: 'Jahit Luka',
    doctor: 'dr. Budi Santoso, Sp.B',
    status: 'Dalam Tindakan',
    room: 'Ruang Tindakan 1',
  },
  {
    id: 'TI002',
    name: 'Agus Wibowo',
    age: 39,
    gender: 'Laki-laki',
    treatmentTime: '17:00',
    procedure: 'Nebulisasi',
    doctor: 'dr. Sari Dewi, Sp.P',
    status: 'Selesai',
    room: 'Ruang Tindakan 2',
  },
];

// Sample data for Hemodialisa
const hemodialisaData = [
  {
    id: 'HD001',
    name: 'Gunawan Tri',
    age: 62,
    gender: 'Laki-laki',
    shift: 'Pagi',
    startTime: '07:00',
    endTime: '11:00',
    machine: 'HD-1',
    doctor: 'dr. Hendra Wijaya, Sp.PD-KGH',
    status: 'Sedang HD',
  },
  {
    id: 'HD002',
    name: 'Nurhayati',
    age: 55,
    gender: 'Perempuan',
    shift: 'Pagi',
    startTime: '07:30',
    endTime: '11:30',
    machine: 'HD-3',
    doctor: 'dr. Dian Purnama, Sp.PD-KGH',
    status: 'Sedang HD',
  },
  {
    id: 'HD003',
    name: 'Wahyu Setiawan',
    age: 48,
    gender: 'Laki-laki',
    shift: 'Siang',
    startTime: '13:00',
    endTime: '17:00',
    machine: 'HD-2',
    doctor: 'dr. Hendra Wijaya, Sp.PD-KGH',
    status: 'Selesai HD',
  },
];

const hemodialisaTerjadwalData = [
  {
    id: 'HDT001',
    name: 'Muhammad Yusuf',
    age: 61,
    gender: 'Laki-laki',
    scheduleDate: '2023-07-17',
    shift: 'Pagi',
    machine: 'HD-1',
    doctor: 'dr. Hendra Wijaya, Sp.PD-KGH',
    frequency: '2x seminggu',
  },
  {
    id: 'HDT002',
    name: 'Hadi Sulistyo',
    age: 59,
    gender: 'Laki-laki',
    scheduleDate: '2023-07-16',
    shift: 'Siang',
    machine: 'HD-2',
    doctor: 'dr. Dian Purnama, Sp.PD-KGH',
    frequency: '3x seminggu',
  },
];

// Updated sample data for Rawat Inap with additional fields
const rawatInapData = [
  {
    id: '000001',
    name: 'Ahmad Fauzi',
    age: 45,
    gender: 'Laki-laki',
    doctor: 'dr. Amir Mahmud, Sp.PD',
    poliklinik: 'Poli Penyakit Dalam',
    status: 'Menunggu',
    insurance: 'BPJS',
    arrivalTime: '08:15',
    admissionDate: '2023-07-10',
    dischargeDate: '2023-07-15',
    careStatus: 'Rawat Tunggal'
  },
  {
    id: '000002',
    name: 'Siti Rahmah',
    age: 32,
    gender: 'Perempuan',
    doctor: 'dr. Dian Pertiwi, Sp.A',
    poliklinik: 'Poli Anak',
    status: 'Diperiksa',
    insurance: 'BPJS',
    arrivalTime: '08:30',
    admissionDate: '2023-07-12',
    dischargeDate: '',
    careStatus: 'Rawat Bersama'
  },
  {
    id: '000003',
    name: 'Budi Santoso',
    age: 55,
    gender: 'Laki-laki',
    doctor: 'dr. Hendra Wijaya, Sp.JP',
    poliklinik: 'Poli Jantung',
    status: 'Menunggu',
    insurance: 'Umum',
    arrivalTime: '09:00',
    admissionDate: '2023-07-08',
    dischargeDate: '2023-07-18',
    careStatus: 'Rawat Gabung'
  },
];

// Columns definitions
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

const bookingColumns = [
  { accessor: 'no_rkm_medis', header: 'No. RM' },
  { accessor: 'nm_pasien', header: 'Nama Pasien' },
  { accessor: 'tanggal_periksa', header: 'Tanggal Periksa' },
  { accessor: 'jam_booking', header: 'Jam Booking' },
  { accessor: 'nm_poli', header: 'Poliklinik' },
  { accessor: 'nm_dokter', header: 'Dokter' },
  { accessor: 'no_tlp', header: 'No. Telepon' },
  { accessor: 'status', header: 'Status' },
  { accessor: 'tanggal_booking', header: 'Tanggal Booking' },
];

const igdTriaseColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'arrivalTime', header: 'Jam Masuk' },
  { accessor: 'complaint', header: 'Keluhan' },
  { accessor: 'priority', header: 'Prioritas' },
  { accessor: 'status', header: 'Status' },
];

const igdObservasiColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'admissionTime', header: 'Jam Masuk Observasi' },
  { accessor: 'diagnosis', header: 'Diagnosis' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'status', header: 'Status' },
  { accessor: 'bed', header: 'Bed' },
];

const igdTindakanColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'treatmentTime', header: 'Jam Tindakan' },
  { accessor: 'procedure', header: 'Tindakan' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'status', header: 'Status' },
  { accessor: 'room', header: 'Ruangan' },
];

const hemodialisaColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'shift', header: 'Shift' },
  { accessor: 'startTime', header: 'Jam Mulai' },
  { accessor: 'endTime', header: 'Jam Selesai' },
  { accessor: 'machine', header: 'Mesin' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'status', header: 'Status' },
];

const hemodialisaTerjadwalColumns = [
  { accessor: 'name', header: 'Nama Pasien' },
  { accessor: 'age', header: 'Umur' },
  { accessor: 'gender', header: 'Jenis Kelamin' },
  { accessor: 'scheduleDate', header: 'Tanggal Jadwal' },
  { accessor: 'shift', header: 'Shift' },
  { accessor: 'machine', header: 'Mesin' },
  { accessor: 'doctor', header: 'Dokter' },
  { accessor: 'frequency', header: 'Frekuensi' },
];

// Komponen untuk menampilkan dokter DPJP dengan dropdown
const DokterDPJPCell = ({ dokterDpjp }: { dokterDpjp: string }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!dokterDpjp) return <span className="text-gray-400">-</span>;
  
  // Parse dokter dari string menggunakan regex yang lebih robust
  // Format: "dr./drg. Nama lengkap dengan gelar (Jenis DPJP), dr./drg. Nama2 (Jenis2)"
  const dokterMatches = dokterDpjp.match(/drg?\.[^()]+\([^)]+\)/g) || [];
  
  const dokterList = dokterMatches.map(item => {
    const match = item.match(/^(drg?\..+?)\s*\((.+?)\)$/);
    if (match) {
      return {
        nama: match[1].trim(),
        jenis: match[2].trim()
      };
    }
    return {
      nama: item.trim(),
      jenis: 'Tidak Diketahui'
    };
  });
  
  // Cari dokter utama
  const dokterUtama = dokterList.find(d => d.jenis.toLowerCase() === 'utama');
  const dokterLainnya = dokterList
    .filter(d => d.jenis.toLowerCase() !== 'utama')
    .sort((a, b) => a.jenis.localeCompare(b.jenis)); // Sort ascending berdasarkan jenis DPJP
  
  if (dokterList.length === 1) {
    return (
      <div className="text-sm">
        <div className="font-medium">{dokterList[0].nama}</div>
        <div className="text-xs text-gray-500">({dokterList[0].jenis})</div>
      </div>
    );
  }
  
  return (
    <div className="text-sm">
      {dokterUtama && (
        <div className="font-medium">
          {dokterUtama.nama}
          <span className="text-xs text-gray-500 ml-1">(Utama)</span>
        </div>
      )}
      
      {dokterLainnya.length > 0 && (
        <div className="mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="flex items-center text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ChevronDown 
              size={12} 
              className={`mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
            {dokterLainnya.length} dokter lainnya
          </button>
          
          {isExpanded && (
            <div className="mt-1 space-y-1 pl-4 border-l-2 border-gray-200">
              {dokterLainnya.map((dokter, index) => (
                <div key={index} className="text-xs">
                  <div className="font-medium">{dokter.nama}</div>
                  <div className="text-gray-500">({dokter.jenis})</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RawatInapTabs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  type RawatInapListTab = 'rawat-inap' | 'rawat-bersama' | 'rawat-gabung';
  type RawatInapTab = RawatInapListTab | 'resume-pasien';
  const [searchParams, setSearchParams] = useSearchParams();
  const rawatInapTabOptions: RawatInapTab[] = ['rawat-inap', 'rawat-bersama', 'rawat-gabung', 'resume-pasien'];
  const defaultRawatInapFrom = subMonths(new Date(), 6);
  const defaultRawatInapTo = new Date();
  const initialRawatInapTab = rawatInapTabOptions.includes(searchParams.get('tab') as RawatInapTab)
    ? searchParams.get('tab') as RawatInapTab
    : 'rawat-inap';
  const emptyTabCounts = {
    rawat_inap: 0,
    rawat_bersama: 0,
    rawat_gabung: 0,
    resume_pasien: 0
  };
  type RawatInapRequestBody = {
    page: string;
    itemsPerPage: string;
    search: string;
    statusPulang: string;
    username: string;
    tab: RawatInapListTab;
    startDate: string;
    endDate: string;
    rawatBersamaResumeStatus?: string;
    includeTabCounts?: boolean;
    countsOnly?: boolean;
  };
  const [rawatInapData, setRawatInapData] = useState<any[]>([]);
  const [resumeData, setResumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<RawatInapTab>(initialRawatInapTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "");
  const [statusPulangRawatInap, setStatusPulangRawatInap] = useState(searchParams.get('statusPulangRawatInap') || "masih-dirawat");
  const [statusPulangResume, setStatusPulangResume] = useState(searchParams.get('statusPulangResume') || "sudah-pulang");
  const [resumeStatus, setResumeStatus] = useState(searchParams.get('resumeStatus') || "belum_resume");
  const [rawatBersamaResumeStatus, setRawatBersamaResumeStatus] = useState(
    searchParams.get('rawatBersamaResumeStatus') || "belum_ada_resume"
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parseDateParam(searchParams.get('from'), defaultRawatInapFrom),
    to: parseDateParam(searchParams.get('to'), defaultRawatInapTo)
  });
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));
  const [tabCounts, setTabCounts] = useState(emptyTabCounts);
  const rawatInapColumns = [
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'nm_pasien', header: 'Nama Pasien' },
    { accessor: 'jenis_kelamin', header: 'JK' },
    { accessor: 'tgl_masuk', header: 'Tgl Masuk' },
    { accessor: 'tgl_keluar', header: 'Tgl Keluar' },
    { accessor: 'kd_kamar', header: 'Kamar' },
    { accessor: 'nm_bangsal', header: 'Bangsal' },
    {
      accessor: 'dokter_dpjp',
      header: 'DPJP',
      render: (row: any) => <DokterDPJPCell dokterDpjp={row.dokter_dpjp} />
    },
    { accessor: 'stts_pulang', header: 'Status Pulang' },
    {
      accessor: 'lama',
      header: 'Lama Rawat',
      render: (row: any) => {
        if (!row.tgl_masuk) return <span className="text-sm">-</span>;

        const tglMasuk = new Date(row.tgl_masuk);
        const today = new Date();
        const lamaRawat = differenceInDays(today, tglMasuk) + 1;

        return (
          <span className="text-sm">
            {lamaRawat} hari
          </span>
        );
      }
    },
    {
      accessor: 'clinical_pathway',
      header: 'Clinical Pathway',
      render: (row: any) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            if (row.no_rkm_medis && row.no_rawat) {
              const formattedNoRawat = formatNoRawat(row.no_rawat);
              const compactNoRawat = String(formattedNoRawat).replace(/\//g, '');
              navigate(`/clinical-pathway/${row.no_rkm_medis}/${compactNoRawat}?mode=monitoring&source=rawat-inap`);
            }
          }}
          className="flex items-center gap-1"
        >
          <FileText size={14} />
          CP
        </Button>
      )
    }
  ];

  const buildRawatInapRequestBody = (
    tabValue: RawatInapListTab,
    overrides: Partial<RawatInapRequestBody> = {}
  ): RawatInapRequestBody => ({
    page: currentPage.toString(),
    itemsPerPage: itemsPerPage.toString(),
    search: searchQuery,
    statusPulang: statusPulangRawatInap,
    username: user?.username || '',
    tab: tabValue,
    startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
    endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
    rawatBersamaResumeStatus,
    ...overrides
  });

  const buildResumeRequestBody = (overrides: Partial<Record<string, string>> = {}) => ({
    page: currentPage.toString(),
    itemsPerPage: itemsPerPage.toString(),
    search: searchQuery,
    statusPulang: statusPulangResume,
    username: user?.username || '',
    resumeStatus,
    startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
    endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
    ...overrides
  });

  const getStatusPulangByTab = (tab: string) => (
    tab === 'resume-pasien' ? statusPulangResume : statusPulangRawatInap
  );

  const setStatusPulangByTab = (tab: string, value: string) => {
    if (tab === 'resume-pasien') {
      setStatusPulangResume(value);
      return;
    }

    setStatusPulangRawatInap(value);
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('tab', activeTab);
    params.set('page', String(currentPage));
    params.set('itemsPerPage', String(itemsPerPage));
    params.set('statusPulangRawatInap', statusPulangRawatInap);
    params.set('statusPulangResume', statusPulangResume);
    params.set('resumeStatus', resumeStatus);
    params.set('rawatBersamaResumeStatus', rawatBersamaResumeStatus);
    params.delete('statusPulang');

    if (dateRange?.from) {
      params.set('from', format(dateRange.from, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
    }

    if (dateRange?.to) {
      params.set('to', format(dateRange.to, 'yyyy-MM-dd'));
    } else {
      params.delete('to');
    }

    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    } else {
      params.delete('search');
    }

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    activeTab,
    currentPage,
    itemsPerPage,
    statusPulangRawatInap,
    statusPulangResume,
    resumeStatus,
    rawatBersamaResumeStatus,
    searchQuery,
    dateRange?.from,
    dateRange?.to,
    searchParams,
    setSearchParams
  ]);

  const applyTabCounts = (counts: any) => {
    setTabCounts({
      rawat_inap: Number(counts?.rawat_inap || 0),
      rawat_bersama: Number(counts?.rawat_bersama || 0),
      rawat_gabung: Number(counts?.rawat_gabung || 0),
      resume_pasien: Number(counts?.resume_pasien || 0)
    });
  };

  const applyResumeCount = (resumeCount: number) => {
    setTabCounts((prev) => ({
      ...prev,
      resume_pasien: Number(resumeCount || 0)
    }));
  };

  const fetchRawatInapTabCounts = async () => {
    try {
      const response = await fetch(API_URLS.RAWAT_INAP_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          buildRawatInapRequestBody('rawat-inap', {
            page: '1',
            itemsPerPage: '1',
            countsOnly: true
          })
        )
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      applyTabCounts(data?.tabCounts);
    } catch (error) {
      console.error('Error fetching Rawat Inap tab counts:', error);
      setTabCounts(emptyTabCounts);
    }
  };

  const fetchResumeTabCount = async () => {
    try {
      const response = await fetch(API_URLS.RESUME_PASIEN_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          buildResumeRequestBody({
            page: '1',
            itemsPerPage: '1'
          })
        )
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error);
      }

      applyResumeCount(data?.total || 0);
    } catch (error) {
      console.error('Error fetching Resume Pasien tab count:', error);
      applyResumeCount(0);
    }
  };

  const fetchRawatInapData = async (tabValue: RawatInapListTab = activeTab as RawatInapListTab) => {
    setLoading(true);
    try {
      const requestBody = buildRawatInapRequestBody(tabValue);
      requestBody.includeTabCounts = false;

      console.log('Fetching Rawat Inap data:', requestBody);

      const response = await fetch(API_URLS.RAWAT_INAP_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching Rawat Inap data:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        console.error('Error fetching Rawat Inap data:', data.error);
        throw new Error(data.error);
      }

      console.log('Rawat Inap data response:', data);
      setRawatInapData(data?.data || []);
      setTotal(data?.total || 0);
      if (data?.tabCounts) {
        applyTabCounts(data?.tabCounts);
      }
      void Promise.allSettled([
        fetchRawatInapTabCounts(),
        fetchResumeTabCount()
      ]);

    } catch (error) {
      console.error('Error fetching Rawat Inap data:', error);
      setRawatInapData([]);
      setTotal(0);
      setTabCounts(emptyTabCounts);
    } finally {
      setLoading(false);
    }
  };

  const fetchResumeData = async () => {
    setLoading(true);
    try {
      const requestBody = buildResumeRequestBody();

      console.log('Fetching Resume Pasien data:', requestBody);

      const response = await fetch(API_URLS.RESUME_PASIEN_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching Resume Pasien data:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        console.error('Error fetching Resume Pasien data:', data.error);
        throw new Error(data.error);
      }

      console.log('Resume Pasien data response:', data);
      setResumeData(data?.data || []);
      setTotal(data?.total || 0);
      applyResumeCount(data?.total || 0);
      void fetchRawatInapTabCounts();

    } catch (error) {
      console.error('Error fetching Resume Pasien data:', error);
      setResumeData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = (tab: string) => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    if (tab === 'resume-pasien') {
      fetchResumeData();
    } else {
      fetchRawatInapData(tab as 'rawat-inap' | 'rawat-bersama' | 'rawat-gabung');
    }
  };

  const handleClearFilters = (tab: string) => {
    setSearchQuery("");
    setStatusPulangByTab(tab, tab === 'resume-pasien' ? "sudah-pulang" : "masih-dirawat");
    setResumeStatus("belum_resume");
    setRawatBersamaResumeStatus("belum_ada_resume");
    setDateRange({
      from: defaultRawatInapFrom,
      to: defaultRawatInapTo
    });
    setCurrentPage(1);
  };

  useEffect(() => {
    if (activeTab === 'resume-pasien') {
      fetchResumeData();
    } else {
      fetchRawatInapData(activeTab);
    }
  }, [activeTab, currentPage, itemsPerPage]);

  // Use the global rawatInapColumns definition

  const resumeColumns = [
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'nm_pasien', header: 'Nama Pasien' },
    { accessor: 'jenis_kelamin', header: 'JK' },
    { accessor: 'tgl_masuk', header: 'Tgl Masuk' },
    { accessor: 'tgl_keluar', header: 'Tgl Keluar' },
    { accessor: 'kd_kamar', header: 'Kamar' },
    { accessor: 'nm_bangsal', header: 'Bangsal' },
    { 
      accessor: 'dokter_dpjp', 
      header: 'DPJP',
      render: (row: any) => <DokterDPJPCell dokterDpjp={row.dokter_dpjp} />
    },
    { accessor: 'diagnosa_utama', header: 'Diagnosa Utama' },
    { accessor: 'stts_pulang', header: 'Status Pulang' },
    { accessor: 'lama', header: 'Lama Rawat' },
    { 
      accessor: 'status_resume', 
      header: 'Status Resume',
      render: (row: any) => {
        if (row.status_resume === 'sudah_resume') {
          return (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Sudah Resume
            </span>
          );
        } else {
          return (
            <button 
              onClick={() => handleCreateResume(row.no_rawat)}
              className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-blue-100 hover:bg-blue-200 text-blue-800 transition-colors"
            >
              Belum Resume
            </button>
          );
        }
      }
    }
  ];

  const handleCreateResume = (noRawat: string) => {
    // TODO: Implement resume creation functionality
    console.log('Create resume for:', noRawat);
    // This will redirect to resume creation page or open a modal
  };

  const getInapTitle = (tab: string) => {
    switch (tab) {
      case 'rawat-bersama':
        return 'Data Pasien Rawat Bersama';
      case 'rawat-gabung':
        return 'Data Pasien Rawat Gabung';
      default:
        return 'Data Pasien Rawat Inap';
    }
  };

  const renderFilterSection = (tab: string) => (
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
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[350px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                "Pilih rentang tanggal"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={indonesianLocale}
              className="p-3 pointer-events-auto min-w-[600px]"
            />
          </PopoverContent>
        </Popover>

        <Select value={getStatusPulangByTab(tab)} onValueChange={(value) => setStatusPulangByTab(tab, value)}>
          <SelectTrigger className="w-full sm:w-auto min-w-[160px]">
            <SelectValue placeholder="Status Rawat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="masih-dirawat">Masih Dirawat (-)</SelectItem>
            <SelectItem value="pindah-kamar">Pindah Kamar</SelectItem>
            <SelectItem value="sudah-pulang">Sudah Pulang</SelectItem>
          </SelectContent>
        </Select>

        {tab === 'resume-pasien' ? (
          <Select value={resumeStatus} onValueChange={setResumeStatus}>
            <SelectTrigger className="w-full sm:w-auto min-w-[170px]">
              <SelectValue placeholder="Status Resume" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Resume</SelectItem>
              <SelectItem value="belum_resume">Belum Resume</SelectItem>
              <SelectItem value="sudah_resume">Sudah Resume</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        {tab === 'rawat-bersama' && getStatusPulangByTab(tab) === 'sudah-pulang' ? (
          <Select value={rawatBersamaResumeStatus} onValueChange={setRawatBersamaResumeStatus}>
            <SelectTrigger className="w-full sm:w-auto min-w-[210px]">
              <SelectValue placeholder="Mode Resume Bersama" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="belum_ada_resume">Belum Ada Resume</SelectItem>
              <SelectItem value="belum_resume_dokter">Belum Resume Dokter</SelectItem>
              <SelectItem value="sudah_resume">Sudah Resume</SelectItem>
              <SelectItem value="all">Semua Resume</SelectItem>
            </SelectContent>
          </Select>
        ) : null}

        <Button 
          variant="secondary"
          onClick={() => handleFilterApply(tab)}
          className="w-full sm:w-auto"
        >
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>

        <Button 
          variant="outline"
          onClick={() => handleClearFilters(tab)}
          className="w-full sm:w-auto"
        >
          <X className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={(value) => {
      setCurrentPage(1);
      setActiveTab(value as RawatInapTab);
    }}>
      <TabsList className="mb-4">
        <TabsTrigger value="rawat-inap">
          <Home className="mr-2 h-4 w-4" />
          <span>Rawat Inap ({tabCounts.rawat_inap})</span>
        </TabsTrigger>
        <TabsTrigger value="rawat-bersama">
          <Home className="mr-2 h-4 w-4" />
          <span>Rawat Bersama ({tabCounts.rawat_bersama})</span>
        </TabsTrigger>
        <TabsTrigger value="rawat-gabung">
          <Home className="mr-2 h-4 w-4" />
          <span>Rawat Gabung ({tabCounts.rawat_gabung})</span>
        </TabsTrigger>
        <TabsTrigger value="resume-pasien">
          <File className="mr-2 h-4 w-4" />
          <span>Resume Pasien ({tabCounts.resume_pasien})</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="rawat-inap" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{getInapTitle('rawat-inap')}</CardTitle>
            {renderFilterSection('rawat-inap')}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PatientTable 
                patients={rawatInapData} 
                columns={rawatInapColumns}
                loading={loading}
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rawat-bersama" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{getInapTitle('rawat-bersama')}</CardTitle>
            {renderFilterSection('rawat-bersama')}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PatientTable 
                patients={rawatInapData} 
                columns={rawatInapColumns}
                loading={loading}
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="rawat-gabung" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>{getInapTitle('rawat-gabung')}</CardTitle>
            {renderFilterSection('rawat-gabung')}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PatientTable 
                patients={rawatInapData} 
                columns={rawatInapColumns}
                loading={loading}
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="resume-pasien" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Resume Pasien Rawat Inap</CardTitle>
            {renderFilterSection('resume-pasien')}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <PatientTable 
                patients={resumeData} 
                columns={resumeColumns}
                loading={loading}
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
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

const IGDTabs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const igdTabOptions = ['triase', 'observasi', 'tindakan'] as const;
  const initialIGDTab = igdTabOptions.includes(searchParams.get('tab') as typeof igdTabOptions[number])
    ? searchParams.get('tab') as typeof igdTabOptions[number]
    : 'triase';
  const defaultIGDDate = new Date();
  const [igdData, setIgdData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<typeof igdTabOptions[number]>(initialIGDTab);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || "all");
  const [triaseLevel, setTriaseLevel] = useState(searchParams.get('triase') || "all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parseDateParam(searchParams.get('from'), defaultIGDDate),
    to: parseDateParam(searchParams.get('to'), defaultIGDDate)
  });
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));

  const fetchIGDData = async (tab: string) => {
    setLoading(true);
    try {
      const requestParams = {
        page: currentPage.toString(),
        itemsPerPage: itemsPerPage.toString(),
        search: searchQuery,
        status: statusFilter,
        triase_level: triaseLevel,
        date_from: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
        date_to: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
        tab: tab
      };

      const params = new URLSearchParams(requestParams);

      console.log('=== IGD Data Fetch Start ===');
      console.log('Tab:', tab);
      console.log('Current page:', currentPage);
      console.log('Items per page:', itemsPerPage);
      console.log('Search query:', searchQuery);
      console.log('Status filter:', statusFilter);
      console.log('Triase level:', triaseLevel);
      console.log('Date range:', dateRange);
      console.log('Request params object:', requestParams);
      console.log('URL params string:', params.toString());
      console.log('Full URL:', `${API_URLS.IGD_DATA}?${params.toString()}`);
      const response = await fetch(
        `${API_URLS.IGD_DATA}?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('=== IGD Data Fetch Response ===');
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        console.error('=== Response Not OK ===');
        console.error('Status:', response.status);
        console.error('Status text:', response.statusText);
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      console.log('=== IGD Data Processing ===');
      console.log('Raw response data:', data);
      console.log('Data type:', typeof data);
      console.log('Data keys:', data ? Object.keys(data) : 'No data');
      console.log('Data.data array:', data?.data);
      console.log('Data.data length:', data?.data ? data.data.length : 0);
      console.log('Data.total:', data?.total);
      console.log('First record sample:', data?.data?.[0]);

      if (data) {
        setIgdData(data.data || []);
        setTotal(data.total || 0);
        console.log('State updated - igdData length:', data.data ? data.data.length : 0);
        console.log('State updated - total:', data.total || 0);
      } else {
        console.warn('=== No Data Received ===');
        setIgdData([]);
        setTotal(0);
      }

    } catch (error) {
      console.error('=== IGD Data Fetch Exception ===');
      console.error('Exception type:', error.constructor.name);
      console.error('Exception message:', error.message);
      console.error('Exception stack:', error.stack);
      console.error('Full exception object:', error);
    } finally {
      console.log('=== IGD Data Fetch Complete ===');
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('tab', activeTab);
    params.set('page', String(currentPage));
    params.set('itemsPerPage', String(itemsPerPage));
    params.set('status', statusFilter);
    params.set('triase', triaseLevel);

    if (dateRange?.from) {
      params.set('from', format(dateRange.from, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
    }

    if (dateRange?.to) {
      params.set('to', format(dateRange.to, 'yyyy-MM-dd'));
    } else {
      params.delete('to');
    }

    if (searchQuery.trim()) {
      params.set('search', searchQuery.trim());
    } else {
      params.delete('search');
    }

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    activeTab,
    currentPage,
    itemsPerPage,
    searchQuery,
    statusFilter,
    triaseLevel,
    dateRange?.from,
    dateRange?.to,
    searchParams,
    setSearchParams
  ]);

  useEffect(() => {
    fetchIGDData(activeTab);
  }, [activeTab, currentPage, itemsPerPage, searchQuery, statusFilter, triaseLevel, dateRange?.from, dateRange?.to]);

  const handleFilterApply = (tab: string) => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchIGDData(tab);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setTriaseLevel("all");
    setDateRange({
      from: defaultIGDDate,
      to: defaultIGDDate
    });
    setCurrentPage(1);
  };

  const getIgdTriaseBadgeClass = (value: string) => {
    switch ((value || '').toLowerCase()) {
      case 'merah':
        return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'kuning':
        return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
      case 'hijau':
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'hitam':
        return 'bg-slate-800 text-white hover:bg-slate-800';
      default:
        return 'bg-slate-100 text-slate-700 hover:bg-slate-100';
    }
  };

  const igdColumns = [
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'nm_pasien', header: 'Nama Pasien' },
    { accessor: 'tgl_registrasi', header: 'Tanggal' },
    { accessor: 'jam_reg', header: 'Jam' },
    { accessor: 'nm_dokter', header: 'Dokter' },
    {
      accessor: 'triase_level',
      header: 'Level Triase',
      render: (row: any) => {
        const triaseLevelLabel = String(row.triase_level || 'Belum Triase').trim() || 'Belum Triase';
        return (
          <Badge className={cn('font-medium', getIgdTriaseBadgeClass(triaseLevelLabel))}>
            {triaseLevelLabel}
          </Badge>
        );
      }
    },
    {
      accessor: 'nm_tindakan',
      header: 'Tindakan',
      render: (row: any) => {
        const tindakan = String(row.nm_tindakan || '').trim() || 'Belum Ada Tindakan';
        const tindakanItems = tindakan
          .split(',')
          .map((item: string) => item.trim())
          .filter(Boolean);
        const compactText = tindakanItems.length > 2
          ? `${tindakanItems.slice(0, 2).join(', ')} +${tindakanItems.length - 2} lainnya`
          : tindakan;

        return (
          <div className="max-w-[240px]" title={tindakan}>
            <div className="truncate text-sm font-medium">{compactText}</div>
            {row.kd_tindakan ? (
              <div className="truncate text-xs text-muted-foreground" title={String(row.kd_tindakan)}>
                Kode: {String(row.kd_tindakan)}
              </div>
            ) : null}
          </div>
        );
      }
    },
    { accessor: 'status', header: 'Status' },
    { 
      accessor: 'clinical_pathway', 
      header: 'Clinical Pathway',
      render: (row: any) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            if (row.no_rkm_medis && row.no_rawat) {
              const formattedNoRawat = formatNoRawat(row.no_rawat);
              const compactNoRawat = String(formattedNoRawat).replace(/\//g, '');
              navigate(`/clinical-pathway/${row.no_rkm_medis}/${compactNoRawat}?mode=initiation&source=igd`);
            }
          }}
          className="flex items-center gap-1"
        >
          <FileText size={14} />
          CP
        </Button>
      )
    }
  ];

  const renderFilterSection = (tab: string) => (
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
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[350px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                "Pilih rentang tanggal"
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={indonesianLocale}
              className="p-3 pointer-events-auto min-w-[600px]"
            />
          </PopoverContent>
        </Popover>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-auto min-w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="Menunggu">Menunggu</SelectItem>
            <SelectItem value="Triase">Triase</SelectItem>
            <SelectItem value="Selesai">Selesai</SelectItem>
          </SelectContent>
        </Select>

        <Select value={triaseLevel} onValueChange={setTriaseLevel}>
          <SelectTrigger className="w-full sm:w-auto min-w-[140px]">
            <SelectValue placeholder="Level Triase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Level</SelectItem>
            <SelectItem value="T001">Merah</SelectItem>
            <SelectItem value="T002">Kuning</SelectItem>
            <SelectItem value="T003">Hijau</SelectItem>
            <SelectItem value="T004">Hitam</SelectItem>
          </SelectContent>
        </Select>

        <Button 
          variant="secondary"
          onClick={() => handleFilterApply(tab)}
          className="w-full sm:w-auto"
        >
          <Filter className="mr-2 h-4 w-4" />
          Filter
        </Button>

        <Button 
          variant="outline"
          onClick={handleClearFilters}
          className="w-full sm:w-auto"
        >
          <X className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={(value) => {
      setCurrentPage(1);
      setActiveTab(value as typeof igdTabOptions[number]);
    }}>
      <TabsList className="mb-4">
        <TabsTrigger value="triase">
          <List className="mr-2 h-4 w-4" />
          <span>Triase</span>
        </TabsTrigger>
        <TabsTrigger value="observasi">
          <Clock className="mr-2 h-4 w-4" />
          <span>Observasi</span>
        </TabsTrigger>
        <TabsTrigger value="tindakan">
          <Check className="mr-2 h-4 w-4" />
          <span>Tindakan</span>
        </TabsTrigger>
      </TabsList>

      {['triase', 'observasi', 'tindakan'].map((tabValue) => (
        <TabsContent key={tabValue} value={tabValue} className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>
                {tabValue === 'triase' && 'Triase IGD'}
                {tabValue === 'observasi' && 'Observasi IGD'}
                {tabValue === 'tindakan' && 'Tindakan IGD'}
              </CardTitle>
              {renderFilterSection(tabValue)}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <PatientTable 
                  patients={igdData} 
                  columns={igdColumns}
                  loading={loading}
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
};


const Patients = () => {
  const location = useLocation();
  const isMobile = useIsMobile();
  const path = location.pathname;
  const [openMedicalRecordTabs, setOpenMedicalRecordTabs] = useState<MedicalRecordWorkspaceTab[]>([]);
  const [activeMedicalRecordTabId, setActiveMedicalRecordTabId] = useState<string>(LIST_PASIEN_TAB_ID);
  const [medicalRecordReloadCounters, setMedicalRecordReloadCounters] = useState<Record<string, number>>({});
  const patientTabRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const patientTabsScrollContainerRef = useRef<HTMLDivElement | null>(null);
  let title = "Rawat Jalan";
  let description = "Pasien yang mendapatkan pelayanan medis tanpa harus menginap di rumah sakit";
  let tabs = <RawatJalanTabs />;

  useEffect(() => {
    const handleOpenMedicalRecordTab = (event: Event) => {
      const detail = (event as CustomEvent<OpenMedicalRecordTabDetail>).detail;
      if (!detail?.noRkmMedis || !detail?.noRawat) {
        return;
      }

      const nextTab: MedicalRecordWorkspaceTab = {
        id: `${detail.noRkmMedis}-${detail.noRawat}`,
        noRkmMedis: detail.noRkmMedis,
        noRawat: detail.noRawat,
        patientName: detail.patientName || `Pasien ${detail.noRkmMedis}`,
        sourcePath: detail.sourcePath
      };

      setOpenMedicalRecordTabs((previous) => {
        const existingTab = previous.find((tab) => tab.id === nextTab.id);
        if (existingTab) {
          const remainingTabs = previous.filter((tab) => tab.id !== nextTab.id);
          return [nextTab, ...remainingTabs];
        }

        return [nextTab, ...previous];
      });
      setActiveMedicalRecordTabId(nextTab.id);
      setMedicalRecordReloadCounters((previous) => ({
        ...previous,
        [nextTab.id]: (previous[nextTab.id] ?? 0) + 1
      }));
    };

    window.addEventListener(OPEN_MEDICAL_RECORD_TAB_EVENT, handleOpenMedicalRecordTab as EventListener);

    return () => {
      window.removeEventListener(OPEN_MEDICAL_RECORD_TAB_EVENT, handleOpenMedicalRecordTab as EventListener);
    };
  }, []);

  const activateMedicalRecordTab = (tabId: string, shouldReload = false) => {
    setOpenMedicalRecordTabs((previous) => {
      const targetTab = previous.find((tab) => tab.id === tabId);
      if (!targetTab) {
        return previous;
      }

      const remainingTabs = previous.filter((tab) => tab.id !== tabId);
      return [targetTab, ...remainingTabs];
    });

    setActiveMedicalRecordTabId(tabId);

    if (shouldReload) {
      setMedicalRecordReloadCounters((previous) => ({
        ...previous,
        [tabId]: (previous[tabId] ?? 0) + 1
      }));
    }
  };

  const closeMedicalRecordTab = (tabId: string) => {
    setOpenMedicalRecordTabs((previous) => {
      const currentIndex = previous.findIndex((tab) => tab.id === tabId);
      const nextTabs = previous.filter((tab) => tab.id !== tabId);

      setActiveMedicalRecordTabId((currentActiveTabId) => {
        if (currentActiveTabId !== tabId) {
          return currentActiveTabId;
        }

        if (!nextTabs.length) {
          return LIST_PASIEN_TAB_ID;
        }

        const fallbackIndex = currentIndex > 0 ? currentIndex - 1 : 0;
        return nextTabs[Math.min(fallbackIndex, nextTabs.length - 1)].id;
      });

      return nextTabs;
    });

    setMedicalRecordReloadCounters((previous) => {
      if (!(tabId in previous)) {
        return previous;
      }

      const nextCounters = { ...previous };
      delete nextCounters[tabId];
      return nextCounters;
    });
  };

  const closeOtherMedicalRecordTabs = () => {
    if (activeMedicalRecordTabId === LIST_PASIEN_TAB_ID) {
      setOpenMedicalRecordTabs([]);
      setMedicalRecordReloadCounters({});
      return;
    }

    setOpenMedicalRecordTabs((previous) => previous.filter((tab) => tab.id === activeMedicalRecordTabId));
    setMedicalRecordReloadCounters((previous) => {
      const activeCounter = previous[activeMedicalRecordTabId];
      return activeCounter === undefined ? {} : { [activeMedicalRecordTabId]: activeCounter };
    });
  };

  const closeAllMedicalRecordTabs = () => {
    setOpenMedicalRecordTabs([]);
    setActiveMedicalRecordTabId(LIST_PASIEN_TAB_ID);
    setMedicalRecordReloadCounters({});
  };

  const scrollPatientTabs = (direction: 'left' | 'right') => {
    const container = patientTabsScrollContainerRef.current;
    if (!container) {
      return;
    }

    const scrollAmount = Math.max(container.clientWidth * 0.7, 220);
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const activeMedicalRecordTab = openMedicalRecordTabs.find((tab) => tab.id === activeMedicalRecordTabId) || null;

  useEffect(() => {
    if (activeMedicalRecordTabId === LIST_PASIEN_TAB_ID) {
      return;
    }

    const activeTabElement = patientTabRefs.current[activeMedicalRecordTabId];
    if (!activeTabElement) {
      return;
    }

    activeTabElement.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }, [activeMedicalRecordTabId, openMedicalRecordTabs]);
  
  if (path.includes('booking')) {
    title = "Booking";
    description = "Pasien yang telah memesan jadwal kunjungan atau kontrol dengan dokter";
    tabs = <BookingTabs />;
  } else if (path.includes('igd')) {
    title = "IGD";
    description = "Pasien yang memerlukan penanganan darurat segera di Instalasi Gawat Darurat (IGD) rumah sakit";
    tabs = <IGDTabs />;
  } else if (path.includes('rawat-inap')) {
    title = "Rawat Inap";
    description = "Pasien yang mendapatkan perawatan medis yang intensif, meliputi observasi, diagnosis, pengobatan, keperawatan, dan rehabilitasi. ";
    tabs = <RawatInapTabs />;
  } else if (path.includes('hemodialisa')) {
    title = "Hemodialisa";
    description = "Pasien yang prosedur cuci darah yang dilakukan untuk membersihkan darah dari racun dan sisa metabolisme tubuh";
    tabs = <HemodialisaTabs />;
  }
  
  return (
    <div className="p-2 md:p-6 space-y-3 md:space-y-4 w-full mx-auto animate-fade-in shadow-md bg-gray-50 rounded-lg bg-gray-50">
      <div className="mb-4 md:mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <User size={24} className="text-primary" />
          <h1 className="text-xl md:text-2xl font-bold text-gray-800">Pasien {title}</h1>
        </div>
        <p className="text-sm md:text-base text-gray-500">{description}</p>
        <Separator className="mt-2" />
      </div>
      <div className="overflow-hidden rounded-lg border bg-background shadow-sm">
          <div className="border-b bg-muted/30 px-2 pt-2">
            <div className="flex items-end gap-2">
                <div className="shrink-0 border-r border-border/60 pr-2">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-2 transition-colors",
                    activeMedicalRecordTabId === LIST_PASIEN_TAB_ID
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-transparent bg-amber-100/70 text-amber-700 hover:bg-amber-100"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setActiveMedicalRecordTabId(LIST_PASIEN_TAB_ID)}
                    className="flex min-w-0 items-center gap-2 text-left"
                  >
                    <span className="text-sm font-medium whitespace-nowrap">List Pasien</span>
                  </button>
                </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => scrollPatientTabs('left')}
                    disabled={openMedicalRecordTabs.length === 0}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                <div
                  ref={patientTabsScrollContainerRef}
                  className="min-w-0 flex-1 overflow-x-auto scroll-smooth"
                >
                  <div className="flex min-w-max gap-1">
                {openMedicalRecordTabs.map((tab) => {
                  const isActive = tab.id === activeMedicalRecordTabId;

                  return (
                    <div
                      key={tab.id}
                      ref={(element) => {
                        patientTabRefs.current[tab.id] = element;
                      }}
                      className={cn(
                        "flex items-center gap-2 rounded-t-md border border-b-0 px-3 py-2 transition-colors",
                        isActive
                          ? "border-primary bg-background text-primary"
                          : "border-transparent bg-transparent text-muted-foreground hover:bg-background/70"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => activateMedicalRecordTab(tab.id, true)}
                        className="flex min-w-0 items-center gap-2 text-left"
                      >
                        <span className="max-w-[240px] truncate text-sm font-medium">
                          {tab.patientName || `Pasien ${tab.noRkmMedis}`}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatWorkspaceNoRawat(tab.noRawat)}
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => closeMedicalRecordTab(tab.id)}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  );
                })}
                  </div>
                </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => scrollPatientTabs('right')}
                    disabled={openMedicalRecordTabs.length === 0}
                  >
                    <ChevronRight size={16} />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={openMedicalRecordTabs.length === 0}
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-52 p-2">
                      <div className="space-y-1">
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={closeOtherMedicalRecordTabs}
                          disabled={openMedicalRecordTabs.length === 0}
                        >
                          Tutup Tab Lainnya
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-destructive hover:text-destructive"
                          onClick={closeAllMedicalRecordTabs}
                          disabled={openMedicalRecordTabs.length === 0}
                        >
                          Tutup Semua Tab
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
            </div>
          </div>
          <div className={cn(activeMedicalRecordTabId === LIST_PASIEN_TAB_ID ? "block" : "hidden")}>
            {tabs}
          </div>
          {activeMedicalRecordTab ? (
            <div className={cn("bg-background", activeMedicalRecordTabId === LIST_PASIEN_TAB_ID ? "hidden" : "block")}>
              <MedicalRecord
                key={`${activeMedicalRecordTab.id}-${medicalRecordReloadCounters[activeMedicalRecordTab.id] ?? 0}`}
                noRkmMedis={activeMedicalRecordTab.noRkmMedis}
                noRawat={activeMedicalRecordTab.noRawat}
                embedded
              />
            </div>
          ) : null}
        </div>
    </div>
  );
};
export default Patients;
