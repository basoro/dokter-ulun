
import React from 'react';
import { Bell, FlaskConical, Loader2, Menu, Pill, Radio, Search, User, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { API_URLS } from '@/config/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import logoImg from '@/assets/logo.png'; // Add this import
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface HeaderProps {
  hospitalName: string;
  isMobile?: boolean;
  onMenuClick?: () => void;
  username?: string;
  doctorId?: string;
  onLogout?: () => void;
  onMedicalRecordSearchClick?: () => void;
}

interface DoctorNotificationItem {
  id: string;
  type: 'prescription' | 'laboratory' | 'radiology';
  title: string;
  status: 'menunggu' | 'diproses' | 'selesai';
  status_label: string;
  description: string;
  reference_id: string;
  no_rawat: string;
  no_rkm_medis: string;
  patient_name: string;
  created_at: string;
  sampled_at?: string;
  result_at?: string;
  processed_at?: string;
}

interface DoctorNotificationSummary {
  active: number;
  menunggu: number;
  diproses: number;
  selesai: number;
  prescription: number;
  laboratory: number;
  radiology: number;
}

type NotificationTab = 'prescription' | 'laboratory' | 'radiology';

const EMPTY_SUMMARY: DoctorNotificationSummary = {
  active: 0,
  menunggu: 0,
  diproses: 0,
  selesai: 0,
  prescription: 0,
  laboratory: 0,
  radiology: 0
};

const formatNotificationTime = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '-';
  }

  const parsedDate = new Date(normalized.replace(' ', 'T'));
  if (Number.isNaN(parsedDate.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsedDate);
};

const getNotificationTypeLabel = (type: DoctorNotificationItem['type']) => {
  switch (type) {
    case 'prescription':
      return 'Peresepan';
    case 'laboratory':
      return 'Lab';
    case 'radiology':
      return 'Radiologi';
    default:
      return 'Proses';
  }
};

const getNotificationTypeIcon = (type: DoctorNotificationItem['type']) => {
  switch (type) {
    case 'prescription':
      return Pill;
    case 'laboratory':
      return FlaskConical;
    case 'radiology':
      return Radio;
    default:
      return Bell;
  }
};

const getNotificationStatusClassName = (status: DoctorNotificationItem['status']) => {
  switch (status) {
    case 'menunggu':
      return 'bg-amber-100 text-amber-700';
    case 'diproses':
      return 'bg-blue-100 text-blue-700';
    case 'selesai':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const getTabLabel = (tab: NotificationTab) => {
  switch (tab) {
    case 'prescription':
      return 'Resep';
    case 'laboratory':
      return 'Lab';
    case 'radiology':
      return 'Rad';
    default:
      return '';
  }
};

const Header: React.FC<HeaderProps> = ({ 
  hospitalName, 
  isMobile = false, 
  onMenuClick,
  username,
  doctorId,
  onLogout,
  onMedicalRecordSearchClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationSummary, setNotificationSummary] = React.useState<DoctorNotificationSummary>(EMPTY_SUMMARY);
  const [notifications, setNotifications] = React.useState<DoctorNotificationItem[]>([]);
  const [notificationLoading, setNotificationLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<NotificationTab>('prescription');
  const previousActiveSignatureRef = React.useRef('');
  const hasLoadedNotificationsRef = React.useRef(false);
  const fetchNotificationsRef = React.useRef<((showLoading?: boolean) => Promise<void>) | null>(null);

  React.useEffect(() => {
    if (!doctorId) {
      setNotificationSummary(EMPTY_SUMMARY);
      setNotifications([]);
      return;
    }

    let isMounted = true;

    const fetchNotifications = async (showLoading = false) => {
      try {
        if (showLoading && isMounted) {
          setNotificationLoading(true);
        }

        const params = new URLSearchParams({
          doctorId,
          limit: '8'
        });
        const response = await fetch(`${API_URLS.DOCTOR_NOTIFICATIONS}?${params.toString()}`, {
          credentials: 'include'
        });
        const responseJson = await response.json();

        if (!response.ok || !responseJson?.success) {
          throw new Error(responseJson?.error || `HTTP error ${response.status}`);
        }

        if (!isMounted) {
          return;
        }

        const nextSummary = responseJson?.summary || EMPTY_SUMMARY;
        const nextNotifications = Array.isArray(responseJson?.data) ? responseJson.data : [];
        const nextActiveSignature = nextNotifications
          .filter((item: DoctorNotificationItem) => item.status !== 'selesai')
          .map((item: DoctorNotificationItem) => `${item.id}:${item.status}`)
          .join('|');

        if (
          hasLoadedNotificationsRef.current &&
          nextActiveSignature &&
          nextActiveSignature !== previousActiveSignatureRef.current
        ) {
          toast.info(`Ada pembaruan proses layanan: ${nextSummary.active} notifikasi aktif`, {
            description: 'Periksa proses resep, laboratorium, atau radiologi terbaru.'
          });
        }

        previousActiveSignatureRef.current = nextActiveSignature;
        hasLoadedNotificationsRef.current = true;
        setNotificationSummary(nextSummary);
        setNotifications(nextNotifications);
      } catch (error) {
        if (showLoading) {
          console.error('Error fetching doctor notifications:', error);
        }
      } finally {
        if (isMounted) {
          setNotificationLoading(false);
        }
      }
    };

    fetchNotificationsRef.current = fetchNotifications;

    void fetchNotifications(true);
    const intervalId = window.setInterval(() => {
      void fetchNotifications(false);
    }, 60000);

    return () => {
      isMounted = false;
      fetchNotificationsRef.current = null;
      window.clearInterval(intervalId);
    };
  }, [doctorId]);

  const handleOpenNotification = (item: DoctorNotificationItem) => {
    if (!item.no_rkm_medis) {
      return;
    }

    navigate(`/rekam-medik/${item.no_rkm_medis}`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  const notificationsByTab = React.useMemo<Record<NotificationTab, DoctorNotificationItem[]>>(() => ({
    prescription: notifications.filter((item) => item.type === 'prescription'),
    laboratory: notifications.filter((item) => item.type === 'laboratory'),
    radiology: notifications.filter((item) => item.type === 'radiology')
  }), [notifications]);

  const tabStats = React.useMemo<Record<NotificationTab, { total: number; menunggu: number; diproses: number; selesai: number; active: number }>>(() => {
    const buildStats = (items: DoctorNotificationItem[]) => ({
      total: items.length,
      menunggu: items.filter((item) => item.status === 'menunggu').length,
      diproses: items.filter((item) => item.status === 'diproses').length,
      selesai: items.filter((item) => item.status === 'selesai').length,
      active: items.filter((item) => item.status !== 'selesai').length
    });

    return {
      prescription: buildStats(notificationsByTab.prescription),
      laboratory: buildStats(notificationsByTab.laboratory),
      radiology: buildStats(notificationsByTab.radiology)
    };
  }, [notificationsByTab]);

  const renderNotificationList = (items: DoctorNotificationItem[], emptyMessage: string) => {
    if (items.length === 0) {
      return (
        <div className="px-3 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }

    return items.map((item) => {
      const TypeIcon = getNotificationTypeIcon(item.type);

      return (
        <React.Fragment key={item.id}>
          <DropdownMenuItem
            className="block rounded-md px-3 py-3 cursor-pointer"
            onClick={() => handleOpenNotification(item)}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
                <TypeIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.patient_name || 'Pasien'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getNotificationTypeLabel(item.type)} • {item.reference_id}
                    </p>
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold', getNotificationStatusClassName(item.status))}>
                    {item.status_label}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {item.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>No. RM {item.no_rkm_medis || '-'}</span>
                  <span>{formatNotificationTime(item.created_at)}</span>
                </div>
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
        </React.Fragment>
      );
    });
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-primary h-16 w-full shadow-md z-50">
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center">
          {isMobile && (
            <button 
              onClick={onMenuClick}
              className="mr-3 p-1.5 rounded-full text-white hover:bg-white/20 transition-colors"
              aria-label="Toggle navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <img 
            src={logoImg} 
            alt="Hospital Logo" 
            className="h-10 w-10 mr-3 object-contain"
          />          
          <h1 className="text-white font-bold text-base md:text-lg truncate">{hospitalName}</h1>
        </div>
        
        <div className="flex items-center space-x-3 md:space-x-4">
          <div className="relative hidden md:block">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-white/60" />
            </div>
            <button
              type="button"
              onClick={onMedicalRecordSearchClick}
              className="w-72 bg-white/10 text-left text-white/70 hover:bg-white/15 border-none rounded-full py-1.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
            >
              Cari rekam medis pasien...
            </button>
          </div>

          <button
            type="button"
            onClick={onMedicalRecordSearchClick}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors md:hidden"
            aria-label="Cari rekam medis pasien"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                aria-label="Notifikasi proses layanan"
              >
                {notificationLoading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Bell className="h-5 w-5 text-white" />
                )}
                {notificationSummary.active > 0 ? (
                  <span className="absolute -top-2 -right-2 min-w-[24px] h-6 px-1.5 bg-red-600 text-white text-xs leading-none font-extrabold rounded-full border-2 border-white shadow-md flex items-center justify-center z-10">
                    {notificationSummary.active > 99 ? '99+' : notificationSummary.active}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[360px] p-0">
              <div className="px-4 py-3 border-b">
                <div className="flex items-center justify-between gap-2">
                  <DropdownMenuLabel className="p-0">Notifikasi Proses</DropdownMenuLabel>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => void fetchNotificationsRef.current?.(true)}
                  >
                    Refresh
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pantau proses peresepan, laboratorium, dan radiologi pasien Anda.
                </p>
                <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  Total aktif: <span className="font-semibold">{notificationSummary.active}</span>
                </div>
              </div>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as NotificationTab)} className="w-full">
                <div className="px-2 pt-2">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="prescription" className="gap-2 text-xs">
                      Resep
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        {tabStats.prescription.active}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="laboratory" className="gap-2 text-xs">
                      Laboratorium
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        {tabStats.laboratory.active}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="radiology" className="gap-2 text-xs">
                      Radiologi
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        {tabStats.radiology.active}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {(['prescription', 'laboratory', 'radiology'] as NotificationTab[]).map((tab) => (
                  <TabsContent key={tab} value={tab} className="mt-0">
                    <div className="px-2 pb-2">
                      <div className="grid grid-cols-3 gap-2 px-2 py-2 text-xs">
                        <div className="rounded-md bg-amber-50 px-2 py-2 text-amber-700">
                          <div className="font-semibold">{tabStats[tab].menunggu}</div>
                          <div>Menunggu</div>
                        </div>
                        <div className="rounded-md bg-blue-50 px-2 py-2 text-blue-700">
                          <div className="font-semibold">{tabStats[tab].diproses}</div>
                          <div>Diproses</div>
                        </div>
                        <div className="rounded-md bg-emerald-50 px-2 py-2 text-emerald-700">
                          <div className="font-semibold">{tabStats[tab].selesai}</div>
                          <div>Selesai</div>
                        </div>
                      </div>
                      <div className="px-2 pb-1 text-[11px] text-muted-foreground">
                        {getTabLabel(tab)}: {tabStats[tab].total} item, {tabStats[tab].active} aktif
                      </div>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto p-2 pt-0">
                      {renderNotificationList(
                        notificationsByTab[tab],
                        `Belum ada notifikasi ${getTabLabel(tab).toLowerCase()}.`
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer">
                <div className="h-9 w-9 bg-white/20 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                {!isMobile && username && (
                  <div className="text-white text-sm hidden md:block">{username}</div>
                )}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-sm font-medium">
                {username || 'User'}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onLogout} className="text-red-500 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
