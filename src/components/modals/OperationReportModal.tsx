import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Scissors, Calendar, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';
import { useAuth } from '@/contexts/AuthContext';

interface OperationReport {
  id?: number;
  no_rawat: string;
  kd_dokter: string;
  tanggal_op: string;
  hasil_op: string;
  pre_op: string;
  post_op: string;
  implan: string;
  kirim_pa: 'Ya' | 'Tidak';
  nm_op: string;
  created_at?: string;
}

interface OperationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const OperationReportModal: React.FC<OperationReportModalProps> = ({ isOpen, onClose, noRawat }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<OperationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingItem, setEditingItem] = useState<OperationReport | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<OperationReport>({
    id: undefined,
    no_rawat: noRawat,
    kd_dokter: user?.kd_dokter || user?.username || '',
    tanggal_op: new Date().toISOString().slice(0, 16),
    hasil_op: '',
    pre_op: '',
    post_op: '',
    implan: '',
    kirim_pa: 'Tidak',
    nm_op: '',
    created_at: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen, noRawat]);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, no_rawat: noRawat }));
  }, [noRawat]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      kd_dokter: prev.kd_dokter || user?.kd_dokter || user?.username || '',
    }));
  }, [user]);

  const fetchReports = async () => {
    if (!noRawat) {
      setReports([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URLS.OPERATION_REPORTS}/${encodeURIComponent(noRawat)}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal memuat laporan operasi');
      }

      setReports(result.data || []);
    } catch (error) {
      console.error('Error fetching operation reports:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal memuat laporan operasi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const requestBody = {
        ...formData,
        no_rawat: noRawat,
        kd_dokter: formData.kd_dokter || user?.kd_dokter || user?.username || '',
      };

      const response = await fetch(API_URLS.OPERATION_REPORTS, {
        method: editingItem ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Gagal menyimpan laporan operasi');
      }

      await fetchReports();
      if (editingItem) {
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil diperbarui",
        });
      } else {
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil ditambahkan",
        });
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Gagal menyimpan laporan operasi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: OperationReport) => {
    setEditingItem(item);
    setFormData({
      ...item,
      no_rawat: noRawat,
      original_tanggal: item.original_tanggal || item.tanggal,
    });
    setShowForm(true);
  };

  const handleDelete = async (item: OperationReport) => {
    if (confirm('Apakah Anda yakin ingin menghapus laporan operasi ini?')) {
      try {
        setDeleting(true);
        const response = await fetch(API_URLS.OPERATION_REPORTS, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            no_rawat: noRawat,
            id: item.id,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Gagal menghapus laporan operasi');
        }

        await fetchReports();
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil dihapus",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Gagal menghapus laporan operasi",
          variant: "destructive",
        });
      } finally {
        setDeleting(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      id: undefined,
      no_rawat: noRawat,
      kd_dokter: user?.kd_dokter || user?.username || '',
      tanggal_op: new Date().toISOString().slice(0, 16),
      hasil_op: '',
      pre_op: '',
      post_op: '',
      implan: '',
      kirim_pa: 'Tidak',
      nm_op: '',
      created_at: '',
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const getPaBadge = (permintaanPa: string) => (
    <Badge variant={permintaanPa === 'Ya' ? 'default' : 'outline'}>{permintaanPa === 'Ya' ? 'PA: Ya' : 'PA: Tidak'}</Badge>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5" />
            Laporan Operasi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Button */}
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)} disabled={loading || saving}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Laporan
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? 'Edit Laporan Operasi' : 'Tambah Laporan Operasi'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tanggal_operasi">Tanggal Operasi</Label>
                    <Input
                      type="datetime-local"
                      id="tanggal_operasi"
                      value={formData.tanggal_op}
                      onChange={(e) => setFormData(prev => ({ ...prev, tanggal_op: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nm_op">Nama Operasi</Label>
                    <Input id="nm_op" value={formData.nm_op} onChange={(e) => setFormData(prev => ({ ...prev, nm_op: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="diagnosa_pre_operasi">Diagnosa Pre-Operasi</Label>
                    <Input
                      id="diagnosa_pre_operasi"
                      value={formData.pre_op}
                      onChange={(e) => setFormData(prev => ({ ...prev, pre_op: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="diagnosa_post_operasi">Diagnosa Post-Operasi</Label>
                    <Input
                      id="diagnosa_post_operasi"
                      value={formData.post_op}
                      onChange={(e) => setFormData(prev => ({ ...prev, post_op: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="implan">Implan</Label>
                    <Input
                      id="implan"
                      value={formData.implan}
                      onChange={(e) => setFormData(prev => ({ ...prev, implan: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="kirim_pa">Kirim PA</Label>
                    <select
                      id="kirim_pa"
                      value={formData.kirim_pa}
                      onChange={(e) => setFormData(prev => ({ ...prev, kirim_pa: e.target.value as 'Ya' | 'Tidak' }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="Tidak">Tidak</option>
                      <option value="Ya">Ya</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="hasil_operasi">Hasil Operasi</Label>
                    <Textarea
                      id="hasil_operasi"
                      value={formData.hasil_op}
                      onChange={(e) => setFormData(prev => ({ ...prev, hasil_op: e.target.value }))}
                      rows={4}
                    />
                  </div>
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

          {/* Reports List */}
          <div className="space-y-3">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Memuat laporan operasi...
              </div>
            ) : null}
            {reports.map((report) => (
              <Card key={report.id || `${report.no_rawat}-${report.tanggal_op}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {report.nm_op || report.post_op || report.pre_op || 'Laporan Operasi'} - {report.tanggal_op}
                    </div>
                    <div className="flex gap-2">
                      {getPaBadge(report.kirim_pa)}
                      <Button size="sm" variant="outline" onClick={() => handleEdit(report)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(report)} disabled={deleting}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Tanggal Operasi</p>
                      <p className="text-sm">{report.tanggal_op}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Nama Operasi</p>
                      <p className="text-sm">{report.nm_op || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Kirim PA</p>
                      <p className="text-sm">{report.kirim_pa}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa Pre-Operasi</p>
                      <p className="text-sm">{report.pre_op}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa Post-Operasi</p>
                      <p className="text-sm">{report.post_op}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Implan</p>
                      <p className="text-sm">{report.implan || '-'}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa</p>
                      <p className="text-sm">{report.pre_op} → {report.post_op}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-sm font-medium text-muted-foreground">Hasil Operasi</p>
                      <p className="text-sm whitespace-pre-line break-words">{report.hasil_op}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!loading && reports.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada laporan operasi untuk pasien ini
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
