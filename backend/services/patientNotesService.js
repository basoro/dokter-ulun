import { executeQuery } from '../config/database.js';

class PatientNotesService {
  static async getNotes(noRawat) {
    if (!noRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    const sql = `
      SELECT
        DATE_FORMAT(cp.tanggal, '%Y-%m-%d') AS tanggal,
        TIME_FORMAT(cp.jam, '%H:%i') AS jam,
        cp.no_rawat,
        cp.kd_dokter,
        cp.catatan,
        COALESCE(d.nm_dokter, cp.kd_dokter) AS petugas
      FROM catatan_perawatan cp
      LEFT JOIN dokter d ON cp.kd_dokter = d.kd_dokter
      WHERE cp.no_rawat = ?
      ORDER BY cp.tanggal DESC, cp.jam DESC
    `;

    const rows = await executeQuery(sql, [noRawat]);
    return {
      success: true,
      data: rows,
    };
  }

  static async getPreviousVisitNotes(noRkmMedis, excludeNoRawat = '') {
    const normalizedNoRkmMedis = String(noRkmMedis || '').trim();
    const normalizedExcludeNoRawat = String(excludeNoRawat || '').trim();

    if (!normalizedNoRkmMedis) {
      throw new Error('no_rkm_medis wajib diisi');
    }

    const sql = `
      SELECT
        DATE_FORMAT(cp.tanggal, '%Y-%m-%d') AS tanggal,
        TIME_FORMAT(cp.jam, '%H:%i') AS jam,
        cp.no_rawat,
        rp.no_rkm_medis,
        cp.kd_dokter,
        cp.catatan,
        DATE_FORMAT(rp.tgl_registrasi, '%Y-%m-%d') AS tgl_registrasi,
        COALESCE(rp.status_lanjut, '') AS status_lanjut,
        COALESCE(pol.nm_poli, '') AS nm_poli,
        COALESCE(d.nm_dokter, cp.kd_dokter) AS petugas
      FROM reg_periksa rp
      INNER JOIN catatan_perawatan cp ON cp.no_rawat = rp.no_rawat
      LEFT JOIN dokter d ON cp.kd_dokter = d.kd_dokter
      LEFT JOIN poliklinik pol ON rp.kd_poli = pol.kd_poli
      WHERE rp.no_rkm_medis = ?
        AND (? = '' OR rp.no_rawat <> ?)
      ORDER BY rp.tgl_registrasi DESC, cp.tanggal DESC, cp.jam DESC
    `;

    const rows = await executeQuery(sql, [
      normalizedNoRkmMedis,
      normalizedExcludeNoRawat,
      normalizedExcludeNoRawat,
    ]);

    return {
      success: true,
      data: rows,
    };
  }

  static async createNote(payload) {
    const { no_rawat, tanggal, jam, kd_dokter, catatan } = payload || {};

    if (!no_rawat || !tanggal || !jam || !kd_dokter || !catatan?.trim()) {
      throw new Error('no_rawat, tanggal, jam, kd_dokter, dan catatan wajib diisi');
    }

    const sql = `
      INSERT INTO catatan_perawatan (tanggal, jam, no_rawat, kd_dokter, catatan)
      VALUES (?, ?, ?, ?, ?)
    `;

    await executeQuery(sql, [tanggal, jam, no_rawat, kd_dokter, catatan.trim()]);
    return {
      success: true,
      message: 'Catatan pasien berhasil ditambahkan',
    };
  }

  static async updateNote(payload) {
    const {
      no_rawat,
      tanggal,
      jam,
      kd_dokter,
      catatan,
      original_tanggal,
      original_jam,
      original_kd_dokter,
    } = payload || {};

    if (
      !no_rawat ||
      !tanggal ||
      !jam ||
      !kd_dokter ||
      !catatan?.trim() ||
      !original_tanggal ||
      !original_jam ||
      !original_kd_dokter
    ) {
      throw new Error('Data catatan untuk update belum lengkap');
    }

    const sql = `
      UPDATE catatan_perawatan
      SET tanggal = ?, jam = ?, kd_dokter = ?, catatan = ?
      WHERE no_rawat = ?
        AND DATE_FORMAT(tanggal, '%Y-%m-%d') = ?
        AND TIME_FORMAT(jam, '%H:%i') = ?
        AND kd_dokter = ?
    `;

    const result = await executeQuery(sql, [
      tanggal,
      jam,
      kd_dokter,
      catatan.trim(),
      no_rawat,
      original_tanggal,
      original_jam,
      original_kd_dokter,
    ]);

    if (!result.affectedRows) {
      throw new Error('Catatan pasien yang akan diperbarui tidak ditemukan');
    }

    return {
      success: true,
      message: 'Catatan pasien berhasil diperbarui',
    };
  }

  static async deleteNote(payload) {
    const { no_rawat, tanggal, jam, kd_dokter } = payload || {};

    if (!no_rawat || !tanggal || !jam || !kd_dokter) {
      throw new Error('no_rawat, tanggal, jam, dan kd_dokter wajib diisi');
    }

    const sql = `
      DELETE FROM catatan_perawatan
      WHERE no_rawat = ?
        AND DATE_FORMAT(tanggal, '%Y-%m-%d') = ?
        AND TIME_FORMAT(jam, '%H:%i') = ?
        AND kd_dokter = ?
    `;

    const result = await executeQuery(sql, [no_rawat, tanggal, jam, kd_dokter]);

    if (!result.affectedRows) {
      throw new Error('Catatan pasien yang akan dihapus tidak ditemukan');
    }

    return {
      success: true,
      message: 'Catatan pasien berhasil dihapus',
    };
  }
}

export default PatientNotesService;
