import React from 'react';
import { format } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Download, FileText, FlaskConical, ImageIcon, Loader2, RotateCcw, Search, ScanLine, Save, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { DateRange } from 'react-day-picker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DatePickerPopover } from '@/components/DatePickerPopover';
import { PaginationControls } from '@/components/PaginationControls';
import { usePagination } from '@/hooks/usePagination';
import { API_CONFIG, API_URLS } from '@/config/api';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

type DiagnosticMode = 'laboratorium' | 'radiologi';

interface DiagnosticHubPageProps {
  mode: DiagnosticMode;
}

interface DiagnosticListItem {
  no_rawat: string;
  no_rkm_medis: string;
  tgl_registrasi: string;
  jam_reg: string;
  status_lanjut: string;
  nm_pasien: string;
  umur?: string;
  nm_dokter: string;
  pemeriksaan: string;
}

interface LaboratoryDetail {
  no_rkm_medis: string;
  no_rawat: string;
  nm_pasien: string;
  umur: string;
  status_lanjut: string;
  kd_pj?: string;
  nm_dokter: string;
  nm_perawatan: string;
  attachments: Array<{
    lokasi_file: string;
    nama_file: string;
    url: string;
  }>;
  results: Array<{
    template_name?: string;
    pemeriksaan: string;
    nilai: string;
    satuan: string;
    nilai_rujukan: string;
    keterangan: string;
  }>;
  review: {
    kesan?: string;
    saran?: string;
  };
}

interface RadiologyPacsImage {
  instance_id?: string;
}

interface RadiologyPacsResult {
  tanggal: string;
  tgl_periksa?: string;
  pemeriksaan: string;
  judul?: string;
  hasil?: string;
  kesan?: string;
  saran?: string;
  pacs_modality?: string;
  pacs_images?: RadiologyPacsImage[];
  pacs_total_images?: number;
}

interface RadiologyDetail {
  no_rkm_medis: string;
  no_rawat: string;
  nm_pasien: string;
  umur: string;
  status_lanjut: string;
  kd_pj?: string;
  nm_dokter: string;
  nm_perawatan: string;
  local_images: Array<{
    path: string;
  }>;
  pacs_results: RadiologyPacsResult[];
  review: {
    judul?: string;
    hasil?: string;
    kesan?: string;
    saran?: string;
  };
}

interface ViewerImageItem {
  src: string;
  title: string;
  description?: string;
  downloadName?: string;
}

const pageConfig: Record<DiagnosticMode, {
  title: string;
  description: string;
  listAction: string;
  detailAction: string;
  saveAction: string;
  endpoint: string;
  icon: React.ReactNode;
  emptyMessage: string;
  searchPlaceholder: string;
  accessEndpoint: string;
}> = {
  laboratorium: {
    title: 'Laboratorium',
    description: 'Daftar pasien laboratorium dan ringkasan hasil pemeriksaan.',
    listAction: 'get_daily_patients',
    detailAction: 'get_patient_detail',
    saveAction: 'save_lab_review',
    endpoint: API_URLS.LABORATORY_DATA,
    accessEndpoint: API_URLS.LABORATORY_DATA_ACCESS,
    icon: <FlaskConical className="h-6 w-6 text-primary" />,
    emptyMessage: 'Belum ada data pasien laboratorium pada filter ini.',
    searchPlaceholder: 'Cari pasien, no. rawat, no. RM, dokter, atau pemeriksaan...'
  },
  radiologi: {
    title: 'Radiologi',
    description: 'Daftar pasien radiologi, hasil interpretasi, dan tampilan PACS.',
    listAction: 'get_daily_patients',
    detailAction: 'get_patient_detail',
    saveAction: 'save_radiology_report',
    endpoint: API_URLS.RADIOLOGY_DATA,
    accessEndpoint: API_URLS.RADIOLOGY_DATA_ACCESS,
    icon: <ScanLine className="h-6 w-6 text-primary" />,
    emptyMessage: 'Belum ada data pasien radiologi pada filter ini.',
    searchPlaceholder: 'Cari pasien, no. rawat, no. RM, dokter, atau pemeriksaan...'
  }
};

const formatDateTime = (date?: string, time?: string) => {
  if (!date) {
    return '-';
  }

  const dateText = String(date).trim();
  const timeText = String(time || '').trim();
  return timeText ? `${dateText} ${timeText}` : dateText;
};

const buildPacsPreviewUrl = (instanceId?: string, width = 500) => {
  const normalizedInstanceId = String(instanceId || '').trim();
  if (!normalizedInstanceId) {
    return '';
  }

  return `${API_CONFIG.BASE_URL_WITHOUT_API}/api/pacs/preview/${encodeURIComponent(normalizedInstanceId)}?width=${width}`;
};

const isImageUrl = (value?: string) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(String(value || '').trim());

const getLabResultRowTone = (keterangan?: string) => {
  const normalized = String(keterangan || '').trim().toUpperCase();
  if (normalized === 'H') {
    return 'high';
  }
  if (normalized === 'L') {
    return 'low';
  }
  return 'normal';
};

const DiagnosticHubPage: React.FC<DiagnosticHubPageProps> = ({ mode }) => {
  const config = pageConfig[mode];
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: new Date(),
    to: new Date()
  });
  const [items, setItems] = React.useState<DiagnosticListItem[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [savingReview, setSavingReview] = React.useState(false);
  const [labDetail, setLabDetail] = React.useState<LaboratoryDetail | null>(null);
  const [radiologyDetail, setRadiologyDetail] = React.useState<RadiologyDetail | null>(null);
  const [labReviewForm, setLabReviewForm] = React.useState({
    kesan: '',
    saran: ''
  });
  const [radiologyReviewForm, setRadiologyReviewForm] = React.useState({
    judul: '',
    hasil: '',
    kesan: '',
    saran: ''
  });
  const [imageViewer, setImageViewer] = React.useState<{
    open: boolean;
    title: string;
    images: ViewerImageItem[];
    currentIndex: number;
    zoom: number;
  }>({
    open: false,
    title: '',
    images: [],
    currentIndex: 0,
    zoom: 1
  });
  const [checkingAccess, setCheckingAccess] = React.useState(true);
  const [canAccess, setCanAccess] = React.useState(false);
  const [accessError, setAccessError] = React.useState('');

  const selectedNoRawat = String(searchParams.get('no_rawat') || '').trim();
  const username = String(user?.username || '').trim();
  const { paginationState, updatePagination, handlePageChange, handleItemsPerPageChange } = usePagination({
    initialItemsPerPage: 10
  });

  const fetchList = React.useCallback(async () => {
    if (!username || !canAccess) {
      setItems([]);
      return;
    }

    setLoadingList(true);
    try {
      const params = new URLSearchParams({
        username,
        action: config.listAction,
        page: String(paginationState.currentPage),
        itemsPerPage: String(paginationState.itemsPerPage),
        search: searchQuery.trim(),
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : '',
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''
      });

      const response = await fetch(`${config.endpoint}?${params.toString()}`, {
        credentials: 'include'
      });
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || `Gagal memuat data ${config.title.toLowerCase()}`);
      }

      setItems(Array.isArray(result?.data) ? result.data : []);
      updatePagination({
        total: Number(result?.total) || 0,
        totalPages: Number(result?.totalPages) || 0,
        page: Number(result?.page) || paginationState.currentPage,
        limit: Number(result?.limit) || paginationState.itemsPerPage
      });
    } catch (error) {
      console.error(`Error fetching ${mode} list:`, error);
      toast({
        title: 'Gagal memuat data',
        description: error instanceof Error ? error.message : `Data ${config.title.toLowerCase()} gagal dimuat`,
        variant: 'destructive'
      });
    } finally {
      setLoadingList(false);
    }
  }, [
    config.endpoint,
    canAccess,
    config.listAction,
    config.title,
    dateRange?.from,
    dateRange?.to,
    mode,
    paginationState.currentPage,
    paginationState.itemsPerPage,
    searchQuery,
    username,
    updatePagination
  ]);

  const fetchDetail = React.useCallback(async (noRawat: string) => {
    if (!noRawat || !username || !canAccess) {
      setLabDetail(null);
      setRadiologyDetail(null);
      return;
    }

    setLoadingDetail(true);
    try {
      const params = new URLSearchParams({
        username,
        action: config.detailAction,
        no_rawat: noRawat
      });

      const response = await fetch(`${config.endpoint}?${params.toString()}`, {
        credentials: 'include'
      });
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || `Gagal memuat detail ${config.title.toLowerCase()}`);
      }

      if (mode === 'laboratorium') {
        const detail = result?.data as LaboratoryDetail;
        setLabDetail(detail);
        setLabReviewForm({
          kesan: String(detail?.review?.kesan || ''),
          saran: String(detail?.review?.saran || '')
        });
      } else {
        const detail = result?.data as RadiologyDetail;
        setRadiologyDetail(detail);
        setRadiologyReviewForm({
          judul: String(detail?.review?.judul || ''),
          hasil: String(detail?.review?.hasil || ''),
          kesan: String(detail?.review?.kesan || ''),
          saran: String(detail?.review?.saran || '')
        });
      }
    } catch (error) {
      console.error(`Error fetching ${mode} detail:`, error);
      toast({
        title: 'Gagal memuat detail',
        description: error instanceof Error ? error.message : `Detail ${config.title.toLowerCase()} gagal dimuat`,
        variant: 'destructive'
      });
    } finally {
      setLoadingDetail(false);
    }
  }, [canAccess, config.detailAction, config.endpoint, config.title, mode, username]);

  React.useEffect(() => {
    const checkAccess = async () => {
      if (!username) {
        setCanAccess(false);
        setAccessError('');
        setCheckingAccess(false);
        return;
      }

      setCheckingAccess(true);
      setAccessError('');

      try {
        const response = await fetch(`${config.accessEndpoint}/${encodeURIComponent(username)}`, {
          credentials: 'include'
        });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result?.error || `Gagal memeriksa akses ${config.title.toLowerCase()}`);
        }

        setCanAccess(Boolean(result?.can_access));
      } catch (error) {
        setCanAccess(false);
        setAccessError(error instanceof Error ? error.message : `Gagal memeriksa akses ${config.title.toLowerCase()}`);
      } finally {
        setCheckingAccess(false);
      }
    };

    void checkAccess();
  }, [config.accessEndpoint, config.title, username]);

  React.useEffect(() => {
    if (!canAccess) {
      setItems([]);
      return;
    }
    void fetchList();
  }, [canAccess, fetchList]);

  React.useEffect(() => {
    if (!selectedNoRawat || !canAccess) {
      setLabDetail(null);
      setRadiologyDetail(null);
      return;
    }

    void fetchDetail(selectedNoRawat);
  }, [fetchDetail, selectedNoRawat]);

  const handleApplyFilter = () => {
    updatePagination({ page: 1 });
  };

  const handleClearFilter = () => {
    setSearchQuery('');
    setDateRange({
      from: new Date(),
      to: new Date()
    });
    updatePagination({ page: 1 });
  };

  const handleSelectPatient = (noRawat: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('no_rawat', noRawat);
    setSearchParams(nextParams);
  };

  const handleCloseDetail = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('no_rawat');
    setSearchParams(nextParams);
  };

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLTableRowElement>, noRawat: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelectPatient(noRawat);
    }
  };

  const openImageViewer = (images: ViewerImageItem[], startIndex = 0, title = 'Viewer Gambar') => {
    if (!images.length) {
      return;
    }

    const normalizedStartIndex = Math.min(Math.max(startIndex, 0), images.length - 1);
    setImageViewer({
      open: true,
      title,
      images,
      currentIndex: normalizedStartIndex,
      zoom: 1
    });
  };

  const closeImageViewer = () => {
    setImageViewer((previous) => ({
      ...previous,
      open: false,
      zoom: 1
    }));
  };

  const goToViewerImage = (direction: number) => {
    setImageViewer((previous) => {
      if (!previous.images.length) {
        return previous;
      }

      const totalImages = previous.images.length;
      const nextIndex = ((previous.currentIndex + direction) % totalImages + totalImages) % totalImages;

      return {
        ...previous,
        currentIndex: nextIndex,
        zoom: 1
      };
    });
  };

  const zoomInViewer = () => {
    setImageViewer((previous) => ({
      ...previous,
      zoom: Math.min(previous.zoom + 0.25, 4)
    }));
  };

  const zoomOutViewer = () => {
    setImageViewer((previous) => ({
      ...previous,
      zoom: Math.max(previous.zoom - 0.25, 0.5)
    }));
  };

  const resetViewerZoom = () => {
    setImageViewer((previous) => ({
      ...previous,
      zoom: 1
    }));
  };

  const handleSaveReview = async () => {
    if (!selectedNoRawat) {
      return;
    }

    setSavingReview(true);
    try {
      const payload = mode === 'laboratorium'
        ? {
            no_rawat: selectedNoRawat,
            kesan: labReviewForm.kesan,
            saran: labReviewForm.saran
          }
        : {
            no_rawat: selectedNoRawat,
            judul: radiologyReviewForm.judul,
            hasil: radiologyReviewForm.hasil,
            kesan: radiologyReviewForm.kesan,
            saran: radiologyReviewForm.saran
          };

      const response = await fetch(`${config.endpoint}?action=${config.saveAction}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          ...payload,
          username
        })
      });
      const result = await response.json();

      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || `Gagal menyimpan ${config.title.toLowerCase()}`);
      }

      toast({
        title: 'Berhasil disimpan',
        description: `Catatan ${config.title.toLowerCase()} berhasil disimpan`
      });

      await fetchDetail(selectedNoRawat);
      await fetchList();
    } catch (error) {
      console.error(`Error saving ${mode} review:`, error);
      toast({
        title: 'Gagal menyimpan',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan',
        variant: 'destructive'
      });
    } finally {
      setSavingReview(false);
    }
  };

  const activeDetail = mode === 'laboratorium' ? labDetail : radiologyDetail;
  const activeViewerImage = imageViewer.images[imageViewer.currentIndex] || null;
  const groupedLabResults = React.useMemo(() => {
    if (mode !== 'laboratorium' || !labDetail?.results?.length) {
      return [];
    }

    const groups = new Map<string, LaboratoryDetail['results']>();
    labDetail.results.forEach((result) => {
      const groupName = String(result.template_name || '').trim() || 'Template Lainnya';
      const currentGroup = groups.get(groupName) || [];
      currentGroup.push(result);
      groups.set(groupName, currentGroup);
    });

    return Array.from(groups.entries()).map(([templateName, results]) => ({
      templateName,
      results
    }));
  }, [labDetail?.results, mode]);

  if (checkingAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Memeriksa akses {config.title.toLowerCase()}...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{config.title}</h1>
        <Card>
          <CardContent className="p-6 text-sm text-red-600">
            {accessError || `Anda tidak memiliki akses ke halaman ${config.title.toLowerCase()}.`}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 space-y-6 w-full mx-auto animate-fade-in shadow-md bg-white rounded-md">
      <div className="flex items-center gap-3">
        {config.icon}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{config.title}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
      </div>
      <Separator />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Daftar Pasien {config.title}</CardTitle>
          <CardDescription>Filter berdasarkan tanggal registrasi lalu klik pasien untuk membuka detail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={config.searchPlaceholder}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <DatePickerPopover
              triggerId={`${mode}-date-range`}
              mode="range"
              selected={dateRange}
              onSelect={(value) => setDateRange(value as DateRange | undefined)}
              defaultMonth={dateRange?.from}
              numberOfMonths={2}
              buttonClassName="w-full xl:w-[320px]"
              placeholder="Pilih rentang tanggal"
              displayValue={dateRange?.from ? (
                dateRange.to
                  ? `${format(dateRange.from, 'dd MMM yyyy')} - ${format(dateRange.to, 'dd MMM yyyy')}`
                  : format(dateRange.from, 'dd MMM yyyy')
              ) : undefined}
            />

            <div className="flex gap-2">
              <Button onClick={handleApplyFilter}>Filter</Button>
              <Button variant="outline" onClick={handleClearFilter}>
                <X className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>Total: {paginationState.totalItems} pasien</span>
            {loadingList ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Pasien</TableHead>
                <TableHead>No RM</TableHead>
                <TableHead>Dokter Pengirim</TableHead>
                <TableHead>Pemeriksaan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    {loadingList ? 'Memuat data...' : config.emptyMessage}
                  </TableCell>
                </TableRow>
              ) : items.map((item) => (
                <TableRow
                  key={item.no_rawat}
                  className={`cursor-pointer ${selectedNoRawat === item.no_rawat ? 'bg-primary/5' : ''}`}
                  onClick={() => handleSelectPatient(item.no_rawat)}
                  onKeyDown={(event) => handleRowKeyDown(event, item.no_rawat)}
                  tabIndex={0}
                  aria-label={`Buka detail pasien ${item.nm_pasien}`}
                >
                  <TableCell>
                    <div className="font-medium text-primary">{item.nm_pasien}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(item.tgl_registrasi, item.jam_reg)}
                    </div>
                  </TableCell>
                  <TableCell>{item.no_rkm_medis}</TableCell>
                  <TableCell>{item.nm_dokter || '-'}</TableCell>
                  <TableCell className="max-w-[420px] whitespace-normal">{item.pemeriksaan || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <PaginationControls
            currentPage={paginationState.currentPage}
            totalPages={paginationState.totalPages}
            totalItems={paginationState.totalItems}
            itemsPerPage={paginationState.itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
            loading={loadingList}
          />
        </CardContent>
      </Card>

      <Sheet open={Boolean(selectedNoRawat)} onOpenChange={(open) => {
        if (!open) {
          handleCloseDetail();
        }
      }}>
        <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-[75vw]">
          <div className="p-6 space-y-6">
            <SheetHeader className="pr-10">
              <SheetTitle>Detail Pasien</SheetTitle>
              <SheetDescription>
                {selectedNoRawat ? `No. Rawat ${selectedNoRawat}` : 'Pilih pasien dari daftar untuk melihat detail'}
              </SheetDescription>
            </SheetHeader>

            {!selectedNoRawat ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Belum ada pasien yang dipilih.
              </div>
            ) : loadingDetail ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat detail pasien...
              </div>
            ) : !activeDetail ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Detail pasien tidak ditemukan.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Identitas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><span className="font-medium">Nama:</span> {activeDetail.nm_pasien}</div>
                      <div><span className="font-medium">No. RM:</span> {activeDetail.no_rkm_medis}</div>
                      <div><span className="font-medium">No. Rawat:</span> {activeDetail.no_rawat}</div>
                      <div><span className="font-medium">Umur:</span> {activeDetail.umur || '-'}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Informasi Kunjungan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div><span className="font-medium">Status:</span> {activeDetail.status_lanjut || '-'}</div>
                      <div><span className="font-medium">Dokter Pengirim:</span> {activeDetail.nm_dokter || '-'}</div>
                      <div><span className="font-medium">Penjamin:</span> {activeDetail.kd_pj || '-'}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Pemeriksaan</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      {activeDetail.nm_perawatan || '-'}
                    </CardContent>
                  </Card>
                </div>

                {mode === 'laboratorium' && labDetail ? (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          Lampiran Laboratorium
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {labDetail.attachments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Belum ada lampiran laboratorium.</p>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {labDetail.attachments.map((attachment, attachmentIndex) => {
                              const attachmentIsImage = isImageUrl(attachment.url || attachment.nama_file);
                              return attachmentIsImage ? (
                                <button
                                  key={`${attachment.lokasi_file}-${attachment.nama_file}`}
                                  type="button"
                                  className="overflow-hidden rounded-lg border text-left hover:border-primary hover:bg-primary/5"
                                  onClick={() => {
                                    const viewerImages = labDetail.attachments
                                      .filter((item) => isImageUrl(item.url || item.nama_file))
                                      .map((item) => ({
                                        src: item.url,
                                        title: item.nama_file,
                                        description: item.lokasi_file,
                                        downloadName: item.nama_file
                                      }));
                                    const startIndex = viewerImages.findIndex((item) => item.src === attachment.url);
                                    openImageViewer(viewerImages, startIndex >= 0 ? startIndex : attachmentIndex, 'Lampiran Laboratorium');
                                  }}
                                >
                                  <img
                                    src={attachment.url}
                                    alt={attachment.nama_file}
                                    className="aspect-video h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                  <div className="p-3 text-sm">
                                    <div className="font-medium">{attachment.nama_file}</div>
                                    <div className="mt-1 break-all text-xs text-muted-foreground">{attachment.lokasi_file}</div>
                                  </div>
                                </button>
                              ) : (
                                <a
                                  key={`${attachment.lokasi_file}-${attachment.nama_file}`}
                                  href={attachment.url || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-lg border p-3 text-sm hover:border-primary hover:bg-primary/5"
                                >
                                  <div className="font-medium">{attachment.nama_file}</div>
                                  <div className="mt-1 break-all text-xs text-muted-foreground">{attachment.lokasi_file}</div>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">Hasil Pemeriksaan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {labDetail.results.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Belum ada hasil pemeriksaan laboratorium.</p>
                        ) : (
                          <div className="space-y-6">
                            {groupedLabResults.map((group, groupIndex) => (
                              <div key={`${group.templateName}-${groupIndex}`} className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="rounded-md px-3 py-1 text-sm font-semibold">
                                    {group.templateName}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {group.results.length} item pemeriksaan
                                  </span>
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Pemeriksaan</TableHead>
                                      <TableHead>Nilai</TableHead>
                                      <TableHead>Rujukan</TableHead>
                                      <TableHead>Keterangan</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {group.results.map((result, index) => {
                                      const rowTone = getLabResultRowTone(result.keterangan);
                                      return (
                                        <TableRow
                                          key={`${group.templateName}-${result.pemeriksaan}-${index}`}
                                          className={cn(
                                            rowTone === 'high' && 'bg-red-50/80 hover:bg-red-100/80',
                                            rowTone === 'low' && 'bg-amber-50/80 hover:bg-amber-100/80'
                                          )}
                                        >
                                          <TableCell className="font-medium">{result.pemeriksaan || '-'}</TableCell>
                                          <TableCell>{[result.nilai, result.satuan].filter(Boolean).join(' ') || '-'}</TableCell>
                                          <TableCell>{result.nilai_rujukan || '-'}</TableCell>
                                          <TableCell>
                                            <span
                                              className={cn(
                                                'inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold',
                                                rowTone === 'high' && 'bg-red-100 text-red-700',
                                                rowTone === 'low' && 'bg-amber-100 text-amber-700',
                                                rowTone === 'normal' && 'bg-muted text-muted-foreground'
                                              )}
                                            >
                                              {result.keterangan || '-'}
                                            </span>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Kesan dan Saran
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Kesan</label>
                            <Textarea
                              rows={10}
                              value={labReviewForm.kesan}
                              onChange={(event) => setLabReviewForm((previous) => ({ ...previous, kesan: event.target.value }))}
                              placeholder="Tulis kesan hasil laboratorium..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Saran</label>
                            <Textarea
                              rows={10}
                              value={labReviewForm.saran}
                              onChange={(event) => setLabReviewForm((previous) => ({ ...previous, saran: event.target.value }))}
                              placeholder="Tulis saran hasil laboratorium..."
                            />
                          </div>
                        </div>
                        <Button onClick={handleSaveReview} disabled={savingReview}>
                          {savingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Simpan
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                ) : null}

                {mode === 'radiologi' && radiologyDetail ? (
                  <>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <CalendarDays className="h-4 w-4" />
                          Hasil dan PACS Radiologi
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {radiologyDetail.pacs_results.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Belum ada hasil radiologi yang dapat ditampilkan.</p>
                        ) : radiologyDetail.pacs_results.map((result, index) => (
                          <div key={`${result.tanggal}-${index}`} className="rounded-lg border p-4 space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="font-medium">{result.pemeriksaan || result.judul || '-'}</p>
                                <p className="text-sm text-muted-foreground">{result.tanggal || '-'}</p>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="secondary">{result.pacs_modality || 'RAD'}</Badge>
                                <Badge variant="outline">{Math.max(Number(result.pacs_total_images) || 0, result.pacs_images?.length || 0)} gambar</Badge>
                              </div>
                            </div>
                            {result.hasil ? (
                              <div className="rounded-md bg-muted/50 p-3 text-sm whitespace-pre-wrap">{result.hasil}</div>
                            ) : null}
                            {result.kesan || result.saran ? (
                              <div className="grid gap-3 md:grid-cols-2 text-sm">
                                <div>
                                  <p className="font-medium">Kesan</p>
                                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{result.kesan || '-'}</p>
                                </div>
                                <div>
                                  <p className="font-medium">Saran</p>
                                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{result.saran || '-'}</p>
                                </div>
                              </div>
                            ) : null}
                            {Array.isArray(result.pacs_images) && result.pacs_images.length > 0 ? (
                              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {result.pacs_images.slice(0, 4).map((image, imageIndex) => {
                                  const previewUrl = buildPacsPreviewUrl(image.instance_id, 420);
                                  return (
                                    <button
                                      key={`${image.instance_id || imageIndex}`}
                                      type="button"
                                      className="overflow-hidden rounded-lg border bg-black/5 hover:border-primary"
                                      onClick={() => {
                                        const viewerImages = result.pacs_images?.map((item, index) => ({
                                          src: buildPacsPreviewUrl(item.instance_id, 1200),
                                          title: `${result.pemeriksaan || 'Radiologi'} ${index + 1}`,
                                          description: result.tanggal || '',
                                          downloadName: `radiologi-${result.pemeriksaan || 'gambar'}-${index + 1}.jpg`
                                        })).filter((item) => Boolean(item.src)) || [];
                                        openImageViewer(viewerImages, imageIndex, result.pemeriksaan || 'Radiologi');
                                      }}
                                    >
                                      <img
                                        src={previewUrl}
                                        alt={`PACS ${result.pemeriksaan || 'Radiologi'} ${imageIndex + 1}`}
                                        className="aspect-video h-full w-full object-cover"
                                        loading="lazy"
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {radiologyDetail.local_images.length > 0 ? (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base">Referensi Gambar Lokal</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2">
                          {radiologyDetail.local_images.map((image, index) => (
                            <div key={`${image.path}-${index}`} className="rounded-md border p-3 text-sm break-all">
                              {image.path}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    ) : null}

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Interpretasi, Kesan, dan Saran
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Judul Pemeriksaan</label>
                          <Input
                            value={radiologyReviewForm.judul}
                            onChange={(event) => setRadiologyReviewForm((previous) => ({ ...previous, judul: event.target.value }))}
                            placeholder="Tulis judul pemeriksaan..."
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Interpretasi Hasil</label>
                          <Textarea
                            rows={7}
                            value={radiologyReviewForm.hasil}
                            onChange={(event) => setRadiologyReviewForm((previous) => ({ ...previous, hasil: event.target.value }))}
                            placeholder="Tulis interpretasi hasil radiologi..."
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Kesan</label>
                            <Textarea
                              rows={8}
                              value={radiologyReviewForm.kesan}
                              onChange={(event) => setRadiologyReviewForm((previous) => ({ ...previous, kesan: event.target.value }))}
                              placeholder="Tulis kesan radiologi..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Saran</label>
                            <Textarea
                              rows={8}
                              value={radiologyReviewForm.saran}
                              onChange={(event) => setRadiologyReviewForm((previous) => ({ ...previous, saran: event.target.value }))}
                              placeholder="Tulis saran radiologi..."
                            />
                          </div>
                        </div>
                        <Button onClick={handleSaveReview} disabled={savingReview}>
                          {savingReview ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                          Simpan
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                ) : null}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={imageViewer.open} onOpenChange={(open) => {
        if (!open) {
          closeImageViewer();
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4 pr-12">
            <DialogTitle>{imageViewer.title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {activeViewerImage ? `${imageViewer.currentIndex + 1} dari ${imageViewer.images.length}` : 'Tidak ada gambar'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={zoomOutViewer} disabled={imageViewer.zoom <= 0.5}>
                  <ZoomOut className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">Zoom Out</span>
                </Button>
                <Button variant="outline" size="sm" onClick={resetViewerZoom} disabled={imageViewer.zoom === 1}>
                  <RotateCcw className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">Reset</span>
                </Button>
                <Button variant="outline" size="sm" onClick={zoomInViewer} disabled={imageViewer.zoom >= 4}>
                  <ZoomIn className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">Zoom In</span>
                </Button>
                {activeViewerImage?.src ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={activeViewerImage.src} download={activeViewerImage.downloadName || `gambar-${imageViewer.currentIndex + 1}.jpg`}>
                      <Download className="h-4 w-4 sm:mr-2" />
                      <span className="sr-only sm:not-sr-only">Download</span>
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="relative flex min-h-[60vh] items-center justify-center overflow-auto rounded-lg bg-black/90 p-4">
              {activeViewerImage ? (
                <img
                  src={activeViewerImage.src}
                  alt={activeViewerImage.title}
                  className="max-h-[75vh] max-w-full object-contain transition-transform duration-200"
                  style={{ transform: `scale(${imageViewer.zoom})` }}
                />
              ) : (
                <div className="text-sm text-white/80">Gambar tidak tersedia</div>
              )}

              {imageViewer.images.length > 1 ? (
                <>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2"
                    onClick={() => goToViewerImage(-1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                    onClick={() => goToViewerImage(1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </div>

            {activeViewerImage ? (
              <div className="space-y-1 px-1">
                <p className="text-sm font-medium">{activeViewerImage.title}</p>
                {activeViewerImage.description ? (
                  <p className="text-xs text-muted-foreground break-all">{activeViewerImage.description}</p>
                ) : null}
              </div>
            ) : null}

            {imageViewer.images.length > 1 ? (
              <div className="grid max-h-28 grid-cols-4 gap-3 overflow-y-auto md:grid-cols-6">
                {imageViewer.images.map((image, index) => (
                  <button
                    key={`${image.src}-${index}`}
                    type="button"
                    className={`overflow-hidden rounded-md border ${index === imageViewer.currentIndex ? 'ring-2 ring-primary' : 'opacity-80 hover:opacity-100'}`}
                    onClick={() => setImageViewer((previous) => ({ ...previous, currentIndex: index, zoom: 1 }))}
                  >
                    <img
                      src={image.src}
                      alt={image.title}
                      className="aspect-video h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiagnosticHubPage;
