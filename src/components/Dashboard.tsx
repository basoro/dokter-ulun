
import React, { useState, useEffect } from 'react';
import StatCard from './StatCard';
import VisitChart from './VisitChart';
import PatientTable from './PatientTable';
import { User, Users, Calendar, ArrowUp, BarChart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { API_URLS } from '@/config/api';

interface DashboardData {
  stats: {
    totalPatients: number;
    monthlyPatients: number;
    monthlyPoliPatients: number;
    dailyPoliPatients: number;
  };
  chartData: Array<{ name: string; value: number }>;
  activePatients: Array<{ id: string; name: string; visits: number }>;
  queuePatients: Array<{ id: number; name: string; status: string; no_rawat?: string }>;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    stats: {
      totalPatients: 0,
      monthlyPatients: 0,
      monthlyPoliPatients: 0,
      dailyPoliPatients: 0,
    },
    chartData: [],
    activePatients: [],
    queuePatients: [],
  });
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.username) return;
      
      try {
        setLoading(true);
        
        // Use backend API instead of Supabase
        const response = await fetch(API_URLS.DASHBOARD_DATA, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            username: user.username,
            kd_poli: user.kd_poli // Use dynamic kd_poli from user context
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch dashboard data');
        }

        setDashboardData(data.data);
        
      } catch (error) {
        console.error('Dashboard data error:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengambil data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="p-2 md:p-6 space-y-6 md:space-y-8 w-full mx-auto animate-fade-in">
        <div className="mb-4 md:mb-8">
          <div className="flex items-center space-x-2 mb-2">
            <BarChart size={24} className="text-primary" />
            <h1 className="text-xl md:text-2xl font-bold uppercase text-gray-800">Dashboard Dokter</h1>
          </div>
          <p className="text-sm md:text-base text-gray-500">Memuat data...</p>
          <Separator className="mt-4" />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-md p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-2"></div>
              <div className="h-6 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 space-y-6 md:space-y-8 w-full mx-auto animate-fade-in">
      <div className="mb-4 md:mb-8">
        <div className="flex items-center space-x-2 mb-2">
          <BarChart size={24} className="text-primary" />
          <h1 className="text-xl md:text-2xl font-bold uppercase text-gray-800">Dashboard Dokter</h1>
        </div>
        <p className="text-sm md:text-base text-gray-500">Selamat datang kembali, selamat melayani pasien hari ini!</p>
        <Separator className="mt-4" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard 
          title="Total Pasien" 
          value={dashboardData.stats.totalPatients.toLocaleString('id-ID')} 
          icon={<Users size={24} color="white" />} 
          color="red" 
        />
        <StatCard 
          title="Bulan Ini" 
          value={dashboardData.stats.monthlyPatients.toLocaleString('id-ID')} 
          icon={<Calendar size={24} color="white" />} 
          color="blue" 
        />
        <StatCard 
          title="Poli Bulan Ini" 
          value={dashboardData.stats.monthlyPoliPatients.toLocaleString('id-ID')} 
          icon={<Users size={24} color="white" />} 
          color="green" 
        />
        <StatCard 
          title="Poli Hari Ini" 
          value={dashboardData.stats.dailyPoliPatients.toLocaleString('id-ID')} 
          icon={<User size={24} color="white" />} 
          color="orange" 
        />
      </div>
      
      <Card className="shadow-sm border-0">
        <CardContent className="p-0">
          <VisitChart 
            title="Poliklinik Hari Ini" 
            date={today}
            data={dashboardData.chartData}
          />
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <PatientTable 
          title="Pasien Paling Aktif" 
          patients={dashboardData.activePatients} 
          type="active" 
        />
        <PatientTable 
          title="Antrian 10 Pasien Terakhir" 
          patients={dashboardData.queuePatients} 
          type="queue" 
        />
      </div>
    </div>
  );
};

export default Dashboard;
