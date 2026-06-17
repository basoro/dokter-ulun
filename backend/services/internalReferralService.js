import { getConnection } from '../config/database.js';

class InternalReferralService {
  static normalizeText(value) {
    return String(value || '').trim();
  }

  static getHariKerja(dateInput) {
    const normalized = this.normalizeText(dateInput);
    const date = normalized ? new Date(`${normalized}T00:00:00`) : new Date();

    if (Number.isNaN(date.getTime())) {
      throw new Error('Format tanggal tidak valid');
    }

    const mapping = ['AKHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    return mapping[date.getDay()];
  }

  static async getReferralSource(noRawat) {
    const connection = await getConnection();
    try {
      const [rows] = await connection.execute(
        `
          SELECT
            rp.no_rawat,
            rp.kd_poli AS asal_kd_poli,
            COALESCE(pol.nm_poli, rp.kd_poli, '') AS asal_nm_poli,
            rp.kd_dokter AS asal_kd_dokter,
            COALESCE(d.nm_dokter, rp.kd_dokter, '') AS asal_nm_dokter
          FROM reg_periksa rp
          LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
          LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
          WHERE rp.no_rawat = ?
          LIMIT 1
        `,
        [noRawat]
      );

      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  static async getPoliOptions() {
    const connection = await getConnection();
    try {
      const [rows] = await connection.execute(
        `
          SELECT kd_poli, nm_poli
          FROM poliklinik
          WHERE status = '1'  
          ORDER BY nm_poli ASC
        `
      );

      return rows;
    } finally {
      connection.release();
    }
  }

  static async getDoctorOptions() {
    const connection = await getConnection();
    try {
      const [rows] = await connection.execute(
        `
          SELECT
            d.kd_dokter,
            d.nm_dokter,
            GROUP_CONCAT(DISTINCT rp.kd_poli ORDER BY rp.kd_poli SEPARATOR ',') AS poli_codes
          FROM dokter d
          LEFT JOIN reg_periksa rp
            ON rp.kd_dokter = d.kd_dokter
           AND COALESCE(rp.kd_poli, '') <> ''
          WHERE status = '1'
          GROUP BY d.kd_dokter, d.nm_dokter
          ORDER BY d.nm_dokter ASC
        `
      );

      return rows;
    } finally {
      connection.release();
    }
  }

  static async getDoctorsBySchedule(payload) {
    const kd_poli = this.normalizeText(payload?.kd_poli);
    const date = this.normalizeText(payload?.date);

    if (!kd_poli) {
      throw new Error('kd_poli wajib diisi');
    }

    const hariKerja = this.getHariKerja(date);
    const connection = await getConnection();

    try {
      const [rows] = await connection.execute(
        `
          SELECT a.kd_dokter, b.nm_dokter
          FROM jadwal a
          INNER JOIN dokter b ON a.kd_dokter = b.kd_dokter
          WHERE a.kd_poli = ?
            AND a.hari_kerja = ?
            AND b.status = '1'
          GROUP BY a.kd_dokter, b.nm_dokter
          ORDER BY b.nm_dokter ASC
        `,
        [kd_poli, hariKerja]
      );

      return {
        success: true,
        meta: {
          kd_poli,
          hari_kerja: hariKerja
        },
        data: rows || []
      };
    } finally {
      connection.release();
    }
  }

  static async getReferrals(noRawat) {
    if (!noRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    const connection = await getConnection();
    try {
      const [sourceRows] = await connection.execute(
        `
          SELECT
            rp.no_rawat,
            rp.kd_poli AS asal_kd_poli,
            COALESCE(pol.nm_poli, rp.kd_poli, '') AS asal_nm_poli,
            rp.kd_dokter AS asal_kd_dokter,
            COALESCE(d.nm_dokter, rp.kd_dokter, '') AS asal_nm_dokter
          FROM reg_periksa rp
          LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
          LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter
          WHERE rp.no_rawat = ?
          LIMIT 1
        `,
        [noRawat]
      );

      const [referralRows] = await connection.execute(
        `
          SELECT
            rip.no_rawat,
            rip.kd_dokter,
            rip.kd_poli,
            COALESCE(pol.nm_poli, rip.kd_poli, '') AS nm_poli,
            COALESCE(d.nm_dokter, rip.kd_dokter, '') AS nm_dokter,
            COALESCE(rid.konsul, '') AS konsul,
            COALESCE(rid.pemeriksaan, '') AS pemeriksaan,
            COALESCE(rid.diagnosa, '') AS diagnosa,
            COALESCE(rid.saran, '') AS saran
          FROM rujukan_internal_poli rip
          LEFT JOIN rujukan_internal_poli_detail rid
            ON rid.no_rawat = rip.no_rawat
           AND rid.kd_dokter = rip.kd_dokter
          LEFT JOIN poliklinik pol ON rip.kd_poli = pol.kd_poli
          LEFT JOIN dokter d ON rip.kd_dokter = d.kd_dokter
          WHERE rip.no_rawat = ?
          ORDER BY COALESCE(pol.nm_poli, rip.kd_poli, '') ASC, COALESCE(d.nm_dokter, rip.kd_dokter, '') ASC
        `,
        [noRawat]
      );

      const [poliRows] = await connection.execute(
        `
          SELECT kd_poli, nm_poli
          FROM poliklinik
          WHERE status = '1'  
          ORDER BY nm_poli ASC
        `
      );

      const [doctorRows] = await connection.execute(
        `
          SELECT
            d.kd_dokter,
            d.nm_dokter,
            GROUP_CONCAT(DISTINCT rp.kd_poli ORDER BY rp.kd_poli SEPARATOR ',') AS poli_codes
          FROM dokter d
          LEFT JOIN reg_periksa rp
            ON rp.kd_dokter = d.kd_dokter
           AND COALESCE(rp.kd_poli, '') <> ''
          WHERE d.status = '1'
          GROUP BY d.kd_dokter, d.nm_dokter
          ORDER BY d.nm_dokter ASC
        `
      );

      const sourceInfo = sourceRows[0] || null;

      return {
        success: true,
        data: referralRows || [],
        meta: {
          source: sourceInfo,
        },
        options: {
          poliklinik: poliRows || [],
          doctors: doctorRows || [],
        },
      };
    } finally {
      connection.release();
    }
  }

  static async createReferral(payload) {
    const no_rawat = this.normalizeText(payload?.no_rawat);
    const kd_dokter = this.normalizeText(payload?.kd_dokter);
    const kd_poli = this.normalizeText(payload?.kd_poli);
    const konsul = this.normalizeText(payload?.konsul);
    const pemeriksaan = this.normalizeText(payload?.pemeriksaan);
    const diagnosa = this.normalizeText(payload?.diagnosa);
    const saran = this.normalizeText(payload?.saran);

    if (!no_rawat || !kd_dokter || !kd_poli) {
      throw new Error('no_rawat, kd_dokter, dan kd_poli wajib diisi');
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `
          INSERT INTO rujukan_internal_poli (no_rawat, kd_dokter, kd_poli)
          VALUES (?, ?, ?)
        `,
        [no_rawat, kd_dokter, kd_poli]
      );

      await connection.execute(
        `
          INSERT INTO rujukan_internal_poli_detail (no_rawat, kd_dokter, konsul, pemeriksaan, diagnosa, saran)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [no_rawat, kd_dokter, konsul, pemeriksaan, diagnosa, saran]
      );

      await connection.commit();

      return {
        success: true,
        message: 'Rujukan internal berhasil ditambahkan',
      };
    } catch (error) {
      await connection.rollback();
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new Error('Rujukan internal untuk dokter tujuan tersebut sudah ada');
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  static async updateReferral(payload) {
    const no_rawat = this.normalizeText(payload?.no_rawat);
    const kd_dokter = this.normalizeText(payload?.kd_dokter);
    const kd_poli = this.normalizeText(payload?.kd_poli);
    const original_kd_dokter = this.normalizeText(payload?.original_kd_dokter);
    const konsul = this.normalizeText(payload?.konsul);
    const pemeriksaan = this.normalizeText(payload?.pemeriksaan);
    const diagnosa = this.normalizeText(payload?.diagnosa);
    const saran = this.normalizeText(payload?.saran);

    if (!no_rawat || !kd_dokter || !kd_poli || !original_kd_dokter) {
      throw new Error('Data rujukan internal untuk update belum lengkap');
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      const [headerResult] = await connection.execute(
        `
          UPDATE rujukan_internal_poli
          SET kd_dokter = ?, kd_poli = ?
          WHERE no_rawat = ? AND kd_dokter = ?
        `,
        [kd_dokter, kd_poli, no_rawat, original_kd_dokter]
      );

      if (!headerResult.affectedRows) {
        throw new Error('Rujukan internal yang akan diperbarui tidak ditemukan');
      }

      const [detailResult] = await connection.execute(
        `
          UPDATE rujukan_internal_poli_detail
          SET kd_dokter = ?, konsul = ?, pemeriksaan = ?, diagnosa = ?, saran = ?
          WHERE no_rawat = ? AND kd_dokter = ?
        `,
        [kd_dokter, konsul, pemeriksaan, diagnosa, saran, no_rawat, original_kd_dokter]
      );

      if (!detailResult.affectedRows) {
        await connection.execute(
          `
            INSERT INTO rujukan_internal_poli_detail (no_rawat, kd_dokter, konsul, pemeriksaan, diagnosa, saran)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [no_rawat, kd_dokter, konsul, pemeriksaan, diagnosa, saran]
        );
      }

      await connection.commit();

      return {
        success: true,
        message: 'Rujukan internal berhasil diperbarui',
      };
    } catch (error) {
      await connection.rollback();
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new Error('Rujukan internal untuk dokter tujuan tersebut sudah ada');
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteReferral(payload) {
    const no_rawat = this.normalizeText(payload?.no_rawat);
    const kd_dokter = this.normalizeText(payload?.kd_dokter);

    if (!no_rawat || !kd_dokter) {
      throw new Error('no_rawat dan kd_dokter wajib diisi');
    }

    const connection = await getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `
          DELETE FROM rujukan_internal_poli_detail
          WHERE no_rawat = ? AND kd_dokter = ?
        `,
        [no_rawat, kd_dokter]
      );

      const [headerResult] = await connection.execute(
        `
          DELETE FROM rujukan_internal_poli
          WHERE no_rawat = ? AND kd_dokter = ?
        `,
        [no_rawat, kd_dokter]
      );

      if (!headerResult.affectedRows) {
        throw new Error('Rujukan internal yang akan dihapus tidak ditemukan');
      }

      await connection.commit();

      return {
        success: true,
        message: 'Rujukan internal berhasil dihapus',
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default InternalReferralService;
