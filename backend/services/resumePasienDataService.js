import { executeQuery } from '../config/database.js';
import { getAccessibleDoctorCodesByPhpNative } from './doctorAccessMapping.js';

class ResumePasienDataService {
  enumCaraKeluar = ['Atas Izin Dokter', 'Pindah RS', 'Pulang Atas Permintaan Sendiri', 'Lainnya'];
  enumKeadaan = ['Membaik', 'Sembuh', 'Keadaan Khusus', 'Meninggal'];
  enumDilanjutkan = ['Kembali Ke RS', 'RS Lain', 'Dokter Luar', 'Puskesmes', 'Lainnya'];
  enumKondisiPulangRalan = ['Hidup', 'Meninggal'];

  buildInClausePlaceholders(values = []) {
    return values.map(() => '?').join(', ');
  }

  shouldUseAdmissionDateForDischargeFilter(accessibleDoctorCodes = []) {
    return accessibleDoctorCodes.includes('DR00016');
  }

  getDischargeDateFilterColumn(accessibleDoctorCodes = []) {
    return this.shouldUseAdmissionDateForDischargeFilter(accessibleDoctorCodes)
      ? 'ki.tgl_masuk'
      : 'ki.tgl_keluar';
  }

  applyStatusRawatFilter(whereConditions, params, statusPulang) {
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

  // Format date to YYYY-MM-DD format
  formatDateOnly(dateStr) {
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

  formatDateTimeLocal(dateStr) {
    if (!dateStr) return '';

    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');

      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting datetime:', dateStr, error);
      return '';
    }
  }

  normalizeStatusRawat(statusRawat) {
    const normalized = String(statusRawat || 'Ranap').trim().toLowerCase();
    return normalized === 'ralan' ? 'Ralan' : 'Ranap';
  }

  normalizeResumePayload(no_rawat, resumeData = {}) {
    const value = (key, fallback = '') => String(resumeData[key] ?? fallback).trim();
    const normalized = {
      no_rawat,
      kd_dokter: value('kd_dokter'),
      diagnosa_awal: value('diagnosa_awal'),
      alasan: value('alasan'),
      keluhan_utama: value('keluhan_utama'),
      pemeriksaan_fisik: value('pemeriksaan_fisik'),
      jalannya_penyakit: value('jalannya_penyakit'),
      pemeriksaan_penunjang: value('pemeriksaan_penunjang'),
      hasil_laborat: value('hasil_laborat'),
      tindakan_dan_operasi: value('tindakan_dan_operasi'),
      obat_di_rs: value('obat_di_rs'),
      diagnosa_utama: value('diagnosa_utama'),
      kd_diagnosa_utama: value('kd_diagnosa_utama'),
      diagnosa_sekunder: value('diagnosa_sekunder'),
      kd_diagnosa_sekunder: value('kd_diagnosa_sekunder'),
      diagnosa_sekunder2: value('diagnosa_sekunder2'),
      kd_diagnosa_sekunder2: value('kd_diagnosa_sekunder2'),
      diagnosa_sekunder3: value('diagnosa_sekunder3'),
      kd_diagnosa_sekunder3: value('kd_diagnosa_sekunder3'),
      diagnosa_sekunder4: value('diagnosa_sekunder4'),
      kd_diagnosa_sekunder4: value('kd_diagnosa_sekunder4'),
      prosedur_utama: value('prosedur_utama'),
      kd_prosedur_utama: value('kd_prosedur_utama'),
      prosedur_sekunder: value('prosedur_sekunder'),
      kd_prosedur_sekunder: value('kd_prosedur_sekunder'),
      prosedur_sekunder2: value('prosedur_sekunder2'),
      kd_prosedur_sekunder2: value('kd_prosedur_sekunder2'),
      prosedur_sekunder3: value('prosedur_sekunder3'),
      kd_prosedur_sekunder3: value('kd_prosedur_sekunder3'),
      alergi: value('alergi'),
      diet: value('diet'),
      lab_belum: value('lab_belum'),
      edukasi: value('edukasi'),
      cara_keluar: value('cara_keluar'),
      ket_keluar: value('ket_keluar'),
      keadaan: value('keadaan'),
      ket_keadaan: value('ket_keadaan'),
      dilanjutkan: value('dilanjutkan'),
      ket_dilanjutkan: value('ket_dilanjutkan'),
      kontrol: resumeData.kontrol ? resumeData.kontrol : null,
      obat_pulang: value('obat_pulang'),
    };

    if (!normalized.kd_dokter) {
      throw new Error('kd_dokter wajib diisi');
    }

    if (!this.enumCaraKeluar.includes(normalized.cara_keluar)) {
      throw new Error('cara_keluar tidak valid');
    }

    if (!this.enumKeadaan.includes(normalized.keadaan)) {
      throw new Error('keadaan tidak valid');
    }

    if (!this.enumDilanjutkan.includes(normalized.dilanjutkan)) {
      throw new Error('dilanjutkan tidak valid');
    }

    return normalized;
  }

  normalizeResumeRalanPayload(no_rawat, resumeData = {}) {
    const value = (key, fallback = '') => String(resumeData[key] ?? fallback).trim();
    const kondisiPulang = value('kondisi_pulang') || (String(resumeData.keadaan || '').trim() === 'Meninggal' ? 'Meninggal' : 'Hidup');
    const normalized = {
      no_rawat,
      kd_dokter: value('kd_dokter'),
      keluhan_utama: value('keluhan_utama'),
      jalannya_penyakit: value('jalannya_penyakit'),
      pemeriksaan_penunjang: value('pemeriksaan_penunjang'),
      hasil_laborat: value('hasil_laborat'),
      diagnosa_utama: value('diagnosa_utama'),
      kd_diagnosa_utama: value('kd_diagnosa_utama'),
      diagnosa_sekunder: value('diagnosa_sekunder'),
      kd_diagnosa_sekunder: value('kd_diagnosa_sekunder'),
      diagnosa_sekunder2: value('diagnosa_sekunder2'),
      kd_diagnosa_sekunder2: value('kd_diagnosa_sekunder2'),
      diagnosa_sekunder3: value('diagnosa_sekunder3'),
      kd_diagnosa_sekunder3: value('kd_diagnosa_sekunder3'),
      diagnosa_sekunder4: value('diagnosa_sekunder4'),
      kd_diagnosa_sekunder4: value('kd_diagnosa_sekunder4'),
      prosedur_utama: value('prosedur_utama'),
      kd_prosedur_utama: value('kd_prosedur_utama'),
      prosedur_sekunder: value('prosedur_sekunder'),
      kd_prosedur_sekunder: value('kd_prosedur_sekunder'),
      prosedur_sekunder2: value('prosedur_sekunder2'),
      kd_prosedur_sekunder2: value('kd_prosedur_sekunder2'),
      prosedur_sekunder3: value('prosedur_sekunder3'),
      kd_prosedur_sekunder3: value('kd_prosedur_sekunder3'),
      kondisi_pulang: kondisiPulang,
      obat_pulang: value('obat_pulang')
    };

    if (!normalized.kd_dokter) {
      throw new Error('kd_dokter wajib diisi');
    }

    if (!this.enumKondisiPulangRalan.includes(normalized.kondisi_pulang)) {
      throw new Error('kondisi_pulang tidak valid');
    }

    return normalized;
  }

  splitGroupedValues(value, maxItems) {
    return String(value || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, maxItems);
  }

  async getRalanResumeDefaults(no_rawat) {
    const [keluhanRows, diagnosaRows, prosedurRows, terapiPemberianRows, terapiResepRows, terapiRacikanRows] = await Promise.all([
      executeQuery(
        `
          SELECT keluhan
          FROM pemeriksaan_ralan
          WHERE no_rawat = ?
          ORDER BY tgl_perawatan DESC, jam_rawat DESC
          LIMIT 1
        `,
        [no_rawat]
      ),
      executeQuery(
        `
          SELECT dp.kd_penyakit, py.nm_penyakit
          FROM diagnosa_pasien dp
          INNER JOIN penyakit py ON py.kd_penyakit = dp.kd_penyakit
          WHERE dp.no_rawat = ? AND dp.status = 'Ralan'
          ORDER BY CAST(COALESCE(NULLIF(dp.prioritas, ''), '0') AS UNSIGNED) ASC, dp.kd_penyakit ASC
          LIMIT 5
        `,
        [no_rawat]
      ),
      executeQuery(
        `
          SELECT pp.kode, icd9.deskripsi_panjang
          FROM prosedur_pasien pp
          INNER JOIN icd9 ON icd9.kode = pp.kode
          WHERE pp.no_rawat = ? AND pp.status = 'Ralan'
          ORDER BY CAST(COALESCE(NULLIF(pp.prioritas, ''), '0') AS UNSIGNED) ASC, pp.kode ASC
          LIMIT 4
        `,
        [no_rawat]
      ),
      executeQuery(
        `
          SELECT GROUP_CONCAT(DISTINCT db.nama_brng ORDER BY db.nama_brng ASC SEPARATOR '\n') AS terapi
          FROM detail_pemberian_obat dpo
          INNER JOIN databarang db ON db.kode_brng = dpo.kode_brng
          WHERE dpo.no_rawat = ? AND LOWER(COALESCE(dpo.status, '')) = 'ralan'
        `,
        [no_rawat]
      ),
      executeQuery(
        `
          SELECT GROUP_CONCAT(DISTINCT db.nama_brng ORDER BY db.nama_brng ASC SEPARATOR '\n') AS terapi
          FROM resep_obat ro
          INNER JOIN resep_dokter rd ON rd.no_resep = ro.no_resep
          INNER JOIN databarang db ON db.kode_brng = rd.kode_brng
          WHERE ro.no_rawat = ? AND LOWER(COALESCE(ro.status, '')) = 'ralan'
        `,
        [no_rawat]
      ),
      executeQuery(
        `
          SELECT GROUP_CONCAT(DISTINCT db.nama_brng ORDER BY db.nama_brng ASC SEPARATOR '\n') AS terapi
          FROM resep_obat ro
          INNER JOIN resep_dokter_racikan_detail rdrd ON rdrd.no_resep = ro.no_resep
          INNER JOIN databarang db ON db.kode_brng = rdrd.kode_brng
          WHERE ro.no_rawat = ? AND LOWER(COALESCE(ro.status, '')) = 'ralan'
        `,
        [no_rawat]
      )
    ]);

    const diagnosaList = Array.isArray(diagnosaRows) ? diagnosaRows : [];
    const prosedurList = Array.isArray(prosedurRows) ? prosedurRows : [];
    const terapi = [
      terapiResepRows?.[0]?.terapi,
      terapiRacikanRows?.[0]?.terapi,
      terapiPemberianRows?.[0]?.terapi
    ].find((item) => String(item || '').trim()) || '';

    return {
      keluhan_utama: String(keluhanRows?.[0]?.keluhan || '').trim(),
      diagnosa_utama: diagnosaList[0]?.nm_penyakit || '',
      kd_diagnosa_utama: diagnosaList[0]?.kd_penyakit || '',
      diagnosa_sekunder: diagnosaList[1]?.nm_penyakit || '',
      kd_diagnosa_sekunder: diagnosaList[1]?.kd_penyakit || '',
      diagnosa_sekunder2: diagnosaList[2]?.nm_penyakit || '',
      kd_diagnosa_sekunder2: diagnosaList[2]?.kd_penyakit || '',
      diagnosa_sekunder3: diagnosaList[3]?.nm_penyakit || '',
      kd_diagnosa_sekunder3: diagnosaList[3]?.kd_penyakit || '',
      diagnosa_sekunder4: diagnosaList[4]?.nm_penyakit || '',
      kd_diagnosa_sekunder4: diagnosaList[4]?.kd_penyakit || '',
      prosedur_utama: prosedurList[0]?.deskripsi_panjang || '',
      kd_prosedur_utama: prosedurList[0]?.kode || '',
      prosedur_sekunder: prosedurList[1]?.deskripsi_panjang || '',
      kd_prosedur_sekunder: prosedurList[1]?.kode || '',
      prosedur_sekunder2: prosedurList[2]?.deskripsi_panjang || '',
      kd_prosedur_sekunder2: prosedurList[2]?.kode || '',
      prosedur_sekunder3: prosedurList[3]?.deskripsi_panjang || '',
      kd_prosedur_sekunder3: prosedurList[3]?.kode || '',
      obat_pulang: String(terapi || '').trim()
    };
  }

  // Get resume pasien data with pagination and filters
  async getResumePasienData({
    page = "1",
    itemsPerPage = "50", 
    search = "",
    statusPulang = "all",
    username = "",
    resumeStatus = "all",
    startDate,
    endDate
  }) {
    try {
      // Validate and limit itemsPerPage
      const limit = Math.min(parseInt(itemsPerPage), 500);
      const offset = (parseInt(page) - 1) * limit;
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      // Build the WHERE clause - start with kamar_inap filter
      let whereConditions = ['ki.no_rawat IS NOT NULL'];
      let params = [];
      const normalizedUsername = String(username || '').trim();
      const accessibleDoctorCodes = getAccessibleDoctorCodesByPhpNative(normalizedUsername);
      const normalizedResumeStatus = String(resumeStatus || 'all').trim();

      if (accessibleDoctorCodes.length > 0) {
        const doctorPlaceholders = this.buildInClausePlaceholders(accessibleDoctorCodes);
        whereConditions.push(`EXISTS (
          SELECT 1
          FROM dpjp_ranap dr_user
          WHERE dr_user.no_rawat = ki.no_rawat
            AND dr_user.kd_dokter IN (${doctorPlaceholders})
            AND COALESCE(dr_user.jenis_dpjp, 'Utama') IN ('Utama', 'PPDS', 'Internship')
        )`);
        params.push(...accessibleDoctorCodes);
      }

      // Search filter
      if (search && search.trim()) {
        whereConditions.push(`(
          p.nm_pasien LIKE ? OR
          p.no_rkm_medis LIKE ? OR
          ki.no_rawat LIKE ? OR
          d.nm_dokter LIKE ? OR
          rpr.diagnosa_utama LIKE ? OR
          rpr.diagnosa_sekunder LIKE ?
        )`);
        const searchParam = `%${search.trim()}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
      }

      // Status rawat filter
      this.applyStatusRawatFilter(whereConditions, params, statusPulang);

      // Date range filter follows PHP native: use tgl_masuk for DR00016 scope, otherwise tgl_keluar.
      if (startDate && endDate) {
        const dateColumn = String(statusPulang || '').trim() === 'sudah-pulang'
          ? this.getDischargeDateFilterColumn(accessibleDoctorCodes)
          : 'ki.tgl_masuk';

        whereConditions.push(`DATE(${dateColumn}) BETWEEN ? AND ?`);
        params.push(startDate, endDate);
      }

      // "Sudah Resume" / "Belum Resume" should reflect actual resume existence,
      // not text matches in resume fields such as ket_keadaan.
      if (normalizedResumeStatus === 'sudah_resume') {
        whereConditions.push('rpr.no_rawat IS NOT NULL');
      } else if (normalizedResumeStatus === 'belum_resume') {
        whereConditions.push('rpr.no_rawat IS NULL');
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      console.log('WHERE clause:', whereClause);
      console.log('Parameters:', params);

      // Main query - start from kamar_inap and LEFT JOIN to resume_pasien_ranap
      const query = `
        SELECT 
          ki.no_rawat,
          p.no_rkm_medis,
          p.nm_pasien,
          p.jk as jenis_kelamin,
          p.tgl_lahir,
          MIN(ki.tgl_masuk) as tgl_masuk,
          NULLIF(
            SUBSTRING_INDEX(
              GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
              '||',
              1
            ),
            ''
          ) as tgl_keluar,
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
          rpr.diagnosa_awal,
          rpr.kd_diagnosa_utama,
          rpr.diagnosa_utama,
          rpr.kd_diagnosa_sekunder,
          rpr.diagnosa_sekunder,
          rpr.prosedur_utama,
          rpr.prosedur_sekunder,
          rpr.keadaan,
          rpr.ket_keadaan,
          CASE 
            WHEN rpr.no_rawat IS NOT NULL THEN 'sudah_resume'
            ELSE 'belum_resume'
          END as status_resume
        FROM kamar_inap ki
        LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
        LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        ${whereClause}
        GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir, rpr.diagnosa_awal, rpr.kd_diagnosa_utama, rpr.diagnosa_utama, rpr.kd_diagnosa_sekunder, rpr.diagnosa_sekunder, rpr.prosedur_utama, rpr.prosedur_sekunder, rpr.keadaan, rpr.ket_keadaan
        ORDER BY MIN(ki.tgl_masuk) DESC
        LIMIT ? OFFSET ?
      `;

      // Count query - start from kamar_inap
      const countQuery = `
        SELECT COUNT(DISTINCT ki.no_rawat) as total
        FROM kamar_inap ki
        LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
        LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        ${whereClause}
      `;

      console.log('Executing count query...');
      const countResult = await executeQuery(countQuery, params);
      const total = countResult[0]?.total || 0;

      console.log('Executing data query...');
      const dataResult = await executeQuery(query, [...params, limit, offset]);
      
      console.log(`Found ${dataResult.length} records out of ${total} total`);

      // Format date fields
      const formattedData = dataResult.map(row => ({
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
      console.error('Error getting resume pasien data:', error);
      throw error;
    }
  }

  // Get resume detail for specific patient
  async getResumeDetail(no_rawat, statusRawat = 'Ranap', kdDokter = '') {
    const normalizedStatusRawat = this.normalizeStatusRawat(statusRawat);
    if (normalizedStatusRawat === 'Ralan') {
      return this.getResumeDetailRalan(no_rawat, kdDokter);
    }

    return this.getResumeDetailRanap(no_rawat);
  }

  async getResumeDetailRanap(no_rawat) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const query = `
      SELECT 
        rp.no_rawat,
        rp.kd_dokter AS kd_dokter_reg,
        regDok.nm_dokter AS dokter_reg,
        p.no_rkm_medis,
        p.nm_pasien,
        p.jk as jenis_kelamin,
        p.tgl_lahir,
        MIN(ki.tgl_masuk) as tgl_masuk,
        NULLIF(
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(DATE_FORMAT(ki.tgl_keluar, '%Y-%m-%d'), '') ORDER BY ki.tgl_masuk DESC SEPARATOR '||'),
            '||',
            1
          ),
          ''
        ) as tgl_keluar,
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
        rpr.kd_dokter,
        COALESCE(penulis.nm_dokter, rpr.kd_dokter, '') AS dokter_penulis,
        COALESCE(
          NULLIF(rpr.diagnosa_awal, ''),
          NULLIF(
            SUBSTRING_INDEX(
              GROUP_CONCAT(COALESCE(ki.diagnosa_awal, '') ORDER BY ki.tgl_masuk ASC SEPARATOR '||'),
              '||',
              1
            ),
            ''
          ),
          ''
        ) AS diagnosa_awal,
        COALESCE(rpr.alasan, '') AS alasan,
        COALESCE(rpr.keluhan_utama, '') AS keluhan_utama,
        COALESCE(rpr.pemeriksaan_fisik, '') AS pemeriksaan_fisik,
        COALESCE(rpr.jalannya_penyakit, '') AS jalannya_penyakit,
        COALESCE(rpr.pemeriksaan_penunjang, '') AS pemeriksaan_penunjang,
        COALESCE(rpr.hasil_laborat, '') AS hasil_laborat,
        COALESCE(rpr.tindakan_dan_operasi, '') AS tindakan_dan_operasi,
        COALESCE(rpr.obat_di_rs, '') AS obat_di_rs,
        COALESCE(rpr.diagnosa_utama, '') AS diagnosa_utama,
        COALESCE(rpr.kd_diagnosa_utama, '') AS kd_diagnosa_utama,
        COALESCE(rpr.diagnosa_sekunder, '') AS diagnosa_sekunder,
        COALESCE(rpr.kd_diagnosa_sekunder, '') AS kd_diagnosa_sekunder,
        COALESCE(rpr.diagnosa_sekunder2, '') AS diagnosa_sekunder2,
        COALESCE(rpr.kd_diagnosa_sekunder2, '') AS kd_diagnosa_sekunder2,
        COALESCE(rpr.diagnosa_sekunder3, '') AS diagnosa_sekunder3,
        COALESCE(rpr.kd_diagnosa_sekunder3, '') AS kd_diagnosa_sekunder3,
        COALESCE(rpr.diagnosa_sekunder4, '') AS diagnosa_sekunder4,
        COALESCE(rpr.kd_diagnosa_sekunder4, '') AS kd_diagnosa_sekunder4,
        COALESCE(rpr.prosedur_utama, '') AS prosedur_utama,
        COALESCE(rpr.kd_prosedur_utama, '') AS kd_prosedur_utama,
        COALESCE(rpr.prosedur_sekunder, '') AS prosedur_sekunder,
        COALESCE(rpr.kd_prosedur_sekunder, '') AS kd_prosedur_sekunder,
        COALESCE(rpr.prosedur_sekunder2, '') AS prosedur_sekunder2,
        COALESCE(rpr.kd_prosedur_sekunder2, '') AS kd_prosedur_sekunder2,
        COALESCE(rpr.prosedur_sekunder3, '') AS prosedur_sekunder3,
        COALESCE(rpr.kd_prosedur_sekunder3, '') AS kd_prosedur_sekunder3,
        COALESCE(rpr.alergi, '') AS alergi,
        COALESCE(rpr.diet, '') AS diet,
        COALESCE(rpr.lab_belum, '') AS lab_belum,
        COALESCE(rpr.edukasi, '') AS edukasi,
        COALESCE(rpr.cara_keluar, '') AS cara_keluar,
        COALESCE(rpr.ket_keluar, '') AS ket_keluar,
        COALESCE(rpr.keadaan, '') AS keadaan,
        COALESCE(rpr.ket_keadaan, '') AS ket_keadaan,
        COALESCE(rpr.dilanjutkan, '') AS dilanjutkan,
        COALESCE(rpr.ket_dilanjutkan, '') AS ket_dilanjutkan,
        rpr.kontrol,
        COALESCE(rpr.obat_pulang, '') AS obat_pulang,
        CASE WHEN rpr.no_rawat IS NULL THEN 0 ELSE 1 END AS has_resume
      FROM reg_periksa rp
      LEFT JOIN kamar_inap ki ON rp.no_rawat = ki.no_rawat
      LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN dokter regDok ON rp.kd_dokter = regDok.kd_dokter
      LEFT JOIN resume_pasien_ranap rpr ON rp.no_rawat = rpr.no_rawat
      LEFT JOIN dpjp_ranap dr ON rp.no_rawat = dr.no_rawat
      LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
      LEFT JOIN dokter penulis ON rpr.kd_dokter = penulis.kd_dokter
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE rp.no_rawat = ?
      GROUP BY rp.no_rawat, rp.kd_dokter, regDok.nm_dokter, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir, rpr.kd_dokter, penulis.nm_dokter, rpr.diagnosa_awal, rpr.alasan, rpr.keluhan_utama, rpr.pemeriksaan_fisik, rpr.jalannya_penyakit, rpr.pemeriksaan_penunjang, rpr.hasil_laborat, rpr.tindakan_dan_operasi, rpr.obat_di_rs, rpr.diagnosa_utama, rpr.kd_diagnosa_utama, rpr.diagnosa_sekunder, rpr.kd_diagnosa_sekunder, rpr.diagnosa_sekunder2, rpr.kd_diagnosa_sekunder2, rpr.diagnosa_sekunder3, rpr.kd_diagnosa_sekunder3, rpr.diagnosa_sekunder4, rpr.kd_diagnosa_sekunder4, rpr.prosedur_utama, rpr.kd_prosedur_utama, rpr.prosedur_sekunder, rpr.kd_prosedur_sekunder, rpr.prosedur_sekunder2, rpr.kd_prosedur_sekunder2, rpr.prosedur_sekunder3, rpr.kd_prosedur_sekunder3, rpr.alergi, rpr.diet, rpr.lab_belum, rpr.edukasi, rpr.cara_keluar, rpr.ket_keluar, rpr.keadaan, rpr.ket_keadaan, rpr.dilanjutkan, rpr.ket_dilanjutkan, rpr.kontrol
    `;

    try {
      const result = await executeQuery(query, [no_rawat]);
      
      if (result.length === 0) {
        return {
          success: false,
          error: 'Resume not found'
        };
      }

      // Format date fields
      const formattedData = {
        ...result[0],
        tgl_lahir: this.formatDateOnly(result[0].tgl_lahir),
        tgl_masuk: this.formatDateOnly(result[0].tgl_masuk),
        tgl_keluar: this.formatDateOnly(result[0].tgl_keluar),
        kontrol: this.formatDateTimeLocal(result[0].kontrol)
      };

      return {
        success: true,
        data: formattedData
      };
    } catch (error) {
      console.error('Error getting resume detail:', error);
      throw error;
    }
  }

  async getResumeDetailRalan(no_rawat, kdDokter = '') {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const normalizedKdDokter = String(kdDokter || '').trim();
    if (!normalizedKdDokter) {
      throw new Error('kd_dokter is required');
    }

    const query = `
      SELECT
        rp.no_rawat,
        rp.kd_dokter AS kd_dokter_reg,
        regDok.nm_dokter AS dokter_reg,
        p.no_rkm_medis,
        p.nm_pasien,
        p.jk AS jenis_kelamin,
        p.tgl_lahir,
        rpr.kd_dokter,
        COALESCE(penulis.nm_dokter, rpr.kd_dokter, '') AS dokter_penulis,
        COALESCE(rpr.keluhan_utama, '') AS keluhan_utama,
        COALESCE(rpr.jalannya_penyakit, '') AS jalannya_penyakit,
        COALESCE(rpr.pemeriksaan_penunjang, '') AS pemeriksaan_penunjang,
        COALESCE(rpr.hasil_laborat, '') AS hasil_laborat,
        COALESCE(rpr.diagnosa_utama, '') AS diagnosa_utama,
        COALESCE(rpr.kd_diagnosa_utama, '') AS kd_diagnosa_utama,
        COALESCE(rpr.diagnosa_sekunder, '') AS diagnosa_sekunder,
        COALESCE(rpr.kd_diagnosa_sekunder, '') AS kd_diagnosa_sekunder,
        COALESCE(rpr.diagnosa_sekunder2, '') AS diagnosa_sekunder2,
        COALESCE(rpr.kd_diagnosa_sekunder2, '') AS kd_diagnosa_sekunder2,
        COALESCE(rpr.diagnosa_sekunder3, '') AS diagnosa_sekunder3,
        COALESCE(rpr.kd_diagnosa_sekunder3, '') AS kd_diagnosa_sekunder3,
        COALESCE(rpr.diagnosa_sekunder4, '') AS diagnosa_sekunder4,
        COALESCE(rpr.kd_diagnosa_sekunder4, '') AS kd_diagnosa_sekunder4,
        COALESCE(rpr.prosedur_utama, '') AS prosedur_utama,
        COALESCE(rpr.kd_prosedur_utama, '') AS kd_prosedur_utama,
        COALESCE(rpr.prosedur_sekunder, '') AS prosedur_sekunder,
        COALESCE(rpr.kd_prosedur_sekunder, '') AS kd_prosedur_sekunder,
        COALESCE(rpr.prosedur_sekunder2, '') AS prosedur_sekunder2,
        COALESCE(rpr.kd_prosedur_sekunder2, '') AS kd_prosedur_sekunder2,
        COALESCE(rpr.prosedur_sekunder3, '') AS prosedur_sekunder3,
        COALESCE(rpr.kd_prosedur_sekunder3, '') AS kd_prosedur_sekunder3,
        COALESCE(rpr.kondisi_pulang, 'Hidup') AS kondisi_pulang,
        COALESCE(rpr.obat_pulang, '') AS obat_pulang,
        CASE WHEN rpr.no_rawat IS NULL THEN 0 ELSE 1 END AS has_resume
      FROM reg_periksa rp
      LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN dokter regDok ON rp.kd_dokter = regDok.kd_dokter
      LEFT JOIN resume_pasien rpr
        ON rp.no_rawat = rpr.no_rawat
       AND rpr.kd_dokter = ?
      LEFT JOIN dokter penulis ON rpr.kd_dokter = penulis.kd_dokter
      WHERE rp.no_rawat = ?
      LIMIT 1
    `;

    try {
      const result = await executeQuery(query, [normalizedKdDokter, no_rawat]);

      if (result.length === 0) {
        return {
          success: false,
          error: 'Resume not found'
        };
      }

      const baseData = result[0];
      const defaults = await this.getRalanResumeDefaults(no_rawat);
      const formattedData = {
        ...baseData,
        ...(Number(baseData.has_resume || 0) ? {} : defaults),
        no_rawat: baseData.no_rawat,
        kd_dokter: baseData.kd_dokter || normalizedKdDokter,
        dokter_penulis: baseData.dokter_penulis || baseData.dokter_reg || normalizedKdDokter,
        tgl_lahir: this.formatDateOnly(baseData.tgl_lahir),
        diagnosa_awal: '',
        alasan: '',
        pemeriksaan_fisik: '',
        tindakan_dan_operasi: '',
        obat_di_rs: '',
        alergi: '',
        diet: '',
        lab_belum: '',
        edukasi: '',
        cara_keluar: 'Atas Izin Dokter',
        ket_keluar: '',
        keadaan: baseData.kondisi_pulang === 'Meninggal' ? 'Meninggal' : 'Membaik',
        ket_keadaan: '',
        dilanjutkan: 'Kembali Ke RS',
        ket_dilanjutkan: '',
        kontrol: '',
        obat_pulang: String(baseData.obat_pulang || '').trim() || String(defaults.obat_pulang || '').trim(),
        has_resume: Number(baseData.has_resume || 0)
      };

      return {
        success: true,
        data: formattedData
      };
    } catch (error) {
      console.error('Error getting ralan resume detail:', error);
      throw error;
    }
  }

  // Create or update resume pasien
  async saveResume(no_rawat, resumeData, statusRawat = 'Ranap') {
    const normalizedStatusRawat = this.normalizeStatusRawat(statusRawat);
    if (normalizedStatusRawat === 'Ralan') {
      return this.saveResumeRalan(no_rawat, resumeData);
    }

    return this.saveResumeRanap(no_rawat, resumeData);
  }

  async saveResumeRanap(no_rawat, resumeData) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }
    
    try {
      const normalized = this.normalizeResumePayload(no_rawat, resumeData);
      const query = `
        INSERT INTO resume_pasien_ranap (
          no_rawat, kd_dokter, diagnosa_awal, alasan, keluhan_utama, pemeriksaan_fisik,
          jalannya_penyakit, pemeriksaan_penunjang, hasil_laborat, tindakan_dan_operasi,
          obat_di_rs, diagnosa_utama, kd_diagnosa_utama, diagnosa_sekunder, kd_diagnosa_sekunder,
          diagnosa_sekunder2, kd_diagnosa_sekunder2, diagnosa_sekunder3, kd_diagnosa_sekunder3,
          diagnosa_sekunder4, kd_diagnosa_sekunder4, prosedur_utama, kd_prosedur_utama,
          prosedur_sekunder, kd_prosedur_sekunder, prosedur_sekunder2, kd_prosedur_sekunder2,
          prosedur_sekunder3, kd_prosedur_sekunder3, alergi, diet, lab_belum, edukasi,
          cara_keluar, ket_keluar, keadaan, ket_keadaan, dilanjutkan, ket_dilanjutkan,
          kontrol, obat_pulang
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        ON DUPLICATE KEY UPDATE
          kd_dokter = VALUES(kd_dokter),
          diagnosa_awal = VALUES(diagnosa_awal),
          alasan = VALUES(alasan),
          keluhan_utama = VALUES(keluhan_utama),
          pemeriksaan_fisik = VALUES(pemeriksaan_fisik),
          jalannya_penyakit = VALUES(jalannya_penyakit),
          pemeriksaan_penunjang = VALUES(pemeriksaan_penunjang),
          hasil_laborat = VALUES(hasil_laborat),
          tindakan_dan_operasi = VALUES(tindakan_dan_operasi),
          obat_di_rs = VALUES(obat_di_rs),
          diagnosa_utama = VALUES(diagnosa_utama),
          kd_diagnosa_utama = VALUES(kd_diagnosa_utama),
          diagnosa_sekunder = VALUES(diagnosa_sekunder),
          kd_diagnosa_sekunder = VALUES(kd_diagnosa_sekunder),
          diagnosa_sekunder2 = VALUES(diagnosa_sekunder2),
          kd_diagnosa_sekunder2 = VALUES(kd_diagnosa_sekunder2),
          diagnosa_sekunder3 = VALUES(diagnosa_sekunder3),
          kd_diagnosa_sekunder3 = VALUES(kd_diagnosa_sekunder3),
          diagnosa_sekunder4 = VALUES(diagnosa_sekunder4),
          kd_diagnosa_sekunder4 = VALUES(kd_diagnosa_sekunder4),
          prosedur_utama = VALUES(prosedur_utama),
          kd_prosedur_utama = VALUES(kd_prosedur_utama),
          prosedur_sekunder = VALUES(prosedur_sekunder),
          kd_prosedur_sekunder = VALUES(kd_prosedur_sekunder),
          prosedur_sekunder2 = VALUES(prosedur_sekunder2),
          kd_prosedur_sekunder2 = VALUES(kd_prosedur_sekunder2),
          prosedur_sekunder3 = VALUES(prosedur_sekunder3),
          kd_prosedur_sekunder3 = VALUES(kd_prosedur_sekunder3),
          alergi = VALUES(alergi),
          diet = VALUES(diet),
          lab_belum = VALUES(lab_belum),
          edukasi = VALUES(edukasi),
          cara_keluar = VALUES(cara_keluar),
          ket_keluar = VALUES(ket_keluar),
          keadaan = VALUES(keadaan),
          ket_keadaan = VALUES(ket_keadaan),
          dilanjutkan = VALUES(dilanjutkan),
          ket_dilanjutkan = VALUES(ket_dilanjutkan),
          kontrol = VALUES(kontrol),
          obat_pulang = VALUES(obat_pulang)
      `;

      const params = [
        normalized.no_rawat,
        normalized.kd_dokter,
        normalized.diagnosa_awal,
        normalized.alasan,
        normalized.keluhan_utama,
        normalized.pemeriksaan_fisik,
        normalized.jalannya_penyakit,
        normalized.pemeriksaan_penunjang,
        normalized.hasil_laborat,
        normalized.tindakan_dan_operasi,
        normalized.obat_di_rs,
        normalized.diagnosa_utama,
        normalized.kd_diagnosa_utama,
        normalized.diagnosa_sekunder,
        normalized.kd_diagnosa_sekunder,
        normalized.diagnosa_sekunder2,
        normalized.kd_diagnosa_sekunder2,
        normalized.diagnosa_sekunder3,
        normalized.kd_diagnosa_sekunder3,
        normalized.diagnosa_sekunder4,
        normalized.kd_diagnosa_sekunder4,
        normalized.prosedur_utama,
        normalized.kd_prosedur_utama,
        normalized.prosedur_sekunder,
        normalized.kd_prosedur_sekunder,
        normalized.prosedur_sekunder2,
        normalized.kd_prosedur_sekunder2,
        normalized.prosedur_sekunder3,
        normalized.kd_prosedur_sekunder3,
        normalized.alergi,
        normalized.diet,
        normalized.lab_belum,
        normalized.edukasi,
        normalized.cara_keluar,
        normalized.ket_keluar,
        normalized.keadaan,
        normalized.ket_keadaan,
        normalized.dilanjutkan,
        normalized.ket_dilanjutkan,
        normalized.kontrol,
        normalized.obat_pulang,
      ];

      await executeQuery(query, params);

      return {
        success: true,
        message: 'Resume berhasil disimpan'
      };
    } catch (error) {
      console.error('Error saving resume:', error);
      throw error;
    }
  }

  async saveResumeRalan(no_rawat, resumeData) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    try {
      const normalized = this.normalizeResumeRalanPayload(no_rawat, resumeData);
      const existingRows = await executeQuery(
        `
          SELECT no_rawat
          FROM resume_pasien
          WHERE no_rawat = ? AND kd_dokter = ?
          LIMIT 1
        `,
        [normalized.no_rawat, normalized.kd_dokter]
      );

      if (existingRows.length > 0) {
        await executeQuery(
          `
            UPDATE resume_pasien
            SET
              keluhan_utama = ?,
              jalannya_penyakit = ?,
              pemeriksaan_penunjang = ?,
              hasil_laborat = ?,
              diagnosa_utama = ?,
              kd_diagnosa_utama = ?,
              diagnosa_sekunder = ?,
              kd_diagnosa_sekunder = ?,
              diagnosa_sekunder2 = ?,
              kd_diagnosa_sekunder2 = ?,
              diagnosa_sekunder3 = ?,
              kd_diagnosa_sekunder3 = ?,
              diagnosa_sekunder4 = ?,
              kd_diagnosa_sekunder4 = ?,
              prosedur_utama = ?,
              kd_prosedur_utama = ?,
              prosedur_sekunder = ?,
              kd_prosedur_sekunder = ?,
              prosedur_sekunder2 = ?,
              kd_prosedur_sekunder2 = ?,
              prosedur_sekunder3 = ?,
              kd_prosedur_sekunder3 = ?,
              kondisi_pulang = ?,
              obat_pulang = ?
            WHERE no_rawat = ? AND kd_dokter = ?
          `,
          [
            normalized.keluhan_utama,
            normalized.jalannya_penyakit,
            normalized.pemeriksaan_penunjang,
            normalized.hasil_laborat,
            normalized.diagnosa_utama,
            normalized.kd_diagnosa_utama,
            normalized.diagnosa_sekunder,
            normalized.kd_diagnosa_sekunder,
            normalized.diagnosa_sekunder2,
            normalized.kd_diagnosa_sekunder2,
            normalized.diagnosa_sekunder3,
            normalized.kd_diagnosa_sekunder3,
            normalized.diagnosa_sekunder4,
            normalized.kd_diagnosa_sekunder4,
            normalized.prosedur_utama,
            normalized.kd_prosedur_utama,
            normalized.prosedur_sekunder,
            normalized.kd_prosedur_sekunder,
            normalized.prosedur_sekunder2,
            normalized.kd_prosedur_sekunder2,
            normalized.prosedur_sekunder3,
            normalized.kd_prosedur_sekunder3,
            normalized.kondisi_pulang,
            normalized.obat_pulang,
            normalized.no_rawat,
            normalized.kd_dokter
          ]
        );
      } else {
        await executeQuery(
          `
            INSERT INTO resume_pasien (
              no_rawat, kd_dokter, keluhan_utama, jalannya_penyakit, pemeriksaan_penunjang,
              hasil_laborat, diagnosa_utama, kd_diagnosa_utama, diagnosa_sekunder,
              kd_diagnosa_sekunder, diagnosa_sekunder2, kd_diagnosa_sekunder2,
              diagnosa_sekunder3, kd_diagnosa_sekunder3, diagnosa_sekunder4,
              kd_diagnosa_sekunder4, prosedur_utama, kd_prosedur_utama, prosedur_sekunder,
              kd_prosedur_sekunder, prosedur_sekunder2, kd_prosedur_sekunder2,
              prosedur_sekunder3, kd_prosedur_sekunder3, kondisi_pulang, obat_pulang
            ) VALUES (
              ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )
          `,
          [
            normalized.no_rawat,
            normalized.kd_dokter,
            normalized.keluhan_utama,
            normalized.jalannya_penyakit,
            normalized.pemeriksaan_penunjang,
            normalized.hasil_laborat,
            normalized.diagnosa_utama,
            normalized.kd_diagnosa_utama,
            normalized.diagnosa_sekunder,
            normalized.kd_diagnosa_sekunder,
            normalized.diagnosa_sekunder2,
            normalized.kd_diagnosa_sekunder2,
            normalized.diagnosa_sekunder3,
            normalized.kd_diagnosa_sekunder3,
            normalized.diagnosa_sekunder4,
            normalized.kd_diagnosa_sekunder4,
            normalized.prosedur_utama,
            normalized.kd_prosedur_utama,
            normalized.prosedur_sekunder,
            normalized.kd_prosedur_sekunder,
            normalized.prosedur_sekunder2,
            normalized.kd_prosedur_sekunder2,
            normalized.prosedur_sekunder3,
            normalized.kd_prosedur_sekunder3,
            normalized.kondisi_pulang,
            normalized.obat_pulang
          ]
        );
      }

      return {
        success: true,
        message: 'Resume rawat jalan berhasil disimpan'
      };
    } catch (error) {
      console.error('Error saving ralan resume:', error);
      throw error;
    }
  }

  // Delete resume pasien
  async deleteResume(no_rawat, statusRawat = 'Ranap', kdDokter = '') {
    const normalizedStatusRawat = this.normalizeStatusRawat(statusRawat);
    if (normalizedStatusRawat === 'Ralan') {
      return this.deleteResumeRalan(no_rawat, kdDokter);
    }

    return this.deleteResumeRanap(no_rawat);
  }

  async deleteResumeRanap(no_rawat) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const query = 'DELETE FROM resume_pasien_ranap WHERE no_rawat = ?';
    
    try {
      const result = await executeQuery(query, [no_rawat]);
      
      if (result.affectedRows === 0) {
        return {
          success: false,
          error: 'Resume not found'
        };
      }

      return {
        success: true,
        message: 'Resume deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting resume:', error);
      throw error;
    }
  }

  async deleteResumeRalan(no_rawat, kdDokter = '') {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const normalizedKdDokter = String(kdDokter || '').trim();
    if (!normalizedKdDokter) {
      throw new Error('kd_dokter is required');
    }

    const query = 'DELETE FROM resume_pasien WHERE no_rawat = ? AND kd_dokter = ?';

    try {
      const result = await executeQuery(query, [no_rawat, normalizedKdDokter]);

      if (result.affectedRows === 0) {
        return {
          success: false,
          error: 'Resume not found'
        };
      }

      return {
        success: true,
        message: 'Resume rawat jalan berhasil dihapus'
      };
    } catch (error) {
      console.error('Error deleting ralan resume:', error);
      throw error;
    }
  }
}

export default new ResumePasienDataService();
