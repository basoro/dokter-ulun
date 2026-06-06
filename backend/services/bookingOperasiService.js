import pool from '../config/database.js';

class BookingOperasiService {
  static async getBookingOperasiData({
    page = 1,
    itemsPerPage = 10,
    search = '',
    startDate = null,
    endDate = null,
    status = 'all'
  }) {
    try {
      console.log('Received request body:', { page, itemsPerPage, search, startDate, endDate, status });
      
      // Pagination parameters
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);
      
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      // Build WHERE conditions
      let conditions = [];
      let params = [];
      
      console.log('Building query conditions...');

      // Search filter
      if (search && search.trim()) {
        conditions.push(`(
          p.nm_pasien LIKE ? OR 
          bo.no_rawat LIKE ? OR 
          rp.no_rkm_medis LIKE ? OR
          po.nm_perawatan LIKE ? OR
          d.nm_dokter LIKE ?
        )`);
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        console.log('Search filter applied:', search);
      }

      // Date range filtering
      if (startDate && endDate) {
        conditions.push('bo.tanggal BETWEEN ? AND ?');
        params.push(startDate, endDate);
        console.log('Date range filter applied:', startDate, 'to', endDate);
      } else if (startDate) {
        conditions.push('bo.tanggal >= ?');
        params.push(startDate);
        console.log('Start date filter applied:', startDate);
      } else if (endDate) {
        conditions.push('bo.tanggal <= ?');
        params.push(endDate);
        console.log('End date filter applied:', endDate);
      }

      // Status filtering
      if (status && status.trim() && status !== 'all') {
        conditions.push('bo.status = ?');
        params.push(status);
        console.log('Status filter applied:', status);
      } else {
        console.log('Status filter: showing all statuses');
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Count query
      const countSql = `
        SELECT COUNT(*) as total
        FROM booking_operasi bo
        LEFT JOIN reg_periksa rp ON bo.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN paket_operasi po ON bo.kode_paket = po.kode_paket
        LEFT JOIN dokter d ON bo.kd_dokter = d.kd_dokter
        ${whereClause}
      `;

      // Main query with JOIN to paket_operasi
      const sql = `
        SELECT 
          bo.no_rawat,
          bo.kode_paket,
          bo.tanggal,
          bo.jam_mulai,
          bo.jam_selesai,
          bo.status,
          bo.kd_dokter,
          rp.no_rkm_medis,
          rp.tgl_registrasi,
          rp.jam_reg,
          COALESCE(p.nm_pasien, 'Pasien Tidak Diketahui') as nm_pasien,
          p.alamat,
          p.no_tlp,
          p.jk,
          p.tgl_lahir,
          COALESCE(po.nm_perawatan, 'Paket Tidak Diketahui') as nama_paket,
          po.kategori as kategori_paket,
          COALESCE(d.nm_dokter, 'Dokter Tidak Diketahui') as nm_dokter
        FROM booking_operasi bo
        LEFT JOIN reg_periksa rp ON bo.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN paket_operasi po ON bo.kode_paket = po.kode_paket
        LEFT JOIN dokter d ON bo.kd_dokter = d.kd_dokter
        ${whereClause}
        ORDER BY bo.tanggal DESC, bo.jam_mulai ASC
        ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
      `;

      console.log('Executing count SQL:', countSql);
      console.log('Count parameters:', params);
      
      // Execute count query
      const [countResult] = await pool.execute(countSql, params);
      const total = countResult[0]?.total || 0;
      
      console.log('Total count result:', total);
      
      const queryParams2 = limit === 10000 ? params : [...params, limit, offset];
      console.log('Executing data SQL:', sql);
      console.log('Data parameters:', queryParams2);
      
      const [result] = await pool.execute(sql, queryParams2);
      
      console.log('Query executed, rows found:', result?.length || 0);

      const bookingData = result?.map(row => ({
        no_rawat: row.no_rawat,
        kode_paket: row.kode_paket,
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        status: row.status,
        kd_dokter: row.kd_dokter,
        no_rkm_medis: row.no_rkm_medis,
        tgl_registrasi: row.tgl_registrasi,
        jam_reg: row.jam_reg,
        nm_pasien: row.nm_pasien,
        alamat: row.alamat,
        no_tlp: row.no_tlp,
        jk: row.jk,
        tgl_lahir: row.tgl_lahir,
        nama_paket: row.nama_paket,
        kategori_paket: row.kategori_paket,
        nm_dokter: row.nm_dokter
      })) || [];

      const totalPages = Math.ceil(total / limit);

      console.log('Booking operasi data processed:', {
        total,
        page: parseInt(page),
        limit,
        totalPages,
        bookingDataCount: bookingData.length
      });

      return {
        success: true,
        data: bookingData,
        total,
        limit,
        offset,
        page: parseInt(page),
        totalPages
      };

    } catch (error) {
      console.error('Error in booking operasi service:', error);
      throw new Error(`Booking operasi service error: ${error.message}`);
    }
  }
}

export { BookingOperasiService };