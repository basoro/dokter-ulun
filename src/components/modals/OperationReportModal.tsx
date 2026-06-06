import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Scissors, Calendar } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface OperationReport {
  id?: string;
  tanggal_operasi: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_operasi: string;
  diagnosa_pre_operasi: string;
  diagnosa_post_operasi: string;
  operator_utama: string;
  asisten_operator: string;
  dokter_anestesi: string;
  jenis_anestesi: string;
  laporan_operasi: string;
  komplikasi: string;
  kondisi_post_operasi: string;
  instruksi_post_operasi: string;
  status: 'Scheduled' | 'Ongoing' | 'Completed' | 'Cancelled';
}

interface OperationReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const OperationReportModal: React.FC<OperationReportModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [reports, setReports] = useState<OperationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<OperationReport | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<OperationReport>({
    tanggal_operasi: new Date().toISOString().split('T')[0],
    jam_mulai: '',
    jam_selesai: '',
    jenis_operasi: '',
    diagnosa_pre_operasi: '',
    diagnosa_post_operasi: '',
    operator_utama: '',
    asisten_operator: '',
    dokter_anestesi: '',
    jenis_anestesi: '',
    laporan_operasi: '',
    komplikasi: '',
    kondisi_post_operasi: '',
    instruksi_post_operasi: '',
    status: 'Scheduled'
  });
  const { toast } = useToast();

  const anesthesiaTypes = [
    'General Anesthesia', 'Spinal Anesthesia', 'Epidural Anesthesia', 
    'Local Anesthesia', 'Regional Anesthesia', 'Sedation'
  ];

  useEffect(() => {
    if (isOpen) {
      fetchReports();
    }
  }, [isOpen]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with real API call
      setReports([
        {
          id: '1',
          tanggal_operasi: '2025-01-15',
          jam_mulai: '08:00',
          jam_selesai: '10:30',
          jenis_operasi: 'Appendectomy',
          diagnosa_pre_operasi: 'Appendicitis Acute',
          diagnosa_post_operasi: 'Post Appendectomy',
          operator_utama: 'Dr. Ahmad Bedah',
          asisten_operator: 'Dr. Sarah',
          dokter_anestesi: 'Dr. Budi',
          jenis_anestesi: 'General Anesthesia',
          laporan_operasi: 'Operasi appendectomy laparoscopic dilakukan dengan sukses. Tidak ada komplikasi intraoperatif.',
          komplikasi: 'Tidak ada',
          kondisi_post_operasi: 'Stabil',
          instruksi_post_operasi: 'NPO 6 jam, mobilisasi bertahap, antibiotik profilaksis',
          status: 'Completed'
        }
      ]);
    } catch (error) {
      console.error('Error fetching operation reports:', error);
      toast({
        title: "Error",
        description: "Gagal memuat laporan operasi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        // Update existing item
        setReports(prev => prev.map(item => 
          item.id === editingItem.id ? { ...formData, id: editingItem.id } : item
        ));
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil diperbarui",
        });
      } else {
        // Add new item
        const newItem = { ...formData, id: Date.now().toString() };
        setReports(prev => [newItem, ...prev]);
        toast({
          title: "Berhasil",
          description: "Laporan operasi berhasil ditambahkan",
        });
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menyimpan laporan operasi",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: OperationReport) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus laporan operasi ini?')) {
      setReports(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Berhasil",
        description: "Laporan operasi berhasil dihapus",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal_operasi: new Date().toISOString().split('T')[0],
      jam_mulai: '',
      jam_selesai: '',
      jenis_operasi: '',
      diagnosa_pre_operasi: '',
      diagnosa_post_operasi: '',
      operator_utama: '',
      asisten_operator: '',
      dokter_anestesi: '',
      jenis_anestesi: '',
      laporan_operasi: '',
      komplikasi: '',
      kondisi_post_operasi: '',
      instruksi_post_operasi: '',
      status: 'Scheduled'
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'Scheduled': 'outline',
      'Ongoing': 'secondary',
      'Completed': 'default',
      'Cancelled': 'destructive'
    } as const;
    return <Badge variant={variants[status as keyof typeof variants] || 'outline'}>{status}</Badge>;
  };

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
            <Button onClick={() => setShowForm(true)}>
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="tanggal_operasi">Tanggal Operasi</Label>
                    <input
                      type="date"
                      id="tanggal_operasi"
                      value={formData.tanggal_operasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, tanggal_operasi: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <Label htmlFor="jam_mulai">Jam Mulai</Label>
                    <input
                      type="time"
                      id="jam_mulai"
                      value={formData.jam_mulai}
                      onChange={(e) => setFormData(prev => ({ ...prev, jam_mulai: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <Label htmlFor="jam_selesai">Jam Selesai</Label>
                    <input
                      type="time"
                      id="jam_selesai"
                      value={formData.jam_selesai}
                      onChange={(e) => setFormData(prev => ({ ...prev, jam_selesai: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="jenis_operasi">Jenis Operasi</Label>
                    <Input
                      id="jenis_operasi"
                      value={formData.jenis_operasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, jenis_operasi: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="operator_utama">Operator Utama</Label>
                    <Input
                      id="operator_utama"
                      value={formData.operator_utama}
                      onChange={(e) => setFormData(prev => ({ ...prev, operator_utama: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="asisten_operator">Asisten Operator</Label>
                    <Input
                      id="asisten_operator"
                      value={formData.asisten_operator}
                      onChange={(e) => setFormData(prev => ({ ...prev, asisten_operator: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dokter_anestesi">Dokter Anestesi</Label>
                    <Input
                      id="dokter_anestesi"
                      value={formData.dokter_anestesi}
                      onChange={(e) => setFormData(prev => ({ ...prev, dokter_anestesi: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="jenis_anestesi">Jenis Anestesi</Label>
                    <select
                      id="jenis_anestesi"
                      value={formData.jenis_anestesi}
                      onChange={(e) => setFormData(prev => ({ ...prev, jenis_anestesi: e.target.value }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Pilih Jenis Anestesi</option>
                      {anesthesiaTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="diagnosa_pre_operasi">Diagnosa Pre-Operasi</Label>
                    <Input
                      id="diagnosa_pre_operasi"
                      value={formData.diagnosa_pre_operasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, diagnosa_pre_operasi: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="diagnosa_post_operasi">Diagnosa Post-Operasi</Label>
                    <Input
                      id="diagnosa_post_operasi"
                      value={formData.diagnosa_post_operasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, diagnosa_post_operasi: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label htmlFor="laporan_operasi">Laporan Operasi</Label>
                    <Textarea
                      id="laporan_operasi"
                      value={formData.laporan_operasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, laporan_operasi: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="komplikasi">Komplikasi</Label>
                    <Textarea
                      id="komplikasi"
                      value={formData.komplikasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, komplikasi: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="kondisi_post_operasi">Kondisi Post-Operasi</Label>
                    <Textarea
                      id="kondisi_post_operasi"
                      value={formData.kondisi_post_operasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, kondisi_post_operasi: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label htmlFor="instruksi_post_operasi">Instruksi Post-Operasi</Label>
                    <Textarea
                      id="instruksi_post_operasi"
                      value={formData.instruksi_post_operasi}
                      onChange={(e) => setFormData(prev => ({ ...prev, instruksi_post_operasi: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave}>Simpan</Button>
                  <Button variant="outline" onClick={resetForm}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reports List */}
          <div className="space-y-3">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {report.jenis_operasi} - {report.tanggal_operasi}
                    </div>
                    <div className="flex gap-2">
                      {getStatusBadge(report.status)}
                      <Button size="sm" variant="outline" onClick={() => handleEdit(report)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(report.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Waktu Operasi</p>
                      <p className="text-sm">{report.jam_mulai} - {report.jam_selesai}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Operator Utama</p>
                      <p className="text-sm">{report.operator_utama}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Jenis Anestesi</p>
                      <p className="text-sm">{report.jenis_anestesi}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa</p>
                      <p className="text-sm">{report.diagnosa_pre_operasi} → {report.diagnosa_post_operasi}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {reports.length === 0 && (
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