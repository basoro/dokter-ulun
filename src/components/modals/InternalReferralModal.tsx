import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, ArrowRight, Clock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface InternalReferral {
  id?: string;
  tanggal_rujukan: string;
  dari_poli: string;
  ke_poli: string;
  dokter_pengirim: string;
  dokter_tujuan: string;
  diagnosa: string;
  alasan_rujukan: string;
  catatan: string;
  status: 'Pending' | 'Diterima' | 'Selesai';
  prioritas: 'Normal' | 'Cito' | 'Urgent';
}

interface InternalReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const InternalReferralModal: React.FC<InternalReferralModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [referrals, setReferrals] = useState<InternalReferral[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<InternalReferral | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<InternalReferral>({
    tanggal_rujukan: new Date().toISOString().split('T')[0],
    dari_poli: '',
    ke_poli: '',
    dokter_pengirim: '',
    dokter_tujuan: '',
    diagnosa: '',
    alasan_rujukan: '',
    catatan: '',
    status: 'Pending',
    prioritas: 'Normal'
  });
  const { toast } = useToast();

  const poliklinikOptions = [
    'Poli Umum', 'Poli Anak', 'Poli Kandungan', 'Poli Bedah', 'Poli Mata',
    'Poli THT', 'Poli Jantung', 'Poli Paru', 'Poli Saraf', 'Poli Kulit'
  ];

  useEffect(() => {
    if (isOpen) {
      fetchReferrals();
    }
  }, [isOpen]);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with real API call
      setReferrals([
        {
          id: '1',
          tanggal_rujukan: '2025-01-15',
          dari_poli: 'Poli Umum',
          ke_poli: 'Poli Jantung',
          dokter_pengirim: 'Dr. Ahmad',
          dokter_tujuan: 'Dr. Sarah',
          diagnosa: 'Hipertensi Stage 2',
          alasan_rujukan: 'Evaluasi lebih lanjut hipertensi dengan komplikasi',
          catatan: 'Pasien sudah diberi ACE inhibitor, monitoring diperlukan',
          status: 'Diterima',
          prioritas: 'Normal'
        }
      ]);
    } catch (error) {
      console.error('Error fetching referrals:', error);
      toast({
        title: "Error",
        description: "Gagal memuat rujukan internal",
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
        setReferrals(prev => prev.map(item => 
          item.id === editingItem.id ? { ...formData, id: editingItem.id } : item
        ));
        toast({
          title: "Berhasil",
          description: "Rujukan internal berhasil diperbarui",
        });
      } else {
        // Add new item
        const newItem = { ...formData, id: Date.now().toString() };
        setReferrals(prev => [newItem, ...prev]);
        toast({
          title: "Berhasil",
          description: "Rujukan internal berhasil ditambahkan",
        });
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menyimpan rujukan internal",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: InternalReferral) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus rujukan ini?')) {
      setReferrals(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Berhasil",
        description: "Rujukan internal berhasil dihapus",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal_rujukan: new Date().toISOString().split('T')[0],
      dari_poli: '',
      ke_poli: '',
      dokter_pengirim: '',
      dokter_tujuan: '',
      diagnosa: '',
      alasan_rujukan: '',
      catatan: '',
      status: 'Pending',
      prioritas: 'Normal'
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      'Pending': 'default',
      'Diterima': 'secondary',
      'Selesai': 'default'
    } as const;
    return <Badge variant={variants[status as keyof typeof variants] || 'default'}>{status}</Badge>;
  };

  const getPriorityBadge = (prioritas: string) => {
    const variants = {
      'Normal': 'outline',
      'Cito': 'secondary',
      'Urgent': 'destructive'
    } as const;
    return <Badge variant={variants[prioritas as keyof typeof variants] || 'outline'}>{prioritas}</Badge>;
  };

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
          {/* Add Button */}
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Rujukan
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? 'Edit Rujukan Internal' : 'Tambah Rujukan Internal'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="tanggal_rujukan">Tanggal Rujukan</Label>
                    <input
                      type="date"
                      id="tanggal_rujukan"
                      value={formData.tanggal_rujukan}
                      onChange={(e) => setFormData(prev => ({ ...prev, tanggal_rujukan: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <Label htmlFor="prioritas">Prioritas</Label>
                    <select
                      id="prioritas"
                      value={formData.prioritas}
                      onChange={(e) => setFormData(prev => ({ ...prev, prioritas: e.target.value as any }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Cito">Cito</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Diterima">Diterima</option>
                      <option value="Selesai">Selesai</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="dari_poli">Dari Poliklinik</Label>
                    <select
                      id="dari_poli"
                      value={formData.dari_poli}
                      onChange={(e) => setFormData(prev => ({ ...prev, dari_poli: e.target.value }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Pilih Poliklinik</option>
                      {poliklinikOptions.map(poli => (
                        <option key={poli} value={poli}>{poli}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="ke_poli">Ke Poliklinik</Label>
                    <select
                      id="ke_poli"
                      value={formData.ke_poli}
                      onChange={(e) => setFormData(prev => ({ ...prev, ke_poli: e.target.value }))}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Pilih Poliklinik</option>
                      {poliklinikOptions.map(poli => (
                        <option key={poli} value={poli}>{poli}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="dokter_pengirim">Dokter Pengirim</Label>
                    <Input
                      id="dokter_pengirim"
                      value={formData.dokter_pengirim}
                      onChange={(e) => setFormData(prev => ({ ...prev, dokter_pengirim: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dokter_tujuan">Dokter Tujuan</Label>
                    <Input
                      id="dokter_tujuan"
                      value={formData.dokter_tujuan}
                      onChange={(e) => setFormData(prev => ({ ...prev, dokter_tujuan: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="diagnosa">Diagnosa</Label>
                    <Input
                      id="diagnosa"
                      value={formData.diagnosa}
                      onChange={(e) => setFormData(prev => ({ ...prev, diagnosa: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label htmlFor="alasan_rujukan">Alasan Rujukan</Label>
                    <Textarea
                      id="alasan_rujukan"
                      value={formData.alasan_rujukan}
                      onChange={(e) => setFormData(prev => ({ ...prev, alasan_rujukan: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label htmlFor="catatan">Catatan</Label>
                    <Textarea
                      id="catatan"
                      value={formData.catatan}
                      onChange={(e) => setFormData(prev => ({ ...prev, catatan: e.target.value }))}
                      rows={2}
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

          {/* Referrals List */}
          <div className="space-y-3">
            {referrals.map((referral) => (
              <Card key={referral.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {referral.tanggal_rujukan}
                    </div>
                    <div className="flex gap-2">
                      {getPriorityBadge(referral.prioritas)}
                      {getStatusBadge(referral.status)}
                      <Button size="sm" variant="outline" onClick={() => handleEdit(referral)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(referral.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{referral.dari_poli}</span>
                    <ArrowRight className="h-4 w-4" />
                    <span className="font-medium">{referral.ke_poli}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dokter Pengirim</p>
                      <p className="text-sm">{referral.dokter_pengirim}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dokter Tujuan</p>
                      <p className="text-sm">{referral.dokter_tujuan}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa</p>
                      <p className="text-sm">{referral.diagnosa}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Alasan Rujukan</p>
                      <p className="text-sm">{referral.alasan_rujukan}</p>
                    </div>
                    {referral.catatan && (
                      <div className="md:col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">Catatan</p>
                        <p className="text-sm">{referral.catatan}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {referrals.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada rujukan internal untuk pasien ini
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};