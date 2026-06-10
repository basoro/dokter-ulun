import db from '../config/database.js';

class IgdDataService {
  static getIgdPoliCodes() {
    const rawValue = String(process.env.IGD_POLI_CODES || '').trim();
    const parsedCodes = rawValue
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    return parsedCodes.length ? parsedCodes : ['B0054', 'IGDK', 'IGD01'];
  }

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
      const igdPoliCodes = IgdDataService.getIgdPoliCodes();
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);
      // Build WHERE conditions
      let whereConditions = [`r.kd_poli IN (${igdPoliCodes.map(() => '?').join(', ')})`];
      let queryParams = [...igdPoliCodes];

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
        whereConditions.push(`mti.kd_level = ?`);
        queryParams.push(triaseLevel);
      }

      // Tab-specific conditions
      if (tab === 'triase') {
        whereConditions.push(`mt.no_rawat IS NOT NULL`);
      } else if (tab === 'observasi') {
        whereConditions.push(`mt.no_rawat IS NOT NULL AND dpt.no_rawat IS NULL`);
      } else if (tab === 'tindakan') {
        whereConditions.push(`dpt.no_rawat IS NOT NULL`);
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'Triase') {
          whereConditions.push(`mt.no_rawat IS NOT NULL AND dpt.no_rawat IS NULL`);
        } else if (statusFilter === 'Selesai') {
          whereConditions.push(`dpt.no_rawat IS NOT NULL`);
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
          LEFT JOIN data_triase_igd mt ON r.no_rawat = mt.no_rawat
          LEFT JOIN detail_pemeriksaan_triase dpt ON r.no_rawat = dpt.no_rawat
          LEFT JOIN master_triase_igd mti ON mti.kd_tindakan = dpt.kd_tindakan
          ${whereClause}
        ) unique_records
      `;

      console.log('Count query:', countQuery);
      console.log('Count query params:', queryParams);
      
      const [countResult] = await db.execute(countQuery, queryParams);
      const total = countResult[0]?.total || 0;
      
      console.log('Total count result:', total);

      const limitClause = limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`;

      // Fetch IGD data with deduplication - using data_triase_igd
      const igdQuery = `
        SELECT
          r.no_rawat,
          r.no_rkm_medis,
          p.nm_pasien,
          r.tgl_registrasi,
          r.jam_reg,
          r.kd_dokter,
          d.nm_dokter,
          mt.tanggal as tanggal_triase,
          mt.namakasus as namakasus,
          mt.stts_diantar as stts_diantar,
          COALESCE(GROUP_CONCAT(DISTINCT mti.kd_tindakan ORDER BY mti.kd_tindakan SEPARATOR ', '), '') as kd_tindakan,
          COALESCE(
            GROUP_CONCAT(DISTINCT mti.nm_tindakan ORDER BY mti.nm_tindakan SEPARATOR ', '),
            NULLIF(mt.tindakan, ''),
            NULLIF(mt.diagnosis, ''),
            NULLIF(mt.keterangan, ''),
            'Belum Ada Tindakan'
          ) as nm_tindakan,
          COALESCE(MAX(NULLIF(mti.nm_level, '')), 'Belum Triase') as triase_level,
          COALESCE(MAX(NULLIF(mti.kd_level, '')), '') as kd_level,
          CASE 
            WHEN dpt.no_rawat IS NOT NULL THEN 'Selesai'
            WHEN mt.no_rawat IS NOT NULL THEN 'Triase'
            ELSE 'Menunggu'
          END as status
        FROM reg_periksa r
        LEFT JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        LEFT JOIN data_triase_igd mt ON r.no_rawat = mt.no_rawat
        LEFT JOIN detail_pemeriksaan_triase dpt ON r.no_rawat = dpt.no_rawat
        LEFT JOIN master_triase_igd mti ON mti.kd_tindakan = dpt.kd_tindakan
        ${whereClause}
        GROUP BY
          r.no_rawat,
          r.no_rkm_medis,
          p.nm_pasien,
          r.tgl_registrasi,
          r.jam_reg,
          r.kd_dokter,
          d.nm_dokter,
          mt.tanggal,
          mt.namakasus,
          mt.stts_diantar,
          r.stts,
          mt.no_rawat,
          mt.tindakan,
          mt.diagnosis,
          mt.keterangan
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
