
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatNoRawat } from '@/App';
import { User, CircleCheck, Clock } from 'lucide-react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { PaginationControls } from '@/components/PaginationControls';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { dispatchOpenMedicalRecordTab } from '@/lib/medical-record-tabs';


interface Patient {
  id: number | string;
  name: string;
  visits?: number;
  status?: string;
  [key: string]: any; // Allow any additional properties
}

interface Column {
  accessor: string;
  header: string;
  render?: (row: any) => React.ReactNode;
}

interface PatientTableProps {
  title?: string;
  patients: Patient[];
  type?: 'active' | 'queue';
  columns?: Array<Column>;
  loading?: boolean;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (itemsPerPage: number) => void;
  };
}

const PatientTable: React.FC<PatientTableProps> = ({ 
  title, 
  patients, 
  type = 'active',
  columns,
  loading = false,
  pagination
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Helper function to decode no_rawat from encoded format
  const decodeNoRawat = (encodedNoRawat: string) => {
    if (!encodedNoRawat) return '';
    return encodedNoRawat.replace(/(\d{4})(\d{2})(\d{2})(\d+)/, '$1/$2/$3/$4');
  };

  const handleRowClick = (patient: any) => {
    if (patient.no_rkm_medis && patient.no_rawat) {
      const formattedNoRawat = formatNoRawat(patient.no_rawat);

      if (location.pathname.startsWith('/pasien')) {
        dispatchOpenMedicalRecordTab({
          noRkmMedis: String(patient.no_rkm_medis),
          noRawat: formattedNoRawat,
          patientName: String(patient.name || patient.nm_pasien || '').trim(),
          sourcePath: `${location.pathname}${location.search}`
        });
        return;
      }

      navigate(`/rekam-medik/${patient.no_rkm_medis}/${formattedNoRawat}`, {
        state: {
          from: `${location.pathname}${location.search}`
        }
      });
    }
  };
  
  // If patients is passed as 'data' prop from older code
  const patientData = Array.isArray(patients) ? patients : [];
  
  // Use local pagination only if external pagination is not provided
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // If external pagination is provided, use all data; otherwise use local pagination
  const displayData = pagination ? patientData : patientData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = pagination ? pagination.totalPages : Math.ceil(patientData.length / itemsPerPage);

  // Simple pagination helper
  const getVisiblePages = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 3);
    const end = Math.min(totalPages, currentPage + 3);
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };
  
  // Badge variant helper functions
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Belum': return 'destructive';
      case 'Sudah': return 'default';
      case 'Batal': return 'secondary';
      case 'Berkas Diterima': return 'outline';
      case 'Dirujuk': return 'secondary';
      case 'Meninggal': return 'destructive';
      case 'Dirawat': return 'default';
      case 'Pulang Paksa': return 'outline';
      default: return 'outline';
    }
  };
  
  const getPaymentBadgeVariant = (status: string) => {
    switch (status) {
      case 'Sudah Bayar': return 'default';
      case 'Belum Bayar': return 'destructive';
      default: return 'outline';
    }
  };
  
  // Handle the case when simple view is used (with type and without columns)
  const renderSimpleView = () => {
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-medium">No</TableHead>
              <TableHead className="font-medium">Nama {isMobile ? '' : 'Lengkap'}</TableHead>
              {type === 'active' ? (
                <TableHead className="font-medium text-right sm:text-left">Kunj</TableHead>
              ) : (
                <TableHead className="font-medium text-right sm:text-left">Status</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.length > 0 ? (
              displayData.map((patient) => (
                <TableRow 
                  key={patient.id} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(patient)}
                >
                  <TableCell className="py-2 px-2 sm:py-3 sm:px-4">{patient.id}</TableCell>
                  <TableCell className="py-2 px-2 sm:py-3 sm:px-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                        <User size={isMobile ? 14 : 16} />
                      </div>
                      <div className={cn(
                        "ml-2 sm:ml-4 font-medium text-gray-900",
                        isMobile ? "text-xs sm:text-sm max-w-[120px] truncate" : ""
                      )}>
                        {patient.name}
                      </div>
                    </div>
                  </TableCell>
                  {type === 'active' ? (
                    <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-right sm:text-left">
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                        {patient.visits}
                      </span>
                    </TableCell>
                  ) : (
                    <TableCell className="py-2 px-2 sm:py-3 sm:px-4 text-right sm:text-left">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        patient.status === 'Menunggu' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {patient.status === 'Menunggu' ? <Clock size={12} className="mr-1" /> : <CircleCheck size={12} className="mr-1" />}
                        {patient.status}
                      </span>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6 text-gray-500 italic">
                  Tidak ada data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  // Handle the case when columns are provided (for complex tables)
  const renderColumnsView = () => {
    if (!columns) return renderSimpleView();
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index} className="font-medium whitespace-nowrap">
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-6 text-gray-500 italic">
                  Memuat data...
                </TableCell>
              </TableRow>
            ) : displayData.length > 0 ? (
              displayData.map((patient, rowIndex) => (
                <TableRow 
                  key={patient.id || rowIndex} 
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => handleRowClick(patient)}
                >
                  {columns.map((column, colIndex) => (
                  <TableCell key={colIndex} className="py-2 px-2 sm:py-3 sm:px-4 whitespace-nowrap">
                      {column.render ? (
                        column.render(patient)
                      ) : column.accessor === 'nama' ? (
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-6 w-6 sm:h-8 sm:w-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                            <User size={isMobile ? 14 : 16} />
                          </div>
                          <div className={cn(
                            "ml-2 sm:ml-4 font-medium text-gray-900",
                            isMobile ? "text-xs sm:text-sm max-w-[120px] truncate" : ""
                          )}>
                            {patient[column.accessor]}
                          </div>
                        </div>
                      ) : column.accessor === 'status' ? (
                        <Badge variant={
                          patient[column.accessor] === 'Diterima' ? 'default' :
                          patient[column.accessor] === 'Ditolak' ? 'destructive' :
                          'secondary'
                        }>
                          {patient[column.accessor]}
                        </Badge>
                      ) : column.accessor === 'tanggal' || column.accessor === 'tanggal_booking' ? (
                        new Date(patient[column.accessor]).toLocaleDateString('id-ID')
                      ) : (
                        patient[column.accessor]
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-6 text-gray-500 italic">
                  Tidak ada data
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };
  
  return (
    // <div className="bg-white rounded-xl shadow-md overflow-hidden h-full hover:shadow-lg transition-shadow duration-300">
        <div className="p-0 sm:p-0">
          {title && <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-6 text-gray-800">{title}</h2>}
          <div className="rounded-lg border border-gray-200">
            {columns ? renderColumnsView() : renderSimpleView()}
          </div>
          
          {/* Pagination Controls */}
          {pagination ? (
            <PaginationControls
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              itemsPerPage={pagination.itemsPerPage}
              onPageChange={pagination.onPageChange}
              onItemsPerPageChange={pagination.onItemsPerPageChange}
              loading={loading}
            />
          ) : totalPages > 1 && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Menampilkan {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, patientData.length)} dari {patientData.length} data
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sebelumnya
                  </button>
                  {getVisiblePages().map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === page ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      // </div>
  );
};

export default PatientTable;
