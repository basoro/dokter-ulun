import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { formatNoRawat } from '@/App';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  FileText
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
import { format, addDays, differenceInDays } from 'date-fns';
import { indonesianLocale } from '@/lib/date-utils';
import PatientTable from '@/components/PatientTable';
import { useIsMobile } from '@/hooks/use-mobile';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import RawatJalanTabs from '@/components/RawatJalanTabs';
import HemodialisaTabs from '@/components/HemodialisaTabs';
import { API_URLS } from '@/config/api';

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

  const fetchBookingData = async () => {
    setLoading(true);
    try {
      const requestBody = {
        action: 'getAll',
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : null,
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : null,
        status: statusFilter,
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

      let bookings = data.bookings || [];
      setTotal(data.total || 0);
      
      // Filter booking berdasarkan poliklinik yang mengandung "Pagi" dan "Sore"
      const pagiBookings = bookings.filter(booking => 
        booking.nm_poli && booking.nm_poli.toLowerCase().includes('pagi')
      );
      
      const soreBookings = bookings.filter(booking => 
        booking.nm_poli && booking.nm_poli.toLowerCase().includes('sore')
      );

      setBookingPagi(pagiBookings);
      setBookingSore(soreBookings);
      setTotalPagi(pagiBookings.length);
      setTotalSore(soreBookings.length);
    } catch (error) {
      console.error('Error fetching booking data:', error);
      setBookingPagi([]);
      setBookingSore([]);
      setTotal(0);
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

  useEffect(() => {
    fetchBookingData();
    fetchDoctors();
  }, [currentPage, itemsPerPage]);

  return (
    <Tabs defaultValue="pagi">
      <TabsList className="mb-4">
        <TabsTrigger value="pagi">
          <AlarmClock className="mr-2 h-4 w-4" />
          <span>Pagi</span>
        </TabsTrigger>
        <TabsTrigger value="sore">
          <Clock className="mr-2 h-4 w-4" />
          <span>Sore</span>
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
      const lamaRawat = differenceInDays(today, tglMasuk) + 1; // +1 untuk menghitung hari masuk
      
      return (
        <span className="text-sm">
          {lamaRawat} hari
        </span>
      );
    }
  },
];


const RawatInapTabs = () => {
  const [rawatInapData, setRawatInapData] = useState<any[]>([]);
  const [resumeData, setResumeData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusPulang, setStatusPulang] = useState("-");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchRawatInapData = async () => {
    setLoading(true);
    try {
      const requestBody = {
        page: currentPage.toString(),
        itemsPerPage: itemsPerPage.toString(),
        search: searchQuery,
        statusPulang: statusPulang,
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
      };

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

    } catch (error) {
      console.error('Error fetching Rawat Inap data:', error);
      setRawatInapData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchResumeData = async () => {
    setLoading(true);
    try {
      const requestBody = {
        page: currentPage.toString(),
        itemsPerPage: itemsPerPage.toString(),
        search: searchQuery,
        statusPulang: statusPulang,
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
      };

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

    } catch (error) {
      console.error('Error fetching Resume Pasien data:', error);
      setResumeData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterApply = (tab: string) => {
    setCurrentPage(1);
    if (tab === 'resume-pasien') {
      fetchResumeData();
    } else {
      fetchRawatInapData();
    }
  };

  const handleClearFilters = (tab: string) => {
    setSearchQuery("");
    setStatusPulang("all");
    setDateRange({
      from: new Date(),
      to: new Date()
    });
    setCurrentPage(1);
    if (tab === 'resume-pasien') {
      fetchResumeData();
    } else {
      fetchRawatInapData();
    }
  };

  useEffect(() => {
    fetchRawatInapData();
  }, [currentPage, itemsPerPage]);

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

        <Select value={statusPulang} onValueChange={setStatusPulang}>
          <SelectTrigger className="w-full sm:w-auto min-w-[160px]">
            <SelectValue placeholder="Status Pulang" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="-">Masih Dirawat (-)</SelectItem>
            <SelectItem value="Sehat">Sehat</SelectItem>
            <SelectItem value="Rujuk">Rujuk</SelectItem>
            <SelectItem value="APS">APS</SelectItem>
            <SelectItem value="Meninggal">Meninggal</SelectItem>
            <SelectItem value="Sembuh">Sembuh</SelectItem>
            <SelectItem value="Membaik">Membaik</SelectItem>
            <SelectItem value="Pulang Paksa">Pulang Paksa</SelectItem>
            <SelectItem value="Pindah Kamar">Pindah Kamar</SelectItem>
            <SelectItem value="Status Belum Lengkap">Status Belum Lengkap</SelectItem>
            <SelectItem value="Atas Persetujuan Dokter">Atas Persetujuan Dokter</SelectItem>
            <SelectItem value="Atas Permintaan Sendiri">Atas Permintaan Sendiri</SelectItem>
            <SelectItem value="Lain-lain">Lain-lain</SelectItem>
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
    <Tabs defaultValue="rawat-inap" onValueChange={(value) => {
      setCurrentPage(1);
      if (value === 'resume-pasien') {
        fetchResumeData();
      } else {
        fetchRawatInapData();
      }
    }}>
      <TabsList className="mb-4">
        <TabsTrigger value="rawat-inap">
          <Home className="mr-2 h-4 w-4" />
          <span>Rawat Inap</span>
        </TabsTrigger>
        <TabsTrigger value="resume-pasien">
          <File className="mr-2 h-4 w-4" />
          <span>Resume Pasien</span>
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="rawat-inap" className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Data Pasien Rawat Inap</CardTitle>
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
  const [igdData, setIgdData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triaseLevel, setTriaseLevel] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
    fetchIGDData('triase');
  }, [currentPage, itemsPerPage, searchQuery, statusFilter, triaseLevel, dateRange]);

  const handleFilterApply = (tab: string) => {
    setCurrentPage(1);
    fetchIGDData(tab);
  };

  const handleClearFilters = (tab: string) => {
    setSearchQuery("");
    setStatusFilter("");
    setTriaseLevel("");
    setDateRange({
      from: new Date(),
      to: new Date()
    });
    setCurrentPage(1);
    fetchIGDData(tab);
  };

  const igdColumns = [
    { accessor: 'no_rkm_medis', header: 'No. RM' },
    { accessor: 'nm_pasien', header: 'Nama Pasien' },
    { accessor: 'tgl_registrasi', header: 'Tanggal' },
    { accessor: 'jam_reg', header: 'Jam' },
    { accessor: 'nm_dokter', header: 'Dokter' },
    { accessor: 'triase_level', header: 'Level Triase' },
    { accessor: 'nm_tindakan', header: 'Tindakan' },
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
              navigate(`/clinical-pathway/${row.no_rkm_medis}/${formattedNoRawat}`);
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
    <Tabs defaultValue="triase" onValueChange={(value) => fetchIGDData(value)}>
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
  let title = "Rawat Jalan";
  let description = "Pasien yang mendapatkan pelayanan medis tanpa harus menginap di rumah sakit";
  let tabs = <RawatJalanTabs />;
  
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
      {tabs}
    </div>
  );
};
export default Patients;
