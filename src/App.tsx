
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, type Location } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Patients from "./pages/Patients";
import Presensi from "./pages/Presensi";
import BookingOperasi from "./pages/BookingOperasi";
import TarifINA from "./pages/TarifINA";
import MasterICD from "./pages/MasterICD";
import Statistik from "./pages/Statistik";
import Login from "./pages/Login";
import MedicalRecord from "./pages/MedicalRecord";
import MedicalRecordReadonly from "./pages/MedicalRecordReadonly";
import ClinicalPathway from "./pages/ClinicalPathway";
import StatisticsCare from "./pages/StatisticsCare";
import AIAssistant from "./pages/AIAssistant";
import Settings from "./pages/Settings";
import AuditHistory from "./pages/AuditHistory";
import Panduan from "./pages/Panduan";
import Sidebar from "./components/Sidebar";

// Helper function to format no_rawat
export const formatNoRawat = (noRawat: string) => {
  return noRawat.replace(/\//g, '');
};

// Helper function to unformat no_rawat
export const unformatNoRawat = (noRawat: string) => {
  return noRawat.replace(/\//g, '');
};
import Header from "./components/Header";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import MedicalRecordSearchModal from "./components/modals/MedicalRecordSearchModal";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import { API_URLS } from "./config/api";

const queryClient = new QueryClient();

// Custom hook to detect iPad and mobile devices
const useIsTabletOrMobile = () => {
  const [isTabletOrMobile, setIsTabletOrMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent;
      const isIPad = /iPad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isMobile = window.innerWidth < 768;
      setIsTabletOrMobile(isIPad || isMobile);
    };

    const handleResize = () => {
      checkDevice();
    };

    checkDevice();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return !!isTabletOrMobile;
};

const AppContent = () => {
  const [loading, setLoading] = React.useState(true);
  const isTabletOrMobile = useIsTabletOrMobile();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [medicalRecordSearchOpen, setMedicalRecordSearchOpen] = React.useState(false);
  const [canViewAuditHistory, setCanViewAuditHistory] = React.useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { backgroundLocation?: Location } | null;
  const backgroundLocation = routeState?.backgroundLocation;

  React.useEffect(() => {
    // Simulate loading delay for smooth transitions
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const username = String(user?.username || '').trim();
    if (!username || !isAuthenticated) {
      setCanViewAuditHistory(false);
      return;
    }

    const checkAuditAccess = async () => {
      try {
        const response = await fetch(`${API_URLS.AUDIT_HISTORY_ACCESS}/${encodeURIComponent(username)}`);
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result?.error || 'Gagal memeriksa akses riwayat audit');
        }

        setCanViewAuditHistory(Boolean(result?.can_access));
      } catch {
        setCanViewAuditHistory(false);
      }
    };

    void checkAuditAccess();
  }, [isAuthenticated, user?.username]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl font-bold">
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 pt-16">
      <Header 
        hospitalName="RSUD H. DAMANHURI" 
        onMenuClick={() => setSidebarOpen(true)}
        isMobile={isTabletOrMobile}
        username={user?.name}
        doctorId={user?.username}
        onLogout={logout}
        onMedicalRecordSearchClick={() => setMedicalRecordSearchOpen(true)}
      />
      
      <div className="flex flex-1 w-full">
        {!isTabletOrMobile && (
          <div className="w-64 shrink-0">
            <Sidebar 
              doctorName={user?.name || ""} 
              doctorId={user?.username || ""}
              gender={user?.jk || "L"}
              canViewAuditHistory={canViewAuditHistory}
              onLogout={logout}
            />
          </div>
        )}
        
        <div className="flex-1 p-2 sm:p-4 overflow-auto">
          <Routes location={backgroundLocation || location}>
            <Route path="/" element={<Index />} />
            <Route path="/pasien" element={<Patients />} />
            <Route path="/pasien/booking" element={<Patients />} />
            <Route path="/pasien/igd" element={<Patients />} />
            <Route path="/pasien/rawat-jalan" element={<Patients />} />
            <Route path="/pasien/rawat-inap" element={<Patients />} />
            <Route path="/pasien/hemodialisa" element={<Patients />} />
            <Route path="/presensi" element={<Presensi />} />
            <Route path="/booking" element={<BookingOperasi />} />
            <Route path="/tarif" element={<TarifINA />} />
            <Route path="/icd" element={<MasterICD />} />
            <Route path="/statistik" element={<Statistik />} />
            <Route path="/statistik/rawat-jalan" element={<StatisticsCare mode="rawat-jalan" />} />
            <Route path="/statistik/rawat-inap" element={<StatisticsCare mode="rawat-inap" />} />
            <Route path="/signature" element={<Index />} />
            <Route path="/srq" element={<Index />} />
            <Route path="/ebook" element={<Index />} />
            <Route path="/icd10" element={<MasterICD />} />
            <Route path="/icd9" element={<MasterICD />} />
            <Route path="/igd" element={<Index />} />
            <Route path="/ai-assistant" element={<AIAssistant />} />
            <Route path="/panduan" element={<Panduan />} />
            <Route path="/riwayat-audit" element={<AuditHistory />} />
            <Route path="/pengaturan" element={<Settings />} />
            <Route path="/rekam-medik" element={<MedicalRecord />} />
            <Route path="/rekam-medik/:no_rkm_medis" element={<MedicalRecordReadonly />} />
            <Route path="/rekam-medik/:no_rkm_medis/:no_rawat" element={<MedicalRecord />} />
            <Route path="/clinical-pathway" element={<ClinicalPathway />} />
            <Route path="/clinical-pathway/:no_rkm_medis/:no_rawat" element={<ClinicalPathway />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        
        {isTabletOrMobile && (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="p-0 w-64 [&>button]:hidden">
              <Sidebar 
                doctorName={user?.name || ""} 
                doctorId={user?.username || ""} 
                gender={user?.jk || "L"}
                canViewAuditHistory={canViewAuditHistory}
                onClose={() => setSidebarOpen(false)}
                onLogout={logout}
              />
            </SheetContent>
          </Sheet>
        )}

        {backgroundLocation && (
          <Routes>
            <Route
              path="/rekam-medik/:no_rkm_medis"
              element={<MedicalRecordReadonly asModal onClose={() => navigate(-1)} />}
            />
          </Routes>
        )}
      </div>

      <MedicalRecordSearchModal
        open={medicalRecordSearchOpen}
        onOpenChange={setMedicalRecordSearchOpen}
      />
      <PwaInstallPrompt />
    </div>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
