
import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  FileBarChart, 
  Search, 
  Info, 
  Clipboard 
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const TarifINA = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Sample INA-CBGs data
  const inaCbgsData = [
    { 
      code: 'A-4-10-I', 
      description: 'Operasi Craniotomy Ringan', 
      severity: 'Ringan',
      baseRate: 12500000,
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
    { 
      code: 'A-4-10-II', 
      description: 'Operasi Craniotomy Sedang', 
      severity: 'Sedang',
      baseRate: 18750000, 
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
    { 
      code: 'A-4-10-III', 
      description: 'Operasi Craniotomy Berat', 
      severity: 'Berat',
      baseRate: 25000000, 
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
    { 
      code: 'E-4-12-I', 
      description: 'Pneumonia Ringan', 
      severity: 'Ringan',
      baseRate: 5600000, 
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
    { 
      code: 'E-4-12-II', 
      description: 'Pneumonia Sedang', 
      severity: 'Sedang',
      baseRate: 8200000, 
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
    { 
      code: 'K-1-11-I', 
      description: 'Persalinan Normal', 
      severity: 'Ringan',
      baseRate: 4800000, 
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
    { 
      code: 'K-1-11-II', 
      description: 'Persalinan dengan Komplikasi Minor', 
      severity: 'Sedang',
      baseRate: 6200000, 
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
    { 
      code: 'K-1-11-III', 
      description: 'Persalinan dengan Komplikasi Mayor', 
      severity: 'Berat',
      baseRate: 9500000, 
      hospitalClass: 'A', 
      regionalFactor: 1.2
    },
  ];
  
  const handleSearch = () => {
    if (searchQuery.trim() === '') {
      setSearchResults([]);
      setHasSearched(true);
      return;
    }
    
    const filtered = inaCbgsData.filter(item => 
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setSearchResults(filtered);
    setHasSearched(true);
  };
  
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Kode Disalin",
      description: `Kode ${code} berhasil disalin ke clipboard`,
    });
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };
  
  const calculateFinalRate = (baseRate: number, regionalFactor: number) => {
    return baseRate * regionalFactor;
  };

  return (
    <div className="p-6 w-full mx-auto">
      <div className="flex items-center space-x-2 mb-6">
        <FileBarChart size={24} className="text-primary" />
        <h1 className="text-2xl font-bold text-gray-800">Cek Tarif INACBGs</h1>
      </div>
      <Separator className="mb-6" />
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Pencarian Tarif INA-CBGs</CardTitle>
          <CardDescription>
            Masukkan kode INA-CBGs atau kata kunci untuk mencari tarif
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-1 items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="flex-1"
                placeholder="Cari kode INA-CBGs atau diagnosis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch}>Cari</Button>
          </div>
        </CardContent>
      </Card>
      
      {hasSearched && (
        <Card>
          <CardHeader>
            <CardTitle>Hasil Pencarian</CardTitle>
            <CardDescription>
              {searchResults.length === 0 
                ? "Tidak ditemukan hasil yang sesuai" 
                : `Ditemukan ${searchResults.length} hasil`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {searchResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="p-3 text-left font-medium">Kode</th>
                      <th className="p-3 text-left font-medium">Deskripsi</th>
                      <th className="p-3 text-left font-medium">
                        <div className="flex items-center">
                          Tingkat Keparahan
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 ml-1 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Tingkat keparahan berdasarkan kompleksitas diagnosis dan tindakan</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </th>
                      <th className="p-3 text-left font-medium">
                        <div className="flex items-center">
                          Tarif Dasar
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 ml-1 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Tarif dasar sebelum penyesuaian regional</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </th>
                      <th className="p-3 text-left font-medium">
                        <div className="flex items-center">
                          Tarif Akhir
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-4 w-4 ml-1 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Tarif setelah penyesuaian regional dan kelas rumah sakit</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </th>
                      <th className="p-3 text-left font-medium">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((item, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-3 font-medium">{item.code}</td>
                        <td className="p-3">{item.description}</td>
                        <td className="p-3">
                          <span 
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item.severity === 'Ringan' 
                                ? 'bg-green-100 text-green-800' 
                                : item.severity === 'Sedang'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </td>
                        <td className="p-3">{formatCurrency(item.baseRate)}</td>
                        <td className="p-3">{formatCurrency(calculateFinalRate(item.baseRate, item.regionalFactor))}</td>
                        <td className="p-3">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleCopyCode(item.code)}
                          >
                            <Clipboard className="h-4 w-4 mr-1" /> 
                            Salin Kode
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10">
                <p className="text-muted-foreground">Tidak ada hasil yang ditemukan untuk "{searchQuery}"</p>
                <p className="text-sm mt-2">Coba dengan kata kunci lain atau kode INA-CBGs yang lebih spesifik</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TarifINA;
