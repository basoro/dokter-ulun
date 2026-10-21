import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Search, UserRound } from 'lucide-react';
import { API_URLS } from '@/config/api';
import { formatUIDate, formatUIDateTime } from '@/lib/date-utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MedicalRecordSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchPatientItem {
  no_rkm_medis: string;
  nm_pasien: string;
  jk?: string;
  umur?: number;
  alamat?: string;
  no_tlp?: string;
  last_visit_date?: string;
  last_visit_time?: string;
  last_status_lanjut?: string;
  last_nm_poli?: string;
  last_nm_dokter?: string;
}

const PAGE_SIZE = 20;

const formatGender = (value?: string) => {
  if (String(value || '').trim().toUpperCase() === 'L') {
    return 'Laki-laki';
  }

  if (String(value || '').trim().toUpperCase() === 'P') {
    return 'Perempuan';
  }

  return '-';
};

const formatVisitDate = (dateValue?: string, timeValue?: string) => {
  const trimmedDate = String(dateValue || '').trim();
  const trimmedTime = String(timeValue || '').trim();

  if (!trimmedDate) {
    return 'Belum ada kunjungan';
  }

  if (trimmedTime) {
    return formatUIDateTime(`${trimmedDate} ${trimmedTime}`);
  }

  return formatUIDate(trimmedDate);
};

const MedicalRecordSearchModal: React.FC<MedicalRecordSearchModalProps> = ({
  open,
  onOpenChange
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundLocation = (location.state as { backgroundLocation?: Location } | undefined)?.backgroundLocation;

  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');
  const [patients, setPatients] = React.useState<SearchPatientItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState('');

  const listRef = React.useRef<HTMLDivElement | null>(null);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  const fetchPatients = React.useCallback(async (searchText: string, nextPage: number, append: boolean) => {
    if (searchText.length < 2) {
      setPatients([]);
      setPage(1);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setError('');
      return;
    }

    // Batalkan pencarian sebelumnya agar query lambat tidak menumpuk di server.
    if (!append) {
      abortRef.current?.abort();
    }
    const controller = new AbortController();
    if (!append) {
      abortRef.current = controller;
    }

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');

      const params = new URLSearchParams({
        q: searchText,
        page: String(nextPage),
        limit: String(PAGE_SIZE)
      });
      const response = await fetch(`${API_URLS.SEARCH_MEDICAL_RECORD_PATIENTS}?${params.toString()}`, {
        signal: controller.signal
      });
      const responseJson = await response.json();

      if (!response.ok) {
        throw new Error(responseJson?.error || `HTTP error ${response.status}`);
      }

      const nextPatients = Array.isArray(responseJson?.data) ? responseJson.data : [];
      setPatients((previous) => {
        if (!append) {
          return nextPatients;
        }

        const merged = [...previous];
        nextPatients.forEach((item: SearchPatientItem) => {
          if (!merged.some((existing) => existing.no_rkm_medis === item.no_rkm_medis)) {
            merged.push(item);
          }
        });
        return merged;
      });
      setPage(nextPage);
      setHasMore(Boolean(responseJson?.pagination?.hasMore));
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return;
      }
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat pasien');
      if (!append) {
        setPatients([]);
      }
      setHasMore(false);
    } finally {
      // Jangan mengubah state loading kalau request ini sudah dibatalkan.
      if (append || abortRef.current === controller) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      return;
    }

    if (debouncedQuery.length < 2) {
      setPatients([]);
      setPage(1);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setError('');
      return;
    }

    void fetchPatients(debouncedQuery, 1, false);
  }, [debouncedQuery, fetchPatients, open]);

  React.useEffect(() => {
    if (!open || !hasMore || loading || loadingMore) {
      return;
    }

    const root = listRef.current;
    const target = sentinelRef.current;
    if (!root || !target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void fetchPatients(debouncedQuery, page + 1, true);
        }
      },
      {
        root,
        rootMargin: '120px',
        threshold: 0.1
      }
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [debouncedQuery, fetchPatients, hasMore, loading, loadingMore, open, page]);

  const handleSelectPatient = (patient: SearchPatientItem) => {
    const nextBackgroundLocation = backgroundLocation || location;
    onOpenChange(false);
    navigate(`/rekam-medik/${patient.no_rkm_medis}`, {
      state: {
        backgroundLocation: nextBackgroundLocation
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Pencarian Rekam Medis Pasien</DialogTitle>
          <DialogDescription>
            Cari berdasarkan nama pasien, nomor rekam medis, nomor telepon, atau alamat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ketik minimal 2 karakter..."
              className="pl-10"
              autoFocus
            />
          </div>

          <div
            ref={listRef}
            className="max-h-[60vh] space-y-3 overflow-y-auto pr-1"
          >
            {debouncedQuery.length < 2 ? (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                Masukkan minimal 2 karakter untuk mulai mencari pasien.
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-lg border px-4 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat pasien...
              </div>
            ) : null}

            {!loading && error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            {!loading && !error && debouncedQuery.length >= 2 && patients.length === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                Pasien tidak ditemukan.
              </div>
            ) : null}

            {patients.map((patient) => (
              <button
                key={patient.no_rkm_medis}
                type="button"
                onClick={() => handleSelectPatient(patient)}
                className={cn(
                  'w-full rounded-lg border bg-card px-4 py-4 text-left transition-colors',
                  'hover:border-primary/40 hover:bg-primary/5'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-primary" />
                      <p className="truncate font-semibold text-foreground">{patient.nm_pasien}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      No. RM {patient.no_rkm_medis} • {formatGender(patient.jk)} • {patient.umur ?? '-'} tahun
                    </p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {patient.alamat || 'Alamat belum tersedia'}
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="shrink-0">
                    Lihat
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatVisitDate(patient.last_visit_date, patient.last_visit_time)}</span>
                  <span>{patient.last_status_lanjut || 'Belum ada status rawat'}</span>
                  <span>{patient.last_nm_poli || 'Poli belum tersedia'}</span>
                  <span>{patient.last_nm_dokter || 'Dokter belum tersedia'}</span>
                </div>
              </button>
            ))}

            <div ref={sentinelRef} className="h-4" />

            {loadingMore ? (
              <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat data berikutnya...
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MedicalRecordSearchModal;
