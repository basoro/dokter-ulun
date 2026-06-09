import db from '../config/database.js';
import { AuthService } from './authService.js';

class RawatJalanPatientsService {
  static validateAndFormatDate(dateStr) {
    // Validate format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    return dateStr;
  }

  static normalizeTabFilter(tabFilter = '') {
    const normalizedTab = String(tabFilter || '').trim();

    if (!normalizedTab || normalizedTab === 'pasien-poli') {
      return 'hari-ini';
    }

    return normalizedTab;
  }

  static async getSessionPoliGroups(poliCodes = []) {
    if (!Array.isArray(poliCodes) || poliCodes.length === 0) {
      return {
        hariIni: [],
        pagi: [],
        sore: []
      };
    }

    const placeholders = poliCodes.map(() => '?').join(',');
    const [rows] = await db.execute(
      `
        SELECT kd_poli, nm_poli
        FROM poliklinik
        WHERE kd_poli IN (${placeholders})
      `,
      poliCodes
    );

    const soreCodes = new Set(
      (rows || [])
        .filter((row) => String(row.nm_poli || '').toLowerCase().includes('sore'))
        .map((row) => row.kd_poli)
    );

    const pagiCandidates = poliCodes.filter((code) => !soreCodes.has(code));
    const soreCandidates = poliCodes.filter((code) => soreCodes.has(code));
    const pagiCodes = pagiCandidates.length > 0 ? [pagiCandidates[0]] : [];
    const sorePoliCodes = soreCandidates.length > 0 ? [soreCandidates[0]] : [];

    return {
      hariIni: poliCodes,
      pagi: pagiCodes,
      sore: sorePoliCodes
    };
  }

  static getLanjutanDates() {
    const now = new Date();
    const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const dateMinus1 = new Date(wibNow.getTime() - (24 * 60 * 60 * 1000));
    const dateMinus2 = new Date(wibNow.getTime() - (2 * 24 * 60 * 60 * 1000));
    const formatDate = (date) => {
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return [formatDate(dateMinus1), formatDate(dateMinus2)];
  }

  static async getRawatJalanPatients({
    kd_poli,
    jenis_poli,
    jenis_poli_sore,
    startDate,
    endDate,
    search,
    status,
    statusBayar,
    username,
    kd_dokter,
    tabFilter,
    page = 1,
    itemsPerPage = 10
  }) {
    try {
      console.log('Received request body:', { kd_poli, jenis_poli, jenis_poli_sore, startDate, endDate, search, status, statusBayar, username, kd_dokter, tabFilter });
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

      const normalizedTabFilter = this.normalizeTabFilter(tabFilter);
      const serverPoliAssignments = await AuthService.getSessionPoliAssignments(username);
      const normalizedJenisPoli = String(jenis_poli || serverPoliAssignments.jenis_poli || '').trim();
      const normalizedJenisPoliSore = String(jenis_poli_sore || serverPoliAssignments.jenis_poli_sore || '').trim();
      const sessionPoliGroups = await this.getSessionPoliGroups(poliCodes);
      const soreScopedTabs = ['sore', 'rujukan_internal_sore', 'pasien_lanjutan_sore', 'internal_lanjutan_sore'];
      const pagiScopedTabs = ['pagi', 'rujukan_internal', 'pasien_lanjutan', 'internal_lanjutan'];
      const selectedPoliCodes = normalizedTabFilter === 'pagi'
        ? (normalizedJenisPoli ? [normalizedJenisPoli] : sessionPoliGroups.pagi)
        : normalizedTabFilter === 'sore'
          ? (normalizedJenisPoliSore ? [normalizedJenisPoliSore] : sessionPoliGroups.sore)
          : pagiScopedTabs.includes(normalizedTabFilter)
            ? (normalizedJenisPoli ? [normalizedJenisPoli] : sessionPoliGroups.pagi)
            : soreScopedTabs.includes(normalizedTabFilter)
              ? (normalizedJenisPoliSore ? [normalizedJenisPoliSore] : sessionPoliGroups.sore)
            : sessionPoliGroups.hariIni;
      const sessionScopedTabs = [...pagiScopedTabs, ...soreScopedTabs];
      const effectivePoliCodes = selectedPoliCodes.length > 0 || !sessionScopedTabs.includes(normalizedTabFilter)
        ? selectedPoliCodes
        : [];

      if (sessionScopedTabs.includes(normalizedTabFilter) && effectivePoliCodes.length === 0) {
        return {
          success: true,
          data: [],
          doctors: [],
          total: 0,
          limit: parseInt(itemsPerPage || '10', 10),
          offset: 0,
          page: parseInt(page || '1', 10),
          totalPages: 0
        };
      }

      const filteredPoliCodes = effectivePoliCodes.length > 0
        ? effectivePoliCodes
        : poliCodes;
      const poliPlaceholders = filteredPoliCodes.map(() => '?').join(',');
      const isInternalTab = ['rujukan_internal', 'rujukan_internal_sore', 'internal_lanjutan', 'internal_lanjutan_sore'].includes(normalizedTabFilter);
      const isLanjutanTab = ['pasien_lanjutan', 'pasien_lanjutan_sore', 'internal_lanjutan', 'internal_lanjutan_sore'].includes(normalizedTabFilter);
      const fromClause = isInternalTab
        ? `
          FROM reg_periksa rp
          INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
          INNER JOIN rujukan_internal_poli rip ON rp.no_rawat = rip.no_rawat
          LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
          LEFT JOIN dokter d_target ON rip.kd_dokter = d_target.kd_dokter
          LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
          LEFT JOIN poliklinik pol_target ON rip.kd_poli = pol_target.kd_poli
          LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
        `
        : `
          FROM reg_periksa rp
          INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
          LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
          LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
          LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
        `;
      const doctorCodeColumn = isInternalTab ? 'rip.kd_dokter' : 'rp.kd_dokter';
      const doctorNameColumn = isInternalTab
        ? `COALESCE(d_target.nm_dokter, 'Dokter Tidak Diketahui')`
        : `COALESCE(d.nm_dokter, 'Dokter Tidak Diketahui')`;
      const poliNameColumn = isInternalTab
        ? `COALESCE(pol_target.nm_poli, 'Poliklinik Tidak Diketahui')`
        : `COALESCE(pol.nm_poli, 'Poliklinik Tidak Diketahui')`;

      // Build WHERE conditions
      let conditions = [];
      let params = [];
      let doctorConditions = [];
      let doctorParams = [];
      
      console.log('Building query conditions...');
      
      const poliCondition = isInternalTab
        ? `rip.kd_poli IN (${poliPlaceholders})`
        : `rp.kd_poli IN (${poliPlaceholders})`;

      conditions.push(poliCondition);
      params.push(...filteredPoliCodes);
      doctorConditions.push(poliCondition);
      doctorParams.push(...filteredPoliCodes);
      console.log('Poliklinik condition:', poliCondition, filteredPoliCodes);

      if (isLanjutanTab) {
        const [dateMinus1, dateMinus2] = this.getLanjutanDates();
        conditions.push('DATE(rp.tgl_registrasi) IN (?, ?)');
        conditions.push(`rp.stts = 'Lanjutan'`);
        params.push(dateMinus1, dateMinus2);
        doctorConditions.push('DATE(rp.tgl_registrasi) IN (?, ?)');
        doctorConditions.push(`rp.stts = 'Lanjutan'`);
        doctorParams.push(dateMinus1, dateMinus2);
        console.log('Lanjutan date condition:', [dateMinus1, dateMinus2]);
      } else {
        conditions.push('DATE(rp.tgl_registrasi) BETWEEN ? AND ?');
        params.push(formattedStartDate, formattedEndDate);
        doctorConditions.push('DATE(rp.tgl_registrasi) BETWEEN ? AND ?');
        doctorParams.push(formattedStartDate, formattedEndDate);
        console.log('Date range condition:', `tgl_registrasi BETWEEN '${formattedStartDate}' AND '${formattedEndDate}'`);
      }

      // PHP native rawat jalan does not filter by dokter by default.
      const normalizedDoctorFilter = String(kd_dokter || '').trim();
      const effectiveDoctorFilter = normalizedDoctorFilter === 'all'
        ? 'all'
        : (normalizedDoctorFilter || 'all');

      if (effectiveDoctorFilter !== 'all') {
        conditions.push(`${doctorCodeColumn} = ?`);
        params.push(effectiveDoctorFilter);
        console.log('Doctor filter applied:', effectiveDoctorFilter);
      } else {
        console.log('Doctor filter: showing all doctors in allowed poli');
      }

      if (search && String(search).trim().length > 0) {
        const q = `%${String(search).trim()}%`;
        conditions.push(`(
          p.nm_pasien LIKE ? OR
          rp.no_rkm_medis LIKE ? OR
          rp.no_rawat LIKE ? OR
          ${doctorNameColumn} LIKE ? OR
          ${poliNameColumn} LIKE ?
        )`);
        params.push(q, q, q, q, q);
        doctorConditions.push(`(
          p.nm_pasien LIKE ? OR
          rp.no_rkm_medis LIKE ? OR
          rp.no_rawat LIKE ? OR
          ${doctorNameColumn} LIKE ? OR
          ${poliNameColumn} LIKE ?
        )`);
        doctorParams.push(q, q, q, q, q);
        console.log('Search filter applied:', String(search).trim());
      }
      
      // Status filtering - PHP native lanjutan tabs are fixed to 'Lanjutan'
      if (!isLanjutanTab && status && status.trim() && status !== 'all') {
        const normalizedStatus = String(status).trim().toLowerCase();
        if (normalizedStatus === 'sudah' || normalizedStatus === 'selesai') {
          conditions.push('rp.stts IN (?, ?)');
          params.push('Sudah', 'Selesai');
          doctorConditions.push('rp.stts IN (?, ?)');
          doctorParams.push('Sudah', 'Selesai');
          console.log('Status filter applied (Sudah/Selesai):', status);
        } else {
          conditions.push('rp.stts = ?');
          params.push(status);
          doctorConditions.push('rp.stts = ?');
          doctorParams.push(status);
          console.log('Status filter applied:', status);
        }
      } else {
        console.log('Status filter: showing all statuses (status value:', status, ')');
      }
      
      // Payment status filtering - only add condition if not "all"
      if (statusBayar && statusBayar.trim() && statusBayar !== 'all') {
        conditions.push('rp.status_bayar = ?');
        params.push(statusBayar);
        doctorConditions.push('rp.status_bayar = ?');
        doctorParams.push(statusBayar);
        console.log('Payment status filter applied:', statusBayar);
      } else {
        console.log('Payment status filter: showing all payment statuses (statusBayar value:', statusBayar, ')');
      }

      // Tab-specific filtering
      switch(normalizedTabFilter) {
        case 'rujukan_internal':
          console.log('Tab filter applied: Rujukan Internal');
          break;
        case 'rujukan_internal_sore':
          console.log('Tab filter applied: Rujukan Internal Sore');
          break;
        case 'pasien_lanjutan':
          console.log('Tab filter applied: Pasien Lanjutan');
          break;
        case 'pasien_lanjutan_sore':
          console.log('Tab filter applied: Pasien Lanjutan Sore');
          break;
        case 'internal_lanjutan':
          console.log('Tab filter applied: Internal Lanjutan');
          break;
        case 'internal_lanjutan_sore':
          console.log('Tab filter applied: Internal Lanjutan Sore');
          break;
        case 'pagi':
          console.log('Tab filter applied: Sesi Pagi');
          break;
        case 'sore':
          console.log('Tab filter applied: Sesi Sore');
          break;
        case 'hari-ini':
        default:
          console.log('Tab filter applied: Hari Ini (default)');
          break;
      }

      // Pagination parameters
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage || "10"), 1000);
      const offset = (parseInt(page || "1") - 1) * (limit === 10000 ? 0 : limit);
      
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      // Count query
      const countSql = `
        SELECT COUNT(*) as total
        ${fromClause}
        WHERE ${conditions.join(' AND ')}
      `;

      const doctorSql = `
        SELECT DISTINCT
          ${doctorCodeColumn} as kd_dokter,
          ${doctorNameColumn} as nm_dokter
        ${fromClause}
        WHERE ${doctorConditions.join(' AND ')}
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
          ${doctorNameColumn} as nm_dokter,
          ${poliNameColumn} as nm_poli,
          COALESCE(pj.png_jawab, 'Umum') as png_jawab
        ${fromClause}
        WHERE ${conditions.join(' AND ')}
        ORDER BY rp.no_reg ASC
        ${limitClause}
      `;

      console.log('Executing count SQL:', countSql);
      console.log('Count parameters:', params);
      
      // Execute count query
      const [countResult] = await db.execute(countSql, params);
      const total = countResult[0]?.total || 0;

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
        const [checkResult] = await db.execute(checkQuery, filteredPoliCodes);
        console.log('Data check query result:', checkResult);
        
        // Check if dates exist in the range
        const dateCheckQuery = `
          SELECT COUNT(*) as count_in_range
          FROM reg_periksa
          WHERE DATE(tgl_registrasi) BETWEEN ? AND ?
          AND kd_poli IN (${poliPlaceholders})
        `;
        const [dateCheckResult] = await db.execute(dateCheckQuery, [formattedStartDate, formattedEndDate, ...filteredPoliCodes]);
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
        poliklinik: filteredPoliCodes.join(','),
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
