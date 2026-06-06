import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Search, Calculator } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { API_URLS } from '@/config/api';

interface ICD10Data {
  id?: string;
  kd_penyakit: string;
  nm_penyakit: string;
  ciri_ciri: string;
  keterangan: string;
  status: 'Menular' | 'Tidak Menular';
}

interface ICD9Data {
  id?: string;
  kode: string;
  deskripsi_panjang: string;
  deskripsi_pendek: string;
}

interface ICDModalProps {
  isOpen: boolean;
  onClose: () => void;
  noRawat: string;
}

export const ICDModal: React.FC<ICDModalProps> = ({ isOpen, onClose, noRawat }) => {
  const [activeTab, setActiveTab] = useState('icd10');
  const [icd10Data, setIcd10Data] = useState<ICD10Data[]>([]);
  const [icd9Data, setIcd9Data] = useState<ICD9Data[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [showTariffModal, setShowTariffModal] = useState(false);
  
  const [icd10Form, setIcd10Form] = useState<ICD10Data>({
    kd_penyakit: '',
    nm_penyakit: '',
    ciri_ciri: '',
    keterangan: '',
    status: 'Tidak Menular'
  });

  const [icd9Form, setIcd9Form] = useState<ICD9Data>({
    kode: '',
    deskripsi_panjang: '',
    deskripsi_pendek: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch ICD-10 data
      const icd10Response = await fetch(API_URLS.ICD_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          itemsPerPage: 100,
          search: '',
          icdType: 'icd10'
        })
      });
      
      if (icd10Response.ok) {
        const icd10Data = await icd10Response.json();
        setIcd10Data(icd10Data.data || []);
      }

      // Fetch ICD-9 data
      const icd9Response = await fetch(API_URLS.ICD_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: 1,
          itemsPerPage: 100,
          search: '',
          icdType: 'icd9'
        })
      });
      
      if (icd9Response.ok) {
        const icd9Data = await icd9Response.json();
        setIcd9Data(icd9Data.data || []);
      }
    } catch (error) {
      console.error('Error fetching ICD data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data ICD",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (activeTab === 'icd10') {
        if (editingItem) {
          setIcd10Data(prev => prev.map(item => 
            item.id === editingItem.id ? { ...icd10Form, id: editingItem.id } : item
          ));
          toast({ title: "Berhasil", description: "Data ICD-10 berhasil diperbarui" });
        } else {
          const newItem = { ...icd10Form, id: Date.now().toString() };
          setIcd10Data(prev => [...prev, newItem]);
          toast({ title: "Berhasil", description: "Data ICD-10 berhasil ditambahkan" });
        }
      } else {
        if (editingItem) {
          setIcd9Data(prev => prev.map(item => 
            item.id === editingItem.id ? { ...icd9Form, id: editingItem.id } : item
          ));
          toast({ title: "Berhasil", description: "Data ICD-9 berhasil diperbarui" });
        } else {
          const newItem = { ...icd9Form, id: Date.now().toString() };
          setIcd9Data(prev => [...prev, newItem]);
          toast({ title: "Berhasil", description: "Data ICD-9 berhasil ditambahkan" });
        }
      }
      resetForm();
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menyimpan data ICD",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    if (activeTab === 'icd10') {
      setIcd10Form(item);
    } else {
      setIcd9Form(item);
    }
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      if (activeTab === 'icd10') {
        setIcd10Data(prev => prev.filter(item => item.id !== id));
        toast({ title: "Berhasil", description: "Data ICD-10 berhasil dihapus" });
      } else {
        setIcd9Data(prev => prev.filter(item => item.id !== id));
        toast({ title: "Berhasil", description: "Data ICD-9 berhasil dihapus" });
      }
    }
  };

  const resetForm = () => {
    setIcd10Form({
      kd_penyakit: '',
      nm_penyakit: '',
      ciri_ciri: '',
      keterangan: '',
      status: 'Tidak Menular'
    });
    setIcd9Form({
      kode: '',
      deskripsi_panjang: '',
      deskripsi_pendek: ''
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const handleTariffSimulation = () => {
    setShowTariffModal(true);
  };

  const currentData = activeTab === 'icd10' ? icd10Data : icd9Data;
  const filteredData = currentData.filter((item: any) => {
    const searchLower = search.toLowerCase();
    if (activeTab === 'icd10') {
      return item.kd_penyakit.toLowerCase().includes(searchLower) ||
             item.nm_penyakit.toLowerCase().includes(searchLower);
    } else {
      return item.kode.toLowerCase().includes(searchLower) ||
             item.deskripsi_panjang.toLowerCase().includes(searchLower);
    }
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ICD Management System</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="icd10">ICD-10</TabsTrigger>
              <TabsTrigger value="icd9">ICD-9-CM</TabsTrigger>
            </TabsList>

            <div className="space-y-4 mt-4">
              {/* Search, Add Button, and INACBG Button */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={`Cari ${activeTab === 'icd10' ? 'kode atau nama penyakit' : 'kode atau deskripsi'}...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Tambah
                </Button>
                <Button variant="outline" onClick={handleTariffSimulation}>
                  <Calculator className="h-4 w-4 mr-2" />
                  Tarif INACBG's
                </Button>
              </div>

              <TabsContent value="icd10" className="space-y-4">
                {/* ICD-10 Form */}
                {showForm && activeTab === 'icd10' && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">
                      {editingItem ? 'Edit Data ICD-10' : 'Tambah Data ICD-10'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="kd_penyakit">Kode Penyakit</Label>
                        <Input
                          id="kd_penyakit"
                          value={icd10Form.kd_penyakit}
                          onChange={(e) => setIcd10Form(prev => ({ ...prev, kd_penyakit: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <select
                          id="status"
                          value={icd10Form.status}
                          onChange={(e) => setIcd10Form(prev => ({ ...prev, status: e.target.value as 'Menular' | 'Tidak Menular' }))}
                          className="w-full p-2 border rounded"
                        >
                          <option value="Tidak Menular">Tidak Menular</option>
                          <option value="Menular">Menular</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="nm_penyakit">Nama Penyakit</Label>
                        <Input
                          id="nm_penyakit"
                          value={icd10Form.nm_penyakit}
                          onChange={(e) => setIcd10Form(prev => ({ ...prev, nm_penyakit: e.target.value }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="ciri_ciri">Ciri-ciri</Label>
                        <Textarea
                          id="ciri_ciri"
                          value={icd10Form.ciri_ciri}
                          onChange={(e) => setIcd10Form(prev => ({ ...prev, ciri_ciri: e.target.value }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="keterangan">Keterangan</Label>
                        <Input
                          id="keterangan"
                          value={icd10Form.keterangan}
                          onChange={(e) => setIcd10Form(prev => ({ ...prev, keterangan: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave}>Simpan</Button>
                      <Button variant="outline" onClick={resetForm}>Batal</Button>
                    </div>
                  </div>
                )}

                {/* ICD-10 Data Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Nama Penyakit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Keterangan</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item: any, index: number) => (
                        <TableRow key={item.kd_penyakit || item.id || index}>
                          <TableCell className="font-mono">{item.kd_penyakit}</TableCell>
                          <TableCell>{item.nm_penyakit}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.status === 'Menular' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {item.status}
                            </span>
                          </TableCell>
                          <TableCell>{item.keterangan}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id!)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="icd9" className="space-y-4">
                {/* ICD-9 Form */}
                {showForm && activeTab === 'icd9' && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-semibold">
                      {editingItem ? 'Edit Data ICD-9' : 'Tambah Data ICD-9'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="kode">Kode ICD-9</Label>
                        <Input
                          id="kode"
                          value={icd9Form.kode}
                          onChange={(e) => setIcd9Form(prev => ({ ...prev, kode: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="deskripsi_pendek">Deskripsi Pendek</Label>
                        <Input
                          id="deskripsi_pendek"
                          value={icd9Form.deskripsi_pendek}
                          onChange={(e) => setIcd9Form(prev => ({ ...prev, deskripsi_pendek: e.target.value }))}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="deskripsi_panjang">Deskripsi Panjang</Label>
                        <Input
                          id="deskripsi_panjang"
                          value={icd9Form.deskripsi_panjang}
                          onChange={(e) => setIcd9Form(prev => ({ ...prev, deskripsi_panjang: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSave}>Simpan</Button>
                      <Button variant="outline" onClick={resetForm}>Batal</Button>
                    </div>
                  </div>
                )}

                {/* ICD-9 Data Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kode</TableHead>
                        <TableHead>Deskripsi Pendek</TableHead>
                        <TableHead>Deskripsi Panjang</TableHead>
                        <TableHead>Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredData.map((item: any, index: number) => (
                        <TableRow key={item.kode || item.id || index}>
                          <TableCell className="font-mono">{item.kode}</TableCell>
                          <TableCell>{item.deskripsi_pendek}</TableCell>
                          <TableCell>{item.deskripsi_panjang}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(item.id!)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* INACBG Tariff Simulation Modal */}
      <Dialog open={showTariffModal} onOpenChange={setShowTariffModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Simulasi Tarif INACBG's</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="tanggal_lahir">Tanggal Lahir</Label>
                <Input type="date" id="tanggal_lahir" />
              </div>
              <div>
                <Label htmlFor="jenis_kelamin">Jenis Kelamin</Label>
                <select id="jenis_kelamin" className="w-full p-2 border rounded">
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <div>
                <Label htmlFor="jenis_rawat">Jenis Rawat</Label>
                <select id="jenis_rawat" className="w-full p-2 border rounded">
                  <option value="">Pilih Jenis Rawat</option>
                  <option value="Rawat Jalan">Rawat Jalan</option>
                  <option value="Rawat Inap">Rawat Inap</option>
                </select>
              </div>
            </div>

            {/* Care Class */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="kelas_rawat">Kelas Rawat</Label>
                <select id="kelas_rawat" className="w-full p-2 border rounded">
                  <option value="">Pilih Kelas Rawat</option>
                  <option value="1">Kelas 1</option>
                  <option value="2">Kelas 2</option>
                  <option value="3">Kelas 3</option>
                </select>
              </div>
            </div>

            {/* Primary Diagnosis */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Diagnosa</h3>
              <div>
                <Label htmlFor="diagnosa_primer">Diagnosa Primer</Label>
                <Input id="diagnosa_primer" placeholder="Masukkan diagnosa primer..." />
              </div>
              
              {/* Secondary Diagnosis - Repeatable */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Diagnosa Sekunder</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const container = document.getElementById('secondary-diagnosis-container');
                      if (container) {
                        const newInput = document.createElement('div');
                        newInput.className = 'flex gap-2 items-center';
                        newInput.innerHTML = `
                          <input class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Masukkan diagnosa sekunder..." />
                          <button type="button" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10" onclick="this.parentElement.remove()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          </button>
                        `;
                        container.appendChild(newInput);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah
                  </Button>
                </div>
                <div id="secondary-diagnosis-container" className="space-y-2">
                  <Input placeholder="Masukkan diagnosa sekunder..." />
                </div>
              </div>
            </div>

            {/* Procedures */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Prosedur</h3>
              <div>
                <Label htmlFor="prosedur_primer">Prosedur Primer</Label>
                <Input id="prosedur_primer" placeholder="Masukkan prosedur primer..." />
              </div>
              
              {/* Secondary Procedures - Repeatable */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Prosedur Sekunder</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const container = document.getElementById('secondary-procedure-container');
                      if (container) {
                        const newInput = document.createElement('div');
                        newInput.className = 'flex gap-2 items-center';
                        newInput.innerHTML = `
                          <input class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" placeholder="Masukkan prosedur sekunder..." />
                          <button type="button" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10" onclick="this.parentElement.remove()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                          </button>
                        `;
                        container.appendChild(newInput);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah
                  </Button>
                </div>
                <div id="secondary-procedure-container" className="space-y-2">
                  <Input placeholder="Masukkan prosedur sekunder..." />
                </div>
              </div>
            </div>

            {/* Simulation Result */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-4">Hasil Simulasi</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Kode CBG</p>
                  <p className="font-semibold">-</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Severity Level</p>
                  <p className="font-semibold">-</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tarif INA-CBG's</p>
                  <p className="font-semibold text-green-600">Rp 0</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTariffModal(false)}>
                Tutup
              </Button>
              <Button>
                <Calculator className="h-4 w-4 mr-2" />
                Simulasi
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};