import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from '@/lib/utils';
import { Plus, Edit, Trash2, ArrowRight, Loader2, Check, ChevronsUpDown } from 'lucide-react';
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
  const [doctorOptionsLoading, setDoctorOptionsLoading] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<ReferralSourceInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InternalReferral | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [poliOpen, setPoliOpen] = useState(false);
  const [doctorOpen, setDoctorOpen] = useState(false);

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

  const fetchDoctorOptionsBySchedule = async (kd_poli: string) => {
    if (!kd_poli) {
      setDoctorOptions([]);
      return;
    }

    setDoctorOptionsLoading(true);
    try {
      const params = new URLSearchParams({
        kd_poli
      });
      const response = await fetch(`${API_URLS.INTERNAL_REFERRAL_DOCTORS}?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat dokter tujuan');
      }

      const rows = Array.isArray(result.data) ? result.data : [];
      const options: DoctorOption[] = rows.map((doctor: any) => ({
        kd_dokter: doctor.kd_dokter,
        nm_dokter: doctor.nm_dokter
      }));

      setDoctorOptions(() => {
        const selectedDoctorCode = String(formData.kd_dokter || '').trim();
        if (!selectedDoctorCode) {
          return options;
        }

        const exists = options.some((item) => item.kd_dokter === selectedDoctorCode);
        if (exists) {
          return options;
        }

        const fallbackName = editingItem?.nm_dokter || referrals.find((item) => item.kd_dokter === selectedDoctorCode)?.nm_dokter;
        if (!fallbackName) {
          return options;
        }

        return [
          { kd_dokter: selectedDoctorCode, nm_dokter: fallbackName },
          ...options
        ];
      });
    } catch (error) {
      console.error('Error fetching doctors by schedule:', error);
      setDoctorOptions([]);
    } finally {
      setDoctorOptionsLoading(false);
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
  const currentDoctorCode = user?.kd_dokter || user?.username || '';
  const isPerujukUser = Boolean(sourceInfo?.asal_kd_dokter) && sourceInfo?.asal_kd_dokter === currentDoctorCode;
  const selectedPoliLabel = poliOptions.find((item) => item.kd_poli === formData.kd_poli)?.nm_poli;
  const selectedDoctorLabel = doctorOptions.find((item) => item.kd_dokter === formData.kd_dokter)?.nm_dokter
    || editingItem?.nm_dokter;

  useEffect(() => {
    if (!showForm) {
      setDoctorOptions([]);
      return;
    }

    if (formData.kd_poli) {
      void fetchDoctorOptionsBySchedule(formData.kd_poli);
      return;
    }

    setDoctorOptions([]);
  }, [formData.kd_poli, showForm]);

  useEffect(() => {
    if (!formData.kd_poli || !formData.kd_dokter) {
      return;
    }

    const stillAllowed = doctorOptions.some((doctor) => doctor.kd_dokter === formData.kd_dokter);
    if (!stillAllowed) {
      setFormData((prev) => ({ ...prev, kd_dokter: '' }));
    }
  }, [doctorOptions, formData.kd_dokter, formData.kd_poli]);

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
                    <Popover open={poliOpen} onOpenChange={setPoliOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="kd_poli"
                          variant="outline"
                          role="combobox"
                          aria-expanded={poliOpen}
                          className="w-full justify-between"
                          disabled={saving}
                        >
                          <span className="truncate text-left">
                            {selectedPoliLabel || 'Pilih Poli Tujuan'}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Cari poli..." />
                          <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
                            <CommandEmpty>Poli tidak ditemukan.</CommandEmpty>
                            <CommandGroup>
                              {poliOptions.map((poli) => (
                                <CommandItem
                                  key={poli.kd_poli}
                                  value={`${poli.kd_poli} ${poli.nm_poli}`}
                                  onSelect={() => {
                                    setFormData((prev) => ({
                                      ...prev,
                                      kd_poli: poli.kd_poli,
                                      kd_dokter: prev.kd_poli === poli.kd_poli ? prev.kd_dokter : '',
                                    }));
                                    setPoliOpen(false);
                                    setDoctorOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.kd_poli === poli.kd_poli ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{poli.nm_poli}</span>
                                    <span className="text-xs text-muted-foreground">{poli.kd_poli}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="kd_dokter">Dokter Tujuan</Label>
                    <Popover open={doctorOpen} onOpenChange={setDoctorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          id="kd_dokter"
                          variant="outline"
                          role="combobox"
                          aria-expanded={doctorOpen}
                          className="w-full justify-between"
                          disabled={saving || !formData.kd_poli || doctorOptionsLoading}
                        >
                          <span className="truncate text-left">
                            {doctorOptionsLoading ? 'Memuat dokter...' : (selectedDoctorLabel || 'Pilih Dokter Tujuan')}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Cari dokter..." />
                          <CommandList className="max-h-72 overflow-y-auto overscroll-contain">
                            <CommandEmpty>
                              {!formData.kd_poli
                                ? 'Pilih poli tujuan terlebih dahulu.'
                                : 'Dokter tidak ditemukan pada poli ini.'}
                            </CommandEmpty>
                            <CommandGroup>
                              {doctorOptions.map((doctor) => (
                                <CommandItem
                                  key={doctor.kd_dokter}
                                  value={`${doctor.kd_dokter} ${doctor.nm_dokter}`}
                                  onSelect={() => {
                                    setFormData((prev) => ({ ...prev, kd_dokter: doctor.kd_dokter }));
                                    setDoctorOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      formData.kd_dokter === doctor.kd_dokter ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span>{doctor.nm_dokter}</span>
                                    <span className="text-xs text-muted-foreground">{doctor.kd_dokter}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="konsul">Konsul</Label>
                    <Textarea
                      id="konsul"
                      value={formData.konsul}
                      onChange={(e) => setFormData((prev) => ({ ...prev, konsul: e.target.value }))}
                      rows={3}
                      disabled={saving}
                      readOnly={Boolean(editingItem)}
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
                              <Edit className="mr-2 h-4 w-4" />
                              Jawab Konsul
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDelete(referral)}
                              disabled={!isPerujukUser || saving || deletingKey === itemKey}
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
