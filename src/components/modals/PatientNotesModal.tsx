import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, StickyNote, Loader2, ChevronDown, ChevronUp, History } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatUIDate, formatUIDateTime } from '@/lib/date-utils';
import { format } from 'date-fns';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';

interface PatientNote {
  tanggal: string;
  jam: string;
  no_rawat?: string;
  no_rkm_medis?: string;
  kd_dokter: string;
  catatan: string;
  petugas: string;
  tgl_registrasi?: string;
  status_lanjut?: string;
  nm_poli?: string;
  original_tanggal?: string;
  original_jam?: string;
  original_kd_dokter?: string;
}

interface PatientNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
  noRkmMedis?: string;
}

export const PatientNotesModal: React.FC<PatientNotesModalProps> = ({ isOpen, onClose, noRawat, noRkmMedis }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [previousVisitNotes, setPreviousVisitNotes] = useState<PatientNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [previousVisitLoading, setPreviousVisitLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PatientNote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showPreviousVisitNotes, setShowPreviousVisitNotes] = useState(false);
  const [previousVisitLoaded, setPreviousVisitLoaded] = useState(false);
  const { toast } = useToast();
  const currentDoctorCode = user?.kd_dokter || user?.username || '';
  const currentDoctorName = user?.name || user?.username || '-';

  const createDefaultForm = useMemo(() => {
    return () => ({
      tanggal: format(new Date(), 'yyyy-MM-dd'),
      jam: format(new Date(), 'HH:mm'),
      no_rawat: noRawat,
      kd_dokter: currentDoctorCode,
      catatan: '',
      petugas: currentDoctorName,
    });
  }, [currentDoctorCode, currentDoctorName, noRawat]);

  const [formData, setFormData] = useState<PatientNote>(createDefaultForm);

  useEffect(() => {
    if (isOpen) {
      void fetchNotes();
      setShowPreviousVisitNotes(false);
      setPreviousVisitLoaded(false);
      setPreviousVisitNotes([]);
    }
  }, [isOpen, noRawat]);

  useEffect(() => {
    if (!showForm && !editingItem) {
      setFormData(createDefaultForm());
    }
  }, [createDefaultForm, editingItem, showForm]);

  const fetchNotes = async () => {
    if (!noRawat) {
      setNotes([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URLS.PATIENT_NOTES}/${encodeURIComponent(noRawat)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const loadedNotes = Array.isArray(result.data) ? result.data : [];
      setNotes(
        loadedNotes.map((item: any) => ({
          tanggal: item.tanggal,
          jam: item.jam,
          no_rawat: item.no_rawat,
          kd_dokter: item.kd_dokter,
          catatan: item.catatan || '',
          petugas: item.petugas || item.kd_dokter || '-',
          original_tanggal: item.tanggal,
          original_jam: item.jam,
          original_kd_dokter: item.kd_dokter,
        }))
      );
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Gagal memuat catatan pasien",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviousVisitNotes = async () => {
    const normalizedNoRkmMedis = String(noRkmMedis || '').trim();

    if (!normalizedNoRkmMedis) {
      setPreviousVisitNotes([]);
      setPreviousVisitLoaded(true);
      return;
    }

    setPreviousVisitLoading(true);
    try {
      const query = new URLSearchParams();
      if (noRawat) {
        query.set('exclude_no_rawat', noRawat);
      }

      const response = await fetch(
        `${API_URLS.PATIENT_NOTES_HISTORY}/${encodeURIComponent(normalizedNoRkmMedis)}${query.toString() ? `?${query.toString()}` : ''}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const loadedNotes = Array.isArray(result.data) ? result.data : [];
      setPreviousVisitNotes(
        loadedNotes.map((item: any) => ({
          tanggal: item.tanggal,
          jam: item.jam,
          no_rawat: item.no_rawat,
          no_rkm_medis: item.no_rkm_medis,
          kd_dokter: item.kd_dokter,
          catatan: item.catatan || '',
          petugas: item.petugas || item.kd_dokter || '-',
          tgl_registrasi: item.tgl_registrasi,
          status_lanjut: item.status_lanjut || '',
          nm_poli: item.nm_poli || '',
          original_tanggal: item.tanggal,
          original_jam: item.jam,
          original_kd_dokter: item.kd_dokter,
        }))
      );
      setPreviousVisitLoaded(true);
    } catch (error) {
      console.error('Error fetching previous visit notes:', error);
      toast({
        title: "Error",
        description: "Gagal memuat riwayat catatan kunjungan sebelumnya",
        variant: "destructive",
      });
    } finally {
      setPreviousVisitLoading(false);
    }
  };

  const handleTogglePreviousVisitNotes = async (open: boolean) => {
    setShowPreviousVisitNotes(open);

    if (open && !previousVisitLoaded && !previousVisitLoading) {
      await fetchPreviousVisitNotes();
    }
  };

  const handleSave = async () => {
    if (!noRawat) {
      toast({
        title: "Error",
        description: "No. rawat tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    if (!currentDoctorCode) {
      toast({
        title: "Error",
        description: "Identitas dokter login tidak ditemukan",
        variant: "destructive",
      });
      return;
    }

    if (!formData.tanggal || !formData.jam || !formData.catatan.trim()) {
      toast({
        title: "Error",
        description: "Tanggal, jam, dan catatan wajib diisi",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        no_rawat: noRawat,
        tanggal: formData.tanggal,
        jam: formData.jam,
        kd_dokter: editingItem?.original_kd_dokter || currentDoctorCode,
        catatan: formData.catatan,
        original_tanggal: editingItem?.original_tanggal,
        original_jam: editingItem?.original_jam,
        original_kd_dokter: editingItem?.original_kd_dokter,
      };

      const response = await fetch(API_URLS.PATIENT_NOTES, {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menyimpan catatan pasien');
      }

      if (editingItem) {
        toast({
          title: "Berhasil",
          description: "Catatan pasien berhasil diperbarui",
        });
      } else {
        toast({
          title: "Berhasil",
          description: "Catatan pasien berhasil ditambahkan",
        });
      }

      await fetchNotes();
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menyimpan catatan pasien",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: PatientNote) => {
    setEditingItem(item);
    setFormData({
      tanggal: item.tanggal,
      jam: item.jam,
      no_rawat: item.no_rawat,
      kd_dokter: item.kd_dokter,
      catatan: item.catatan,
      petugas: item.petugas,
      original_tanggal: item.original_tanggal,
      original_jam: item.original_jam,
      original_kd_dokter: item.original_kd_dokter,
    });
    setShowForm(true);
  };

  const handleDelete = async (item: PatientNote) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan ini?')) {
      const deleteKey = `${item.original_tanggal || item.tanggal}-${item.original_jam || item.jam}-${item.original_kd_dokter || item.kd_dokter}`;
      setDeletingKey(deleteKey);
      try {
        const response = await fetch(API_URLS.PATIENT_NOTES, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            no_rawat: noRawat,
            tanggal: item.original_tanggal || item.tanggal,
            jam: item.original_jam || item.jam,
            kd_dokter: item.original_kd_dokter || item.kd_dokter,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Gagal menghapus catatan pasien');
        }

        await fetchNotes();
        toast({
          title: "Berhasil",
          description: "Catatan pasien berhasil dihapus",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Gagal menghapus catatan pasien",
          variant: "destructive",
        });
      } finally {
        setDeletingKey(null);
      }
    }
  };

  const resetForm = () => {
    setFormData(createDefaultForm());
    setEditingItem(null);
    setShowForm(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            Catatan Pasien
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              <div>
                No. Rawat: <span className="font-medium text-foreground">{noRawat || '-'}</span>
              </div>
              <div>
                No. RM: <span className="font-medium text-foreground">{noRkmMedis || '-'}</span>
              </div>
            </div>
            <Button onClick={() => setShowForm(true)} disabled={!noRawat}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Catatan
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? 'Edit Catatan' : 'Tambah Catatan Baru'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="tanggal">Tanggal</Label>
                    <Input
                      type="date"
                      id="tanggal"
                      value={formData.tanggal}
                      onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="jam">Jam</Label>
                    <Input
                      type="time"
                      id="jam"
                      value={formData.jam}
                      onChange={(e) => setFormData(prev => ({ ...prev, jam: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="petugas">Petugas</Label>
                    <Input
                      type="text"
                      id="petugas"
                      value={editingItem?.petugas || currentDoctorName}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="catatan">Catatan</Label>
                  <Textarea
                    id="catatan"
                    value={formData.catatan}
                    onChange={(e) => setFormData(prev => ({ ...prev, catatan: e.target.value }))}
                    rows={4}
                    placeholder="Tulis catatan untuk pasien..."
                    maxLength={700}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.catatan.length}/700 karakter
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Simpan
                  </Button>
                  <Button variant="outline" onClick={resetForm} disabled={saving}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes List */}
          <div className="space-y-3">
            {loading && (
              <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memuat catatan pasien...
              </div>
            )}
            {!loading && notes.map((note) => {
              const noteKey = `${note.original_tanggal || note.tanggal}-${note.original_jam || note.jam}-${note.original_kd_dokter || note.kd_dokter}`;
              const noteDateTime = [note.tanggal, note.jam].filter(Boolean).join(' ');
              return (
              <Card key={noteKey}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <span>{formatUIDateTime(noteDateTime)}</span>
                        <span>•</span>
                        <span>{note.petugas}</span>
                      </div>
                      <p className="text-sm">{note.catatan}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(note)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(note)} disabled={deletingKey === noteKey}>
                        {deletingKey === noteKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )})}
            {!loading && notes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada catatan untuk pasien ini
              </div>
            )}
          </div>

          <div className="flex justify-start pt-2">
            <Button
              variant="outline"
              disabled={!noRkmMedis}
              onClick={() => void handleTogglePreviousVisitNotes(!showPreviousVisitNotes)}
            >
              <History className="h-4 w-4 mr-2" />
              See more
              {showPreviousVisitNotes ? (
                <ChevronUp className="h-4 w-4 ml-2" />
              ) : (
                <ChevronDown className="h-4 w-4 ml-2" />
              )}
            </Button>
          </div>

          <Collapsible open={showPreviousVisitNotes}>
            <CollapsibleContent className="space-y-3">
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Riwayat Catatan Kunjungan Sebelumnya</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {previousVisitLoading && (
                    <div className="py-6 flex items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memuat riwayat catatan...
                    </div>
                  )}
                  {!previousVisitLoading && previousVisitNotes.map((note) => {
                    const noteKey = `history-${note.original_tanggal || note.tanggal}-${note.original_jam || note.jam}-${note.original_kd_dokter || note.kd_dokter}-${note.no_rawat || ''}`;
                    const noteDateTime = [note.tanggal, note.jam].filter(Boolean).join(' ');
                    return (
                      <Card key={noteKey}>
                        <CardContent className="pt-4">
                          <div className="space-y-2">
                            <div className="flex flex-col gap-1 text-sm text-muted-foreground md:flex-row md:flex-wrap md:items-center md:gap-2">
                              <span>{formatUIDateTime(noteDateTime)}</span>
                              <span className="hidden md:inline">•</span>
                              <span>{note.petugas}</span>
                              {note.no_rawat ? (
                                <>
                                  <span className="hidden md:inline">•</span>
                                  <span>No. Rawat {note.no_rawat}</span>
                                </>
                              ) : null}
                              {note.tgl_registrasi ? (
                                <>
                                  <span className="hidden md:inline">•</span>
                                  <span>Kunjungan {formatUIDate(note.tgl_registrasi)}</span>
                                </>
                              ) : null}
                              {note.nm_poli ? (
                                <>
                                  <span className="hidden md:inline">•</span>
                                  <span>{note.nm_poli}</span>
                                </>
                              ) : null}
                              {note.status_lanjut ? (
                                <>
                                  <span className="hidden md:inline">•</span>
                                  <span>{note.status_lanjut}</span>
                                </>
                              ) : null}
                            </div>
                            <p className="text-sm">{note.catatan}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {!previousVisitLoading && previousVisitLoaded && previousVisitNotes.length === 0 && (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      Belum ada riwayat catatan kunjungan sebelumnya
                    </div>
                  )}
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
};
