import db from '../config/database.js';

class RawatInapDataService {
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

  static async getRawatInapData({
    page = "1",
    itemsPerPage = "50", 
    search = "",
    statusPulang = "all",
    startDate,
    endDate
  }) {
    try {
      console.log('=== Rawat Inap Data Request ===');
      console.log('Request params:', { page, itemsPerPage, search, statusPulang, startDate, endDate });

      // Validate and limit itemsPerPage
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      // Build the WHERE clause
      let whereConditions = ['ki.tgl_masuk IS NOT NULL'];
      let params = [];

      // Search filter
      if (search && search.trim()) {
        whereConditions.push(`(
          p.nm_pasien LIKE ? OR
          p.no_rkm_medis LIKE ? OR
          rp.no_rawat LIKE ? OR
          d.nm_dokter LIKE ? OR
          k.kd_kamar LIKE ? OR
          b.nm_bangsal LIKE ?
        )`);
        const searchParam = `%${search.trim()}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
      }

      // Status pulang filter
      if (statusPulang && statusPulang !== 'all') {
        whereConditions.push('ki.stts_pulang = ?');
        params.push(statusPulang);
      }

      // Date range filter
      if (startDate && endDate) {
        whereConditions.push('DATE(ki.tgl_masuk) BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      console.log('WHERE clause:', whereClause);
      console.log('Parameters:', params);

      // Main query with joins - using GROUP BY to prevent duplicates from multiple DPJP
      const query = `
        SELECT 
          ki.no_rawat,
          p.no_rkm_medis,
          p.nm_pasien,
          p.jk as jenis_kelamin,
          p.tgl_lahir,
          ki.tgl_masuk,
          ki.tgl_keluar,
          ki.diagnosa_awal,
          ki.diagnosa_akhir,
          ki.stts_pulang,
          k.kd_kamar,
          b.nm_bangsal,
          GROUP_CONCAT(DISTINCT d.nm_dokter SEPARATOR ', ') as dokter_dpjp,
          rp.tgl_registrasi,
          rp.jam_reg,
          rp.status_lanjut,
          ki.lama,
          ki.trf_kamar
        FROM kamar_inap ki
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
        LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        ${whereClause}
        GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir, 
                 ki.tgl_masuk, ki.tgl_keluar, ki.diagnosa_awal, ki.diagnosa_akhir, 
                 ki.stts_pulang, k.kd_kamar, b.nm_bangsal, rp.tgl_registrasi, 
                 rp.jam_reg, rp.status_lanjut, ki.lama, ki.trf_kamar
        ORDER BY ki.tgl_masuk DESC
        ${limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`}
      `;

      // Count query - using DISTINCT to match the GROUP BY logic
      const countQuery = `
        SELECT COUNT(DISTINCT ki.no_rawat) as total
        FROM kamar_inap ki
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
        LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        ${whereClause}
      `;

      console.log('Executing main query:', query);
      // Use original params without limit/offset since they are injected
      const queryParams = params;
      console.log('Query parameters:', queryParams);

      // Execute count query first
      const [countResult] = await db.execute(countQuery, params);
      const total = countResult[0]?.total || 0;
      
      console.log('Total count result:', total);

      // Execute main data query
      const [dataResult] = await db.execute(query, queryParams);
      const data = dataResult || [];

      console.log('Data result rows count:', data.length);
      console.log('Sample data row:', data[0]);

      console.log(`Found ${data.length} records out of ${total} total`);

      // Format date fields
      const formattedData = data.map(row => ({
        ...row,
        tgl_lahir: this.formatDateOnly(row.tgl_lahir),
        tgl_masuk: this.formatDateOnly(row.tgl_masuk),
        tgl_keluar: this.formatDateOnly(row.tgl_keluar),
        tgl_registrasi: this.formatDateOnly(row.tgl_registrasi)
      }));

      return {
        success: true,
        data: formattedData,
        total,
        limit,
        offset,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      console.error('Error in rawat-inap-data service:', error);
      throw error;
    }
  }
}

export default RawatInapDataService;