import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import DigitalFilesService from './digitalFilesService.js';

dotenv.config();

class LaboratoryDataService {
  constructor() {
    this.dbConfig = {
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT) || 3306,
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

  async getLabRequests(no_rawat) {
    const connection = await this.getConnection();
    try {
      const query = `
        SELECT pl.*, d.nm_dokter 
        FROM permintaan_lab pl
        LEFT JOIN dokter d ON pl.dokter_perujuk = d.kd_dokter
        WHERE pl.no_rawat = ?
        ORDER BY pl.tgl_permintaan DESC, pl.jam_permintaan DESC
      `;
      
      const [rows] = await connection.execute(query, [no_rawat]);
      return rows;
    } finally {
      await connection.end();
    }
  }

  async getLabRequestDetails(noorder) {
    const connection = await this.getConnection();
    try {
      // Get laboratory request examinations
      const examinationQuery = `
        SELECT ppl.*, jpl.nm_perawatan, jpl.total_byr
        FROM permintaan_pemeriksaan_lab ppl
        LEFT JOIN jns_perawatan_lab jpl ON ppl.kd_jenis_prw = jpl.kd_jenis_prw
        WHERE ppl.noorder = ?
      `;
      
      // Get laboratory request details
      const detailQuery = `
        SELECT pdpl.*, jpl.nm_perawatan, tl.Pemeriksaan as template_name
        FROM permintaan_detail_permintaan_lab pdpl
        LEFT JOIN jns_perawatan_lab jpl ON pdpl.kd_jenis_prw = jpl.kd_jenis_prw
        LEFT JOIN template_laboratorium tl ON pdpl.id_template = tl.id_template
        WHERE pdpl.noorder = ?
      `;
      const klinisQuery = `
        SELECT klinis
        FROM diagnosa_pasien_klinis
        WHERE noorder = ?
        LIMIT 1
      `;
      
      const [[examinations], [details], [klinisRows]] = await Promise.all([
        connection.execute(examinationQuery, [noorder]),
        connection.execute(detailQuery, [noorder]),
        connection.execute(klinisQuery, [noorder])
      ]);
      
      return {
        examinations,
        details,
        klinis: klinisRows?.[0]?.klinis || ''
      };
    } finally {
      await connection.end();
    }
  }

  async getLabServices() {
    const connection = await this.getConnection();
    try {
      const query = `
        SELECT kd_jenis_prw, nm_perawatan, total_byr
        FROM jns_perawatan_lab
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

  async getLabTemplates(kd_jenis_prw) {
    const connection = await this.getConnection();
    try {
      const query = `
        SELECT id_template, Pemeriksaan, satuan, nilai_rujukan_ld, nilai_rujukan_la, nilai_rujukan_pd, nilai_rujukan_pa
        FROM template_laboratorium
        WHERE kd_jenis_prw = ?
        ORDER BY Pemeriksaan
      `;
      
      const [rows] = await connection.execute(query, [kd_jenis_prw]);
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

  async getDailyLabPatients({
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
        INNER JOIN periksa_lab pl ON rp.no_rawat = pl.no_rawat
        INNER JOIN jns_perawatan_lab layanan ON pl.kd_jenis_prw = layanan.kd_jenis_prw
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
        INNER JOIN periksa_lab pl ON rp.no_rawat = pl.no_rawat
        INNER JOIN jns_perawatan_lab layanan ON pl.kd_jenis_prw = layanan.kd_jenis_prw
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

  async getLabPatientDetail(no_rawat) {
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
        INNER JOIN periksa_lab pl ON rp.no_rawat = pl.no_rawat
        INNER JOIN jns_perawatan_lab layanan ON pl.kd_jenis_prw = layanan.kd_jenis_prw
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

      const resultsQuery = `
        SELECT
          COALESCE(layanan.nm_perawatan, 'Template Lainnya') AS template_name,
          tl.Pemeriksaan AS pemeriksaan,
          dpl.nilai,
          tl.satuan,
          dpl.nilai_rujukan,
          dpl.keterangan
        FROM detail_periksa_lab dpl
        INNER JOIN template_laboratorium tl ON dpl.id_template = tl.id_template
        LEFT JOIN jns_perawatan_lab layanan ON tl.kd_jenis_prw = layanan.kd_jenis_prw
        WHERE dpl.no_rawat = ?
        ORDER BY dpl.tgl_periksa DESC, dpl.jam DESC, layanan.nm_perawatan ASC, tl.Pemeriksaan ASC
      `;

      const impressionQuery = `
        SELECT
          no_rawat,
          tgl_periksa,
          jam,
          saran,
          kesan
        FROM saran_kesan_lab
        WHERE no_rawat = ?
        ORDER BY tgl_periksa DESC, jam DESC
        LIMIT 1
      `;

      const attachmentsQuery = `
        SELECT lokasi_file
        FROM berkas_digital_perawatan
        WHERE kode = '005' AND no_rawat = ?
        ORDER BY lokasi_file ASC
      `;

      const [[patientRows], [resultRows], [impressionRows], [attachmentRows]] = await Promise.all([
        connection.execute(patientQuery, [no_rawat]),
        connection.execute(resultsQuery, [no_rawat]),
        connection.execute(impressionQuery, [no_rawat]),
        connection.execute(attachmentsQuery, [no_rawat])
      ]);

      const patient = patientRows?.[0];
      if (!patient) {
        throw new Error('Data pasien laboratorium tidak ditemukan');
      }

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
          attachments: attachmentRows.map((row) => {
            const lokasiFile = String(row.lokasi_file || '').trim();
            return {
              lokasi_file: lokasiFile,
              nama_file: DigitalFilesService.extractFileName(lokasiFile),
              url: DigitalFilesService.buildFileUrl(lokasiFile)
            };
          }),
          results: resultRows.map((row) => ({
            template_name: row.template_name || 'Template Lainnya',
            pemeriksaan: row.pemeriksaan || '',
            nilai: row.nilai || '',
            satuan: row.satuan || '',
            nilai_rujukan: row.nilai_rujukan || '',
            keterangan: row.keterangan || ''
          })),
          review: impressionRows?.[0] || {
            kesan: '',
            saran: ''
          }
        }
      };
    } finally {
      await connection.end();
    }
  }

  async saveLabReview(no_rawat, kesan = '', saran = '') {
    const connection = await this.getConnection();
    try {
      const normalizedNoRawat = String(no_rawat || '').trim();
      const normalizedKesan = String(kesan || '').trim();
      const normalizedSaran = String(saran || '').trim();

      if (!normalizedNoRawat) {
        throw new Error('no_rawat wajib diisi');
      }

      if (!normalizedKesan && !normalizedSaran) {
        throw new Error('Kesan atau saran wajib diisi');
      }

      await connection.execute(
        `
          INSERT INTO saran_kesan_lab (no_rawat, tgl_periksa, jam, saran, kesan)
          VALUES (?, CURDATE(), CURTIME(), ?, ?)
        `,
        [normalizedNoRawat, normalizedSaran, normalizedKesan]
      );

      return {
        success: true,
        no_rawat: normalizedNoRawat
      };
    } finally {
      await connection.end();
    }
  }

  async createLabRequest(no_rawat, dokter_perujuk, examinations, details, status_rawat, klinis = '') {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const normalizedStatusRawat = this.normalizeStatusRawat(status_rawat) || 'ralan';
      const normalizedKlinis = this.normalizeKlinis(klinis);
      
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const [sequenceRows] = await connection.execute(
        `
          SELECT MAX(noorder) AS last_noorder
          FROM permintaan_lab
          WHERE noorder LIKE ?
        `,
        [`PL${today}%`]
      );
      const lastNoorder = sequenceRows[0]?.last_noorder || '';
      const lastSequence = Number(String(lastNoorder).slice(`PL${today}`.length)) || 0;
      const nextSequence = String(lastSequence + 1).padStart(4, '0');
      const noorder = `PL${today}${nextSequence}`;
      
      const insertLabRequestQuery = `
        INSERT INTO permintaan_lab (noorder, no_rawat, tgl_permintaan, jam_permintaan, tgl_sampel, jam_sampel, tgl_hasil, jam_hasil, dokter_perujuk, status, kategori)
        VALUES (?, ?, CURDATE(), CURTIME(), '0000-00-00', '00:00:00', '0000-00-00', '00:00:00', ?, ?, 'PK')
      `;
      
      await connection.execute(insertLabRequestQuery, [noorder, no_rawat, dokter_perujuk, normalizedStatusRawat]);

      if (normalizedKlinis) {
        await connection.execute(
          `
            INSERT INTO diagnosa_pasien_klinis (noorder, klinis)
            VALUES (?, ?)
          `,
          [noorder, normalizedKlinis]
        );
      }
      
      if (examinations && examinations.length > 0) {
        for (const examination of examinations) {
          const insertExaminationQuery = `
            INSERT INTO permintaan_pemeriksaan_lab (noorder, kd_jenis_prw, stts_bayar)
            VALUES (?, ?, 'Belum')
          `;
          await connection.execute(insertExaminationQuery, [noorder, examination.kd_jenis_prw]);
        }
      }
      
      if (details && details.length > 0) {
        for (const detail of details) {
          const insertDetailQuery = `
            INSERT INTO permintaan_detail_permintaan_lab (noorder, kd_jenis_prw, id_template, stts_bayar)
            VALUES (?, ?, ?, 'Belum')
          `;
          await connection.execute(insertDetailQuery, [noorder, detail.kd_jenis_prw, detail.id_template]);
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

  async updateLabRequest(noorder, examinations, details, status_rawat, username = '', klinis = '') {
    const connection = await this.getConnection();
    try {
      await connection.beginTransaction();
      const normalizedUsername = String(username || '').trim();
      const normalizedStatusRawat = this.normalizeStatusRawat(status_rawat);
      const normalizedKlinis = this.normalizeKlinis(klinis);

      if (normalizedUsername) {
        const [rows] = await connection.execute(
          'SELECT dokter_perujuk FROM permintaan_lab WHERE noorder = ? LIMIT 1',
          [noorder]
        );

        if (!rows.length) {
          throw new Error('Permintaan laboratorium tidak ditemukan atau sudah dihapus');
        }

        if (String(rows[0].dokter_perujuk || '').trim() !== normalizedUsername) {
          throw new Error('Anda tidak berhak mengedit permintaan laboratorium ini');
        }
      }

      if (normalizedStatusRawat) {
        await connection.execute(
          'UPDATE permintaan_lab SET status = ? WHERE noorder = ?',
          [normalizedStatusRawat, noorder]
        );
      }
      
      await connection.execute('DELETE FROM diagnosa_pasien_klinis WHERE noorder = ?', [noorder]);
      await connection.execute('DELETE FROM permintaan_pemeriksaan_lab WHERE noorder = ?', [noorder]);
      await connection.execute('DELETE FROM permintaan_detail_permintaan_lab WHERE noorder = ?', [noorder]);

      if (normalizedKlinis) {
        await connection.execute(
          `
            INSERT INTO diagnosa_pasien_klinis (noorder, klinis)
            VALUES (?, ?)
          `,
          [noorder, normalizedKlinis]
        );
      }
      
      if (examinations && examinations.length > 0) {
        for (const examination of examinations) {
          const insertExaminationQuery = `
            INSERT INTO permintaan_pemeriksaan_lab (noorder, kd_jenis_prw, stts_bayar)
            VALUES (?, ?, 'Belum')
          `;
          await connection.execute(insertExaminationQuery, [noorder, examination.kd_jenis_prw]);
        }
      }
      
      if (details && details.length > 0) {
        for (const detail of details) {
          const insertDetailQuery = `
            INSERT INTO permintaan_detail_permintaan_lab (noorder, kd_jenis_prw, id_template, stts_bayar)
            VALUES (?, ?, ?, 'Belum')
          `;
          await connection.execute(insertDetailQuery, [noorder, detail.kd_jenis_prw, detail.id_template]);
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

  async deleteLabRequest(noorder, username = '') {
    const connection = await this.getConnection();
    try {
      const normalizedUsername = String(username || '').trim();

      if (normalizedUsername) {
        const [rows] = await connection.execute(
          'SELECT dokter_perujuk FROM permintaan_lab WHERE noorder = ? LIMIT 1',
          [noorder]
        );

        if (!rows.length) {
          throw new Error('Permintaan laboratorium tidak ditemukan atau sudah dihapus');
        }

        if (String(rows[0].dokter_perujuk || '').trim() !== normalizedUsername) {
          throw new Error('Anda tidak berhak menghapus permintaan laboratorium ini');
        }
      }

      await connection.execute('DELETE FROM diagnosa_pasien_klinis WHERE noorder = ?', [noorder]);
      const deleteQuery = `DELETE FROM permintaan_lab WHERE noorder = ?`;
      
      await connection.execute(deleteQuery, [noorder]);
      return { success: true };
    } finally {
      await connection.end();
    }
  }
}

export default new LaboratoryDataService();
