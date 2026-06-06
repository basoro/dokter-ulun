import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, FileText, Calendar } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface MedicalResume {
  id?: string;
  tanggal_masuk: string;
  tanggal_keluar: string;
  anamnesis: string;
  pemeriksaan_fisik: string;
  hasil_laboratorium: string;
  hasil_radiologi: string;
  diagnosa_masuk: string;
  diagnosa_keluar: string;
  tindakan: string;
  kondisi_keluar: string;
  anjuran: string;
  dokter_penanggung_jawab: string;
}

interface MedicalResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const MedicalResumeModal: React.FC<MedicalResumeModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [resumes, setResumes] = useState<MedicalResume[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<MedicalResume | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<MedicalResume>({
    tanggal_masuk: '',
    tanggal_keluar: '',
    anamnesis: '',
    pemeriksaan_fisik: '',
    hasil_laboratorium: '',
    hasil_radiologi: '',
    diagnosa_masuk: '',
    diagnosa_keluar: '',
    tindakan: '',
    kondisi_keluar: '',
    anjuran: '',
    dokter_penanggung_jawab: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchResumes();
    }
  }, [isOpen]);

  const fetchResumes = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with real API call
      setResumes([
        {
          id: '1',
          tanggal_masuk: '2025-01-10',
          tanggal_keluar: '2025-01-15',
          anamnesis: 'Pasien datang dengan keluhan demam tinggi dan batuk',
          pemeriksaan_fisik: 'TD: 120/80, Nadi: 88x/menit, RR: 20x/menit, Suhu: 38.5°C',
          hasil_laboratorium: 'Leukosit: 12.000, Hemoglobin: 12.5',
          hasil_radiologi: 'Foto thorax: Normal',
          diagnosa_masuk: 'Demam tifoid suspek',
          diagnosa_keluar: 'Demam tifoid',
          tindakan: 'Pemberian antibiotik dan simptomatik',
          kondisi_keluar: 'Membaik',
          anjuran: 'Kontrol poliklinik dalam 1 minggu',
          dokter_penanggung_jawab: 'Dr. Ahmad Santoso'
        }
      ]);
    } catch (error) {
      console.error('Error fetching resumes:', error);
      toast({
        title: "Error",
        description: "Gagal memuat resume medis",
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
        setResumes(prev => prev.map(item => 
          item.id === editingItem.id ? { ...formData, id: editingItem.id } : item
        ));
        toast({
          title: "Berhasil",
          description: "Resume medis berhasil diperbarui",
        });
      } else {
        // Add new item
        const newItem = { ...formData, id: Date.now().toString() };
        setResumes(prev => [newItem, ...prev]);
        toast({
          title: "Berhasil",
          description: "Resume medis berhasil ditambahkan",
        });
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menyimpan resume medis",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: MedicalResume) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus resume medis ini?')) {
      setResumes(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Berhasil",
        description: "Resume medis berhasil dihapus",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal_masuk: '',
      tanggal_keluar: '',
      anamnesis: '',
      pemeriksaan_fisik: '',
      hasil_laboratorium: '',
      hasil_radiologi: '',
      diagnosa_masuk: '',
      diagnosa_keluar: '',
      tindakan: '',
      kondisi_keluar: '',
      anjuran: '',
      dokter_penanggung_jawab: ''
    });
    setEditingItem(null);
    setShowForm(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Resume Medis
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Button */}
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Tambah Resume
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? 'Edit Resume Medis' : 'Tambah Resume Medis'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tanggal_masuk">Tanggal Masuk</Label>
                    <input
                      type="date"
                      id="tanggal_masuk"
                      value={formData.tanggal_masuk}
                      onChange={(e) => setFormData(prev => ({ ...prev, tanggal_masuk: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tanggal_keluar">Tanggal Keluar</Label>
                    <input
                      type="date"
                      id="tanggal_keluar"
                      value={formData.tanggal_keluar}
                      onChange={(e) => setFormData(prev => ({ ...prev, tanggal_keluar: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="anamnesis">Anamnesis</Label>
                    <Textarea
                      id="anamnesis"
                      value={formData.anamnesis}
                      onChange={(e) => setFormData(prev => ({ ...prev, anamnesis: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="pemeriksaan_fisik">Pemeriksaan Fisik</Label>
                    <Textarea
                      id="pemeriksaan_fisik"
                      value={formData.pemeriksaan_fisik}
                      onChange={(e) => setFormData(prev => ({ ...prev, pemeriksaan_fisik: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hasil_laboratorium">Hasil Laboratorium</Label>
                    <Textarea
                      id="hasil_laboratorium"
                      value={formData.hasil_laboratorium}
                      onChange={(e) => setFormData(prev => ({ ...prev, hasil_laboratorium: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="hasil_radiologi">Hasil Radiologi</Label>
                    <Textarea
                      id="hasil_radiologi"
                      value={formData.hasil_radiologi}
                      onChange={(e) => setFormData(prev => ({ ...prev, hasil_radiologi: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="diagnosa_masuk">Diagnosa Masuk</Label>
                    <Input
                      id="diagnosa_masuk"
                      value={formData.diagnosa_masuk}
                      onChange={(e) => setFormData(prev => ({ ...prev, diagnosa_masuk: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="diagnosa_keluar">Diagnosa Keluar</Label>
                    <Input
                      id="diagnosa_keluar"
                      value={formData.diagnosa_keluar}
                      onChange={(e) => setFormData(prev => ({ ...prev, diagnosa_keluar: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="tindakan">Tindakan</Label>
                    <Textarea
                      id="tindakan"
                      value={formData.tindakan}
                      onChange={(e) => setFormData(prev => ({ ...prev, tindakan: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="kondisi_keluar">Kondisi Keluar</Label>
                    <Input
                      id="kondisi_keluar"
                      value={formData.kondisi_keluar}
                      onChange={(e) => setFormData(prev => ({ ...prev, kondisi_keluar: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dokter_penanggung_jawab">Dokter Penanggung Jawab</Label>
                    <Input
                      id="dokter_penanggung_jawab"
                      value={formData.dokter_penanggung_jawab}
                      onChange={(e) => setFormData(prev => ({ ...prev, dokter_penanggung_jawab: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="anjuran">Anjuran</Label>
                    <Textarea
                      id="anjuran"
                      value={formData.anjuran}
                      onChange={(e) => setFormData(prev => ({ ...prev, anjuran: e.target.value }))}
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

          {/* Resumes List */}
          <div className="space-y-3">
            {resumes.map((resume) => (
              <Card key={resume.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Resume Medis ({resume.tanggal_masuk} - {resume.tanggal_keluar})
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(resume)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(resume.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa Masuk</p>
                      <p className="text-sm">{resume.diagnosa_masuk}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Diagnosa Keluar</p>
                      <p className="text-sm">{resume.diagnosa_keluar}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Kondisi Keluar</p>
                      <p className="text-sm">{resume.kondisi_keluar}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Dokter</p>
                      <p className="text-sm">{resume.dokter_penanggung_jawab}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {resumes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada resume medis untuk pasien ini
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};