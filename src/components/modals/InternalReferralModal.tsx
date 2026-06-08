import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

interface PoliOption {
  kd_poli: string;
  nm_poli: string;
}

interface DoctorOption {
  kd_dokter: string;
  nm_dokter: string;
}

interface ReferralSourceInfo {
  no_rawat: string;
  asal_kd_poli: string;
  asal_nm_poli: string;
  asal_kd_dokter: string;
  asal_nm_dokter: string;
}

interface InternalReferral {
  no_rawat: string;
  kd_dokter: string;
  kd_poli: string;
  nm_poli: string;
  nm_dokter: string;
  konsul: string;
  pemeriksaan: string;
  diagnosa: string;
  saran: string;
  original_kd_dokter?: string;
}

interface InternalReferralForm {
  kd_poli: string;
  kd_dokter: string;
  konsul: string;
  pemeriksaan: string;
  diagnosa: string;
  saran: string;
}

interface InternalReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const InternalReferralModal: React.FC<InternalReferralModalProps> = ({ isOpen, onClose, noRawat }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<InternalReferral[]>([]);
  const [poliOptions, setPoliOptions] = useState<PoliOption[]>([]);
  const [doctorOptions, setDoctorOptions] = useState<DoctorOption[]>([]);
  const [sourceInfo, setSourceInfo] = useState<ReferralSourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InternalReferral | null>(null);
  const [showForm, setShowForm] = useState(false);

  const createDefaultForm = useMemo(() => {
    return (): InternalReferralForm => ({
      kd_poli: '',
      kd_dokter: '',
      konsul: '',
      pemeriksaan: '',
      diagnosa: '',
      saran: '',
    });
  }, []);

  const [formData, setFormData] = useState<InternalReferralForm>(createDefaultForm);

  useEffect(() => {
    if (isOpen) {
      void fetchReferrals();
    }
  }, [isOpen, noRawat]);

  useEffect(() => {
    if (!showForm && !editingItem) {
      setFormData(createDefaultForm());
    }
  }, [createDefaultForm, editingItem, showForm]);

  const fetchReferrals = async () => {
    if (!noRawat) {
      setReferrals([]);
      setSourceInfo(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URLS.INTERNAL_REFERRALS}/${encodeURIComponent(noRawat)}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat rujukan internal');
      }

      setReferrals(
        (Array.isArray(result.data) ? result.data : []).map((item: any) => ({
          no_rawat: item.no_rawat,
          kd_dokter: item.kd_dokter,
          kd_poli: item.kd_poli || '',
          nm_poli: item.nm_poli || item.kd_poli || '-',
          nm_dokter: item.nm_dokter || item.kd_dokter || '-',
          konsul: item.konsul || '',
          pemeriksaan: item.pemeriksaan || '',
          diagnosa: item.diagnosa || '',
          saran: item.saran || '',
          original_kd_dokter: item.kd_dokter,
        }))
      );
      setPoliOptions(Array.isArray(result.options?.poliklinik) ? result.options.poliklinik : []);
      setDoctorOptions(Array.isArray(result.options?.doctors) ? result.options.doctors : []);
      setSourceInfo(result.meta?.source || null);
    } catch (error) {
      console.error('Error fetching internal referrals:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memuat rujukan internal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

    if (!formData.kd_poli || !formData.kd_dokter) {
      toast({
        title: "Validasi",
        description: "Poli tujuan dan dokter tujuan wajib dipilih",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        no_rawat: noRawat,
        kd_poli: formData.kd_poli,
        kd_dokter: formData.kd_dokter,
        konsul: formData.konsul,
        pemeriksaan: formData.pemeriksaan,
        diagnosa: formData.diagnosa,
        saran: formData.saran,
        original_kd_dokter: editingItem?.original_kd_dokter,
      };

      const response = await fetch(API_URLS.INTERNAL_REFERRALS, {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menyimpan rujukan internal');
      }

      await fetchReferrals();
      resetForm();

      toast({
        title: "Berhasil",
        description: editingItem
          ? "Rujukan internal berhasil diperbarui"
          : "Rujukan internal berhasil ditambahkan",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menyimpan rujukan internal",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: InternalReferral) => {
    setEditingItem(item);
    setFormData({
      kd_poli: item.kd_poli,
      kd_dokter: item.kd_dokter,
      konsul: item.konsul,
      pemeriksaan: item.pemeriksaan,
      diagnosa: item.diagnosa,
      saran: item.saran,
    });
    setShowForm(true);
  };

  const handleDelete = async (item: InternalReferral) => {
    if (!confirm('Apakah Anda yakin ingin menghapus rujukan internal ini?')) {
      return;
    }

    const deleteKey = `${item.no_rawat}-${item.original_kd_dokter || item.kd_dokter}`;
    setDeletingKey(deleteKey);
    try {
      const response = await fetch(API_URLS.INTERNAL_REFERRALS, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          no_rawat: noRawat,
          kd_dokter: item.original_kd_dokter || item.kd_dokter,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menghapus rujukan internal');
      }

      await fetchReferrals();
      toast({
        title: "Berhasil",
        description: "Rujukan internal berhasil dihapus",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menghapus rujukan internal",
        variant: "destructive",
      });
    } finally {
      setDeletingKey(null);
    }
  };

  const resetForm = () => {
    setFormData(createDefaultForm());
    setEditingItem(null);
    setShowForm(false);
  };

  const currentDoctorName = sourceInfo?.asal_nm_dokter || user?.name || user?.username || '-';
  const currentPoliName = sourceInfo?.asal_nm_poli || user?.kd_poli || '-';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5" />
            Rujukan Internal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">No. Rawat</p>
                <p className="text-sm font-semibold">{noRawat || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Asal Poli</p>
                <p className="text-sm font-semibold">{currentPoliName || '-'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dokter Perujuk</p>
                <p className="text-sm font-semibold">{currentDoctorName || '-'}</p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)} disabled={loading || saving}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Rujukan
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? 'Edit Rujukan Internal' : 'Tambah Rujukan Internal'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="kd_poli">Poli Tujuan</Label>
                    <select
                      id="kd_poli"
                      value={formData.kd_poli}
                      onChange={(e) => setFormData((prev) => ({ ...prev, kd_poli: e.target.value }))}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      disabled={saving}
                    >
                      <option value="">Pilih Poli Tujuan</option>
                      {poliOptions.map((poli) => (
                        <option key={poli.kd_poli} value={poli.kd_poli}>
                          {poli.nm_poli}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="kd_dokter">Dokter Tujuan</Label>
                    <select
                      id="kd_dokter"
                      value={formData.kd_dokter}
                      onChange={(e) => setFormData((prev) => ({ ...prev, kd_dokter: e.target.value }))}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      disabled={saving}
                    >
                      <option value="">Pilih Dokter Tujuan</option>
                      {doctorOptions.map((doctor) => (
                        <option key={doctor.kd_dokter} value={doctor.kd_dokter}>
                          {doctor.nm_dokter}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="konsul">Konsul</Label>
                    <Textarea
                      id="konsul"
                      value={formData.konsul}
                      onChange={(e) => setFormData((prev) => ({ ...prev, konsul: e.target.value }))}
                      rows={3}
                      disabled={saving}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="pemeriksaan">Pemeriksaan</Label>
                    <Textarea
                      id="pemeriksaan"
                      value={formData.pemeriksaan}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pemeriksaan: e.target.value }))}
                      rows={3}
                      disabled={saving}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="diagnosa">Diagnosa</Label>
                    <Textarea
                      id="diagnosa"
                      value={formData.diagnosa}
                      onChange={(e) => setFormData((prev) => ({ ...prev, diagnosa: e.target.value }))}
                      rows={3}
                      disabled={saving}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="saran">Saran</Label>
                    <Textarea
                      id="saran"
                      value={formData.saran}
                      onChange={(e) => setFormData((prev) => ({ ...prev, saran: e.target.value }))}
                      rows={3}
                      disabled={saving}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                  </Button>
                  <Button variant="outline" onClick={resetForm} disabled={saving}>
                    Batal
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Memuat rujukan internal...
              </div>
            ) : (
              <>
                {referrals.map((referral) => {
                  const itemKey = `${referral.no_rawat}-${referral.original_kd_dokter || referral.kd_dokter}`;
                  return (
                    <Card key={itemKey}>
                      <CardHeader>
                        <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-2 text-base">
                            <span className="font-medium">{currentPoliName || '-'}</span>
                            <ArrowRight className="h-4 w-4" />
                            <span className="font-medium">{referral.nm_poli || referral.kd_poli || '-'}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEdit(referral)}
                              disabled={saving || deletingKey === itemKey}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(referral)}
                              disabled={saving || deletingKey === itemKey}
                            >
                              {deletingKey === itemKey ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Dokter Perujuk</p>
                            <p className="text-sm">{currentDoctorName || '-'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Dokter Tujuan</p>
                            <p className="text-sm">{referral.nm_dokter || referral.kd_dokter || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-muted-foreground">Konsul</p>
                            <p className="whitespace-pre-wrap text-sm">{referral.konsul || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-muted-foreground">Pemeriksaan</p>
                            <p className="whitespace-pre-wrap text-sm">{referral.pemeriksaan || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-muted-foreground">Diagnosa</p>
                            <p className="whitespace-pre-wrap text-sm">{referral.diagnosa || '-'}</p>
                          </div>
                          <div className="md:col-span-2">
                            <p className="text-sm font-medium text-muted-foreground">Saran</p>
                            <p className="whitespace-pre-wrap text-sm">{referral.saran || '-'}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {referrals.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground">
                    Belum ada rujukan internal untuk pasien ini
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
