import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

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
