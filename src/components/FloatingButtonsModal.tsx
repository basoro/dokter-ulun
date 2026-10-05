import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from "@/components/ui/button";
import { 
  Code, 
  StickyNote, 
  FileText, 
  File, 
  ArrowRight, 
  Scissors,
  Plus,
  X,
  ChevronUp
} from 'lucide-react';
import { API_URLS } from '@/config/api';
import { useToast } from '@/hooks/use-toast';
import { ICDModal } from './modals/ICDModal';
import { PatientNotesModal } from './modals/PatientNotesModal';
import { DigitalFilesModal } from './modals/DigitalFilesModal';
import { MedicalResumeModal } from './modals/MedicalResumeModal';
import { InternalReferralModal } from './modals/InternalReferralModal';
import { OperationReportModal } from './modals/OperationReportModal';

interface FloatingButtonsModalProps {
  noRawat: string;
  noRkmMedis?: string;
  defaultStatusRawat?: 'Ralan' | 'Ranap';
  onIcdDataChanged?: () => void;
}

export const FloatingButtonsModal: React.FC<FloatingButtonsModalProps> = ({
  noRawat,
  noRkmMedis,
  defaultStatusRawat = 'Ralan',
  onIcdDataChanged
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isSatusehatLoading, setIsSatusehatLoading] = useState(false);
  const [isSatusehatButtonEnabled, setIsSatusehatButtonEnabled] = useState(false);
  const { toast } = useToast();

  const buttons = [
    {
      id: 'icd',
      label: 'ICD Management',
      icon: Code,
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      id: 'notes',
      label: 'Catatan Pasien',
      icon: StickyNote,
      color: 'bg-yellow-500 hover:bg-yellow-600'
    },
    {
      id: 'files',
      label: 'Berkas Digital',
      icon: File,
      color: 'bg-purple-500 hover:bg-purple-600'
    },
    {
      id: 'resume',
      label: 'Resume Medis',
      icon: FileText,
      color: 'bg-indigo-500 hover:bg-indigo-600'
    },
    {
      id: 'referral',
      label: 'Rujukan Internal',
      icon: ArrowRight,
      color: 'bg-orange-500 hover:bg-orange-600'
    },
    {
      id: 'operation',
      label: 'Laporan Operasi',
      icon: Scissors,
      color: 'bg-red-500 hover:bg-red-600'
    }
  ];

  const closeModal = () => setActiveModal(null);

  useEffect(() => {
    let isActive = true;

    const loadSsrmeButtonSetting = async () => {
      try {
        const response = await fetch(API_URLS.SATU_SEHAT_BUTTON_SETTING);
        const result = await response.json().catch(() => null);
        if (isActive && response.ok && result?.success) {
          setIsSatusehatButtonEnabled(Boolean(result.enabled));
        }
      } catch {
        if (isActive) {
          setIsSatusehatButtonEnabled(false);
        }
      }
    };

    void loadSsrmeButtonSetting();
    return () => {
      isActive = false;
    };
  }, []);

  /**
   * Buka RME Nasional SATUSEHAT (ChaRME) untuk kunjungan aktif.
   *
   * Halaman SATUSEHAT melarang iframe (X-Frame-Options: SAMEORIGIN), sehingga
   * hasil URL dibuka di popup window tanpa bar. Window kosong dibuka lebih dulu
   * saat klik (user gesture, lolos popup blocker), URL-nya diisi setelah respons
   * dari backend diterima.
   */
  const handleOpenSatusehat = async () => {
    setIsMenuOpen(false);

    if (!String(noRawat || '').trim()) {
      toast({
        title: 'SATUSEHAT',
        description: 'Pilih pasien terlebih dahulu.',
        variant: 'destructive'
      });
      return;
    }

    const width = Math.min(Math.round(window.screen.width * 0.85), 1600);
    const height = Math.min(Math.round(window.screen.height * 0.92), 1100);
    const left = Math.max(0, Math.round((window.screen.width - width) / 2));
    const top = Math.max(0, Math.round((window.screen.height - height) / 2));
    const rmeWindow = window.open(
      'about:blank',
      'satusehatRme',
      `width=${width},height=${height},left=${left},top=${top}` +
        ',toolbar=no,menubar=no,location=no,status=no,directories=no,scrollbars=yes,resizable=yes'
    );

    setIsSatusehatLoading(true);
    toast({
      title: 'SATUSEHAT',
      description: 'Membuka RME Nasional SATUSEHAT…'
    });

    try {
      const response = await fetch(API_URLS.SATU_SEHAT_RME_NASIONAL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ no_rawat: String(noRawat || '').trim() })
      });

      const result = await response.json().catch(() => null);
      if (!result) {
        throw new Error(`Response tidak valid (HTTP ${response.status}).`);
      }

      const status = String(result.status || (result.success ? 'success' : 'error'));
      const message = String(result.message || '').trim();
      const mainUrl = status === 'success'
        ? String(result.url || '').trim()
        : String(result.consent_url || '').trim();

      if (mainUrl && rmeWindow && !rmeWindow.closed) {
        rmeWindow.location.href = mainUrl;
        rmeWindow.focus();
      } else if (mainUrl) {
        window.open(mainUrl, '_blank', 'noopener');
      } else if (rmeWindow && !rmeWindow.closed) {
        rmeWindow.close();
      }

      if (status === 'success') {
        toast({
          title: 'RME Nasional SATUSEHAT',
          description: message || 'RME pasien berhasil dibuka.'
        });
      } else if (status === 'consent_required') {
        toast({
          title: 'Persetujuan (consent) diperlukan',
          description: `${message || 'Pasien belum menyetujui akses RME.'} Setelah persetujuan diberikan, klik tombol SATUSEHAT lagi.`
        });
      } else {
        toast({
          title: 'Gagal membuka RME',
          description: message || 'Permintaan ke SATUSEHAT gagal.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      if (rmeWindow && !rmeWindow.closed) {
        rmeWindow.close();
      }
      toast({
        title: 'Gagal membuka RME',
        description: error instanceof Error ? error.message : 'Gagal menghubungi server.',
        variant: 'destructive'
      });
    } finally {
      setIsSatusehatLoading(false);
    }
  };

  const handleMenuItemClick = (buttonId: string) => {
    if (buttonId === 'satusehat') {
      void handleOpenSatusehat();
      return;
    }

    setActiveModal(buttonId);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollToTop(window.scrollY > 240);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {/* Floating Action Button Group - Rendered via Portal */}
      {createPortal(
        <>
          {showScrollToTop && (
            <div className="fixed bottom-6 left-6 z-[9999]">
              <Button
                type="button"
                onClick={handleScrollToTop}
                className="h-12 w-12 rounded-full bg-red-600 text-white shadow-lg transition-all duration-300 hover:bg-red-700 hover:shadow-xl"
                size="icon"
                aria-label="Scroll ke atas"
              >
                <ChevronUp className="h-5 w-5" />
              </Button>
            </div>
          )}

          <div className="fixed bottom-6 right-6 z-[9999]">
            {/* Drop-up Menu */}
            {isMenuOpen && (
              <div className="absolute bottom-16 right-0 mb-2 flex flex-col items-end gap-2 animate-scale-in">
                {buttons.map((button, index) => {
                  const IconComponent = button.icon;
                  return (
                    <div
                      key={button.id}
                      className="flex items-center gap-3 animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className="whitespace-nowrap rounded-lg border bg-background px-3 py-1 text-sm text-foreground shadow-md">
                        {button.label}
                      </span>
                      <Button
                        onClick={() => handleMenuItemClick(button.id)}
                        disabled={button.id === 'satusehat' && isSatusehatLoading}
                        className={`${button.color} flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all duration-200 hover:shadow-xl disabled:opacity-60`}
                        size="sm"
                      >
                        <IconComponent className={`h-5 w-5 ${button.id === 'satusehat' && isSatusehatLoading ? 'animate-pulse' : ''}`} />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-3">
              {isSatusehatButtonEnabled && (
                <Button
                  type="button"
                  onClick={() => void handleOpenSatusehat()}
                  disabled={isSatusehatLoading}
                  className="h-12 w-36 rounded-full border-0 bg-white px-1 shadow-md transition-all duration-200 hover:scale-110 hover:bg-white hover:shadow-lg disabled:opacity-60"
                  aria-label="Buka RME Nasional SATUSEHAT"
                  title="Buka RME Nasional SATUSEHAT"
                >
                  <img
                    src="/satusehat-button-dark-color.png"
                    alt="SATUSEHAT"
                    className={`h-auto w-full object-contain ${isSatusehatLoading ? 'animate-pulse' : ''}`}
                  />
                </Button>
              )}

              <Button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 hover:bg-primary/90 hover:shadow-xl"
                size="sm"
                aria-label={isMenuOpen ? 'Tutup menu tindakan' : 'Buka menu tindakan'}
              >
                {isMenuOpen ? (
                  <X className="h-6 w-6 transition-transform duration-200" />
                ) : (
                  <Plus className="h-6 w-6 transition-transform duration-200" />
                )}
              </Button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Modals */}
      <ICDModal 
        isOpen={activeModal === 'icd'} 
        onClose={closeModal}
        noRawat={noRawat}
        noRkmMedis={noRkmMedis}
        defaultStatusLayanan={defaultStatusRawat}
        onDataChanged={onIcdDataChanged}
      />
      <PatientNotesModal 
        isOpen={activeModal === 'notes'} 
        onClose={closeModal}
        noRawat={noRawat}
        noRkmMedis={noRkmMedis}
      />
      <DigitalFilesModal 
        isOpen={activeModal === 'files'} 
        onClose={closeModal}
        noRawat={noRawat}
      />
      <MedicalResumeModal 
        isOpen={activeModal === 'resume'} 
        onClose={closeModal}
        noRawat={noRawat}
        defaultStatusRawat={defaultStatusRawat}
      />
      <InternalReferralModal 
        isOpen={activeModal === 'referral'} 
        onClose={closeModal}
        noRawat={noRawat}
      />
      <OperationReportModal 
        isOpen={activeModal === 'operation'} 
        onClose={closeModal}
        noRawat={noRawat}
      />
    </>
  );
};
