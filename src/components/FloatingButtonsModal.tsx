import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { ICDModal } from './modals/ICDModal';
import { PatientNotesModal } from './modals/PatientNotesModal';
import { DigitalFilesModal } from './modals/DigitalFilesModal';
import { MedicalResumeModal } from './modals/MedicalResumeModal';
import { InternalReferralModal } from './modals/InternalReferralModal';
import { OperationReportModal } from './modals/OperationReportModal';

interface FloatingButtonsModalProps {
  noRawat: string;
  defaultStatusRawat?: 'Ralan' | 'Ranap';
}

export const FloatingButtonsModal: React.FC<FloatingButtonsModalProps> = ({
  noRawat,
  defaultStatusRawat = 'Ralan'
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  const handleMenuItemClick = (buttonId: string) => {
    setActiveModal(buttonId);
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Floating Action Button Group - Rendered via Portal */}
      {createPortal(
        <div className="fixed bottom-6 right-6 z-[9999]">
          {/* Drop-up Menu */}
          {isMenuOpen && (
            <div className="absolute bottom-16 right-0 flex flex-col gap-2 mb-2 items-end animate-scale-in">
              {buttons.map((button, index) => {
                const IconComponent = button.icon;
                return (
                  <div
                    key={button.id}
                    className="flex items-center gap-3 animate-fade-in"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <span className="bg-background border text-foreground px-3 py-1 rounded-lg text-sm whitespace-nowrap shadow-md">
                      {button.label}
                    </span>
                    <Button
                      onClick={() => handleMenuItemClick(button.id)}
                      className={`${button.color} text-white shadow-lg hover:shadow-xl transition-all duration-200 w-12 h-12 rounded-full flex items-center justify-center`}
                      size="sm"
                    >
                      <IconComponent className="h-5 w-5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main FAB Button */}
          <Button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 w-14 h-14 rounded-full flex items-center justify-center"
            size="sm"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6 transition-transform duration-200" />
            ) : (
              <Plus className="h-6 w-6 transition-transform duration-200" />
            )}
          </Button>
        </div>,
        document.body
      )}

      {/* Modals */}
      <ICDModal 
        isOpen={activeModal === 'icd'} 
        onClose={closeModal}
        noRawat={noRawat}
        defaultStatusLayanan={defaultStatusRawat}
      />
      <PatientNotesModal 
        isOpen={activeModal === 'notes'} 
        onClose={closeModal}
        noRawat={noRawat}
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
