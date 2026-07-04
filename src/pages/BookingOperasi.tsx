import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar as CalendarIcon, 
  Search, 
  Plus, 
  ClipboardList, 
  Clock,
  Clipboard,
  Building2,
  Filter,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { PaginationControls } from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { API_URLS } from '@/config/api';
import { DatePickerPopover } from '@/components/DatePickerPopover';
import { formatUIDate } from '@/lib/date-utils';

const BookingOperasi = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [status, setStatus] = useState('all');
  const [bookingData, setBookingData] = useState([]);
  const [loading, setLoading] = useState(false);

  const { paginationState, handlePageChange, handleItemsPerPageChange, updatePagination } = usePagination({
    initialItemsPerPage: 10
  });

  const fetchBookingData = async () => {
    setLoading(true);
    try {
      const response = await fetch(API_URLS.BOOKING_OPERASI_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          page: paginationState.currentPage,
          itemsPerPage: paginationState.itemsPerPage,
          search: searchQuery,
          startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
          endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : '',
          status: status === 'all' ? '' : status
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.success) {
        setBookingData(data.data || []);
        updatePagination({
          total: data.total,
          totalPages: data.totalPages
        });
      } else {
        throw new Error(data?.error || 'Failed to fetch booking data');
      }
    } catch (error) {
      console.error('Error fetching booking data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data booking operasi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookingData();
  }, [paginationState.currentPage, paginationState.itemsPerPage]);

  const handleFilterApply = () => {
    updatePagination({ page: 1 });
    fetchBookingData();
  };

  const handleClearFilters = () => {
    setDateRange(undefined);
    setStatus('all');
    setSearchQuery('');
    updatePagination({ page: 1 });
  };

  const handleScheduleOperation = () => {
    setIsModalOpen(false);
    toast({
      title: "Operasi Berhasil Dijadwalkan",
      description: "Jadwal operasi telah berhasil ditambahkan",
    });
  };

  return (
    <div className="mx-auto w-full animate-fade-in space-y-6 rounded-md bg-white p-2 shadow-md transition-colors dark:bg-slate-950 dark:shadow-slate-950/40 md:space-y-8 md:p-6">
      <div className="flex items-center space-x-2 mb-6">
        <ClipboardList size={24} className="text-primary" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Booking Operasi</h1>
      </div>
      <Separator className="mb-6" />
      
      <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2 w-full">
              <CardTitle className="flex items-center">
                <CalendarIcon className="mr-2 h-5 w-5" />
                Daftar Booking Operasi
              </CardTitle>
              <div className="flex flex-col lg:flex-row gap-2 items-start mb-4 w-full">
                <div className="relative w-full sm:w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Cari pasien, operasi, atau dokter..."
                    className="w-full pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                  <DatePickerPopover
                    triggerId="date"
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    calendarClassName="sm:min-w-[600px]"
                    buttonClassName="w-full sm:w-[300px]"
                    placeholder="Pilih rentang tanggal"
                    displayValue={dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {formatUIDate(dateRange.from)} - {formatUIDate(dateRange.to)}
                        </>
                      ) : (
                        formatUIDate(dateRange.from)
                      )
                    ) : undefined}
                  />
                  
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Status Operasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="Menunggu">Menunggu</SelectItem>
                      <SelectItem value="Proses Operasi">Proses Operasi</SelectItem>
                      <SelectItem value="Selesai">Selesai</SelectItem>
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    Total: {paginationState.totalItems} booking operasi
                  </span>
                  {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>}
                </div>
                
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto">
                      <Plus className="h-4 w-4 mr-2" />
                      Jadwalkan Operasi
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Jadwalkan Operasi Baru</DialogTitle>
                      <DialogDescription>
                        Masukkan detail untuk menjadwalkan operasi baru
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="patientId" className="text-right">
                          ID Pasien
                        </Label>
                        <Input id="patientId" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="patientName" className="text-right">
                          Nama Pasien
                        </Label>
                        <Input id="patientName" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="operationType" className="text-right">
                          Jenis Operasi
                        </Label>
                        <Input id="operationType" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="room" className="text-right">
                          Ruangan
                        </Label>
                        <Input id="room" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">
                          Tanggal
                        </Label>
                        <Input id="date" type="date" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="time" className="text-right">
                          Jam
                        </Label>
                        <Input id="time" type="time" className="col-span-3" />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="doctor" className="text-right">
                          Dokter
                        </Label>
                        <Input id="doctor" className="col-span-3" />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" onClick={handleScheduleOperation}>Jadwalkan</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-3 text-left font-medium">No. Rawat</th>
                      <th className="p-3 text-left font-medium">Pasien</th>
                      <th className="p-3 text-left font-medium">Paket Operasi</th>
                      <th className="p-3 text-left font-medium">Tanggal</th>
                      <th className="p-3 text-left font-medium">Jam</th>
                      <th className="p-3 text-left font-medium">Dokter</th>
                      <th className="p-3 text-left font-medium">Status</th>
                      <th className="p-3 text-left font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          <div className="flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            <span>Memuat data...</span>
                          </div>
                        </td>
                      </tr>
                    ) : bookingData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                          Tidak ada data booking operasi
                        </td>
                      </tr>
                    ) : (
                      bookingData.map((booking: any) => (
                        <tr key={booking.no_rawat} className="border-b">
                          <td className="p-3 font-mono text-sm">{booking.no_rawat}</td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{booking.nm_pasien}</p>
                              <p className="text-xs text-muted-foreground">
                                {booking.no_rkm_medis} | {booking.jk} | {booking.alamat}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{booking.nama_paket}</p>
                              <p className="text-xs text-muted-foreground">
                                {booking.kategori_paket} | {booking.kode_paket}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">
                            {formatUIDate(booking.tanggal)}
                          </td>
                          <td className="p-3">
                            <div>
                              <p className="text-sm">{booking.jam_mulai || '-'}</p>
                              <p className="text-xs text-muted-foreground">
                                s/d {booking.jam_selesai || '-'}
                              </p>
                            </div>
                          </td>
                          <td className="p-3">{booking.nm_dokter}</td>
                          <td className="p-3">
                            <span 
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                booking.status === 'Selesai' 
                                  ? 'bg-green-100 text-green-800' 
                                  : booking.status === 'Proses Operasi'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {booking.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm">Detail</Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Detail Booking Operasi</DialogTitle>
                                  <DialogDescription>
                                    No. Rawat: {booking.no_rawat}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <p className="text-sm font-medium">Pasien:</p>
                                      <p>{booking.nm_pasien}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {booking.no_rkm_medis} | {booking.jk}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Paket Operasi:</p>
                                      <p>{booking.nama_paket}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {booking.kategori_paket}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Tanggal:</p>
                                      <p>
                                        {formatUIDate(booking.tanggal)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Jam:</p>
                                      <p>{booking.jam_mulai} - {booking.jam_selesai}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Dokter:</p>
                                      <p>{booking.nm_dokter}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Status:</p>
                                      <p>{booking.status}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">Alamat:</p>
                                      <p>{booking.alamat}</p>
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium">No. Telepon:</p>
                                      <p>{booking.no_tlp || '-'}</p>
                                    </div>
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline">Cetak</Button>
                                  <Button>Ubah Status</Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          <PaginationControls
            currentPage={paginationState.currentPage}
            totalPages={paginationState.totalPages}
            itemsPerPage={paginationState.itemsPerPage}
            totalItems={paginationState.totalItems}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
      </div>
    </div>
  );
};

export default BookingOperasi;
