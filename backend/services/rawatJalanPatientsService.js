import db from '../config/database.js';

class RawatJalanPatientsService {
  static validateAndFormatDate(dateStr) {
    // Validate format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    return dateStr;
  }

  static async getRawatJalanPatients({
    kd_poli,
    startDate,
    endDate,
    status,
    statusBayar,
    username,
    kd_dokter,
    tabFilter,
    page = 1,
    itemsPerPage = 10
  }) {
    try {
      console.log('Received request body:', { kd_poli, startDate, endDate, status, statusBayar, username, kd_dokter, tabFilter });
      console.log('Current time (WIB):', new Date(new Date().getTime() + (7 * 60 * 60 * 1000)).toISOString());
      
      if (!kd_poli || !startDate || !endDate || !username) {
        console.error('Missing required parameters:', { kd_poli, startDate, endDate, username });
        throw new Error('kd_poli, startDate, endDate, and username (kd_dokter) are required');
      }

      // Use dates as-is since they're already formatted in WIB from frontend
      const formattedStartDate = this.validateAndFormatDate(startDate);
      const formattedEndDate = this.validateAndFormatDate(endDate);

      console.log('Date parameters received (already in WIB):', { 
        formattedStartDate, 
        formattedEndDate,
        original: { startDate, endDate }
      });

      const poliCodes = String(kd_poli || '')
        .split(',')
        .map(code => code.trim())
        .filter(Boolean);

      if (poliCodes.length === 0) {
        throw new Error('Minimal satu kd_poli wajib dikirim');
      }

      const poliPlaceholders = poliCodes.map(() => '?').join(',');

      // Build WHERE conditions
      let conditions = [];
      let params = [];
      
      console.log('Building query conditions...');
      
      // Date range filtering (required)
      conditions.push('rp.tgl_registrasi BETWEEN ? AND ?');
      params.push(formattedStartDate, formattedEndDate);
      console.log('Date range condition:', `tgl_registrasi BETWEEN '${formattedStartDate}' AND '${formattedEndDate}'`);
      
      conditions.push(`rp.kd_poli IN (${poliPlaceholders})`);
      params.push(...poliCodes);
      console.log('Poliklinik condition:', 'rp.kd_poli IN capability user', poliCodes);

      // Default doctor filter follows the logged-in user, unless "all" is explicitly requested.
      const normalizedDoctorFilter = String(kd_dokter || '').trim();
      const effectiveDoctorFilter = normalizedDoctorFilter === 'all'
        ? 'all'
        : (normalizedDoctorFilter || username);

      if (effectiveDoctorFilter !== 'all') {
        conditions.push('rp.kd_dokter = ?');
        params.push(effectiveDoctorFilter);
        console.log('Doctor filter applied:', effectiveDoctorFilter);
      } else {
        console.log('Doctor filter: showing all doctors in allowed poli');
      }
      
      // Status filtering - only add condition if not "all"
      if (status && status.trim() && status !== 'all') {
        conditions.push('rp.stts = ?');
        params.push(status);
        console.log('Status filter applied:', status);
      } else {
        console.log('Status filter: showing all statuses (status value:', status, ')');
      }
      
      // Payment status filtering - only add condition if not "all"
      if (statusBayar && statusBayar.trim() && statusBayar !== 'all') {
        conditions.push('rp.status_bayar = ?');
        params.push(statusBayar);
        console.log('Payment status filter applied:', statusBayar);
      } else {
        console.log('Payment status filter: showing all payment statuses (statusBayar value:', statusBayar, ')');
      }

      // Tab-specific filtering
      if (tabFilter) {
        switch(tabFilter) {
          case 'pagi':
            conditions.push('LOWER(pol.nm_poli) LIKE ?');
            params.push('%pagi%');
            console.log('Tab filter applied: Pagi');
            break;
          case 'sore':
            conditions.push('LOWER(pol.nm_poli) LIKE ?');
            params.push('%sore%');
            console.log('Tab filter applied: Sore');
            break;
          case 'rujukan_internal':
            conditions.push('EXISTS (SELECT 1 FROM rujukan_internal_poli rip WHERE rip.no_rawat = rp.no_rawat)');
            console.log('Tab filter applied: Rujukan Internal');
            break;
          case 'pasien_lanjutan':
            // Yesterday's patients with status 'Belum' in WIB timezone
            const now = new Date();
            const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
            const yesterday = new Date(wibNow.getTime() - (24 * 60 * 60 * 1000));
            const year = yesterday.getUTCFullYear();
            const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
            const day = String(yesterday.getUTCDate()).padStart(2, '0');
            const formattedYesterday = `${year}-${month}-${day}`;
            conditions.push('rp.tgl_registrasi = ? AND rp.stts = ?');
            params.push(formattedYesterday, 'Belum');
            console.log('Tab filter applied: Pasien Lanjutan for date:', formattedYesterday);
            break;
          case 'hari_ini':
          default:
            // No additional filter for "Hari Ini" - shows all data within date range
            console.log('Tab filter applied: Hari Ini (default)');
            break;
        }
      }

      // Pagination parameters
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage || "10"), 1000);
      const offset = (parseInt(page || "1") - 1) * (limit === 10000 ? 0 : limit);
      
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      // Count query
      const countSql = `
        SELECT COUNT(*) as total
        FROM reg_periksa rp
        INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
        WHERE ${conditions.join(' AND ')}
      `;

      const doctorSql = `
        SELECT DISTINCT
          rp.kd_dokter,
          COALESCE(d.nm_dokter, 'Dokter Tidak Diketahui') as nm_dokter
        FROM reg_periksa rp
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
        WHERE rp.tgl_registrasi BETWEEN ? AND ?
          AND rp.kd_poli IN (${poliPlaceholders})
          ${status && status.trim() && status !== 'all' ? 'AND rp.stts = ?' : ''}
          ${statusBayar && statusBayar.trim() && statusBayar !== 'all' ? 'AND rp.status_bayar = ?' : ''}
          ${tabFilter === 'pagi' ? 'AND LOWER(pol.nm_poli) LIKE ?' : ''}
          ${tabFilter === 'sore' ? 'AND LOWER(pol.nm_poli) LIKE ?' : ''}
          ${tabFilter === 'rujukan_internal' ? 'AND EXISTS (SELECT 1 FROM rujukan_internal_poli rip WHERE rip.no_rawat = rp.no_rawat)' : ''}
          ${tabFilter === 'pasien_lanjutan' ? 'AND rp.tgl_registrasi = ? AND rp.stts = ?' : ''}
        ORDER BY nm_dokter ASC
      `;

      // Query rawat jalan patients with LEFT JOINs to prevent data loss
      const limitClause = limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`;
      const sql = `
        SELECT 
          rp.no_reg,
          rp.no_rkm_medis,
          rp.no_rawat,
          rp.stts,
          rp.tgl_registrasi,
          rp.jam_reg,
          rp.status_bayar,
          p.nm_pasien,
          p.no_tlp,
          p.alamat,
          p.jk,
          p.tgl_lahir,
          COALESCE(d.nm_dokter, 'Dokter Tidak Diketahui') as nm_dokter,
          COALESCE(pol.nm_poli, 'Poliklinik Tidak Diketahui') as nm_poli,
          COALESCE(pj.png_jawab, 'Umum') as png_jawab
        FROM reg_periksa rp
        INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
        WHERE ${conditions.join(' AND ')}
        ORDER BY rp.no_reg ASC
        ${limitClause}
      `;

      console.log('Executing count SQL:', countSql);
      console.log('Count parameters:', params);
      
      // Execute count query
      const [countResult] = await db.execute(countSql, params);
      const total = countResult[0]?.total || 0;

      const doctorParams = [formattedStartDate, formattedEndDate, ...poliCodes];
      if (status && status.trim() && status !== 'all') {
        doctorParams.push(status);
      }
      if (statusBayar && statusBayar.trim() && statusBayar !== 'all') {
        doctorParams.push(statusBayar);
      }
      if (tabFilter === 'pagi') {
        doctorParams.push('%pagi%');
      }
      if (tabFilter === 'sore') {
        doctorParams.push('%sore%');
      }
      if (tabFilter === 'pasien_lanjutan') {
        const now = new Date();
        const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const yesterday = new Date(wibNow.getTime() - (24 * 60 * 60 * 1000));
        const year = yesterday.getUTCFullYear();
        const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getUTCDate()).padStart(2, '0');
        const formattedYesterday = `${year}-${month}-${day}`;
        doctorParams.push(formattedYesterday, 'Belum');
      }

      const [doctorResult] = await db.execute(doctorSql, doctorParams);
      
      console.log('Total count result:', total);
      
      // Use params directly since LIMIT/OFFSET are now injected
      const queryParams2 = params;
      console.log('Executing data SQL:', sql);
      console.log('Data parameters:', queryParams2);
      console.log('Full WHERE clause:', conditions.join(' AND '));
      
      const [result] = await db.execute(sql, queryParams2);
      
      console.log('Query executed, rows found:', result?.length || 0);
      
      // Log some sample data from database
      if (result && result.length > 0) {
        console.log('Sample tgl_registrasi values from DB:', 
          result.slice(0, 3).map(row => ({ 
            no_reg: row.no_reg, 
            tgl_registrasi: row.tgl_registrasi,
            kd_dokter: row.kd_dokter || 'No kd_dokter in result'
          }))
        );
      } else {
        console.log('No rows returned from query');
        
        // Try a simpler query to check if data exists
        const checkQuery = `
          SELECT COUNT(*) as total_count, 
                 MIN(tgl_registrasi) as min_date, 
                 MAX(tgl_registrasi) as max_date
          FROM reg_periksa 
          WHERE kd_poli IN (${poliPlaceholders})
        `;
        const [checkResult] = await db.execute(checkQuery, poliCodes);
        console.log('Data check query result:', checkResult);
        
        // Check if dates exist in the range
        const dateCheckQuery = `
          SELECT COUNT(*) as count_in_range
          FROM reg_periksa
          WHERE tgl_registrasi BETWEEN ? AND ?
          AND kd_poli IN (${poliPlaceholders})
        `;
        const [dateCheckResult] = await db.execute(dateCheckQuery, [formattedStartDate, formattedEndDate, ...poliCodes]);
        console.log('Date range check result:', dateCheckResult);
      }

      const patients = result?.map(row => ({
        no_reg: row.no_reg,
        no_rkm_medis: row.no_rkm_medis,
        no_rawat: row.no_rawat,
        status: row.stts,
        tgl_registrasi: row.tgl_registrasi,
        jam_reg: row.jam_reg,
        nm_pasien: row.nm_pasien,
        no_tlp: row.no_tlp,
        alamat: row.alamat,
        jk: row.jk,
        tgl_lahir: row.tgl_lahir,
        nm_dokter: row.nm_dokter,
        nm_poli: row.nm_poli,
        png_jawab: row.png_jawab,
        payment_status: row.status_bayar || 'Belum Bayar'
      })) || [];

      const responseData = {
        success: true,
        data: patients,
        doctors: (doctorResult || []).map(row => ({
          kd_dokter: row.kd_dokter,
          nm_dokter: row.nm_dokter
        })),
        total,
        limit,
        offset,
        page: parseInt(page || "1"),
        totalPages: Math.ceil(total / limit)
      };

      console.log('Rawat jalan patients retrieved successfully:', patients.length, 'records');
      console.log('Sample patient data (first 3):', patients.slice(0, 3));
      console.log('Filter summary:', {
        dateRange: `${formattedStartDate} to ${formattedEndDate}`,
        requestedBy: username,
        selectedDoctor: effectiveDoctorFilter,
        poliklinik: kd_poli,
        status: status === 'all' ? 'ALL' : status,
        statusBayar: statusBayar === 'all' ? 'ALL' : statusBayar,
        tabFilter
      });

      return responseData;

    } catch (error) {
      console.error('Rawat jalan patients error:', error);
      throw error;
    }
  }
}

export default RawatJalanPatientsService;
