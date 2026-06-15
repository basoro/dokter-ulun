import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import GetMedicalRecordService from './getMedicalRecordService.js';

dotenv.config();

class RadiologyDataService {
  constructor() {
    this.dbConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'sik',
      timezone: '+00:00'
    };
  }

  async getConnection() {
    return await mysql.createConnection(this.dbConfig);
  }

  normalizeStatusRawat(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();

    if (normalizedValue === 'ranap' || normalizedValue === 'rawat inap') {
      return 'ranap';
    }

    if (
      normalizedValue === 'igd' ||
      normalizedValue === 'gawat darurat' ||
      normalizedValue === 'instalasi gawat darurat'
    ) {
      return 'ralan';
    }

    if (normalizedValue === 'ralan' || normalizedValue === 'rawat jalan') {
      return 'ralan';
    }

    return null;
  }

  normalizeKlinis(value) {
    return String(value ?? '').trim();
  }

  async getRadiologyRequests(no_rawat) {
    const connection = await this.getConnection();
    try {
      const query = `
        SELECT pr.*, d.nm_dokter
        FROM permintaan_radiologi pr
        LEFT JOIN dokter d ON pr.dokter_perujuk = d.kd_dokter
        WHERE pr.no_rawat = ?
        ORDER BY pr.tgl_permintaan DESC, pr.jam_permintaan DESC
      `;

      const [rows] = await connection.execute(query, [no_rawat]);
      return rows;
    } finally {
      await connection.end();
    }
  }

  async getRadiologyRequestDetails(noorder) {
    const connection = await this.getConnection();
    try {
      const query = `
        SELECT ppr.*, jpr.nm_perawatan, jpr.total_byr
        FROM permintaan_pemeriksaan_radiologi ppr
        LEFT JOIN jns_perawatan_radiologi jpr ON ppr.kd_jenis_prw = jpr.kd_jenis_prw
        WHERE ppr.noorder = ?
        ORDER BY jpr.nm_perawatan
      `;
      const klinisQuery = `
        SELECT klinis
        FROM diagnosa_pasien_klinis
        WHERE noorder = ?
        LIMIT 1
      `;

      const [[rows], [klinisRows]] = await Promise.all([
        connection.execute(query, [noorder]),
        connection.execute(klinisQuery, [noorder])
      ]);
      return {
        examinations: rows,
        klinis: klinisRows?.[0]?.klinis || ''
      };
    } finally {
      await connection.end();
    }
  }

  async getRadiologyServices() {
    const connection = await this.getConnection();
    try {
      const query = `
        SELECT kd_jenis_prw, nm_perawatan, total_byr
        FROM jns_perawatan_radiologi
        WHERE status = '1'
        ORDER BY nm_perawatan
        LIMIT 100
      `;

      const [rows] = await connection.execute(query);
      return rows;
    } finally {
      await connection.end();
    }
  }

  normalizePagination(page = 1, itemsPerPage = 10) {
    const normalizedPage = Math.max(parseInt(page, 10) || 1, 1);
    const normalizedItemsPerPage = parseInt(itemsPerPage, 10) || 10;
    const limit = normalizedItemsPerPage === -1
      ? 10000
      : Math.min(Math.max(normalizedItemsPerPage, 1), 100);
    const offset = limit === 10000 ? 0 : (normalizedPage - 1) * limit;

    return {
      page: normalizedPage,
      limit,
      offset
    };
  }

  buildListFilters({ search = '', date = '', startDate = '', endDate = '' } = {}) {
    const conditions = [];
    const params = [];

    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      conditions.push(`(
        p.nm_pasien LIKE ? OR
        rp.no_rkm_medis LIKE ? OR
        rp.no_rawat LIKE ? OR
        d.nm_dokter LIKE ? OR
        layanan.nm_perawatan LIKE ?
      )`);
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (startDate && endDate) {
      conditions.push('rp.tgl_registrasi BETWEEN ? AND ?');
      params.push(startDate, endDate);
    } else if (startDate) {
      conditions.push('rp.tgl_registrasi >= ?');
      params.push(startDate);
    } else if (endDate) {
      conditions.push('rp.tgl_registrasi <= ?');
      params.push(endDate);
    } else {
      const effectiveDate = String(date || '').trim() || new Date().toISOString().slice(0, 10);
      conditions.push('rp.tgl_registrasi = ?');
      params.push(effectiveDate);
    }

    return {
      whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
      params
    };
  }

  async getDailyRadiologyPatients({
    page = 1,
    itemsPerPage = 10,
    search = '',
    date = '',
    startDate = '',
    endDate = ''
  } = {}) {
    const connection = await this.getConnection();
    try {
      const { page: normalizedPage, limit, offset } = this.normalizePagination(page, itemsPerPage);
      const { whereClause, params } = this.buildListFilters({ search, date, startDate, endDate });

      const countQuery = `
        SELECT COUNT(DISTINCT rp.no_rawat) AS total
        FROM reg_periksa rp
        INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        INNER JOIN periksa_radiologi pr ON rp.no_rawat = pr.no_rawat
        INNER JOIN jns_perawatan_radiologi layanan ON pr.kd_jenis_prw = layanan.kd_jenis_prw
        ${whereClause}
      `;

      const listQuery = `
        SELECT
          rp.no_rawat,
          rp.no_rkm_medis,
          rp.tgl_registrasi,
          rp.jam_reg,
          rp.status_lanjut,
          p.nm_pasien,
          p.umur,
          COALESCE(d.nm_dokter, '') AS nm_dokter,
          GROUP_CONCAT(DISTINCT layanan.nm_perawatan ORDER BY layanan.nm_perawatan SEPARATOR ' | ') AS pemeriksaan
        FROM reg_periksa rp
        INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        INNER JOIN periksa_radiologi pr ON rp.no_rawat = pr.no_rawat
        INNER JOIN jns_perawatan_radiologi layanan ON pr.kd_jenis_prw = layanan.kd_jenis_prw
        ${whereClause}
        GROUP BY
          rp.no_rawat,
          rp.no_rkm_medis,
          rp.tgl_registrasi,
          rp.jam_reg,
          rp.status_lanjut,
          p.nm_pasien,
          p.umur,
          d.nm_dokter
        ORDER BY rp.tgl_registrasi DESC, rp.jam_reg DESC
        ${limit === 10000 ? '' : 'LIMIT ? OFFSET ?'}
      `;

      const [[countRows], [rows]] = await Promise.all([
        connection.execute(countQuery, params),
        connection.execute(listQuery, limit === 10000 ? params : [...params, limit, offset])
      ]);

      const total = Number(countRows?.[0]?.total || 0);
      const totalPages = limit === 10000 ? 1 : Math.max(Math.ceil(total / limit), 1);

      return {
        success: true,
        data: rows.map((row) => ({
          no_rawat: row.no_rawat,
          no_rkm_medis: row.no_rkm_medis,
          tgl_registrasi: row.tgl_registrasi,
          jam_reg: row.jam_reg,
          status_lanjut: row.status_lanjut,
          nm_pasien: row.nm_pasien,
          umur: row.umur,
          nm_dokter: row.nm_dokter,
          pemeriksaan: row.pemeriksaan || ''
        })),
        total,
        page: normalizedPage,
        limit,
        totalPages
      };
    } finally {
      await connection.end();
    }
  }

  async getRadiologyPatientDetail(no_rawat) {
    const connection = await this.getConnection();
    try {
      const patientQuery = `
        SELECT
          rp.no_rkm_medis,
          rp.no_rawat,
          rp.status_lanjut,
          rp.kd_pj,
          p.nm_pasien,
          p.umur,
          COALESCE(d.nm_dokter, '') AS nm_dokter,
          GROUP_CONCAT(DISTINCT layanan.nm_perawatan ORDER BY layanan.nm_perawatan SEPARATOR ' | ') AS nm_perawatan
        FROM reg_periksa rp
        INNER JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
        INNER JOIN periksa_radiologi pr ON rp.no_rawat = pr.no_rawat
        INNER JOIN jns_perawatan_radiologi layanan ON pr.kd_jenis_prw = layanan.kd_jenis_prw
        WHERE rp.no_rawat = ?
        GROUP BY
          rp.no_rkm_medis,
          rp.no_rawat,
          rp.status_lanjut,
          rp.kd_pj,
          p.nm_pasien,
          p.umur,
          d.nm_dokter
        LIMIT 1
      `;

      const localImageQuery = `
        SELECT *
        FROM gambar_radiologi
        WHERE no_rawat = ?
      `;

      const impressionQuery = `
        SELECT
          skr.tgl_periksa,
          skr.jam,
          skr.judul,
          skr.saran,
          skr.kesan,
          GROUP_CONCAT(hr.hasil ORDER BY hr.hasil SEPARATOR '\n') AS hasil
        FROM saran_kesan_rad skr
        LEFT JOIN hasil_radiologi hr
          ON hr.no_rawat = skr.no_rawat
         AND hr.tgl_periksa = skr.tgl_periksa
         AND hr.jam = skr.jam
        WHERE skr.no_rawat = ?
        GROUP BY skr.tgl_periksa, skr.jam, skr.judul, skr.saran, skr.kesan
        ORDER BY skr.tgl_periksa DESC, skr.jam DESC
        LIMIT 1
      `;

      const [[patientRows], [localImageRows], [impressionRows]] = await Promise.all([
        connection.execute(patientQuery, [no_rawat]),
        connection.execute(localImageQuery, [no_rawat]),
        connection.execute(impressionQuery, [no_rawat])
      ]);

      const patient = patientRows?.[0];
      if (!patient) {
        throw new Error('Data pasien radiologi tidak ditemukan');
      }

      const radiologyResults = await GetMedicalRecordService.fetchRadiology(no_rawat, null, { includePacs: true });
      const localImages = localImageRows
        .map((row) => {
          const pathValue = Object.values(row).find((value) => (
            typeof value === 'string' &&
            /\.(png|jpe?g|gif|webp|bmp)$/i.test(String(value))
          ));

          return pathValue ? String(pathValue).trim() : '';
        })
        .filter(Boolean)
        .map((filePath) => ({
          path: filePath
        }));

      return {
        success: true,
        data: {
          no_rkm_medis: patient.no_rkm_medis,
          no_rawat: patient.no_rawat,
          nm_pasien: patient.nm_pasien,
          umur: patient.umur,
          status_lanjut: patient.status_lanjut,
          kd_pj: patient.kd_pj,
          nm_dokter: patient.nm_dokter,
          nm_perawatan: patient.nm_perawatan || '',
          local_images: localImages,
          pacs_results: radiologyResults,
          review: impressionRows?.[0] || {
            judul: '',
            hasil: '',
            kesan: '',
            saran: ''
          }
        }
      };
    } finally {
      await connection.end();
    }
  }

  async saveRadiologyReport(no_rawat, judul = '', hasil = '', kesan = '', saran = '') {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();

      const normalizedNoRawat = String(no_rawat || '').trim();
      const normalizedJudul = String(judul || '').trim();
      const normalizedHasil = String(hasil || '').trim();
      const normalizedKesan = String(kesan || '').trim();
      const normalizedSaran = String(saran || '').trim();

      if (!normalizedNoRawat) {
        throw new Error('no_rawat wajib diisi');
      }

      if (!normalizedHasil && !normalizedKesan && !normalizedSaran && !normalizedJudul) {
        throw new Error('Minimal salah satu field hasil radiologi wajib diisi');
      }

      if (normalizedHasil) {
        await connection.execute(
          `
            INSERT INTO hasil_radiologi (no_rawat, tgl_periksa, jam, hasil)
            VALUES (?, CURDATE(), CURTIME(), ?)
          `,
          [normalizedNoRawat, normalizedHasil]
        );
      }

      await connection.execute(
        `
          INSERT INTO saran_kesan_rad (no_rawat, tgl_periksa, jam, judul, saran, kesan)
          VALUES (?, CURDATE(), CURTIME(), ?, ?, ?)
        `,
        [normalizedNoRawat, normalizedJudul, normalizedSaran, normalizedKesan]
      );

      await connection.commit();
      return {
        success: true,
        no_rawat: normalizedNoRawat
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  async createRadiologyRequest(no_rawat, dokter_perujuk, examinations, status_rawat, klinis = '') {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();

      const normalizedStatusRawat = this.normalizeStatusRawat(status_rawat) || 'ralan';
      const normalizedKlinis = this.normalizeKlinis(klinis);
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const [sequenceRows] = await connection.execute(
        `
          SELECT MAX(noorder) AS last_noorder
          FROM permintaan_radiologi
          WHERE noorder LIKE ?
        `,
        [`PR${today}%`]
      );

      const lastNoorder = sequenceRows[0]?.last_noorder || '';
      const lastSequence = Number(String(lastNoorder).slice(`PR${today}`.length)) || 0;
      const nextSequence = String(lastSequence + 1).padStart(4, '0');
      const noorder = `PR${today}${nextSequence}`;

      const insertHeaderQuery = `
        INSERT INTO permintaan_radiologi (
          noorder,
          no_rawat,
          tgl_permintaan,
          jam_permintaan,
          tgl_sampel,
          jam_sampel,
          tgl_hasil,
          jam_hasil,
          dokter_perujuk,
          status
        )
        VALUES (?, ?, CURDATE(), CURTIME(), '0000-00-00', '00:00:00', '0000-00-00', '00:00:00', ?, ?)
      `;

      await connection.execute(insertHeaderQuery, [
        noorder,
        no_rawat,
        dokter_perujuk,
        normalizedStatusRawat
      ]);

      if (normalizedKlinis) {
        await connection.execute(
          `
            INSERT INTO diagnosa_pasien_klinis (noorder, klinis)
            VALUES (?, ?)
          `,
          [noorder, normalizedKlinis]
        );
      }

      if (Array.isArray(examinations) && examinations.length > 0) {
        for (const examination of examinations) {
          const insertDetailQuery = `
            INSERT INTO permintaan_pemeriksaan_radiologi (noorder, kd_jenis_prw, stts_bayar)
            VALUES (?, ?, 'Belum')
          `;

          await connection.execute(insertDetailQuery, [noorder, examination.kd_jenis_prw]);
        }
      }

      await connection.commit();
      return { success: true, noorder, status_rawat: normalizedStatusRawat };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  async updateRadiologyRequest(noorder, examinations, status_rawat, username = '', klinis = '') {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const normalizedUsername = String(username || '').trim();

      const normalizedStatusRawat = this.normalizeStatusRawat(status_rawat);
      const normalizedKlinis = this.normalizeKlinis(klinis);

      if (normalizedUsername) {
        const [rows] = await connection.execute(
          'SELECT dokter_perujuk FROM permintaan_radiologi WHERE noorder = ? LIMIT 1',
          [noorder]
        );

        if (!rows.length) {
          throw new Error('Permintaan radiologi tidak ditemukan atau sudah dihapus');
        }

        if (String(rows[0].dokter_perujuk || '').trim() !== normalizedUsername) {
          throw new Error('Anda tidak berhak mengedit permintaan radiologi ini');
        }
      }

      await connection.execute('DELETE FROM diagnosa_pasien_klinis WHERE noorder = ?', [noorder]);
      if (normalizedStatusRawat) {
        await connection.execute(
          'UPDATE permintaan_radiologi SET status = ? WHERE noorder = ?',
          [normalizedStatusRawat, noorder]
        );
      }

      if (normalizedKlinis) {
        await connection.execute(
          `
            INSERT INTO diagnosa_pasien_klinis (noorder, klinis)
            VALUES (?, ?)
          `,
          [noorder, normalizedKlinis]
        );
      }

      await connection.execute('DELETE FROM permintaan_pemeriksaan_radiologi WHERE noorder = ?', [noorder]);

      if (Array.isArray(examinations) && examinations.length > 0) {
        for (const examination of examinations) {
          const insertDetailQuery = `
            INSERT INTO permintaan_pemeriksaan_radiologi (noorder, kd_jenis_prw, stts_bayar)
            VALUES (?, ?, 'Belum')
          `;

          await connection.execute(insertDetailQuery, [noorder, examination.kd_jenis_prw]);
        }
      }

      await connection.commit();
      return { success: true, status_rawat: normalizedStatusRawat };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  async deleteRadiologyRequest(noorder, username = '') {
    const connection = await this.getConnection();
    try {
      const normalizedUsername = String(username || '').trim();

      if (normalizedUsername) {
        const [rows] = await connection.execute(
          'SELECT dokter_perujuk FROM permintaan_radiologi WHERE noorder = ? LIMIT 1',
          [noorder]
        );

        if (!rows.length) {
          throw new Error('Permintaan radiologi tidak ditemukan atau sudah dihapus');
        }

        if (String(rows[0].dokter_perujuk || '').trim() !== normalizedUsername) {
          throw new Error('Anda tidak berhak menghapus permintaan radiologi ini');
        }
      }

      await connection.execute('DELETE FROM diagnosa_pasien_klinis WHERE noorder = ?', [noorder]);
      await connection.execute('DELETE FROM permintaan_radiologi WHERE noorder = ?', [noorder]);
      return { success: true };
    } finally {
      await connection.end();
    }
  }
}

export default new RadiologyDataService();
