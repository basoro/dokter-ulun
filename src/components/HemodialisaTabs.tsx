import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Filter,
  X,
} from 'lucide-react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import PatientTable from '@/components/PatientTable';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { formatDateWIB, formatDateTimeWIB } from '@/lib/date-utils';
import { API_URLS } from '@/config/api';
import { DatePickerPopover } from '@/components/DatePickerPopover';

const parseDateParam = (value: string | null, fallback: Date) => {
  if (!value) return fallback;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return fallback;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const parsePositiveInt = (value: string | null, fallback: number) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Columns for hemodialisa data
const hemodialisaColumns = [
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

const HemodialisaTabs = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialToday = new Date();
  const initialFromDate = parseDateParam(searchParams.get('from'), initialToday);
  const initialToDate = parseDateParam(searchParams.get('to'), initialFromDate);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  
  // Date range state - use current date without timezone conversion
  const [date, setDate] = useState<DateRange | undefined>({
    from: initialFromDate,
    to: initialToDate
  });
  
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || "all");
  const [statusBayarFilter, setStatusBayarFilter] = useState<string>(searchParams.get('statusBayar') || "all");
  const [hemodialisaPatients, setHemodialisaPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(parsePositiveInt(searchParams.get('page'), 1));
  const [total, setTotal] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(parsePositiveInt(searchParams.get('itemsPerPage'), 10));
  
  const fetchHemodialisaPatients = async () => {
    if (!date?.from || !date?.to) {
      console.log('Missing date range:', { date });
      return;
    }
    
    setLoading(true);
    try {
      let requestBody = {
        startDate: formatDateWIB(date.from),
        endDate: formatDateWIB(date.to),
        status: statusFilter,
        statusBayar: statusBayarFilter,
        page: currentPage.toString(),
        itemsPerPage: itemsPerPage.toString()
      };

      console.log('Request dates (WIB):', {
        startDate: formatDateWIB(date.from),
        endDate: formatDateWIB(date.to),
        originalDates: { from: date.from, to: date.to }
      });

      console.log('Fetching hemodialisa patients with filters:', requestBody);
      
      const response = await fetch(API_URLS.HEMODIALISA_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Raw response from hemodialisa-data:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        console.error('HTTP error fetching hemodialisa patients:', response.status, response.statusText);
        setHemodialisaPatients([]);
        setTotal(0);
        return;
      }

      const data = await response.json();
      console.log('Parsed response data:', data);

      if (data?.success) {
        console.log('Received patient data:', data.data);
        console.log('Data structure check:', { 
          isArray: Array.isArray(data.data), 
          length: data.data?.length, 
          firstItem: data.data?.[0] 
        });
        setHemodialisaPatients(Array.isArray(data.data) ? data.data : []);
        setTotal(data.total || 0);
      } else {
        console.error('Failed to fetch patients:', data);
        setHemodialisaPatients([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('Error fetching hemodialisa patients:', error);
      setHemodialisaPatients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (date?.from && date?.to) {
      fetchHemodialisaPatients();
    }
  }, [date?.from, date?.to, currentPage, itemsPerPage, statusFilter, statusBayarFilter]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);

    params.set('page', String(currentPage));
    params.set('itemsPerPage', String(itemsPerPage));
    params.set('status', statusFilter);
    params.set('statusBayar', statusBayarFilter);

    if (date?.from) {
      params.set('from', format(date.from, 'yyyy-MM-dd'));
    } else {
      params.delete('from');
    }

    if (date?.to) {
      params.set('to', format(date.to, 'yyyy-MM-dd'));
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
    currentPage,
    itemsPerPage,
    statusFilter,
    statusBayarFilter,
    searchQuery,
    date?.from,
    date?.to,
    searchParams,
    setSearchParams
  ]);
  
  const handleFilterApply = () => {
    if (currentPage !== 1) {
      setCurrentPage(1);
      return;
    }

    fetchHemodialisaPatients();
  };

  const handleClearFilters = () => {
    setDate({
      from: new Date(),
      to: new Date()
    });
    setStatusFilter("all");
    setStatusBayarFilter("all");
    setSearchQuery("");
    setCurrentPage(1);
  };
  
  console.log('Filtering data:', {
    totalPatients: hemodialisaPatients.length,
    searchQuery,
    statusFilter,
    statusBayarFilter
  });
  
  const filteredHemodialisaData = hemodialisaPatients.filter(patient => {
    let passesSearch = true;
    let passesStatus = true;
    let passesPaymentStatus = true;
    
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
    
    if (statusBayarFilter && statusBayarFilter !== "all") {
      passesPaymentStatus = patient.payment_status?.toLowerCase() === statusBayarFilter.toLowerCase();
    }
    
    return passesSearch && passesStatus && passesPaymentStatus;
  }).map(patient => ({
    id: patient.no_rkm_medis,
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

  console.log('Final filtered data:', {
    filteredCount: filteredHemodialisaData.length,
    originalCount: hemodialisaPatients.length,
    sampleFilteredData: filteredHemodialisaData.slice(0, 2)
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2 w-full">
          <CardTitle>Daftar Pasien Hemodialisa</CardTitle>
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
              <DatePickerPopover
                triggerId="date"
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
                calendarClassName="min-w-[600px]"
                buttonClassName="w-full sm:w-[280px]"
                placeholder="Pilih rentang tanggal"
                displayValue={date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "LLL dd, y")} -{" "}
                      {format(date.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : undefined}
              />
              
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
              patients={filteredHemodialisaData} 
              columns={hemodialisaColumns}
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
    </div>
  );
};

export default HemodialisaTabs;
