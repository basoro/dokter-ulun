import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Edit, Trash2, StickyNote } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface PatientNote {
  id?: string;
  tanggal: string;
  catatan: string;
  petugas: string;
}

interface PatientNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const PatientNotesModal: React.FC<PatientNotesModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [notes, setNotes] = useState<PatientNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<PatientNote | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<PatientNote>({
    tanggal: new Date().toISOString().split('T')[0],
    catatan: '',
    petugas: 'Dr. Current User'
  });
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchNotes();
    }
  }, [isOpen]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with real API call
      setNotes([
        {
          id: '1',
          tanggal: '2025-01-15',
          catatan: 'Pasien menunjukkan perbaikan kondisi setelah pemberian obat.',
          petugas: 'Dr. Sarah'
        },
        {
          id: '2',
          tanggal: '2025-01-14',
          catatan: 'Pasien masih mengalami demam ringan, perlu monitoring.',
          petugas: 'Dr. Ahmad'
        }
      ]);
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

  const handleSave = async () => {
    try {
      if (editingItem) {
        // Update existing item
        setNotes(prev => prev.map(item => 
          item.id === editingItem.id ? { ...formData, id: editingItem.id } : item
        ));
        toast({
          title: "Berhasil",
          description: "Catatan pasien berhasil diperbarui",
        });
      } else {
        // Add new item
        const newItem = { ...formData, id: Date.now().toString() };
        setNotes(prev => [newItem, ...prev]);
        toast({
          title: "Berhasil",
          description: "Catatan pasien berhasil ditambahkan",
        });
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menyimpan catatan pasien",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: PatientNote) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus catatan ini?')) {
      setNotes(prev => prev.filter(item => item.id !== id));
      toast({
        title: "Berhasil",
        description: "Catatan pasien berhasil dihapus",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split('T')[0],
      catatan: '',
      petugas: 'Dr. Current User'
    });
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
          {/* Add Button */}
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(true)}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tanggal">Tanggal</Label>
                    <input
                      type="date"
                      id="tanggal"
                      value={formData.tanggal}
                      onChange={(e) => setFormData(prev => ({ ...prev, tanggal: e.target.value }))}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <Label htmlFor="petugas">Petugas</Label>
                    <input
                      type="text"
                      id="petugas"
                      value={formData.petugas}
                      onChange={(e) => setFormData(prev => ({ ...prev, petugas: e.target.value }))}
                      className="w-full p-2 border rounded"
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
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave}>Simpan</Button>
                  <Button variant="outline" onClick={resetForm}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes List */}
          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                        <span>{note.tanggal}</span>
                        <span>•</span>
                        <span>{note.petugas}</span>
                      </div>
                      <p className="text-sm">{note.catatan}</p>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(note)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(note.id!)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {notes.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada catatan untuk pasien ini
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};