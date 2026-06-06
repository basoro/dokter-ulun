import db from '../config/database.js';

class IcdDataService {
  static async getIcdData(page = 1, itemsPerPage = 10, search = '', icdType = 'icd10') {
    try {
      console.log('ICD data request:', { page, itemsPerPage, search, icdType });

      // Pagination parameters
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);
      
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      let countSql = '';
      let dataSql = '';
      let params = [];

      if (icdType === 'icd9') {
        // ICD-9-CM queries
        console.log('Fetching ICD-9-CM data');
        
        if (search && search.trim()) {
          countSql = `
            SELECT COUNT(*) as total
            FROM icd9
            WHERE kode LIKE ? OR deskripsi_panjang LIKE ? OR deskripsi_pendek LIKE ?
          `;
          
          dataSql = `
            SELECT 
              kode,
              deskripsi_panjang,
              deskripsi_pendek
            FROM icd9
            WHERE kode LIKE ? OR deskripsi_panjang LIKE ? OR deskripsi_pendek LIKE ?
            ORDER BY kode ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          const searchTerm = `%${search}%`;
          params = [searchTerm, searchTerm, searchTerm];
        } else {
          countSql = `
            SELECT COUNT(*) as total
            FROM icd9
          `;
          
          dataSql = `
            SELECT 
              kode,
              deskripsi_panjang,
              deskripsi_pendek
            FROM icd9
            ORDER BY kode ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          params = [];
        }
      } else {
        // ICD-10 queries (penyakit table)
        console.log('Fetching ICD-10 data');
        
        if (search && search.trim()) {
          countSql = `
            SELECT COUNT(*) as total
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
            WHERE p.kd_penyakit LIKE ? OR p.nm_penyakit LIKE ? OR p.ciri_ciri LIKE ? OR p.keterangan LIKE ?
          `;
          
          dataSql = `
            SELECT 
              p.kd_penyakit,
              p.nm_penyakit,
              p.ciri_ciri,
              p.keterangan,
              p.kd_ktg,
              p.status,
              COALESCE(kp.nm_kategori, 'Tidak Ada Kategori') as nm_kategori
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
            WHERE p.kd_penyakit LIKE ? OR p.nm_penyakit LIKE ? OR p.ciri_ciri LIKE ? OR p.keterangan LIKE ?
            ORDER BY p.kd_penyakit ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          const searchTerm = `%${search}%`;
          params = [searchTerm, searchTerm, searchTerm, searchTerm];
        } else {
          countSql = `
            SELECT COUNT(*) as total
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
          `;
          
          dataSql = `
            SELECT 
              p.kd_penyakit,
              p.nm_penyakit,
              p.ciri_ciri,
              p.keterangan,
              p.kd_ktg,
              p.status,
              COALESCE(kp.nm_kategori, 'Tidak Ada Kategori') as nm_kategori
            FROM penyakit p
            LEFT JOIN kategori_penyakit kp ON p.kd_ktg = kp.kd_ktg
            ORDER BY p.kd_penyakit ASC
            ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
          `;
          
          params = [];
        }
      }

      console.log('Executing count SQL:', countSql);
      console.log('Count parameters:', params);
      
      // Execute count query
      const [countResult] = await db.execute(countSql, params);
      const total = countResult[0]?.total || 0;
      
      console.log('Total count result:', total);
      
      const queryParams2 = limit === 10000 ? params : [...params, limit, offset];
      console.log('Executing data SQL:', dataSql);
      console.log('Data parameters:', queryParams2);
      
      const [result] = await db.execute(dataSql, queryParams2);
      
      console.log('Query executed, rows found:', result?.length || 0);

      const icdData = result?.map(row => {
        if (icdType === 'icd9') {
          return {
            kode: row.kode,
            deskripsi_panjang: row.deskripsi_panjang,
            deskripsi_pendek: row.deskripsi_pendek
          };
        } else {
          return {
            kd_penyakit: row.kd_penyakit,
            nm_penyakit: row.nm_penyakit,
            ciri_ciri: row.ciri_ciri,
            keterangan: row.keterangan,
            kd_ktg: row.kd_ktg,
            status: row.status,
            nm_kategori: row.nm_kategori
          };
        }
      }) || [];

      const totalPages = Math.ceil(total / limit);

      console.log('ICD data processed:', {
        total,
        page: parseInt(page),
        limit,
        totalPages,
        icdDataCount: icdData.length,
        icdType
      });

      return {
        success: true,
        data: icdData,
        total,
        limit,
        offset,
        page: parseInt(page),
        totalPages,
        icdType
      };

    } catch (error) {
      console.error('Error in ICD data service:', error);
      throw error;
    }
  }
}

export default IcdDataService;