import React from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void>;
}

const DISMISSED_STORAGE_KEY = 'pwa-install-banner-dismissed';

const isRunningStandalone = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
};

const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);

  React.useEffect(() => {
    setIsDismissed(localStorage.getItem(DISMISSED_STORAGE_KEY) === 'true');
    setIsInstalled(isRunningStandalone());

    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsInstalled(isRunningStandalone());
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISSED_STORAGE_KEY);
      setIsDismissed(false);
      toast.success('Aplikasi berhasil diinstal');
    };

    const handleDisplayModeChange = () => {
      setIsInstalled(isRunningStandalone());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_STORAGE_KEY, 'true');
    setIsDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      toast.info('Prompt install belum tersedia di browser ini');
      return;
    }

    try {
      setIsInstalling(true);
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;

      if (choiceResult.outcome === 'accepted') {
        toast.success('Instalasi aplikasi diproses');
      } else {
        toast.info('Instalasi aplikasi dibatalkan');
      }
    } finally {
      setDeferredPrompt(null);
      setIsInstalling(false);
    }
  };

  if (isInstalled || isDismissed || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[60] md:left-auto md:right-4 md:w-full md:max-w-sm">
      <Card className={cn('border-primary/20 shadow-xl backdrop-blur')}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground">Install aplikasi</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tambahkan aplikasi dokter ke layar utama untuk akses lebih cepat seperti aplikasi native.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button type="button" onClick={() => void handleInstall()} disabled={isInstalling}>
                  <Download className="h-4 w-4" />
                  {isInstalling ? 'Memproses...' : 'Install'}
                </Button>
                <Button type="button" variant="ghost" onClick={handleDismiss}>
                  Nanti
                </Button>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleDismiss}
              aria-label="Tutup notifikasi install aplikasi"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PwaInstallPrompt;
