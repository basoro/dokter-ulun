
import React from 'react';
import { Bell, BellOff, BellRing, FlaskConical, Loader2, Menu, Moon, Pill, Radio, Search, Settings as SettingsIcon, ShieldAlert, Sun, User, LogOut } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { API_URLS } from '@/config/api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import logoImg from '@/assets/logo.png'; // Add this import
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatUIDateTime } from '@/lib/date-utils';
import {
  NOTIFICATION_PREFERENCES_CHANGED_EVENT,
  type NotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences
} from '@/lib/notification-preferences';
import { useTheme } from 'next-themes';

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
  type: 'prescription' | 'laboratory' | 'radiology' | 'auto_stop_order';
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
  end_at?: string;
  created_by?: string;
}

interface NotificationLabResult {
  tanggal: string;
  no_rawat: string;
  lab_type?: string;
  pemeriksaan: Array<{
    nama?: string;
    pemeriksaan?: string;
    hasil?: string;
    rujukan?: string;
    keterangan?: string;
  }>;
}

interface NotificationRadiologyResult {
  tanggal: string;
  no_rawat: string;
  pemeriksaan: string;
  judul?: string;
  hasil?: string;
  saran?: string;
  kesan?: string;
}

interface DoctorNotificationSummary {
  active: number;
  menunggu: number;
  diproses: number;
  selesai: number;
  prescription: number;
  laboratory: number;
  radiology: number;
  auto_stop_order: number;
}

type NotificationTab = 'prescription' | 'laboratory' | 'radiology' | 'auto_stop_order';
type NotificationFilter = 'all' | 'active' | 'ready';

const formatNotificationTime = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '-';
  }

  return formatUIDateTime(normalized);
};

const getNotificationTypeLabel = (type: DoctorNotificationItem['type']) => {
  switch (type) {
    case 'prescription':
      return 'Peresepan';
    case 'laboratory':
      return 'Lab';
    case 'radiology':
      return 'Radiologi';
    case 'auto_stop_order':
      return 'Stop Order';
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
    case 'auto_stop_order':
      return ShieldAlert;
    default:
      return Bell;
  }
};

const getNotificationStatusClassName = (status: DoctorNotificationItem['status']) => {
  switch (status) {
    case 'menunggu':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
    case 'diproses':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300';
    case 'selesai':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300';
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
    case 'auto_stop_order':
      return 'Stop Order';
    default:
      return '';
  }
};

const getReadyFilterLabel = (tab: NotificationTab) => {
  return tab === 'prescription' ? 'Selesai' : 'Hasil Siap';
};

const isResultReadyNotification = (item: DoctorNotificationItem) =>
  (item.type === 'laboratory' || item.type === 'radiology') && item.status === 'selesai';

const getNotificationPriorityScore = (item: DoctorNotificationItem) => {
  if (item.type === 'auto_stop_order') {
    return 500;
  }

  if (isResultReadyNotification(item)) {
    return 400;
  }

  if (item.status === 'menunggu') {
    return item.type === 'prescription' ? 320 : 300;
  }

  if (item.status === 'diproses') {
    return item.type === 'prescription' ? 230 : 220;
  }

  return item.type === 'prescription' ? 120 : 140;
};

const getNotificationPriorityLabel = (item: DoctorNotificationItem) => {
  if (item.type === 'auto_stop_order') {
    return 'Stop Order';
  }

  if (isResultReadyNotification(item)) {
    return 'Hasil Siap';
  }

  if (item.status === 'menunggu') {
    return 'Prioritas';
  }

  if (item.status === 'diproses') {
    return 'Dipantau';
  }

  return '';
};

const sortNotificationsByPriority = (items: DoctorNotificationItem[]) => {
  return [...items].sort((left, right) => {
    const priorityGap = getNotificationPriorityScore(right) - getNotificationPriorityScore(left);
    if (priorityGap !== 0) {
      return priorityGap;
    }

    return new Date(right.result_at || right.processed_at || right.created_at || 0).getTime()
      - new Date(left.result_at || left.processed_at || left.created_at || 0).getTime();
  });
};

const getNotificationAccentClassName = (item: DoctorNotificationItem) => {
  if (item.type === 'auto_stop_order') {
    return 'border-rose-200 bg-rose-50/70 hover:bg-rose-100/70 focus:bg-rose-100/70 dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/15 dark:focus:bg-rose-500/15';
  }

  if (isResultReadyNotification(item)) {
    return 'border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 focus:bg-emerald-100/70 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15 dark:focus:bg-emerald-500/15';
  }

  if (item.status === 'menunggu') {
    return 'border-amber-200 bg-amber-50/60 hover:bg-amber-100/70 focus:bg-amber-100/70 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15 dark:focus:bg-amber-500/15';
  }

  if (item.status === 'diproses') {
    return 'border-blue-200 bg-blue-50/60 hover:bg-blue-100/70 focus:bg-blue-100/70 dark:border-blue-500/30 dark:bg-blue-500/10 dark:hover:bg-blue-500/15 dark:focus:bg-blue-500/15';
  }

  return 'border-transparent';
};

const getNotificationTimeText = (item: DoctorNotificationItem) => {
  if (isResultReadyNotification(item)) {
    return `Hasil ${formatNotificationTime(item.result_at || item.created_at)}`;
  }

  if (item.status === 'diproses' && (item.sampled_at || item.processed_at)) {
    return `Diproses ${formatNotificationTime(item.sampled_at || item.processed_at)}`;
  }

  return `Masuk ${formatNotificationTime(item.created_at)}`;
};

const filterNotifications = (
  items: DoctorNotificationItem[],
  filter: NotificationFilter,
  tab: NotificationTab
) => {
  if (filter === 'active') {
    return items.filter((item) => item.status !== 'selesai');
  }

  if (filter === 'ready') {
    if (tab === 'prescription') {
      return items.filter((item) => item.status === 'selesai');
    }

    return items.filter((item) => isResultReadyNotification(item));
  }

  return items;
};

const buildNotificationSummary = (items: DoctorNotificationItem[]): DoctorNotificationSummary => ({
  active: items.filter((item) => item.status !== 'selesai').length,
  menunggu: items.filter((item) => item.status === 'menunggu').length,
  diproses: items.filter((item) => item.status === 'diproses').length,
  selesai: items.filter((item) => item.status === 'selesai').length,
  prescription: items.filter((item) => item.type === 'prescription' && item.status !== 'selesai').length,
  laboratory: items.filter((item) => item.type === 'laboratory' && item.status !== 'selesai').length,
  radiology: items.filter((item) => item.type === 'radiology' && item.status !== 'selesai').length,
  auto_stop_order: items.filter((item) => item.type === 'auto_stop_order').length
});

const getNotificationResultTimestamp = (value?: string) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 0;
  }

  const parsedDate = new Date(normalized);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getTime();
  }

  const fallbackDate = new Date(normalized.replace(/Z$/, '').replace(' ', 'T'));
  return Number.isNaN(fallbackDate.getTime()) ? 0 : fallbackDate.getTime();
};

const flattenNotificationLabResults = (payload: any, noRawat: string): NotificationLabResult[] => {
  return [...(payload?.ralan || []), ...(payload?.ranap || [])]
    .map((record: any, index: number) => ({
      tanggal: String(record?.tanggal || '').trim(),
      no_rawat: String(record?.no_rawat || noRawat || '').trim(),
      lab_type: String(record?.lab_type || '').trim(),
      pemeriksaan: Array.isArray(record?.pemeriksaan) ? record.pemeriksaan : [],
      __timestamp: getNotificationResultTimestamp(record?.tanggal),
      __index: index
    }))
    .sort((left, right) => {
      if (right.__timestamp !== left.__timestamp) {
        return right.__timestamp - left.__timestamp;
      }

      return left.__index - right.__index;
    })
    .map(({ __timestamp, __index, ...item }) => item);
};

const flattenNotificationRadiologyResults = (payload: any, noRawat: string): NotificationRadiologyResult[] => {
  return [...(payload?.ralan || []), ...(payload?.ranap || [])]
    .map((record: any, index: number) => ({
      tanggal: String(record?.tanggal || '').trim(),
      no_rawat: String(record?.no_rawat || noRawat || '').trim(),
      pemeriksaan: String(record?.pemeriksaan || '').trim(),
      judul: String(record?.judul || '').trim(),
      hasil: String(record?.hasil || '').trim(),
      saran: String(record?.saran || '').trim(),
      kesan: String(record?.kesan || '').trim(),
      __timestamp: getNotificationResultTimestamp(record?.tanggal),
      __index: index
    }))
    .sort((left, right) => {
      if (right.__timestamp !== left.__timestamp) {
        return right.__timestamp - left.__timestamp;
      }

      return left.__index - right.__index;
    })
    .map(({ __timestamp, __index, ...item }) => item);
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
  const { resolvedTheme, setTheme } = useTheme();
  const [notifications, setNotifications] = React.useState<DoctorNotificationItem[]>([]);
  const [notificationLoading, setNotificationLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<NotificationTab>('prescription');
  const [tabFilters, setTabFilters] = React.useState<Record<NotificationTab, NotificationFilter>>({
    prescription: 'all',
    laboratory: 'all',
    radiology: 'all',
    auto_stop_order: 'all'
  });
  const [notificationPreferences, setNotificationPreferences] = React.useState<NotificationPreferences>(() => loadNotificationPreferences());
  const previousActiveSignatureRef = React.useRef('');
  const previousResultReadySignatureRef = React.useRef('');
  const previousStopOrderSignatureRef = React.useRef('');
  const hasLoadedNotificationsRef = React.useRef(false);
  const fetchNotificationsRef = React.useRef<((showLoading?: boolean) => Promise<void>) | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const [notificationResultItem, setNotificationResultItem] = React.useState<DoctorNotificationItem | null>(null);
  const [notificationResultOpen, setNotificationResultOpen] = React.useState(false);
  const [notificationResultLoading, setNotificationResultLoading] = React.useState(false);
  const [notificationResultError, setNotificationResultError] = React.useState('');
  const [notificationLabResults, setNotificationLabResults] = React.useState<NotificationLabResult[]>([]);
  const [notificationRadiologyResults, setNotificationRadiologyResults] = React.useState<NotificationRadiologyResult[]>([]);
  const [themeReady, setThemeReady] = React.useState(false);
  const soundEnabled = notificationPreferences.sound;
  const isDarkMode = resolvedTheme === 'dark';

  React.useEffect(() => {
    setThemeReady(true);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePreferencesChanged = (event: Event) => {
      const customEvent = event as CustomEvent<NotificationPreferences | undefined>;
      setNotificationPreferences(customEvent.detail || loadNotificationPreferences());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key) {
        setNotificationPreferences(loadNotificationPreferences());
      }
    };

    window.addEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, handlePreferencesChanged as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(NOTIFICATION_PREFERENCES_CHANGED_EVENT, handlePreferencesChanged as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const playNotificationSound = React.useCallback((variant: 'update' | 'lab-ready' | 'radiology-ready' | 'stop-order') => {
    if (!soundEnabled || typeof window === 'undefined') {
      return;
    }

    try {
      const audioWindow = window as Window & typeof globalThis & {
        webkitAudioContext?: typeof AudioContext;
      };
      const AudioContextCtor = window.AudioContext || audioWindow.webkitAudioContext;

      if (!AudioContextCtor) {
        return;
      }

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextCtor();
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        void context.resume();
      }

      const tones =
        variant === 'lab-ready'
          ? [880, 1174]
          : variant === 'radiology-ready'
            ? [740, 988]
            : variant === 'stop-order'
              ? [523, 659, 523]
              : [659, 784];
      const startAt = context.currentTime + 0.02;

      tones.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, startAt + index * 0.18);

        gainNode.gain.setValueAtTime(0.001, startAt + index * 0.18);
        gainNode.gain.exponentialRampToValueAtTime(0.08, startAt + index * 0.18 + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + index * 0.18 + 0.16);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);

        oscillator.start(startAt + index * 0.18);
        oscillator.stop(startAt + index * 0.18 + 0.18);
      });
    } catch (error) {
      console.error('Unable to play notification sound:', error);
    }
  }, [soundEnabled]);

  React.useEffect(() => {
    if (!doctorId) {
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

        const nextNotifications = Array.isArray(responseJson?.data) ? responseJson.data : [];
        const effectiveNextNotifications = nextNotifications.filter((item: DoctorNotificationItem) => notificationPreferences[item.type]);
        const nextSummary = buildNotificationSummary(effectiveNextNotifications);
        const nextActiveSignature = effectiveNextNotifications
          .filter((item: DoctorNotificationItem) => item.status !== 'selesai')
          .map((item: DoctorNotificationItem) => `${item.id}:${item.status}`)
          .join('|');
        const nextResultReadySignature = effectiveNextNotifications
          .filter((item: DoctorNotificationItem) => isResultReadyNotification(item))
          .map((item: DoctorNotificationItem) => `${item.id}:${item.result_at || item.created_at}`)
          .join('|');
        const readyItems = effectiveNextNotifications.filter((item: DoctorNotificationItem) => isResultReadyNotification(item));
        const latestReadyItem = readyItems[0];
        const nextStopOrderSignature = effectiveNextNotifications
          .filter((item: DoctorNotificationItem) => item.type === 'auto_stop_order')
          .map((item: DoctorNotificationItem) => `${item.id}:${item.no_rawat}:${item.end_at || item.created_at}`)
          .join('|');
        const stopOrderItems = effectiveNextNotifications.filter((item: DoctorNotificationItem) => item.type === 'auto_stop_order');
        const latestStopOrderItem = stopOrderItems[0];

        const hasNewStopOrder =
          hasLoadedNotificationsRef.current &&
          nextStopOrderSignature &&
          nextStopOrderSignature !== previousStopOrderSignatureRef.current &&
          !previousStopOrderSignatureRef.current.includes(latestStopOrderItem?.id || '__none__');

        const hasNewResultReady =
          hasLoadedNotificationsRef.current &&
          nextResultReadySignature &&
          nextResultReadySignature !== previousResultReadySignatureRef.current;

        if (hasNewResultReady) {
          const completedResults = nextNotifications.filter((item: DoctorNotificationItem) => isResultReadyNotification(item)).length;
          const nextPreferredTab = latestReadyItem?.type === 'radiology' ? 'radiology' : 'laboratory';
          toast.success(`Ada ${completedResults} hasil pemeriksaan siap dibaca`, {
            description: 'Periksa tab Laboratorium atau Radiologi untuk hasil terbaru.'
          });
          setActiveTab(nextPreferredTab);
          setTabFilters((previous) => ({
            ...previous,
            [nextPreferredTab]: 'ready'
          }));
          playNotificationSound(latestReadyItem?.type === 'radiology' ? 'radiology-ready' : 'lab-ready');
        } else if (hasNewStopOrder) {
          const stopOrderCount = stopOrderItems.length;
          toast.warning(`Ada ${stopOrderCount} automatic stop order untuk pasien Anda`, {
            description: `Obat: ${latestStopOrderItem?.description || '-'} • No. RM ${latestStopOrderItem?.no_rkm_medis || '-'}`
          });
          setActiveTab('auto_stop_order');
          playNotificationSound('stop-order');
        } else if (
          hasLoadedNotificationsRef.current &&
          nextActiveSignature &&
          nextActiveSignature !== previousActiveSignatureRef.current
        ) {
          toast.info(`Ada pembaruan proses layanan: ${nextSummary.active} notifikasi aktif`, {
            description: 'Periksa proses resep, laboratorium, atau radiologi terbaru.'
          });
          playNotificationSound('update');
        }

        previousActiveSignatureRef.current = nextActiveSignature;
        previousResultReadySignatureRef.current = nextResultReadySignature;
        previousStopOrderSignatureRef.current = nextStopOrderSignature;
        hasLoadedNotificationsRef.current = true;
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
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      window.clearInterval(intervalId);
    };
  }, [doctorId, notificationPreferences, playNotificationSound]);

  const effectiveNotifications = React.useMemo(
    () => notifications.filter((item) => notificationPreferences[item.type]),
    [notificationPreferences, notifications]
  );

  const notificationSummary = React.useMemo(
    () => buildNotificationSummary(effectiveNotifications),
    [effectiveNotifications]
  );

  const handleOpenNotification = (item: DoctorNotificationItem) => {
    if (item.type === 'auto_stop_order') {
      if (item.no_rkm_medis) {
        navigate(`/rekam-medik/${item.no_rkm_medis}`, {
          state: {
            backgroundLocation: location
          }
        });
      }
      return;
    }

    if (item.type === 'laboratory' || item.type === 'radiology') {
      setNotificationResultItem(item);
      setNotificationResultOpen(true);
      return;
    }

    if (!item.no_rkm_medis) {
      return;
    }

    navigate(`/rekam-medik/${item.no_rkm_medis}`, {
      state: {
        backgroundLocation: location
      }
    });
  };

  React.useEffect(() => {
    if (!notificationResultOpen || !notificationResultItem) {
      return;
    }

    if (notificationResultItem.type !== 'laboratory' && notificationResultItem.type !== 'radiology') {
      return;
    }

    let isMounted = true;

    const fetchNotificationResult = async () => {
      try {
        setNotificationResultLoading(true);
        setNotificationResultError('');
        setNotificationLabResults([]);
        setNotificationRadiologyResults([]);

        const params = new URLSearchParams({
          type: notificationResultItem.type,
          reference_id: notificationResultItem.reference_id
        });
        const response = await fetch(`${API_URLS.DOCTOR_NOTIFICATION_RESULT}?${params.toString()}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const responseJson = await response.json();
        if (responseJson?.success === false) {
          throw new Error(responseJson?.error || 'Gagal memuat hasil pemeriksaan dari notifikasi.');
        }

        const responseData = responseJson?.data;

        if (!isMounted) {
          return;
        }

        if (notificationResultItem.type === 'laboratory') {
          setNotificationLabResults(Array.isArray(responseData?.results) ? responseData.results : []);
        } else {
          setNotificationRadiologyResults(Array.isArray(responseData?.results) ? responseData.results : []);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setNotificationResultError(
          error instanceof Error ? error.message : 'Gagal memuat hasil pemeriksaan dari notifikasi.'
        );
      } finally {
        if (isMounted) {
          setNotificationResultLoading(false);
        }
      }
    };

    void fetchNotificationResult();

    return () => {
      isMounted = false;
    };
  }, [notificationResultItem, notificationResultOpen]);

  const notificationsByTab = React.useMemo<Record<NotificationTab, DoctorNotificationItem[]>>(() => ({
    prescription: sortNotificationsByPriority(effectiveNotifications.filter((item) => item.type === 'prescription')),
    laboratory: sortNotificationsByPriority(effectiveNotifications.filter((item) => item.type === 'laboratory')),
    radiology: sortNotificationsByPriority(effectiveNotifications.filter((item) => item.type === 'radiology')),
    auto_stop_order: sortNotificationsByPriority(effectiveNotifications.filter((item) => item.type === 'auto_stop_order'))
  }), [effectiveNotifications]);

  const filteredNotificationsByTab = React.useMemo<Record<NotificationTab, DoctorNotificationItem[]>>(() => ({
    prescription: filterNotifications(notificationsByTab.prescription, tabFilters.prescription, 'prescription'),
    laboratory: filterNotifications(notificationsByTab.laboratory, tabFilters.laboratory, 'laboratory'),
    radiology: filterNotifications(notificationsByTab.radiology, tabFilters.radiology, 'radiology'),
    auto_stop_order: filterNotifications(notificationsByTab.auto_stop_order, tabFilters.auto_stop_order, 'auto_stop_order')
  }), [notificationsByTab, tabFilters]);

  const tabStats = React.useMemo<Record<NotificationTab, { total: number; menunggu: number; diproses: number; selesai: number; active: number; readyResults: number }>>(() => {
    const buildStats = (items: DoctorNotificationItem[]) => ({
      total: items.length,
      menunggu: items.filter((item) => item.status === 'menunggu').length,
      diproses: items.filter((item) => item.status === 'diproses').length,
      selesai: items.filter((item) => item.status === 'selesai').length,
      active: items.filter((item) => item.status !== 'selesai').length,
      readyResults: items.filter((item) => isResultReadyNotification(item)).length
    });

    return {
      prescription: buildStats(notificationsByTab.prescription),
      laboratory: buildStats(notificationsByTab.laboratory),
      radiology: buildStats(notificationsByTab.radiology),
      auto_stop_order: buildStats(notificationsByTab.auto_stop_order)
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

    return items.flatMap((item, index) => {
      const TypeIcon = getNotificationTypeIcon(item.type);
      const priorityLabel = getNotificationPriorityLabel(item);
      const isResultReady = isResultReadyNotification(item);
      const isStopOrder = item.type === 'auto_stop_order';

      return [
        <DropdownMenuItem
          key={item.id}
          className={cn(
            'block rounded-md border px-3 py-3 cursor-pointer',
            getNotificationAccentClassName(item)
          )}
          onClick={() => handleOpenNotification(item)}
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'mt-0.5 rounded-full p-2',
              isStopOrder ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300' : 'bg-primary/10 text-primary'
            )}>
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
              {priorityLabel ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={cn(
                    'rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide',
                    isResultReady
                      ? 'bg-emerald-600 text-white'
                      : isStopOrder
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-800 text-white'
                  )}>
                    {priorityLabel}
                  </span>
                  {isResultReady ? (
                    <span className="text-[11px] font-medium text-emerald-700">
                      Hasil pemeriksaan sudah tersedia
                    </span>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {item.description}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>No. RM {item.no_rkm_medis || '-'}</span>
                {isStopOrder && item.end_at ? (
                  <span className="font-semibold text-rose-600 dark:text-rose-300">
                    Tgl. Berakhir {formatNotificationTime(item.end_at)}
                  </span>
                ) : (
                  <span>{getNotificationTimeText(item)}</span>
                )}
              </div>
            </div>
          </div>
        </DropdownMenuItem>,
        index < items.length - 1 ? <DropdownMenuSeparator key={`${item.id}-separator`} /> : null
      ];
    });
  };

  const renderNotificationResultContent = () => {
    if (notificationResultLoading) {
      return (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat hasil pemeriksaan...
        </div>
      );
    }

    if (notificationResultError) {
      return (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {notificationResultError}
        </div>
      );
    }

    if (notificationResultItem?.type === 'laboratory') {
      if (notificationLabResults.length === 0) {
        return (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada hasil laboratorium yang tersedia untuk pasien ini.
          </div>
        );
      }

      return (
        <div className="space-y-4">
          {notificationLabResults.map((labResult, index) => {
            const groupedTests = labResult.pemeriksaan.reduce((groups, test) => {
              const key = String(test?.nama || '-').trim() || '-';
              if (!groups[key]) {
                groups[key] = [];
              }
              groups[key].push(test);
              return groups;
            }, {} as Record<string, NotificationLabResult['pemeriksaan']>);

            return (
              <div key={`${labResult.no_rawat}-${labResult.tanggal}-${index}`} className="rounded-lg border p-4">
                <div className="mb-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Tanggal Hasil</p>
                    <p className="font-medium">{formatNotificationTime(labResult.tanggal)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">No. Rawat</p>
                    <p className="font-medium">{labResult.no_rawat || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Jenis Lab</p>
                    <p className="font-medium uppercase">{labResult.lab_type || 'pk'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(groupedTests).map(([groupName, tests]) => (
                    <div key={groupName} className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-3 font-semibold">{groupName}</p>
                      <div className="space-y-2">
                        {tests.map((test, testIndex) => (
                          <div
                            key={`${groupName}-${testIndex}`}
                            className={cn(
                              'grid gap-4 rounded-r border-l-2 border-primary bg-background px-3 py-2 md:grid-cols-4',
                              test.keterangan === 'H' && 'bg-red-100 text-red-900 dark:bg-red-500/10 dark:text-red-100',
                              test.keterangan === 'L' && 'bg-yellow-100 text-yellow-900 dark:bg-yellow-500/10 dark:text-yellow-100'
                            )}
                          >
                            <div>
                              <p className="text-xs text-muted-foreground">Pemeriksaan</p>
                              <p className="font-medium">{test.pemeriksaan || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Hasil</p>
                              <p className="font-medium">{test.hasil || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Rujukan</p>
                              <p className="font-medium">{test.rujukan || '-'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Keterangan</p>
                              <p className="font-medium">{test.keterangan || '-'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (notificationResultItem?.type === 'radiology') {
      if (notificationRadiologyResults.length === 0) {
        return (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada hasil radiologi yang tersedia untuk pasien ini.
          </div>
        );
      }

      return (
        <div className="space-y-4">
          {notificationRadiologyResults.map((radiologyResult, index) => (
            <div key={`${radiologyResult.no_rawat}-${radiologyResult.tanggal}-${index}`} className="rounded-lg border p-4">
              <div className="mb-4 grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Tanggal Hasil</p>
                  <p className="font-medium">{formatNotificationTime(radiologyResult.tanggal)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">No. Rawat</p>
                  <p className="font-medium">{radiologyResult.no_rawat || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pemeriksaan</p>
                  <p className="font-medium">{radiologyResult.judul || radiologyResult.pemeriksaan || '-'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Hasil</p>
                  <p className="whitespace-pre-wrap font-medium break-words">{radiologyResult.hasil || '-'}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Kesan</p>
                    <p className="whitespace-pre-wrap font-medium break-words">{radiologyResult.kesan || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Saran</p>
                    <p className="whitespace-pre-wrap font-medium break-words">{radiologyResult.saran || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        Belum ada hasil pemeriksaan yang bisa ditampilkan.
      </div>
    );
  };

  return (
    <>
    <header className="fixed left-0 right-0 top-0 z-50 h-16 w-full border-b border-white/10 bg-primary/95 shadow-md backdrop-blur dark:border-white/10 dark:bg-[#12151b]/95">
      <div className="h-full flex items-center justify-between px-4 md:px-6">
        <div className="flex items-center">
          {isMobile && (
            <button 
              onClick={onMenuClick}
              className="mr-3 rounded-full p-1.5 text-white transition-colors hover:bg-white/20 dark:hover:bg-white/8"
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
              className="w-72 rounded-full border-none bg-white/10 py-1.5 pl-10 pr-4 text-left text-sm text-white/70 transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/20 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:bg-white/[0.08]"
            >
              Cari rekam medis pasien...
            </button>
          </div>

          <button
            type="button"
            onClick={onMedicalRecordSearchClick}
            className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] md:hidden"
            aria-label="Cari rekam medis pasien"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]"
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
              <div className="border-b px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <DropdownMenuLabel className="p-0">Notifikasi Proses</DropdownMenuLabel>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        const nextPreferences = {
                          ...notificationPreferences,
                          sound: !notificationPreferences.sound
                        };
                        setNotificationPreferences(nextPreferences);
                        saveNotificationPreferences(nextPreferences);
                      }}
                      aria-label={soundEnabled ? 'Matikan suara notifikasi' : 'Aktifkan suara notifikasi'}
                    >
                      {soundEnabled ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                    </Button>
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
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pantau proses peresepan, laboratorium, dan radiologi pasien Anda.
                </p>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-[#1a1f27] dark:text-slate-300">
                  <span>
                    Total aktif: <span className="font-semibold">{notificationSummary.active}</span>
                  </span>
                  <span className={cn(
                    'rounded-full px-2 py-1 font-semibold',
                    soundEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  )}>
                    {soundEnabled ? 'Suara ON' : 'Suara OFF'}
                  </span>
                </div>
              </div>
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as NotificationTab)} className="w-full">
                <div className="px-2 pt-2">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="prescription" className="gap-2 text-xs">
                      Resep
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        {tabStats.prescription.active}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="laboratory" className="gap-2 text-xs">
                      Lab
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        {tabStats.laboratory.active}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="radiology" className="gap-2 text-xs">
                      Rad
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
                        {tabStats.radiology.active}
                      </span>
                    </TabsTrigger>
                    <TabsTrigger value="auto_stop_order" className="gap-2 text-xs">
                      Stop Order
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[10px]',
                        tabStats.auto_stop_order.active > 0 ? 'bg-rose-500 text-white' : 'bg-muted'
                      )}>
                        {tabStats.auto_stop_order.active}
                      </span>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {(['prescription', 'laboratory', 'radiology', 'auto_stop_order'] as NotificationTab[]).map((tab) => (
                  <TabsContent key={tab} value={tab} className="mt-0">
                    <div className="px-2 pb-2">
                      <div className="grid grid-cols-3 gap-2 px-2 py-2 text-xs">
                        <div className="rounded-md bg-amber-50 px-2 py-2 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                          <div className="font-semibold">{tabStats[tab].menunggu}</div>
                          <div>Menunggu</div>
                        </div>
                        <div className="rounded-md bg-blue-50 px-2 py-2 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                          <div className="font-semibold">{tabStats[tab].diproses}</div>
                          <div>Diproses</div>
                        </div>
                        <div className="rounded-md bg-emerald-50 px-2 py-2 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          <div className="font-semibold">{tabStats[tab].selesai}</div>
                          <div>Selesai</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-2 pb-1 text-[11px] text-muted-foreground">
                        <span>
                          {getTabLabel(tab)}: {tabStats[tab].total} item, {tabStats[tab].active} aktif
                        </span>
                        {(tab === 'laboratory' || tab === 'radiology') && tabStats[tab].readyResults > 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                            Hasil siap: {tabStats[tab].readyResults}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 px-2 pb-2">
                        <Button
                          type="button"
                          variant={tabFilters[tab] === 'all' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => setTabFilters((previous) => ({ ...previous, [tab]: 'all' }))}
                        >
                          Semua
                        </Button>
                        <Button
                          type="button"
                          variant={tabFilters[tab] === 'active' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => setTabFilters((previous) => ({ ...previous, [tab]: 'active' }))}
                        >
                          Aktif Saja
                        </Button>
                        <Button
                          type="button"
                          variant={tabFilters[tab] === 'ready' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => setTabFilters((previous) => ({ ...previous, [tab]: 'ready' }))}
                        >
                          {getReadyFilterLabel(tab)}
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto p-2 pt-0">
                      {renderNotificationList(
                        filteredNotificationsByTab[tab],
                        notificationPreferences[tab]
                          ? `Belum ada notifikasi ${getTabLabel(tab).toLowerCase()} untuk filter ini.`
                          : `Notifikasi ${getTabLabel(tab).toLowerCase()} sedang dinonaktifkan di Pengaturan.`
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex cursor-pointer items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 dark:bg-white/[0.08]">
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
              <DropdownMenuItem
                onClick={() => setTheme(isDarkMode ? 'light' : 'dark')}
                className="cursor-pointer items-start gap-3 py-2"
              >
                {themeReady && isDarkMode ? (
                  <Sun className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <Moon className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{themeReady && isDarkMode ? 'Mode Terang' : 'Mode Gelap'}</span>  
                  
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/pengaturan')} className="cursor-pointer">
                <SettingsIcon className="mr-2 h-4 w-4" />
                <span>Pengaturan</span>
              </DropdownMenuItem>
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
    <Dialog
      open={notificationResultOpen}
      onOpenChange={(open) => {
        setNotificationResultOpen(open);

        if (!open) {
          setNotificationResultItem(null);
          setNotificationResultError('');
          setNotificationLabResults([]);
          setNotificationRadiologyResults([]);
          setNotificationResultLoading(false);
        }
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div>{notificationResultItem ? `Hasil ${getNotificationTypeLabel(notificationResultItem.type)}` : 'Hasil Pemeriksaan'}</div>
              <div className="mt-1 text-sm font-normal text-muted-foreground">
                {notificationResultItem?.patient_name || 'Pasien'} • No. RM {notificationResultItem?.no_rkm_medis || '-'} • No. Rawat {notificationResultItem?.no_rawat || '-'}
              </div>
            </div>
            {notificationResultItem ? (
              <span className={cn('w-fit rounded-full px-2 py-1 text-[10px] font-semibold', getNotificationStatusClassName(notificationResultItem.status))}>
                {notificationResultItem.status_label}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-lg bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Referensi notifikasi: <span className="font-semibold text-foreground">{notificationResultItem?.reference_id || '-'}</span>
        </div>
        <ScrollArea className="max-h-[62vh] pr-4">
          <div className="space-y-4">
            {renderNotificationResultContent()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Header;
