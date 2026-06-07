
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
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClockIcon, Calendar as CalendarIcon, CheckCircle, UserCheck, AlarmCheck, History, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { indonesianLocale, formatIndonesianDate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { API_URLS } from "@/config/api";

const Presensi = () => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [checkInTime, setCheckInTime] = useState<string>('');
  const [checkOutTime, setCheckOutTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('attendance');
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [monthlyAttendance, setMonthlyAttendance] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [availableShifts, setAvailableShifts] = useState<any[]>([]);
  const [selectedShift, setSelectedShift] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  const now = new Date();
  const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const currentTime = `${String(wibNow.getUTCHours()).padStart(2, '0')}:${String(wibNow.getUTCMinutes()).padStart(2, '0')}`;
  
  // Sample data for work schedule
  const workSchedule = [
    { day: 'Senin', shift: 'Pagi', startTime: '07:30', endTime: '16:00' },
    { day: 'Selasa', shift: 'Pagi', startTime: '07:30', endTime: '16:00' },
    { day: 'Rabu', shift: 'Pagi', startTime: '07:30', endTime: '16:00' },
    { day: 'Kamis', shift: 'Pagi', startTime: '07:30', endTime: '16:00' },
    { day: 'Jumat', shift: 'Pagi', startTime: '07:30', endTime: '14:30' },
    { day: 'Sabtu', shift: 'Libur', startTime: '-', endTime: '-' },
    { day: 'Minggu', shift: 'Libur', startTime: '-', endTime: '-' },
  ];
  
  // Find today's schedule using WIB time
  const todayName = wibNow.toLocaleDateString('id-ID', { weekday: 'long', timeZone: 'UTC' });
  const todaySchedule = workSchedule.find(schedule => schedule.day === todayName);
  
  // Fetch available shifts
  const fetchAvailableShifts = async () => {
    if (!user?.username) return;
    
    try {
      const response = await fetch(API_URLS.ATTENDANCE_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          action: 'get_available_shifts'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.success) {
        setAvailableShifts(data.data || []);
      } else {
        throw new Error(data?.error || 'Failed to fetch available shifts');
      }
    } catch (error) {
      console.error('Error fetching available shifts:', error);
    }
  };

  // Fetch attendance data
  const fetchAttendanceHistory = async () => {
    if (!user?.username) return;
    
    setLoading(true);
    try {
      const response = await fetch(API_URLS.ATTENDANCE_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          action: 'get_attendance_history',
          limit: 30
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.success) {
        setAttendanceHistory(data.data || []);
      } else {
        throw new Error(data?.error || 'Failed to fetch attendance history');
      }
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      toast({
        title: "Error",
        description: "Gagal mengambil data riwayat presensi",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch monthly attendance data
  const fetchMonthlyAttendance = async (month: string) => {
    if (!user?.username) return;
    
    setLoading(true);
    try {
      const response = await fetch(API_URLS.ATTENDANCE_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          action: 'get_monthly_attendance',
          month: month
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.success) {
        setMonthlyAttendance(data.data.data || []);
      } else {
        throw new Error(data?.error || 'Failed to fetch monthly attendance');
      }
    } catch (error) {
      console.error('Error fetching monthly attendance:', error);
      toast({
        title: "Error",
        description: "Gagal mengambil data presensi bulanan",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayAttendance = async (targetDate?: string) => {
    if (!user?.username) return;
    
    try {
      const dateStr = targetDate || new Date().toISOString().split('T')[0];
      
      const response = await fetch(API_URLS.ATTENDANCE_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          action: 'get_today_attendance',
          date: dateStr
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.success && data.data) {
        setTodayAttendance(data.data);
        // Set times from database - correct data structure
        if (data.data.attendance?.jam_datang) {
          const jamDatang = new Date(data.data.attendance.jam_datang);
          setCheckInTime(`${String(jamDatang.getHours()).padStart(2, '0')}:${String(jamDatang.getMinutes()).padStart(2, '0')}`);
        }
        if (data.data.attendance?.jam_pulang) {
          const jamPulang = new Date(data.data.attendance.jam_pulang);
          setCheckOutTime(`${String(jamPulang.getHours()).padStart(2, '0')}:${String(jamPulang.getMinutes()).padStart(2, '0')}`);
        }
      } else {
        setTodayAttendance(null);
        setCheckInTime('');
        setCheckOutTime('');
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };

  const handleCheckIn = async () => {
    if (!user?.username) {
      toast({
        title: "Error",
        description: "User tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    // Use today's schedule shift instead of selectedShift
    const currentShift = todaySchedule?.shift || 'Pagi';

    setLoading(true);
    try {
      const response = await fetch(API_URLS.ATTENDANCE_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          action: 'check_in',
          selectedShift: currentShift
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.success) {
        setSelectedShift('');
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
        toast({
          title: "Berhasil Check In",
          description: data.message || "Check in berhasil dicatat",
        });
      } else {
        throw new Error(data?.error || 'Check in gagal');
      }
    } catch (error) {
      console.error('Error check in:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal melakukan check in",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleCheckOut = async () => {
    if (!user?.username) {
      toast({
        title: "Error",
        description: "User tidak ditemukan",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_URLS.ATTENDANCE_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          action: 'check_out'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data?.success) {
        await fetchTodayAttendance();
        await fetchAttendanceHistory();
        toast({
          title: "Berhasil Check Out",
          description: data.message || "Check out berhasil dicatat",
        });
      } else {
        throw new Error(data?.error || 'Check out gagal');
      }
    } catch (error) {
      console.error('Error check out:', error);
      toast({
        title: "Error",
        description: error.message || "Gagal melakukan check out",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.username) {
      fetchAvailableShifts();
      fetchTodayAttendance();
      fetchAttendanceHistory();
      fetchMonthlyAttendance(selectedMonth);
    }
  }, [user?.username]);

  useEffect(() => {
    if (user?.username && selectedMonth) {
      fetchMonthlyAttendance(selectedMonth);
    }
  }, [selectedMonth, user?.username]);

  useEffect(() => {
    if (date && user?.username) {
      const dateStr = date.toISOString().split('T')[0];
      fetchTodayAttendance(dateStr);
    }
  }, [date, user?.username]);

  // Format attendance history for display
  const formattedHistory = attendanceHistory.map(record => {
    const tanggal = new Date(record.tanggal);
    const jamDatang = record.jam_datang ? new Date(record.jam_datang) : null;
    const jamPulang = record.jam_pulang ? new Date(record.jam_pulang) : null;
    
    // Parse keterlambatan as string and determine status
    const keterlambatanMinutes = record.keterlambatan ? parseInt(record.keterlambatan) : 0;
    let statusDisplay = record.status;
    
    if (keterlambatanMinutes > 0) {
      statusDisplay = `Terlambat ${keterlambatanMinutes} menit`;
    }
    
    return {
      date: tanggal.toLocaleDateString('id-ID'),
      checkIn: jamDatang ? `${String(jamDatang.getHours()).padStart(2, '0')}:${String(jamDatang.getMinutes()).padStart(2, '0')}` : '-',
      checkOut: jamPulang ? `${String(jamPulang.getHours()).padStart(2, '0')}:${String(jamPulang.getMinutes()).padStart(2, '0')}` : '-',
      status: statusDisplay,
      shift: record.shift || 'Pagi',
      durasi: record.durasi || '-',
      keterlambatan: keterlambatanMinutes
    };
  });

  return (
    <div className="p-2 md:p-6 space-y-6 md:space-y-8 w-full mx-auto animate-fade-in shadow-md bg-white rounded-md">
      <div className="flex items-center space-x-2 mb-6">
        <UserCheck size={24} className="text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Presensi Dokter</h1>
      </div>
      <Separator className="mb-6" />
      
      <Tabs defaultValue="attendance" onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-8">
          <TabsTrigger value="attendance" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <AlarmCheck className="h-3 w-3 sm:h-4 sm:w-4" />
            Absensi Hari Ini
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            Riwayat Absensi
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
            Bulanan
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="attendance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="border-2 border-primary/10 shadow-md">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center text-primary text-lg sm:text-xl">
                  <CalendarIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Kalender Presensi
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Pilih tanggal untuk melihat absensi</CardDescription>
              </CardHeader>
              <CardContent className="pb-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={indonesianLocale}
                  className="border rounded-md mx-auto"
                  showOutsideDays
                />
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row justify-between border-t pt-4 space-y-2 sm:space-y-0">
                <div>
                  <p className="text-xs sm:text-sm font-medium">Tanggal Dipilih:</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {formatIndonesianDate(date)}
                  </p>
                </div>
                {date && (
                  <Button variant="outline" size={isMobile ? "sm" : "default"} onClick={() => setDate(new Date())}>
                    Hari Ini
                  </Button>
                )}
              </CardFooter>
            </Card>
            
            <Card className="border-2 border-primary/10 shadow-md">
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="flex items-center text-primary text-lg sm:text-xl">
                  <ClockIcon className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Absensi Hari Ini
                </CardTitle>
                 <CardDescription className="text-xs sm:text-sm">
                   {formatIndonesianDate(wibNow)}
                 </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div className="p-3 sm:p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <h3 className="text-sm sm:text-base font-medium mb-2">Status Hari Ini</h3>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 sm:gap-0">
                    <div>
                       <p className="text-xs sm:text-sm">
                         Shift: <span className="font-medium">
                           {todayAttendance?.attendance?.shift || todaySchedule?.shift || '-'}
                           {(todaySchedule?.startTime && todaySchedule?.endTime) && 
                             ` (${todaySchedule.startTime} - ${todaySchedule.endTime})`
                           }
                         </span>
                       </p>
                        <p className="text-xs sm:text-sm">
                          Status: <span className="font-medium">{todayAttendance?.attendance?.status || 'Belum Absen'}</span>
                        </p>
                       {todayAttendance?.attendance?.durasi && (
                         <p className="text-xs sm:text-sm">
                           Durasi: <span className="font-medium">{todayAttendance.attendance.durasi}</span>
                         </p>
                       )}
                    </div>
                    <Badge variant={todayAttendance?.attendance ? "default" : "outline"} className="self-start sm:self-auto">
                      {todayAttendance?.attendance ? 'Sudah Absen' : 'Belum Absen'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">Jam Masuk</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input 
                        type="text" 
                        value={checkInTime} 
                        readOnly 
                        placeholder="--:--" 
                        className="text-xs sm:text-sm"
                      />
                      <Button 
                        onClick={handleCheckIn} 
                        disabled={!!checkInTime || todaySchedule?.shift === 'Libur' || loading}
                        size={isMobile ? "sm" : "default"}
                        className="whitespace-nowrap"
                      >
                        {loading ? 'Loading...' : 'Check In'}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-1 sm:mb-2">Jam Keluar</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input 
                        type="text" 
                        value={checkOutTime} 
                        readOnly 
                        placeholder="--:--" 
                        className="text-xs sm:text-sm"
                      />
                      <Button 
                        onClick={handleCheckOut} 
                        disabled={!checkInTime || !!checkOutTime || todaySchedule?.shift === 'Libur' || loading}
                        size={isMobile ? "sm" : "default"}
                        className="whitespace-nowrap"
                      >
                        {loading ? 'Loading...' : 'Check Out'}
                      </Button>
                    </div>
                  </div>
                </div>
                
                {(checkInTime || checkOutTime) && (
                  <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center text-green-700">
                      <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                      <p className="text-xs sm:text-sm font-medium">Status Kehadiran: Hadir</p>
                    </div>
                    <p className="text-xs sm:text-sm text-green-600 mt-1">
                      {checkInTime ? `Check in: ${checkInTime}` : 'Belum check in'} | 
                      {checkOutTime ? ` Check out: ${checkOutTime}` : ' Belum check out'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-lg sm:text-xl">Riwayat Absensi</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Riwayat presensi dalam 30 hari terakhir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2 sm:-mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Tanggal</TableHead>
                      <TableHead className="text-xs sm:text-sm">Check In</TableHead>
                      <TableHead className="text-xs sm:text-sm">Check Out</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-xs sm:text-sm">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : formattedHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-xs sm:text-sm">
                          Belum ada data presensi
                        </TableCell>
                      </TableRow>
                    ) : (
                      formattedHistory.map((record, index) => (
                        <TableRow key={index}>
                          <TableCell className="text-xs sm:text-sm">{record.date}</TableCell>
                          <TableCell className="text-xs sm:text-sm">{record.checkIn}</TableCell>
                          <TableCell className="text-xs sm:text-sm">{record.checkOut}</TableCell>
                          <TableCell>
                            <span 
                              className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                record.status.includes('Tepat Waktu') 
                                  ? 'bg-green-100 text-green-800'
                                  : record.status.includes('Terlambat')
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {record.status}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly">
          <Card>
            <CardHeader className="pb-2 sm:pb-4">
              <CardTitle className="text-lg sm:text-xl">Riwayat Presensi Bulanan</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Riwayat presensi berdasarkan bulan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <label htmlFor="month-select" className="text-sm font-medium">Pilih Bulan:</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Pilih bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date();
                      date.setMonth(date.getMonth() - i);
                      const monthValue = date.toISOString().substring(0, 7);
                      const monthName = date.toLocaleDateString('id-ID', { 
                        year: 'numeric', 
                        month: 'long' 
                      });
                      return (
                        <SelectItem key={monthValue} value={monthValue}>
                          {monthName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 bg-green-50 border-green-200">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-700">
                      {monthlyAttendance.filter(record => record.status?.includes('Tepat Waktu') || (!record.status?.includes('Terlambat') && record.jam_datang)).length}
                    </p>
                    <p className="text-sm text-green-600">Hadir Tepat Waktu</p>
                  </div>
                </Card>
                <Card className="p-4 bg-yellow-50 border-yellow-200">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-700">
                      {monthlyAttendance.filter(record => record.status?.includes('Terlambat')).length}
                    </p>
                    <p className="text-sm text-yellow-600">Terlambat</p>
                  </div>
                </Card>
                <Card className="p-4 bg-red-50 border-red-200">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-700">
                      {monthlyAttendance.filter(record => !record.jam_datang).length}
                    </p>
                    <p className="text-sm text-red-600">Tidak Hadir</p>
                  </div>
                </Card>
              </div>

              <div className="overflow-x-auto -mx-2 sm:-mx-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Tanggal</TableHead>
                      <TableHead className="text-xs sm:text-sm">Hari</TableHead>
                      <TableHead className="text-xs sm:text-sm">Check In</TableHead>
                      <TableHead className="text-xs sm:text-sm">Check Out</TableHead>
                      <TableHead className="text-xs sm:text-sm">Durasi</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs sm:text-sm">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : monthlyAttendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs sm:text-sm">
                          Belum ada data presensi untuk bulan ini
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthlyAttendance.map((record, index) => {
                        const tanggal = new Date(record.tanggal);
                        const jamDatang = record.jam_datang ? new Date(record.jam_datang) : null;
                        const jamPulang = record.jam_pulang ? new Date(record.jam_pulang) : null;
                        const keterlambatanMinutes = record.keterlambatan ? parseInt(record.keterlambatan) : 0;
                        let statusDisplay = record.status || 'Tidak Hadir';
                        
                        if (keterlambatanMinutes > 0) {
                          statusDisplay = `Terlambat ${keterlambatanMinutes} menit`;
                        }

                        return (
                          <TableRow key={index}>
                            <TableCell className="text-xs sm:text-sm">
                              {tanggal.toLocaleDateString('id-ID')}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {tanggal.toLocaleDateString('id-ID', { weekday: 'long' })}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {jamDatang ? `${String(jamDatang.getHours()).padStart(2, '0')}:${String(jamDatang.getMinutes()).padStart(2, '0')}` : '-'}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {jamPulang ? `${String(jamPulang.getHours()).padStart(2, '0')}:${String(jamPulang.getMinutes()).padStart(2, '0')}` : '-'}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">
                              {record.durasi || '-'}
                            </TableCell>
                            <TableCell>
                              <span 
                                className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                  statusDisplay.includes('Tepat Waktu') || (!statusDisplay.includes('Terlambat') && jamDatang)
                                    ? 'bg-green-100 text-green-800'
                                    : statusDisplay.includes('Terlambat')
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {statusDisplay}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Presensi;
