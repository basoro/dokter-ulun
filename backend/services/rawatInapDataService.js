import db from '../config/database.js';
import { getAccessibleDoctorCodesByPhpNative } from './doctorAccessMapping.js';

class RawatInapDataService {
  static getAccessibleDoctorCodes(username = '') {
    return getAccessibleDoctorCodesByPhpNative(username);
  }

  static buildInClausePlaceholders(values = []) {
    return values.map(() => '?').join(', ');
  }

  static shouldKeepMovementRows(statusPulang) {
    return String(statusPulang || '').trim() === 'pindah-kamar';
  }

  static shouldUseAdmissionDateForDischargeFilter(accessibleDoctorCodes = []) {
    return accessibleDoctorCodes.includes('DR00016');
  }

  static getDischargeDateFilterColumn(accessibleDoctorCodes = []) {
    return this.shouldUseAdmissionDateForDischargeFilter(accessibleDoctorCodes)
      ? 'ki.tgl_masuk'
      : 'ki.tgl_keluar';
  }

  static getResumePendingFilter(normalizedTab = 'rawat-inap') {
    if (normalizedTab === 'rawat-gabung') {
      return 'NOT EXISTS (SELECT 1 FROM resume_pasien_ranap rpr WHERE rpr.no_rawat = rp.no_rawat)';
    }

    return 'NOT EXISTS (SELECT 1 FROM resume_pasien_ranap rpr WHERE rpr.no_rawat = ki.no_rawat)';
  }

  static getRawatBersamaResumeFilter(rawatBersamaResumeStatus = 'belum_ada_resume', accessibleDoctorCodes = []) {
    const normalizedStatus = String(rawatBersamaResumeStatus || 'belum_ada_resume').trim();

    if (normalizedStatus === 'all') {
      return { condition: '', params: [] };
    }

    if (normalizedStatus === 'belum_resume_dokter') {
      if (!accessibleDoctorCodes.length) {
        return { condition: '1 = 0', params: [] };
      }

      const doctorPlaceholders = this.buildInClausePlaceholders(accessibleDoctorCodes);
      return {
        condition: `EXISTS (
          SELECT 1
          FROM resume_pasien_ranap rpr
          WHERE rpr.no_rawat = ki.no_rawat
        ) AND NOT EXISTS (
          SELECT 1
          FROM resume_pasien_ranap rpr_dokter
          WHERE rpr_dokter.no_rawat = ki.no_rawat
            AND rpr_dokter.kd_dokter IN (${doctorPlaceholders})
        )`,
        params: accessibleDoctorCodes
      };
    }

    if (normalizedStatus === 'sudah_resume') {
      return {
        condition: `EXISTS (
          SELECT 1
          FROM resume_pasien_ranap rpr
          WHERE rpr.no_rawat = ki.no_rawat
        )`,
        params: []
      };
    }

    return {
      condition: this.getResumePendingFilter('rawat-bersama'),
      params: []
    };
  }

  static applyStatusRawatFilter(whereConditions, params, statusPulang) {
    const normalizedStatus = String(statusPulang || 'all').trim();

    if (!normalizedStatus || normalizedStatus === 'all') {
      return;
    }

    if (normalizedStatus === 'masih-dirawat') {
      whereConditions.push(`COALESCE(ki.stts_pulang, '') = '-'`);
      return;
    }

    if (normalizedStatus === 'pindah-kamar') {
      whereConditions.push(`COALESCE(ki.stts_pulang, '') = 'Pindah Kamar'`);
      return;
    }

    if (normalizedStatus === 'sudah-pulang') {
      whereConditions.push(`COALESCE(ki.stts_pulang, '') NOT IN ('', '-', 'Pindah Kamar')`);
      return;
    }

    whereConditions.push('ki.stts_pulang = ?');
    params.push(normalizedStatus);
  }

  static getBaseFilters({
    search = "",
    statusPulang = "all",
    username = "",
    tab = "rawat-inap",
    startDate,
    endDate
  }) {
    const whereConditions = ['ki.tgl_masuk IS NOT NULL'];
    const params = [];
    const normalizedUsername = String(username || '').trim();
    const accessibleDoctorCodes = this.getAccessibleDoctorCodes(normalizedUsername);
    const normalizedTab = String(tab || 'rawat-inap').trim();

    if (accessibleDoctorCodes.length > 0 && normalizedTab !== 'rawat-gabung') {
      const doctorPlaceholders = this.buildInClausePlaceholders(accessibleDoctorCodes);
      whereConditions.push(`EXISTS (
        SELECT 1
        FROM dpjp_ranap dr_user
        WHERE dr_user.no_rawat = ki.no_rawat
          AND dr_user.kd_dokter IN (${doctorPlaceholders})
      )`);
      params.push(...accessibleDoctorCodes);
    }

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

    this.applyStatusRawatFilter(whereConditions, params, statusPulang);

    if (startDate && endDate && String(statusPulang || '').trim() !== 'masih-dirawat') {
      const normalizedStatus = String(statusPulang || '').trim();
      const dateColumn = normalizedStatus === 'sudah-pulang'
        ? this.getDischargeDateFilterColumn(accessibleDoctorCodes)
        : 'ki.tgl_masuk';

      whereConditions.push(`DATE(${dateColumn}) BETWEEN ? AND ?`);
      params.push(startDate, endDate);
    }

    return {
      whereConditions,
      params,
      normalizedUsername,
      accessibleDoctorCodes,
      normalizedTab
    };
  }

  static getTabFilter(
    normalizedTab = 'rawat-inap',
    normalizedUsername = '',
    accessibleDoctorCodes = [],
    statusPulang = 'all',
    rawatBersamaResumeStatus = 'belum_ada_resume'
  ) {
    if (normalizedTab === 'rawat-bersama') {
      if (accessibleDoctorCodes.length === 0) {
        return { condition: '1 = 0', params: [] };
      }

      const doctorPlaceholders = this.buildInClausePlaceholders(accessibleDoctorCodes);
      const extraConditions = [];
      const extraParams = [];

      if (String(statusPulang || '').trim() === 'sudah-pulang') {
        const resumeFilter = this.getRawatBersamaResumeFilter(rawatBersamaResumeStatus, accessibleDoctorCodes);

        if (resumeFilter.condition) {
          extraConditions.push(resumeFilter.condition);
          extraParams.push(...resumeFilter.params);
        }
      }

      return {
        condition: `EXISTS (
          SELECT 1
          FROM dpjp_ranap dr_raber
          WHERE dr_raber.no_rawat = ki.no_rawat
            AND dr_raber.kd_dokter IN (${doctorPlaceholders})
            AND dr_raber.jenis_dpjp IN ('Raber', 'Konsul')
        )${extraConditions.length > 0 ? ` AND ${extraConditions.join(' AND ')}` : ''}`,
        params: [...accessibleDoctorCodes, ...extraParams]
      };
    }

    if (normalizedTab === 'rawat-gabung') {
      if (accessibleDoctorCodes.length === 0) {
        return { condition: '1 = 0', params: [] };
      }

      const doctorPlaceholders = this.buildInClausePlaceholders(accessibleDoctorCodes);
      const extraConditions = [];

      if (String(statusPulang || '').trim() === 'sudah-pulang') {
        extraConditions.push(this.getResumePendingFilter(normalizedTab));
      }

      return {
        condition: `dr.kd_dokter IN (${doctorPlaceholders})
          AND COALESCE(dr.jenis_dpjp, 'Utama') IN ('Utama', 'PPDS', 'Internship')
          ${extraConditions.length > 0 ? `AND ${extraConditions.join(' AND ')}` : ''}`,
        params: accessibleDoctorCodes
      };
    }

    if (accessibleDoctorCodes.length === 0) {
      return { condition: '1 = 0', params: [] };
    }

    const doctorPlaceholders = this.buildInClausePlaceholders(accessibleDoctorCodes);
    const extraConditions = [];

    if (String(statusPulang || '').trim() === 'sudah-pulang') {
      extraConditions.push(this.getResumePendingFilter(normalizedTab));
    }

    return {
      condition: `EXISTS (
        SELECT 1
        FROM dpjp_ranap dr_main
        WHERE dr_main.no_rawat = ki.no_rawat
          AND dr_main.kd_dokter IN (${doctorPlaceholders})
          AND COALESCE(dr_main.jenis_dpjp, 'Utama') IN ('Utama', 'PPDS', 'Internship')
      )${extraConditions.length > 0 ? ` AND ${extraConditions.join(' AND ')}` : ''}`,
      params: accessibleDoctorCodes
    };
  }

  static getFromClause() {
    return `
      FROM kamar_inap ki
      LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
      LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
      LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
    `;
  }

  static getRawatGabungFromClause() {
    return `
      FROM ranap_gabung rg
      LEFT JOIN reg_periksa rp ON rg.no_rawat2 = rp.no_rawat
      LEFT JOIN kamar_inap ki ON rg.no_rawat = ki.no_rawat
      LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN dpjp_ranap dr ON rp.no_rawat = dr.no_rawat
      LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj
    `;
  }

  static getGroupedCountQuery(fromClause, whereClause, keepMovementRows = false) {
    if (keepMovementRows) {
      return `
        SELECT COUNT(*) as total
        FROM (
          SELECT ki.no_rawat
          ${fromClause}
          ${whereClause}
          GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir,
                   ki.tgl_masuk, ki.tgl_keluar, ki.diagnosa_awal, ki.diagnosa_akhir,
                   ki.stts_pulang, k.kd_kamar, b.nm_bangsal, rp.tgl_registrasi,
                   rp.jam_reg, rp.status_lanjut, ki.lama, ki.trf_kamar
        ) counted_rows
      `;
    }

    return `
      SELECT COUNT(DISTINCT ki.no_rawat) as total
      ${fromClause}
      ${whereClause}
    `;
  }

  static getRawatGabungCountQuery(whereClause) {
    return `
      SELECT COUNT(DISTINCT rp.no_rawat) as total
      ${this.getRawatGabungFromClause()}
      ${whereClause}
    `;
  }

  static getRawatGabungQuery(whereClause, limit, offset) {
    return `
      SELECT
        rp.no_rawat,
        p.no_rkm_medis,
        p.nm_pasien,
        p.jk as jenis_kelamin,
        p.tgl_lahir,
        MIN(ki.tgl_masuk) as tgl_masuk,
        MAX(COALESCE(pj.png_jawab, '')) as cara_bayar,
        NULLIF(
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ),
          ''
        ) as tgl_keluar,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(ki.diagnosa_awal, '') ORDER BY ki.tgl_masuk ASC SEPARATOR '||'),
          '||',
          1
        ) as diagnosa_awal,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(ki.diagnosa_akhir, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
          '||',
          1
        ) as diagnosa_akhir,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(ki.stts_pulang, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
          '||',
          1
        ) as stts_pulang,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(k.kd_kamar, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
          '||',
          1
        ) as kd_kamar,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(b.nm_bangsal, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
          '||',
          1
        ) as nm_bangsal,
        GROUP_CONCAT(DISTINCT CONCAT(d.nm_dokter, ' (', COALESCE(dr.jenis_dpjp, 'Tidak Diketahui'), ')') SEPARATOR ', ') as dokter_dpjp,
        rp.tgl_registrasi,
        rp.jam_reg,
        rp.status_lanjut,
        CASE
          WHEN SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(ki.stts_pulang, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ) IN ('', '-', 'Pindah Kamar')
            THEN DATEDIFF(CURDATE(), MIN(DATE(ki.tgl_masuk))) + 1
          ELSE DATEDIFF(
            STR_TO_DATE(
              NULLIF(
                SUBSTRING_INDEX(
                  GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                  '||',
                  1
                ),
                ''
              ),
              '%Y-%m-%d'
            ),
            MIN(DATE(ki.tgl_masuk))
          ) + 1
        END as lama,
        SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(ki.trf_kamar, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
          '||',
          1
        ) as trf_kamar
      ${this.getRawatGabungFromClause()}
      ${whereClause}
      GROUP BY rp.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir,
               rp.tgl_registrasi, rp.jam_reg, rp.status_lanjut
      ORDER BY rp.tgl_registrasi ASC, rp.jam_reg ASC
      ${limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`}
    `;
  }

  static getRawatBersamaResumeSelect(normalizedTab = 'rawat-inap', accessibleDoctorCodes = []) {
    if (normalizedTab !== 'rawat-bersama' || !accessibleDoctorCodes.length) {
      return {
        selectClause: `NULL AS rawat_bersama_resume_status`,
        params: []
      };
    }

    const doctorPlaceholders = this.buildInClausePlaceholders(accessibleDoctorCodes);

    return {
      selectClause: `
        CASE
          WHEN NOT EXISTS (
            SELECT 1
            FROM resume_pasien_ranap rpr_any
            WHERE rpr_any.no_rawat = ki.no_rawat
          ) THEN 'belum_ada_resume'
          WHEN EXISTS (
            SELECT 1
            FROM resume_pasien_ranap rpr_self
            WHERE rpr_self.no_rawat = ki.no_rawat
              AND rpr_self.kd_dokter IN (${doctorPlaceholders})
          ) THEN 'sudah_resume_saya'
          ELSE 'sudah_resume_dokter_lain'
        END AS rawat_bersama_resume_status
      `,
      params: accessibleDoctorCodes
    };
  }

  static async getTabCounts(
    {
      search = '',
      statusPulang = 'all',
      username = '',
      startDate,
      endDate,
      rawatBersamaResumeStatus = 'belum_ada_resume'
    } = {}
  ) {
    const normalizedUsername = String(username || '').trim();
    const accessibleDoctorCodes = this.getAccessibleDoctorCodes(normalizedUsername);
    const keepMovementRows = this.shouldKeepMovementRows(statusPulang);
    const countTabs = [
      { key: 'rawat_inap', tab: 'rawat-inap' },
      { key: 'rawat_bersama', tab: 'rawat-bersama' },
      { key: 'rawat_gabung', tab: 'rawat-gabung' }
    ];

    const countEntries = await Promise.all(
      countTabs.map(async ({ key, tab }) => {
        const {
          whereConditions: baseWhereConditions,
          params: baseParams
        } = this.getBaseFilters({
          search,
          statusPulang,
          username: normalizedUsername,
          tab,
          startDate,
          endDate
        });
        const tabFilter = this.getTabFilter(tab, normalizedUsername, accessibleDoctorCodes, statusPulang, rawatBersamaResumeStatus);
        const whereConditions = [...baseWhereConditions, tabFilter.condition];
        const params = [...baseParams, ...tabFilter.params];
        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
        const countQuery = tab === 'rawat-gabung'
          ? this.getRawatGabungCountQuery(whereClause)
          : this.getGroupedCountQuery(this.getFromClause(), whereClause, keepMovementRows);
        const [countResult] = await db.execute(countQuery, params);

        return [key, countResult[0]?.total || 0];
      })
    );

    return Object.fromEntries(countEntries);
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

  static async getRawatInapData({
    page = "1",
    itemsPerPage = "50", 
    search = "",
    statusPulang = "all",
    username = "",
    tab = "rawat-inap",
    startDate,
    endDate,
    rawatBersamaResumeStatus = "belum_ada_resume",
    includeTabCounts = true,
    countsOnly = false
  }) {
    try {
      console.log('=== Rawat Inap Data Request ===');
      console.log('Request params:', { page, itemsPerPage, search, statusPulang, username, tab, startDate, endDate });

      // Validate and limit itemsPerPage
      const limit = parseInt(itemsPerPage) === -1 || parseInt(itemsPerPage) > 1000 ? 10000 : Math.min(parseInt(itemsPerPage), 1000);
      const offset = (parseInt(page) - 1) * (limit === 10000 ? 0 : limit);
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      const {
        whereConditions: baseWhereConditions,
        params: baseParams,
        normalizedUsername,
        accessibleDoctorCodes
      } = this.getBaseFilters({
        search,
        statusPulang,
        username,
        tab,
        startDate,
        endDate
      });
      const normalizedTab = String(tab || 'rawat-inap').trim();
      const shouldIncludeTabCounts = includeTabCounts === true || includeTabCounts === 'true';
      const shouldReturnCountsOnly = countsOnly === true || countsOnly === 'true';
      const tabFilter = this.getTabFilter(
        normalizedTab,
        normalizedUsername,
        accessibleDoctorCodes,
        statusPulang,
        rawatBersamaResumeStatus
      );
      const whereConditions = [...baseWhereConditions, tabFilter.condition];
      const params = [...baseParams, ...tabFilter.params];
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const fromClause = normalizedTab === 'rawat-gabung'
        ? this.getRawatGabungFromClause()
        : this.getFromClause();
      const rawatBersamaResumeSelect = this.getRawatBersamaResumeSelect(normalizedTab, accessibleDoctorCodes);
      const keepMovementRows = this.shouldKeepMovementRows(statusPulang);
      const orderDirection = normalizedTab === 'rawat-inap' || normalizedTab === 'rawat-bersama' ? 'ASC' : 'DESC';
      console.log('WHERE clause:', whereClause);
      console.log('Parameters:', params);

      const query = normalizedTab === 'rawat-gabung'
        ? this.getRawatGabungQuery(whereClause, limit, offset)
        : keepMovementRows
        ? `
            SELECT 
              ki.no_rawat,
              p.no_rkm_medis,
              p.nm_pasien,
              p.jk as jenis_kelamin,
              p.tgl_lahir,
              MAX(COALESCE(pj.png_jawab, '')) as cara_bayar,
              ki.tgl_masuk,
              ki.tgl_keluar,
              ki.diagnosa_awal,
              ki.diagnosa_akhir,
              ki.stts_pulang,
              k.kd_kamar,
              b.nm_bangsal,
              GROUP_CONCAT(DISTINCT CONCAT(d.nm_dokter, ' (', COALESCE(dr.jenis_dpjp, 'Tidak Diketahui'), ')') SEPARATOR ', ') as dokter_dpjp,
              rp.tgl_registrasi,
              rp.jam_reg,
              rp.status_lanjut,
              ${rawatBersamaResumeSelect.selectClause},
              CASE
                WHEN COALESCE(ki.stts_pulang, '') IN ('', '-', 'Pindah Kamar')
                  THEN DATEDIFF(CURDATE(), DATE(ki.tgl_masuk)) + 1
                ELSE DATEDIFF(DATE(ki.tgl_keluar), DATE(ki.tgl_masuk)) + 1
              END as lama,
              ki.trf_kamar
            ${fromClause}
            ${whereClause}
            GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir,
                     ki.tgl_masuk, ki.tgl_keluar, ki.diagnosa_awal, ki.diagnosa_akhir,
                     ki.stts_pulang, k.kd_kamar, b.nm_bangsal, rp.tgl_registrasi,
                     rp.jam_reg, rp.status_lanjut, ki.lama, ki.trf_kamar
            ORDER BY ki.tgl_masuk ${orderDirection}
            ${limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`}
          `
        : `
            SELECT 
              ki.no_rawat,
              p.no_rkm_medis,
              p.nm_pasien,
              p.jk as jenis_kelamin,
              p.tgl_lahir,
              MAX(COALESCE(pj.png_jawab, '')) as cara_bayar,
              MIN(ki.tgl_masuk) as tgl_masuk,
              NULLIF(
                SUBSTRING_INDEX(
                  GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                  '||',
                  1
                ),
                ''
              ) as tgl_keluar,
              SUBSTRING_INDEX(
                GROUP_CONCAT(COALESCE(ki.diagnosa_awal, '') ORDER BY ki.tgl_masuk ASC SEPARATOR '||'),
                '||',
                1
              ) as diagnosa_awal,
              SUBSTRING_INDEX(
                GROUP_CONCAT(COALESCE(ki.diagnosa_akhir, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                '||',
                1
              ) as diagnosa_akhir,
              SUBSTRING_INDEX(
                GROUP_CONCAT(COALESCE(ki.stts_pulang, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                '||',
                1
              ) as stts_pulang,
              SUBSTRING_INDEX(
                GROUP_CONCAT(COALESCE(k.kd_kamar, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                '||',
                1
              ) as kd_kamar,
              SUBSTRING_INDEX(
                GROUP_CONCAT(COALESCE(b.nm_bangsal, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                '||',
                1
              ) as nm_bangsal,
              GROUP_CONCAT(DISTINCT CONCAT(d.nm_dokter, ' (', COALESCE(dr.jenis_dpjp, 'Tidak Diketahui'), ')') SEPARATOR ', ') as dokter_dpjp,
              rp.tgl_registrasi,
              rp.jam_reg,
              rp.status_lanjut,
              ${rawatBersamaResumeSelect.selectClause},
              CASE
                WHEN SUBSTRING_INDEX(
                  GROUP_CONCAT(COALESCE(ki.stts_pulang, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                  '||',
                  1
                ) IN ('', '-', 'Pindah Kamar')
                  THEN DATEDIFF(CURDATE(), MIN(DATE(ki.tgl_masuk))) + 1
                ELSE DATEDIFF(
                  STR_TO_DATE(
                    NULLIF(
                      SUBSTRING_INDEX(
                        GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                        '||',
                        1
                      ),
                      ''
                    ),
                    '%Y-%m-%d'
                  ),
                  MIN(DATE(ki.tgl_masuk))
                ) + 1
              END as lama,
              SUBSTRING_INDEX(
                GROUP_CONCAT(COALESCE(ki.trf_kamar, '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
                '||',
                1
              ) as trf_kamar
            ${fromClause}
            ${whereClause}
            GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir,
                     rp.tgl_registrasi, rp.jam_reg, rp.status_lanjut
            ORDER BY MIN(ki.tgl_masuk) ${orderDirection}
            ${limit === 10000 ? '' : `LIMIT ${limit} OFFSET ${offset}`}
          `;

      let total = 0;
      let data = [];
      let tabCounts = null;

      if (!shouldReturnCountsOnly) {
        const countQuery = normalizedTab === 'rawat-gabung'
          ? this.getRawatGabungCountQuery(whereClause)
          : this.getGroupedCountQuery(fromClause, whereClause, keepMovementRows);

        console.log('Executing main query:', query);
        const queryParams = [...rawatBersamaResumeSelect.params, ...params];
        console.log('Query parameters:', queryParams);

        const [countResult] = await db.execute(countQuery, params);
        total = countResult[0]?.total || 0;

        const [dataResult] = await db.execute(query, queryParams);
        data = dataResult || [];

        console.log('Total count result:', total);
        console.log('Data result rows count:', data.length);
        console.log('Sample data row:', data[0]);
        console.log(`Found ${data.length} records out of ${total} total`);
      }

      if (shouldIncludeTabCounts || shouldReturnCountsOnly) {
        tabCounts = await this.getTabCounts({
          search,
          statusPulang,
          username: normalizedUsername,
          startDate,
          endDate,
          rawatBersamaResumeStatus
        });
        console.log('Tab counts:', tabCounts);
      }

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
        ...(tabCounts ? { tabCounts } : {}),
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
