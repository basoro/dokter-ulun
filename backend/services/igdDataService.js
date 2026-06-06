import db from '../config/database.js';

class IgdDataService {
  static formatDateOnly(dateStr) {
    if (!dateStr) return '';
    
    // Handle MySQL DATE format (YYYY-MM-DD)
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // Handle Date object or ISO string
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return '';
    }
  }

  static async getIgdData(page = 1, itemsPerPage = 10, search = '', statusFilter = '', triaseLevel = '', dateFrom = '', dateTo = '', tab = 'triase') {
    try {
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);

      // Build WHERE conditions
      let whereConditions = [`r.kd_poli = 'IGDK'`];
      let queryParams = [];

      console.log('=== IGD Data Service Debug ===');
      console.log('Parameters received:', {
        limit, offset, search, statusFilter, triaseLevel, dateFrom, dateTo, tab
      });

      if (search) {
        whereConditions.push(`(p.nm_pasien LIKE ? OR r.no_rkm_medis LIKE ?)`);
        queryParams.push(`%${search}%`, `%${search}%`);
      }

      if (dateFrom) {
        whereConditions.push(`DATE(r.tgl_registrasi) >= ?`);
        queryParams.push(dateFrom);
      }

      if (dateTo) {
        whereConditions.push(`DATE(r.tgl_registrasi) <= ?`);
        queryParams.push(dateTo);
      }

      if (triaseLevel && triaseLevel !== 'all') {
        // Adjust for mlite_triase_igd.kategori if needed, for now assuming it matches or we search by text
        whereConditions.push(`mt.kategori = ?`);
        queryParams.push(triaseLevel);
      }

      // Tab-specific conditions
      if (tab === 'triase') {
        whereConditions.push(`mt.no_rawat IS NOT NULL`);
      } else if (tab === 'observasi') {
        whereConditions.push(`mt.no_rawat IS NOT NULL AND r.stts != 'Sudah'`);
      } else if (tab === 'tindakan') {
        whereConditions.push(`r.stts = 'Sudah'`);
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'Triase') {
          whereConditions.push(`mt.no_rawat IS NOT NULL`);
        } else if (statusFilter === 'Selesai') {
          whereConditions.push(`r.stts = 'Sudah'`);
        } else if (statusFilter === 'Menunggu') {
          whereConditions.push(`mt.no_rawat IS NULL`);
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Count total records with deduplication
      const countQuery = `
        SELECT COUNT(*) as total
        FROM (
          SELECT DISTINCT r.no_rawat
          FROM reg_periksa r
          LEFT JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
          LEFT JOIN mlite_triase_igd mt ON r.no_rawat = mt.no_rawat
          ${whereClause}
        ) unique_records
      `;

      console.log('Count query:', countQuery);
      console.log('Count query params:', queryParams);
      
      const [countResult] = await db.execute(countQuery, queryParams);
      const total = countResult[0]?.total || 0;
      
      console.log('Total count result:', total);

      const limitClause = limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`;

      // Fetch IGD data with deduplication - using mlite_triase_igd
      const igdQuery = `
        SELECT DISTINCT
          r.no_rawat,
          r.no_rkm_medis,
          p.nm_pasien,
          r.tgl_registrasi,
          r.jam_reg,
          r.kd_dokter,
          d.nm_dokter,
          mt.tgl_triase as tanggal_triase,
          mt.keluhan_utama as namakasus,
          NULL as stts_diantar,
          mt.kategori as kd_tindakan,
          mt.kategori as nm_tindakan,
          COALESCE(mt.kategori, 'Belum Triase') as triase_level,
          CASE 
            WHEN mt.no_rawat IS NOT NULL AND r.stts = 'Sudah' THEN 'Selesai'
            WHEN mt.no_rawat IS NOT NULL THEN 'Triase'
            ELSE 'Menunggu'
          END as status
        FROM reg_periksa r
        LEFT JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        LEFT JOIN mlite_triase_igd mt ON r.no_rawat = mt.no_rawat
        ${whereClause}
        ORDER BY r.tgl_registrasi DESC, r.jam_reg DESC
        ${limitClause}
      `;

      // Use original params without limit/offset since they are injected
      const queryParams2 = queryParams;
      
      console.log('Main query:', igdQuery);
      console.log('Main query params:', queryParams2);
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);
      
      const [igdResult] = await db.execute(igdQuery, queryParams2);
      
      console.log('Raw IGD result rows count:', igdResult?.length || 0);
      console.log('Sample raw row:', igdResult?.[0]);
      
      const result = (igdResult || []).map((row) => ({
        ...row,
        tgl_registrasi: this.formatDateOnly(row.tgl_registrasi),
        tanggal_triase: this.formatDateOnly(row.tanggal_triase)
      }));
      
      console.log('Processed result count:', result.length);
      console.log('Sample processed row:', result[0]);

      const totalPages = limit === 10000 ? 1 : Math.ceil(total / limit);

      return {
        success: true,
        data: result,
        total,
        limit,
        offset,
        page: parseInt(page),
        totalPages
      };

    } catch (error) {
      console.error('Error in IGD data service:', error);
      throw error;
    }
  }
}

export default IgdDataService;