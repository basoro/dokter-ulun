import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Loader2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { API_URLS } from '@/config/api';
import { DatePickerPopover } from '@/components/DatePickerPopover';

const Statistik = () => {
  const [visitData, setVisitData] = useState<any[]>([]);
  const [diagnosisData, setDiagnosisData] = useState<any[]>([]);
  const [doctorData, setDoctorData] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Period filter states
  const [periodType, setPeriodType] = useState<string>('bulan-ini');
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [appliedPeriodType, setAppliedPeriodType] = useState<string>('bulan-ini');
  const [appliedCustomStartDate, setAppliedCustomStartDate] = useState<Date>();
  const [appliedCustomEndDate, setAppliedCustomEndDate] = useState<Date>();

  const getDateRange = (
    currentPeriodType: string = appliedPeriodType,
    currentCustomStartDate: Date | undefined = appliedCustomStartDate,
    currentCustomEndDate: Date | undefined = appliedCustomEndDate
  ) => {
    const now = new Date();
    let startDate: string;
    let endDate: string;

    switch (currentPeriodType) {
      case 'hari-ini':
        startDate = format(startOfDay(now), 'yyyy-MM-dd');
        endDate = format(endOfDay(now), 'yyyy-MM-dd');
        break;
      case 'minggu-ini':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        startDate = format(startOfDay(startOfWeek), 'yyyy-MM-dd');
        endDate = format(endOfDay(new Date()), 'yyyy-MM-dd');
        break;
      case 'bulan-ini':
        startDate = format(startOfMonth(now), 'yyyy-MM-dd');
        endDate = format(endOfMonth(now), 'yyyy-MM-dd');
        break;
      case 'tahun-ini':
        startDate = format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd');
        endDate = format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd');
        break;
      case 'custom':
        if (!currentCustomStartDate || !currentCustomEndDate) {
          startDate = format(startOfMonth(now), 'yyyy-MM-dd');
          endDate = format(endOfMonth(now), 'yyyy-MM-dd');
        } else {
          startDate = format(currentCustomStartDate, 'yyyy-MM-dd');
          endDate = format(currentCustomEndDate, 'yyyy-MM-dd');
        }
        break;
      default:
        startDate = format(startOfMonth(now), 'yyyy-MM-dd');
        endDate = format(endOfMonth(now), 'yyyy-MM-dd');
    }

    return { startDate, endDate };
  };

  const fetchStatistics = async (
    currentPeriodType: string = appliedPeriodType,
    currentCustomStartDate: Date | undefined = appliedCustomStartDate,
    currentCustomEndDate: Date | undefined = appliedCustomEndDate
  ) => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(currentPeriodType, currentCustomStartDate, currentCustomEndDate);
      const response = await fetch(API_URLS.STATISTICS_DATA, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          statisticType: 'overview',
          periodType: 'monthly',
          startDate,
          endDate,
          limit: 10
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || 'Gagal mengambil data statistik');
      }

      setVisitData(payload.data.visits || []);
      setDiagnosisData(payload.data.diagnosis || []);
      setDoctorData(payload.data.doctors || []);
      setSummaryData(payload.data.summary || null);

    } catch (error) {
      console.error('Error fetching statistics:', error);
      // Reset data on error
      setVisitData([]);
      setDiagnosisData([]);
      setDoctorData([]);
      setSummaryData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics(appliedPeriodType, appliedCustomStartDate, appliedCustomEndDate);
  }, [appliedPeriodType, appliedCustomStartDate, appliedCustomEndDate]);

  const handleApplyFilters = () => {
    setAppliedPeriodType(periodType);
    setAppliedCustomStartDate(customStartDate);
    setAppliedCustomEndDate(customEndDate);
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#ff00ff'];
  const rankedDoctorData = doctorData.map((doctor: any, index) => ({
    ...doctor,
    rank: index + 1,
    total_kinerja: (Number(doctor.rawat_jalan) || 0) + (Number(doctor.rawat_inap) || 0) + (Number(doctor.resep) || 0)
  }));
  const topDoctorChartData = rankedDoctorData.slice(0, 15);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 space-y-6 md:space-y-8 w-full mx-auto animate-fade-in shadow-md bg-white rounded-md">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Statistik</h1>
        <p className="text-muted-foreground">Dashboard analitik data medis</p>
      </div>

      {/* Period Filter */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filter Periode</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Periode</label>
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hari-ini">Hari Ini</SelectItem>
                  <SelectItem value="minggu-ini">Minggu Ini</SelectItem>
                  <SelectItem value="bulan-ini">Bulan Ini</SelectItem>
                  <SelectItem value="tahun-ini">Tahun Ini</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodType === 'custom' && (
              <>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium mb-2 block">Tanggal Mulai</label>
                  <DatePickerPopover
                    mode="single"
                    selected={customStartDate}
                    onSelect={setCustomStartDate}
                    displayValue={customStartDate ? format(customStartDate, "dd/MM/yyyy", { locale: id }) : undefined}
                  />
                </div>

                <div className="flex-1 min-w-[150px]">
                  <label className="text-sm font-medium mb-2 block">Tanggal Selesai</label>
                  <DatePickerPopover
                    mode="single"
                    selected={customEndDate}
                    onSelect={setCustomEndDate}
                    displayValue={customEndDate ? format(customEndDate, "dd/MM/yyyy", { locale: id }) : undefined}
                  />
                </div>
              </>
            )}

            <Button onClick={handleApplyFilters}>
              Terapkan Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summaryData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Total Kunjungan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {summaryData.totalVisits || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Rawat Jalan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-500">
                {summaryData.careTypes?.find((ct: any) => ct.status_lanjut === 'Ralan')?.count || 0}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Rawat Inap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">
                {summaryData.careTypes?.find((ct: any) => ct.status_lanjut === 'Ranap')?.count || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Dokter Aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-500">
                {summaryData.activeDoctors || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="visits" className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="visits">Kunjungan Pasien</TabsTrigger>
          <TabsTrigger value="diagnosis">Distribusi Diagnosis</TabsTrigger>
          <TabsTrigger value="doctors">Kinerja Dokter</TabsTrigger>
        </TabsList>
        
        <TabsContent value="visits">
          <Card>
            <CardHeader>
              <CardTitle>Statistik Kunjungan Pasien</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={visitData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="rawat_jalan" name="Rawat Jalan" fill="#82ca9d" />
                  <Bar dataKey="rawat_inap" name="Rawat Inap" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="diagnosis">
          <Card>
            <CardHeader>
              <CardTitle>Distribusi Diagnosis (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={diagnosisData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={150}
                    fill="#8884d8"
                    dataKey="total_cases"
                    label={({ nm_penyakit, percent }) => `${nm_penyakit} ${(percent * 100).toFixed(0)}%`}
                  >
                    {diagnosisData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="doctors">
          <Card>
            <CardHeader>
              <CardTitle>Kinerja Dokter</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Menampilkan grafik Top 15 dokter berdasarkan total kinerja. Tabel di bawah tetap memuat seluruh dokter yang valid.
              </div>
              <ResponsiveContainer width="100%" height={Math.max(420, topDoctorChartData.length * 36)}>
                <BarChart data={topDoctorChartData} layout="vertical" margin={{ left: 24, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="nm_dokter"
                    width={180}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip />
                  <Bar dataKey="total_kinerja" name="Total Kinerja" fill="#2563eb" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
              
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3">Detail Kinerja Dokter</h3>
                <div className="overflow-x-auto rounded-md border max-h-[520px]">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted sticky top-0">
                        <th className="p-3 text-left font-medium">Ranking</th>
                        <th className="p-3 text-left font-medium">Nama Dokter</th>
                        <th className="p-3 text-left font-medium">Total Kinerja</th>
                        <th className="p-3 text-left font-medium">Rawat Jalan</th>
                        <th className="p-3 text-left font-medium">Rawat Inap</th>
                        <th className="p-3 text-left font-medium">Resep</th>
                        <th className="p-3 text-left font-medium">Tingkat Bayar (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedDoctorData.map((doctor: any, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-3 font-medium">{doctor.rank}</td>
                          <td className="p-3">{doctor.nm_dokter}</td>
                          <td className="p-3">{doctor.total_kinerja}</td>
                          <td className="p-3">{doctor.rawat_jalan}</td>
                          <td className="p-3">{doctor.rawat_inap}</td>
                          <td className="p-3">{doctor.resep}</td>
                          <td className="p-3">{doctor.payment_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Statistik;
