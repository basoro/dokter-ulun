import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Download, ExternalLink, FileImage, FileText, Loader2, RotateCcw, Trash2, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

interface DigitalFile {
  id?: string;
  kode?: string;
  nama_berkas?: string;
  no_rawat?: string;
  lokasi_file?: string;
  nama_file: string;
  tipe_file: string;
  url?: string;
  can_delete?: boolean;
}

interface DigitalFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

interface DigitalFileOption {
  kode: string;
  nama: string;
}

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ACCEPTED_FILE_EXTENSIONS = '.jpg,.jpeg,.png,.pdf';

export const DigitalFilesModal: React.FC<DigitalFilesModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadsBaseUrl, setUploadsBaseUrl] = useState('');
  const [fileOptions, setFileOptions] = useState<DigitalFileOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [selectedKode, setSelectedKode] = useState('');
  const [kodeBerkasOpen, setKodeBerkasOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      void fetchFiles();
      void fetchFileOptions();
    }
  }, [isOpen, noRawat]);

  const fetchFiles = async () => {
    if (!noRawat) {
      setFiles([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (user?.kd_dokter || user?.username) {
        params.set('username', String(user?.kd_dokter || user?.username || ''));
      }

      const response = await fetch(
        `${API_URLS.DIGITAL_FILES}/${encodeURIComponent(noRawat)}${params.toString() ? `?${params.toString()}` : ''}`,
        { credentials: 'include' }
      );
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

  const fetchFileOptions = async () => {
    setOptionsLoading(true);
    try {
      const response = await fetch(API_URLS.DIGITAL_FILES_OPTIONS, {
        credentials: 'include'
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat opsi berkas digital');
      }

      const options = Array.isArray(result.data) ? result.data : [];
      setFileOptions(options);
      setSelectedKode((previous) => previous || options[0]?.kode || '');
    } catch (error) {
      console.error('Error fetching file options:', error);
      toast({
        title: "Error",
        description: "Gagal memuat opsi berkas digital",
        variant: "destructive",
      });
    } finally {
      setOptionsLoading(false);
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

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setUploadQueue([]);
    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [isOpen]);

  const activeFile = files[currentIndex] || null;
  const isImageFile = Boolean(activeFile?.tipe_file?.startsWith('image/'));
  const isPdfFile = activeFile?.tipe_file === 'application/pdf';
  const selectedFileCount = uploadQueue.length;
  const hasPendingUploads = uploadQueue.some((item) => item.status === 'pending' || item.status === 'error');
  const allowedFormatsLabel = useMemo(() => 'JPG, JPEG, PNG, PDF', []);
  const selectedKodeLabel = useMemo(() => {
    const selectedOption = fileOptions.find((option) => option.kode === selectedKode);
    if (!selectedOption) {
      return '';
    }

    return `${selectedOption.kode} - ${selectedOption.nama}`;
  }, [fileOptions, selectedKode]);

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

  const formatFileSize = (size: number) => {
    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const updateQueueItem = (id: string, updater: (item: UploadQueueItem) => UploadQueueItem) => {
    setUploadQueue((previous) => previous.map((item) => (item.id === id ? updater(item) : item)));
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);

    if (!selectedFiles.length) {
      setUploadQueue([]);
      return;
    }

    const validFiles: UploadQueueItem[] = [];
    const invalidMessages: string[] = [];

    selectedFiles.forEach((file, index) => {
      const mimeType = String(file.type || '').toLowerCase();

      if (!ACCEPTED_FILE_TYPES.includes(mimeType)) {
        invalidMessages.push(`${file.name}: format tidak didukung`);
        return;
      }

      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        invalidMessages.push(`${file.name}: ukuran file maksimal 5 MB`);
        return;
      }

      validFiles.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        file,
        progress: 0,
        status: 'pending'
      });
    });

    setUploadQueue(validFiles);

    if (invalidMessages.length) {
      toast({
        title: "Sebagian file tidak dapat dipilih",
        description: invalidMessages.slice(0, 3).join(' | '),
        variant: "destructive",
      });
    }
  };

  const removeQueuedFile = (id: string) => {
    if (uploading) {
      return;
    }

    setUploadQueue((previous) => previous.filter((item) => item.id !== id));
  };

  const uploadSingleFile = (queueItem: UploadQueueItem) => (
    new Promise<{ success: boolean; error?: string }>((resolve) => {
      const formData = new FormData();
      formData.append('no_rawat', noRawat);
      formData.append('kode', selectedKode);
      formData.append('file', queueItem.file);

      const request = new XMLHttpRequest();
      request.open('POST', API_URLS.DIGITAL_FILES_UPLOAD, true);
      request.withCredentials = true;

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }

        const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
        updateQueueItem(queueItem.id, (item) => ({
          ...item,
          progress,
          status: 'uploading'
        }));
      };

      request.onerror = () => {
        resolve({
          success: false,
          error: 'Koneksi upload gagal'
        });
      };

      request.onload = () => {
        let payload: any = null;

        try {
          payload = JSON.parse(request.responseText || '{}');
        } catch {
          payload = null;
        }

        if (request.status >= 200 && request.status < 300 && payload?.data?.failed?.length === 0) {
          resolve({ success: true });
          return;
        }

        resolve({
          success: false,
          error: payload?.data?.failed?.[0]?.error || payload?.error || payload?.message || 'Upload gagal'
        });
      };

      request.send(formData);
    })
  );

  const handleUpload = async () => {
    if (!noRawat) {
      toast({
        title: "No. Rawat belum tersedia",
        description: "Data kunjungan pasien tidak ditemukan.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedKode) {
      toast({
        title: "Kode berkas wajib dipilih",
        description: "Pilih jenis berkas digital sebelum upload.",
        variant: "destructive",
      });
      return;
    }

    if (!uploadQueue.length) {
      toast({
        title: "Belum ada file",
        description: "Pilih minimal satu file untuk di-upload.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    let successCount = 0;
    let failedCount = 0;

    for (const queueItem of uploadQueue) {
      updateQueueItem(queueItem.id, (item) => ({
        ...item,
        progress: 0,
        status: 'uploading',
        error: ''
      }));

      const result = await uploadSingleFile(queueItem);

      if (result.success) {
        successCount += 1;
        updateQueueItem(queueItem.id, (item) => ({
          ...item,
          progress: 100,
          status: 'success',
          error: ''
        }));
      } else {
        failedCount += 1;
        updateQueueItem(queueItem.id, (item) => ({
          ...item,
          status: 'error',
          error: result.error || 'Upload gagal'
        }));
      }
    }

    setUploading(false);

    if (successCount > 0) {
      await fetchFiles();
    }

    toast({
      title: successCount > 0 && failedCount === 0 ? "Upload berhasil" : "Upload selesai",
      description: failedCount === 0
        ? `${successCount} file berhasil di-upload`
        : `${successCount} file berhasil, ${failedCount} file gagal`,
      variant: failedCount > 0 ? "destructive" : "default",
    });

    if (successCount > 0 && failedCount === 0) {
      setUploadQueue([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = async () => {
    if (!activeFile?.lokasi_file || !activeFile?.kode || !activeFile?.can_delete) {
      return;
    }

    setDeletingFileId(activeFile.id || activeFile.lokasi_file);

    try {
      const response = await fetch(API_URLS.DIGITAL_FILES, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          no_rawat: noRawat,
          kode: activeFile.kode,
          lokasi_file: activeFile.lokasi_file,
          username: user?.kd_dokter || user?.username || ''
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menghapus berkas digital');
      }

      toast({
        title: "Berhasil",
        description: "Berkas digital berhasil dihapus",
      });

      setDeleteConfirmOpen(false);
      await fetchFiles();
    } catch (error) {
      console.error('Error deleting digital file:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Gagal menghapus berkas digital',
        variant: "destructive",
      });
    } finally {
      setDeletingFileId('');
    }
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
          {!uploadsBaseUrl ? (
            <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Base URL berkas digital belum dikonfigurasi di backend `.env`.
            </div>
          ) : null}

          <Card>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] xl:items-end">
                <div className="space-y-2 xl:min-w-0">
                  <Label htmlFor="digital-files-upload">Upload Berkas <span className="text-xs text-muted-foreground">(Max 5 MB)</span></Label>
                  <Input
                    id="digital-files-upload"
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_FILE_EXTENSIONS}
                    multiple
                    onChange={handleFileSelection}
                    disabled={uploading}
                  />
                </div>

                <div className="space-y-2 xl:min-w-0">
                  <Label>Kode Berkas</Label>
                  <Popover open={kodeBerkasOpen} onOpenChange={setKodeBerkasOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={kodeBerkasOpen}
                        disabled={optionsLoading || uploading}
                        className="w-full justify-between text-left font-normal"
                      >
                        <span className="truncate">
                          {optionsLoading
                            ? "Memuat kode berkas..."
                            : selectedKodeLabel || "Pilih kode berkas"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Cari kode berkas..." />
                        <CommandList>
                          <CommandEmpty>Tidak ada kode berkas ditemukan.</CommandEmpty>
                          <CommandGroup>
                            {fileOptions.map((option) => (
                              <CommandItem
                                key={option.kode}
                                value={`${option.kode} ${option.nama}`}
                                onSelect={() => {
                                  setSelectedKode(option.kode);
                                  setKodeBerkasOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedKode === option.kode ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{option.nama}</p>
                                  <p className="text-xs text-muted-foreground">{option.kode}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2 xl:min-w-0">
                  <Button
                    type="button"
                    onClick={() => void handleUpload()}
                    disabled={uploading || !selectedFileCount || !selectedKode}
                    className="w-full xl:w-auto"
                  >
                    {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload
                  </Button>
                </div>
              </div>

              {selectedFileCount > 0 ? (
                <div className="space-y-3 rounded-lg border bg-muted/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">Antrian Upload ({selectedFileCount} file)</p>
                    {!uploading && hasPendingUploads ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setUploadQueue([]);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                      >
                        Bersihkan
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {uploadQueue.map((item) => (
                      <div key={item.id} className="rounded-md border bg-background p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{item.file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(item.file.size)}
                            </p>
                          </div>
                          {!uploading && item.status === 'pending' ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => removeQueuedFile(item.id)}
                              className="h-8 w-8 shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                        <div className="mt-3 space-y-2">
                          <Progress value={item.progress} className="h-2" />
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-muted-foreground">
                              {item.status === 'pending' ? 'Menunggu upload' : null}
                              {item.status === 'uploading' ? 'Sedang upload...' : null}
                              {item.status === 'success' ? 'Berhasil di-upload' : null}
                              {item.status === 'error' ? item.error || 'Upload gagal' : null}
                            </span>
                            <span className="font-medium">{item.progress}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

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
                        {activeFile?.can_delete ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirmOpen(true)}
                            disabled={deletingFileId === (activeFile?.id || activeFile?.lokasi_file)}
                          >
                            {deletingFileId === (activeFile?.id || activeFile?.lokasi_file) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
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
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Berkas Digital?</AlertDialogTitle>
              <AlertDialogDescription>
                Berkas <span className="font-medium text-foreground">{activeFile?.nama_berkas || activeFile?.nama_file || '-'}</span> akan dihapus permanen dari daftar berkas digital pasien ini.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(deletingFileId)}>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleDeleteFile();
                }}
                disabled={Boolean(deletingFileId)}
              >
                {deletingFileId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};
