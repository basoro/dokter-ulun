import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FileText, Image, Download, Trash2, Upload } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface DigitalFile {
  id?: string;
  nama_file: string;
  tipe_file: string;
  ukuran_file: string;
  tanggal_upload: string;
  deskripsi: string;
  url?: string;
}

interface DigitalFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const DigitalFilesModal: React.FC<DigitalFilesModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [files, setFiles] = useState<DigitalFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<DigitalFile>({
    nama_file: '',
    tipe_file: '',
    ukuran_file: '',
    tanggal_upload: new Date().toISOString().split('T')[0],
    deskripsi: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with real API call
      setFiles([
        {
          id: '1',
          nama_file: 'hasil_lab_2025_01_15.pdf',
          tipe_file: 'application/pdf',
          ukuran_file: '2.5 MB',
          tanggal_upload: '2025-01-15',
          deskripsi: 'Hasil laboratorium lengkap'
        },
        {
          id: '2',
          nama_file: 'xray_chest_2025_01_14.jpg',
          tipe_file: 'image/jpeg',
          ukuran_file: '1.8 MB',
          tanggal_upload: '2025-01-14',
          deskripsi: 'Foto rontgen dada PA'
        }
      ]);
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        nama_file: file.name,
        tipe_file: file.type,
        ukuran_file: (file.size / 1024 / 1024).toFixed(2) + ' MB'
      }));
    }
  };

  const handleSave = async () => {
    try {
      // Add new file
      const newFile = { ...formData, id: Date.now().toString() };
      setFiles(prev => [newFile, ...prev]);
      toast({
        title: "Berhasil",
        description: "Berkas digital berhasil diunggah",
      });
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengunggah berkas digital",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus berkas ini?')) {
      setFiles(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Berhasil",
        description: "Berkas digital berhasil dihapus",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nama_file: '',
      tipe_file: '',
      ukuran_file: '',
      tanggal_upload: new Date().toISOString().split('T')[0],
      deskripsi: ''
    });
    setShowForm(false);
  };

  const getFileIcon = (tipeFile: string) => {
    if (tipeFile.startsWith('image/')) {
      return <Image className="h-6 w-6 text-blue-500" />;
    }
    return <FileText className="h-6 w-6 text-gray-500" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Berkas Digital
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Add Button */}
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Berkas
            </Button>
          </div>

          {/* Form */}
          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Upload Berkas Baru</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="file">Pilih File</Label>
                  <input
                    type="file"
                    id="file"
                    onChange={handleFileUpload}
                    className="w-full p-2 border rounded"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  />
                </div>
                <div>
                  <Label htmlFor="nama_file">Nama File</Label>
                  <Input
                    id="nama_file"
                    value={formData.nama_file}
                    onChange={(e) => setFormData(prev => ({ ...prev, nama_file: e.target.value }))}
                    placeholder="Masukkan nama file"
                  />
                </div>
                <div>
                  <Label htmlFor="deskripsi">Deskripsi</Label>
                  <Input
                    id="deskripsi"
                    value={formData.deskripsi}
                    onChange={(e) => setFormData(prev => ({ ...prev, deskripsi: e.target.value }))}
                    placeholder="Deskripsi berkas"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </Button>
                  <Button variant="outline" onClick={resetForm}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Files List */}
          <div className="space-y-3">
            {files.map((file) => (
              <Card key={file.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.tipe_file)}
                      <div>
                        <h4 className="font-medium">{file.nama_file}</h4>
                        <p className="text-sm text-muted-foreground">{file.deskripsi}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{file.ukuran_file}</span>
                          <span>•</span>
                          <span>{file.tanggal_upload}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(file.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {files.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada berkas digital untuk pasien ini
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};