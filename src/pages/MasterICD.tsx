import React, { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Search, 
  Info, 
  ArrowUp, 
  ArrowDown,
  Clipboard, 
  ActivitySquare,
  Stethoscope,
  Filter,
  X
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PaginationControls } from "@/components/PaginationControls";
import { usePagination } from "@/hooks/usePagination";
import { API_URLS } from '@/config/api';

const MasterICD = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('icd10');
  const [sortField, setSortField] = useState('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const { paginationState, handlePageChange, handleItemsPerPageChange, updatePagination } = usePagination({
    initialItemsPerPage: 10
  });

  const fetchICDData = async (icdType: string, search: string = '') => {
    setLoading(true);
    try {
      const response = await fetch(API_URLS.ICD_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: paginationState.currentPage,
          itemsPerPage: paginationState.itemsPerPage,
          search: search,
          icdType: icdType
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('ICD data response:', data);
      
      setSearchResults(data.data || []);
      updatePagination({
        total: data.total,
        totalPages: data.totalPages
      });
      setHasSearched(true);
    } catch (error) {
      console.error('Error fetching ICD data:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data ICD",
        variant: "destructive"
      });
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    updatePagination({ page: 1 });
    fetchICDData(activeTab, searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
    updatePagination({ page: 1 });
  };
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchResults([]);
    setHasSearched(false);
    setSearchQuery('');
    updatePagination({ page: 1 });
  };
  
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Kode Disalin",
      description: `Kode ${code} berhasil disalin ke clipboard`,
    });
  };
  
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    
    const sorted = [...searchResults].sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];
      
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    setSearchResults(sorted);
  };

  useEffect(() => {
    if (hasSearched) {
      fetchICDData(activeTab, searchQuery);
    }
  }, [paginationState.currentPage, paginationState.itemsPerPage]);
  
  const SortIcon = ({ field }: { field: string }) => {
    if (field !== sortField) return null;
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  return (
    <div className="p-6 w-full mx-auto">
      <div className="flex items-center space-x-2 mb-6">
        <FileText size={24} className="text-primary" />
        <h1 className="text-2xl font-bold text-gray-800">Master ICD</h1>
      </div>
      <Separator className="mb-6" />
      
      <Tabs defaultValue="icd10" onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 mb-8">
          <TabsTrigger value="icd10" className="flex items-center gap-2">
            <Stethoscope size={16} />
            <span>ICD-10</span>
          </TabsTrigger>
          <TabsTrigger value="icd9" className="flex items-center gap-2">
            <ActivitySquare size={16} />
            <span>ICD-9-CM</span>
          </TabsTrigger>
        </TabsList>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>
              {activeTab === 'icd10' ? 'Pencarian ICD-10' : 'Pencarian ICD-9-CM'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'icd10' 
                ? 'Masukkan kode atau kata kunci untuk mencari diagnosis (ICD-10)' 
                : 'Masukkan kode atau kata kunci untuk mencari prosedur/tindakan (ICD-9-CM)'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex flex-1 items-center space-x-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  className="flex-1"
                  placeholder={`Cari kode ${activeTab === 'icd10' ? 'ICD-10' : 'ICD-9-CM'} atau kata kunci...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSearch} disabled={loading}>
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Filter className="h-4 w-4 mr-2" />
                  )}
                  Cari
                </Button>
                <Button variant="outline" onClick={handleClearSearch}>
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <TabsContent value="icd10">
          {hasSearched && (
            <Card>
              <CardHeader>
                <CardTitle>Hasil Pencarian ICD-10</CardTitle>
                <CardDescription>
                  {loading ? "Memuat..." : searchResults.length === 0 
                    ? "Tidak ditemukan hasil yang sesuai" 
                    : `Ditemukan ${paginationState.totalItems} hasil`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="p-3 text-left font-medium cursor-pointer" onClick={() => handleSort('kd_penyakit')}>
                              <div className="flex items-center">
                                Kode
                                <SortIcon field="kd_penyakit" />
                              </div>
                            </th>
                            <th className="p-3 text-left font-medium cursor-pointer" onClick={() => handleSort('nm_penyakit')}>
                              <div className="flex items-center">
                                Nama Penyakit
                                <SortIcon field="nm_penyakit" />
                              </div>
                            </th>
                            <th className="p-3 text-left font-medium">Ciri-Ciri</th>
                            <th className="p-3 text-left font-medium">Keterangan</th>
                            <th className="p-3 text-left font-medium">Kategori</th>
                            <th className="p-3 text-left font-medium">Status</th>
                            <th className="p-3 text-left font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="p-3 font-medium">{item.kd_penyakit}</td>
                              <td className="p-3">{item.nm_penyakit}</td>
                              <td className="p-3">
                                <div className="max-w-xs truncate" title={item.ciri_ciri}>
                                  {item.ciri_ciri || '-'}
                                </div>
                              </td>
                              <td className="p-3">{item.keterangan || '-'}</td>
                              <td className="p-3">{item.nm_kategori}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  item.status === 'Menular' 
                                    ? 'bg-red-100 text-red-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="p-3">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleCopyCode(item.kd_penyakit)}
                                >
                                  <Clipboard className="h-4 w-4 mr-1" /> 
                                  Salin
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4">
                      <PaginationControls
                        currentPage={paginationState.currentPage}
                        totalPages={paginationState.totalPages}
                        itemsPerPage={paginationState.itemsPerPage}
                        totalItems={paginationState.totalItems}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Tidak ada hasil yang ditemukan untuk "{searchQuery}"</p>
                    <p className="text-sm mt-2">Coba dengan kata kunci lain atau kode ICD-10 yang lebih spesifik</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="icd9">
          {hasSearched && (
            <Card>
              <CardHeader>
                <CardTitle>Hasil Pencarian ICD-9-CM</CardTitle>
                <CardDescription>
                  {loading ? "Memuat..." : searchResults.length === 0 
                    ? "Tidak ditemukan hasil yang sesuai" 
                    : `Ditemukan ${paginationState.totalItems} hasil`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center items-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : searchResults.length > 0 ? (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted">
                            <th className="p-3 text-left font-medium cursor-pointer" onClick={() => handleSort('kode')}>
                              <div className="flex items-center">
                                Kode
                                <SortIcon field="kode" />
                              </div>
                            </th>
                            <th className="p-3 text-left font-medium cursor-pointer" onClick={() => handleSort('deskripsi_pendek')}>
                              <div className="flex items-center">
                                Deskripsi Pendek
                                <SortIcon field="deskripsi_pendek" />
                              </div>
                            </th>
                            <th className="p-3 text-left font-medium">Deskripsi Panjang</th>
                            <th className="p-3 text-left font-medium">Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="p-3 font-medium">{item.kode}</td>
                              <td className="p-3">{item.deskripsi_pendek}</td>
                              <td className="p-3">
                                <div className="max-w-md" title={item.deskripsi_panjang}>
                                  {item.deskripsi_panjang || '-'}
                                </div>
                              </td>
                              <td className="p-3">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleCopyCode(item.kode)}
                                >
                                  <Clipboard className="h-4 w-4 mr-1" /> 
                                  Salin
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4">
                      <PaginationControls
                        currentPage={paginationState.currentPage}
                        totalPages={paginationState.totalPages}
                        itemsPerPage={paginationState.itemsPerPage}
                        totalItems={paginationState.totalItems}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground">Tidak ada hasil yang ditemukan untuk "{searchQuery}"</p>
                    <p className="text-sm mt-2">Coba dengan kata kunci lain atau kode ICD-9-CM yang lebih spesifik</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MasterICD;