import { executeQuery } from '../config/database.js';

// Medical service for handling medical records and patient data
export class MedicalService {
  // Get medical record by patient and visit number
  static async getMedicalRecord(noRkmMedis, noRawat = null) {
    try {
      let sql = `
        SELECT 
          p.no_rkm_medis,
          p.nm_pasien,
          p.jk,
          p.tmp_lahir,
          p.tgl_lahir,
          p.alamat,
          p.no_tlp,
          p.no_peserta,
          p.kd_pj,
          pj.png_jawab,
          reg.no_rawat,
          reg.tgl_registrasi,
          reg.jam_reg,
          reg.kd_dokter,
          d.nm_dokter,
          reg.kd_poli,
          pol.nm_poli,
          reg.status_lanjut,
          reg.kd_pj as reg_kd_pj,
          reg.almt_pj,
          reg.hubunganpj,
          reg.biaya_reg,
          reg.stts_daftar,
          reg.status_bayar,
          reg.status_poli
        FROM pasien p
        LEFT JOIN reg_periksa reg ON p.no_rkm_medis = reg.no_rkm_medis
        LEFT JOIN dokter d ON reg.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON reg.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON p.kd_pj = pj.kd_pj
        WHERE p.no_rkm_medis = ?
      `;
      
      const params = [noRkmMedis];
      
      if (noRawat) {
        sql += ' AND reg.no_rawat = ?';
        params.push(noRawat);
      }
      
      sql += ' ORDER BY reg.tgl_registrasi DESC, reg.jam_reg DESC';
      
      const records = await executeQuery(sql, params);
      
      if (!records || records.length === 0) {
        return null;
      }
      
      // Get additional data for the medical record
      const medicalRecord = records[0];
      
      // Get outpatient visits
      const outpatientVisits = await this.getOutpatientVisits(noRkmMedis);
      
      // Get inpatient visits
      const inpatientVisits = await this.getInpatientVisits(noRkmMedis);
      
      return {
        ...medicalRecord,
        outpatient_visits: outpatientVisits,
        inpatient_visits: inpatientVisits
      };
      
    } catch (error) {
      console.error('Get medical record error:', error);
      throw error;
    }
  }
  
  // Get outpatient visits
  static async getOutpatientVisits(noRkmMedis) {
    try {
      const sql = `
        SELECT 
          reg.no_rawat,
          reg.tgl_registrasi as tanggal,
          reg.jam_reg as jam,
          d.nm_dokter,
          pol.nm_poli,
          reg.status_lanjut,
          reg.status_bayar,
          pj.png_jawab,
          (
            SELECT GROUP_CONCAT(
              CONCAT(pr.kd_jenis_prw, '|', jpr.nm_perawatan, '|', pr.biaya_rawat, '|', pr.tarif_tindakandr, '|', pr.tarif_tindakanpr)
              SEPARATOR '###'
            )
            FROM rawat_jl_dr pr
            LEFT JOIN jns_perawatan jpr ON pr.kd_jenis_prw = jpr.kd_jenis_prw
            WHERE pr.no_rawat = reg.no_rawat
          ) as perawatans,
          (
            SELECT GROUP_CONCAT(
              CONCAT(lab.no_rawat, '|', lab.nip, '|', lab.kd_jenis_prw, '|', lab.tgl_periksa, '|', lab.jam, '|', lab.dokter_perujuk)
              SEPARATOR '###'
            )
            FROM periksa_lab lab
            WHERE lab.no_rawat = reg.no_rawat
          ) as laboratory
        FROM reg_periksa reg
        LEFT JOIN dokter d ON reg.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON reg.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        WHERE reg.no_rkm_medis = ? AND reg.status_lanjut = 'Ralan'
        ORDER BY reg.tgl_registrasi DESC, reg.jam_reg DESC
      `;
      
      return await executeQuery(sql, [noRkmMedis]);
      
    } catch (error) {
      console.error('Get outpatient visits error:', error);
      throw error;
    }
  }
  
  // Get inpatient visits
  static async getInpatientVisits(noRkmMedis) {
    try {
      const sql = `
        SELECT 
          reg.no_rawat,
          reg.tgl_registrasi as tanggal,
          reg.jam_reg as jam,
          d.nm_dokter,
          pol.nm_poli,
          reg.status_lanjut,
          reg.status_bayar,
          pj.png_jawab,
          ri.tgl_masuk,
          ri.jam_masuk,
          ri.tgl_keluar,
          ri.jam_keluar,
          k.nm_kamar,
          b.nm_bangsal,
          ri.lama,
          ri.ttl_biaya,
          ri.stts_pulang
        FROM reg_periksa reg
        LEFT JOIN dokter d ON reg.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON reg.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        LEFT JOIN ranap_inap ri ON reg.no_rawat = ri.no_rawat
        LEFT JOIN kamar k ON ri.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        WHERE reg.no_rkm_medis = ? AND reg.status_lanjut = 'Ranap'
        ORDER BY reg.tgl_registrasi DESC, reg.jam_reg DESC
      `;
      
      return await executeQuery(sql, [noRkmMedis]);
      
    } catch (error) {
      console.error('Get inpatient visits error:', error);
      throw error;
    }
  }
  
  // Get rawat jalan patients
  static async getRawatJalanPatients(filters = {}) {
    try {
      const {
        kd_poli,
        startDate,
        endDate,
        status = 'all',
        statusBayar = 'all',
        tabFilter = 'hari-ini',
        page = 1,
        itemsPerPage = 10
      } = filters;
      
      let sql = `
        SELECT 
          reg.no_reg,
          reg.no_rkm_medis,
          reg.no_rawat,
          p.nm_pasien,
          p.jk,
          p.tmp_lahir,
          p.tgl_lahir,
          TIMESTAMPDIFF(YEAR, p.tgl_lahir, CURDATE()) as umur,
          d.nm_dokter,
          pol.nm_poli,
          reg.tgl_registrasi,
          reg.jam_reg,
          reg.status_lanjut,
          reg.status_bayar,
          pj.png_jawab,
          reg.biaya_reg,
          reg.stts_daftar,
          reg.status_poli
        FROM reg_periksa reg
        INNER JOIN pasien p ON reg.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON reg.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik pol ON reg.kd_poli = pol.kd_poli
        LEFT JOIN penjab pj ON reg.kd_pj = pj.kd_pj
        WHERE reg.status_lanjut = 'Ralan'
      `;
      
      const params = [];
      
      // Filter by poli
      if (kd_poli) {
        const poliArray = kd_poli.split(',').map(p => p.trim()).filter(Boolean);
        if (poliArray.length > 0) {
          sql += ` AND reg.kd_poli IN (${poliArray.map(() => '?').join(',')})`;
          params.push(...poliArray);
        }
      }
      
      // Filter by date range
      if (startDate && endDate) {
        sql += ' AND reg.tgl_registrasi BETWEEN ? AND ?';
        params.push(startDate, endDate);
      }
      
      // Filter by status
      if (status !== 'all') {
        sql += ' AND reg.status_poli = ?';
        params.push(status);
      }
      
      // Filter by payment status
      if (statusBayar !== 'all') {
        sql += ' AND reg.status_bayar = ?';
        params.push(statusBayar);
      }
      
      // Count total records
      const countSql = sql.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
      const countResult = await executeQuery(countSql, params);
      const total = countResult[0]?.total || 0;
      
      // Add pagination
      const offset = (page - 1) * itemsPerPage;
      sql += ' ORDER BY reg.tgl_registrasi DESC, reg.jam_reg DESC LIMIT ? OFFSET ?';
      params.push(parseInt(itemsPerPage), parseInt(offset));
      
      const patients = await executeQuery(sql, params);
      
      return {
        data: patients,
        total,
        page: parseInt(page),
        itemsPerPage: parseInt(itemsPerPage),
        totalPages: Math.ceil(total / itemsPerPage)
      };
      
    } catch (error) {
      console.error('Get rawat jalan patients error:', error);
      throw error;
    }
  }
  
  // Search patients
  static async searchPatients(searchQuery, limit = 10) {
    try {
      const sql = `
        SELECT 
          p.no_rkm_medis,
          p.nm_pasien,
          p.jk,
          p.tmp_lahir,
          p.tgl_lahir,
          TIMESTAMPDIFF(YEAR, p.tgl_lahir, CURDATE()) as umur,
          p.alamat,
          p.no_tlp
        FROM pasien p
        WHERE p.nm_pasien LIKE ? 
           OR p.no_rkm_medis LIKE ?
           OR p.alamat LIKE ?
        ORDER BY p.nm_pasien
        LIMIT ?
      `;
      
      const searchPattern = `%${searchQuery}%`;
      const params = [searchPattern, searchPattern, searchPattern, limit];
      
      return await executeQuery(sql, params);
      
    } catch (error) {
      console.error('Search patients error:', error);
      throw error;
    }
  }

  // Ambil kunjungan terakhir untuk sekumpulan no_rkm_medis sekaligus.
  static async fetchLatestVisitsByNoRm(noRkmMedisList = []) {
    const normalizedList = Array.from(new Set(
      (Array.isArray(noRkmMedisList) ? noRkmMedisList : [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    ));

    if (!normalizedList.length) {
      return new Map();
    }

    const placeholders = normalizedList.map(() => '?').join(', ');
    const rows = await executeQuery(
      `
        SELECT
          r.no_rkm_medis,
          r.no_rawat,
          r.tgl_registrasi,
          r.jam_reg,
          r.status_lanjut,
          pol.nm_poli,
          d.nm_dokter
        FROM reg_periksa r
        INNER JOIN (
          SELECT no_rkm_medis, MAX(CONCAT(tgl_registrasi, ' ', jam_reg)) AS latest
          FROM reg_periksa
          WHERE no_rkm_medis IN (${placeholders})
          GROUP BY no_rkm_medis
        ) t
          ON t.no_rkm_medis = r.no_rkm_medis
         AND CONCAT(r.tgl_registrasi, ' ', r.jam_reg) = t.latest
        LEFT JOIN poliklinik pol ON pol.kd_poli = r.kd_poli
        LEFT JOIN dokter d ON d.kd_dokter = r.kd_dokter
      `,
      normalizedList
    );

    const visitMap = new Map();
    rows.forEach((row) => {
      const key = String(row.no_rkm_medis || '').trim();
      if (key && !visitMap.has(key)) {
        visitMap.set(key, row);
      }
    });

    return visitMap;
  }

  static async searchMedicalRecordPatients(searchQuery, page = 1, limit = 20) {
    try {
      const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
      const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 50);
      const offset = (normalizedPage - 1) * normalizedLimit;
      const normalizedQuery = String(searchQuery || '').trim();
      const searchPattern = `%${normalizedQuery}%`;

      const countSql = `
        SELECT COUNT(*) AS total
        FROM pasien p
        WHERE p.nm_pasien LIKE ?
           OR p.no_rkm_medis LIKE ?
           OR p.no_tlp LIKE ?
           OR p.alamat LIKE ?
      `;

      // Kandidat diambil urut nama lebih dulu. Sebelumnya query ini menghitung
      // kunjungan terakhir untuk SELURUH hasil pencarian (ratusan ribu baris)
      // sebelum LIMIT, sehingga satu pencarian butuh belasan detik.
      const candidatesSql = `
        SELECT
          p.no_rkm_medis,
          p.nm_pasien,
          p.jk,
          p.tgl_lahir,
          TIMESTAMPDIFF(YEAR, p.tgl_lahir, CURDATE()) AS umur,
          p.alamat,
          p.no_tlp
        FROM pasien p
        WHERE p.nm_pasien LIKE ?
           OR p.no_rkm_medis LIKE ?
           OR p.no_tlp LIKE ?
           OR p.alamat LIKE ?
        ORDER BY p.nm_pasien ASC, p.no_rkm_medis ASC
        LIMIT ?
        OFFSET ?
      `;

      const countRows = await executeQuery(countSql, [
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern
      ]);
      const total = Number(countRows?.[0]?.total || 0);

      const candidates = total > 0
        ? await executeQuery(candidatesSql, [
            searchPattern,
            searchPattern,
            searchPattern,
            searchPattern,
            normalizedLimit,
            offset
          ])
        : [];

      // Kunjungan terakhir hanya dihitung untuk baris yang benar-benar
      // ditampilkan (maksimal `limit` pasien), memakai index no_rkm_medis.
      const latestVisits = await this.fetchLatestVisitsByNoRm(
        candidates.map((patient) => patient.no_rkm_medis)
      );

      const rows = candidates.map((patient) => {
        const patientKey = String(patient.no_rkm_medis || '').trim();
        const latest = latestVisits.get(patientKey) || null;

        return {
          ...patient,
          last_no_rawat: latest?.no_rawat ?? null,
          last_visit_date: latest?.tgl_registrasi ?? null,
          last_visit_time: latest?.jam_reg ?? null,
          last_status_lanjut: latest?.status_lanjut ?? null,
          last_nm_poli: latest?.nm_poli ?? null,
          last_nm_dokter: latest?.nm_dokter ?? null
        };
      });

      return {
        data: rows,
        pagination: {
          page: normalizedPage,
          limit: normalizedLimit,
          total,
          hasMore: offset + rows.length < total
        }
      };
    } catch (error) {
      console.error('Search medical record patients error:', error);
      throw error;
    }
  }
}
