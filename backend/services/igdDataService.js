import db from '../config/database.js';

class IgdDataService {
  static normalizeTriaseLevelCode(value) {
    const normalized = String(value || '').trim().toUpperCase();
    const legacyMap = {
      T001: 'KL01',
      T002: 'KL03',
      T003: 'KL05',
      T004: 'KL02'
    };

    return legacyMap[normalized] || normalized;
  }

  static mapTriaseLevelLabel(kdLevel) {
    const normalized = String(kdLevel || '').trim().toUpperCase();
    switch (normalized) {
      case 'KL01':
        return 'Merah';
      case 'KL02':
        return 'Merah Muda';
      case 'KL03':
        return 'Kuning';
      case 'KL04':
        return 'Hijau Muda';
      case 'KL05':
        return 'Hijau';
      default:
        return 'Belum Triase';
    }
  }

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
      const normalizedTriaseLevel = this.normalizeTriaseLevelCode(triaseLevel);
      const triaseSummaryJoin = `
        LEFT JOIN (
          SELECT
            dpt.no_rawat,
            GROUP_CONCAT(DISTINCT mti.kd_tindakan ORDER BY mti.kd_tindakan SEPARATOR ', ') AS kd_tindakan,
            GROUP_CONCAT(DISTINCT mti.nm_tindakan ORDER BY mti.nm_tindakan SEPARATOR ', ') AS nm_tindakan,
            MIN(mti.kd_level) AS kd_level
          FROM detail_pemeriksaan_triase dpt
          INNER JOIN master_triase_igd mti ON mti.kd_tindakan = dpt.kd_tindakan
          GROUP BY dpt.no_rawat
        ) triase_summary ON triase_summary.no_rawat = r.no_rawat
      `;
      const baseWhereConditions = [`r.kd_poli IN (${igdPoliCodes.map(() => '?').join(', ')})`];
      const baseQueryParams = [...igdPoliCodes];

      console.log('=== IGD Data Service Debug ===');
      console.log('Parameters received:', {
        limit, offset, search, statusFilter, triaseLevel, dateFrom, dateTo, tab
      });

      if (search) {
        baseWhereConditions.push(`(p.nm_pasien LIKE ? OR r.no_rkm_medis LIKE ?)`);
        baseQueryParams.push(`%${search}%`, `%${search}%`);
      }

      if (dateFrom) {
        baseWhereConditions.push(`DATE(r.tgl_registrasi) >= ?`);
        baseQueryParams.push(dateFrom);
      }

      if (dateTo) {
        baseWhereConditions.push(`DATE(r.tgl_registrasi) <= ?`);
        baseQueryParams.push(dateTo);
      }

      if (normalizedTriaseLevel && normalizedTriaseLevel !== 'ALL') {
        baseWhereConditions.push(`triase_summary.kd_level = ?`);
        baseQueryParams.push(normalizedTriaseLevel);
      }

      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'Triase') {
          baseWhereConditions.push(`mt.no_rawat IS NOT NULL AND triase_summary.no_rawat IS NULL`);
        } else if (statusFilter === 'Selesai') {
          baseWhereConditions.push(`triase_summary.no_rawat IS NOT NULL`);
        } else if (statusFilter === 'Menunggu') {
          baseWhereConditions.push(`mt.no_rawat IS NULL`);
        }
      }

      const getTabCondition = (tabKey) => {
        if (tabKey === 'triase') return `mt.no_rawat IS NOT NULL`;
        if (tabKey === 'observasi') return `mt.no_rawat IS NOT NULL AND triase_summary.no_rawat IS NULL`;
        if (tabKey === 'tindakan') return `triase_summary.no_rawat IS NOT NULL`;
        return '';
      };

      const buildWhereClause = (tabKey) => {
        const conditions = [...baseWhereConditions];
        const tabCondition = getTabCondition(tabKey);
        if (tabCondition) {
          conditions.push(tabCondition);
        }
        return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      };

      const buildCountQuery = (tabKey) => `
        SELECT COUNT(*) as total
        FROM (
          SELECT DISTINCT r.no_rawat
          FROM reg_periksa r
          LEFT JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
          LEFT JOIN data_triase_igd mt ON r.no_rawat = mt.no_rawat
          ${triaseSummaryJoin}
          ${buildWhereClause(tabKey)}
        ) unique_records
      `;

      const queryParams = [...baseQueryParams];
      const whereClause = buildWhereClause(tab);

      // Count total records with deduplication
      const countQuery = buildCountQuery(tab);

      console.log('Count query:', countQuery);
      console.log('Count query params:', queryParams);
      
      const [countResult] = await db.execute(countQuery, queryParams);
      const total = countResult[0]?.total || 0;
      
      console.log('Total count result:', total);

      const [triaseCountResult, observasiCountResult, tindakanCountResult] = await Promise.all([
        db.execute(buildCountQuery('triase'), baseQueryParams),
        db.execute(buildCountQuery('observasi'), baseQueryParams),
        db.execute(buildCountQuery('tindakan'), baseQueryParams)
      ]);

      const tabCounts = {
        triase: Number(triaseCountResult?.[0]?.[0]?.total || 0),
        observasi: Number(observasiCountResult?.[0]?.[0]?.total || 0),
        tindakan: Number(tindakanCountResult?.[0]?.[0]?.total || 0)
      };

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
          COALESCE(triase_summary.kd_tindakan, '') as kd_tindakan,
          COALESCE(
            triase_summary.nm_tindakan,
            NULLIF(mt.tindakan, ''),
            NULLIF(mt.diagnosis, ''),
            NULLIF(mt.keterangan, ''),
            'Belum Ada Tindakan'
          ) as nm_tindakan,
          COALESCE(triase_summary.kd_level, '') as kd_level,
          CASE 
            WHEN triase_summary.no_rawat IS NOT NULL THEN 'Selesai'
            WHEN mt.no_rawat IS NOT NULL THEN 'Triase'
            ELSE 'Menunggu'
          END as status
        FROM reg_periksa r
        LEFT JOIN pasien p ON r.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        LEFT JOIN data_triase_igd mt ON r.no_rawat = mt.no_rawat
        ${triaseSummaryJoin}
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
        triase_level: this.mapTriaseLevelLabel(row.kd_level),
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
        tabCounts,
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
