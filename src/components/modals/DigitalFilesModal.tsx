import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileImage, FileText, Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';

interface DigitalFile {
  id?: string;
  kode?: string;
  nama_berkas?: string;
  no_rawat?: string;
  lokasi_file?: string;
  nama_file: string;
  tipe_file: string;
  url?: string;
}

interface DigitalFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const DigitalFilesModal: React.FC<DigitalFilesModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadsBaseUrl, setUploadsBaseUrl] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      void fetchFiles();
    }
  }, [isOpen, noRawat]);

  const fetchFiles = async () => {
    if (!noRawat) {
      setFiles([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URLS.DIGITAL_FILES}/${encodeURIComponent(noRawat)}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat berkas digital');
      }

      setFiles(Array.isArray(result.data) ? result.data : []);
      setUploadsBaseUrl(String(result.uploads_base_url || '').trim());
    } catch (error) {
      console.error('Error fetching files:', error);
      toast({
        title: "Error",
        description: "Gagal memuat berkas digital",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (tipeFile: string) => {
    if (tipeFile.startsWith('image/')) {
      return <FileImage className="h-6 w-6 text-blue-500" />;
    }
    return <FileText className="h-6 w-6 text-gray-500" />;
  };

  useEffect(() => {
    setCurrentIndex(0);
  }, [files, isOpen, noRawat]);

  useEffect(() => {
    setZoomLevel(1);
  }, [currentIndex, isOpen, noRawat]);

  const activeFile = files[currentIndex] || null;
  const isImageFile = Boolean(activeFile?.tipe_file?.startsWith('image/'));
  const isPdfFile = activeFile?.tipe_file === 'application/pdf';

  const showPrevious = () => {
    setCurrentIndex((previous) => Math.max(previous - 1, 0));
  };

  const showNext = () => {
    setCurrentIndex((previous) => Math.min(previous + 1, files.length - 1));
  };

  const zoomOut = () => {
    setZoomLevel((previous) => Math.max(1, Number((previous - 0.25).toFixed(2))));
  };

  const zoomIn = () => {
    setZoomLevel((previous) => Math.min(4, Number((previous + 0.25).toFixed(2))));
  };

  const resetZoom = () => {
    setZoomLevel(1);
  };

  const renderPreviewContent = () => {
    if (!activeFile) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Belum ada berkas yang dipilih
        </div>
      );
    }

    if (!activeFile.url) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          {getFileIcon(activeFile.tipe_file)}
          <div>
            <p className="font-medium text-foreground">{activeFile.nama_berkas || activeFile.nama_file}</p>
            <p className="text-sm">{activeFile.nama_file}</p>
            <p>URL berkas belum tersedia. Periksa `DIGITAL_FILES_BASE_URL` di backend.</p>
          </div>
        </div>
      );
    }

    if (isImageFile) {
      return (
        <div className="flex h-full w-full items-center justify-center overflow-auto">
          <img
            src={activeFile.url}
            alt={activeFile.nama_berkas || activeFile.nama_file}
            className="max-h-[55vh] w-auto max-w-full rounded-md object-contain transition-transform duration-200"
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
          />
        </div>
      );
    }

    if (isPdfFile) {
      return (
        <iframe
          src={activeFile.url}
          title={activeFile.nama_berkas || activeFile.nama_file}
          className="h-[55vh] w-full rounded-md border"
        />
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        {getFileIcon(activeFile.tipe_file)}
        <div>
          <p className="font-medium">{activeFile.nama_berkas || activeFile.nama_file}</p>
          <p className="text-sm text-muted-foreground">{activeFile.nama_file}</p>
          <p className="text-sm text-muted-foreground">{activeFile.lokasi_file || '-'}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={activeFile.url} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Buka Berkas
          </a>
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-5xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Berkas Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
            {uploadsBaseUrl
              ? ``
              : '<div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Base URL berkas digital belum dikonfigurasi di backend .env.</div>'}

          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat berkas digital...
              </div>
            ) : null}
            {!loading && files.length > 0 ? (
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-medium">{activeFile?.nama_berkas || activeFile?.nama_file || '-'}</h4>
                        <p className="text-sm text-muted-foreground">
                          Kode berkas: {activeFile?.kode || '-'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Nama file: {activeFile?.nama_file || '-'}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">
                          {activeFile?.lokasi_file || '-'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={showPrevious}
                          disabled={currentIndex === 0}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={showNext}
                          disabled={currentIndex >= files.length - 1}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        {isImageFile ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={zoomOut}
                              disabled={zoomLevel <= 1}
                            >
                              <ZoomOut className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={resetZoom}
                              disabled={zoomLevel === 1}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={zoomIn}
                              disabled={zoomLevel >= 4}
                            >
                              <ZoomIn className="h-4 w-4" />
                            </Button>
                          </>
                        ) : null}
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          disabled={!activeFile?.url}
                        >
                          <a
                            href={activeFile?.url || '#'}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          disabled={!activeFile?.url}
                        >
                          <a
                            href={activeFile?.url || '#'}
                            target="_blank"
                            rel="noreferrer"
                            download={activeFile?.nama_file}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    {isImageFile ? (
                      <div className="mb-3 text-xs text-muted-foreground">
                        Zoom: {Math.round(zoomLevel * 100)}%
                      </div>
                    ) : null}

                    <div className="flex min-h-[40vh] items-center justify-center rounded-lg border bg-muted/20 p-3 sm:min-h-[55vh] sm:p-4">
                      {renderPreviewContent()}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                      {files.map((file, index) => {
                        const isActive = index === currentIndex;
                        const isImage = file.tipe_file.startsWith('image/');

                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => setCurrentIndex(index)}
                            className={`overflow-hidden rounded-md border text-left transition ${
                              isActive ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                            }`}
                          >
                            <div className="flex h-20 items-center justify-center bg-muted/30 sm:h-24">
                              {isImage && file.url ? (
                                <img
                                  src={file.url}
                                  alt={file.nama_file}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                getFileIcon(file.tipe_file)
                              )}
                            </div>
                            <div className="p-2">
                              <p className="truncate text-xs font-medium">{file.nama_berkas || file.nama_file}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {file.kode || file.nama_file}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
            {!loading && files.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada berkas digital untuk pasien ini
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
