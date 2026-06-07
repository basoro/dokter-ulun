import { executeQuery } from '../config/database.js';

class OperationReportService {
  static formatDateTimeLocal(dateTime) {
    if (!dateTime) {
      return '';
    }

    const value = String(dateTime).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
      return value;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return value.replace(' ', 'T').slice(0, 16);
    }

    try {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return '';
      }

      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  }

  static normalizeTanggalOp(value) {
    if (!value) {
      return '';
    }

    const normalized = this.formatDateTimeLocal(value);
    if (normalized) {
      return normalized.replace('T', ' ');
    }

    return String(value).trim();
  }

  static async getReports(noRawat) {
    if (!noRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    const sql = `
      SELECT
        id,
        no_rawat,
        kd_dokter,
        tanggal_op,
        hasil_op,
        pre_op,
        post_op,
        implan,
        kirim_pa,
        nm_op,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM mlite_lap_op
      WHERE no_rawat = ?
        AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
    `;

    const rows = await executeQuery(sql, [noRawat]);

    return {
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        no_rawat: row.no_rawat,
        kd_dokter: row.kd_dokter || '',
        tanggal_op: this.formatDateTimeLocal(row.tanggal_op) || row.tanggal_op || '',
        hasil_op: row.hasil_op || '',
        pre_op: row.pre_op || '',
        post_op: row.post_op || '',
        implan: row.implan || '',
        kirim_pa: row.kirim_pa === 'Ya' ? 'Ya' : 'Tidak',
        nm_op: row.nm_op || '',
        created_at: this.formatDateTimeLocal(row.created_at) || row.created_at || '',
      })),
    };
  }

  static async createReport(payload) {
    const {
      kd_dokter,
      no_rawat,
      tanggal_op,
      hasil_op,
      pre_op,
      post_op,
      implan,
      kirim_pa,
      nm_op,
    } = payload || {};

    if (
      !no_rawat ||
      !tanggal_op ||
      !hasil_op?.trim()
    ) {
      throw new Error('Data laporan operasi belum lengkap');
    }

    const sql = `
      INSERT INTO mlite_lap_op (
        no_rawat,
        kd_dokter,
        tanggal_op,
        hasil_op,
        pre_op,
        post_op,
        implan,
        kirim_pa,
        nm_op
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await executeQuery(sql, [
      no_rawat,
      kd_dokter || null,
      this.normalizeTanggalOp(tanggal_op),
      hasil_op.trim(),
      pre_op?.trim() || null,
      post_op?.trim() || null,
      implan?.trim() || null,
      kirim_pa === 'Ya' ? 'Ya' : 'Tidak',
      nm_op?.trim() || null,
    ]);

    return {
      success: true,
      message: 'Laporan operasi berhasil ditambahkan',
    };
  }

  static async updateReport(payload) {
    const {
      id,
      kd_dokter,
      no_rawat,
      tanggal_op,
      hasil_op,
      pre_op,
      post_op,
      implan,
      kirim_pa,
      nm_op,
    } = payload || {};

    if (
      !id ||
      !no_rawat ||
      !tanggal_op ||
      !hasil_op?.trim()
    ) {
      throw new Error('Data laporan operasi untuk update belum lengkap');
    }

    const sql = `
      UPDATE mlite_lap_op
      SET
        kd_dokter = ?,
        tanggal_op = ?,
        hasil_op = ?,
        pre_op = ?,
        post_op = ?,
        implan = ?,
        kirim_pa = ?,
        nm_op = ?
      WHERE id = ?
        AND no_rawat = ?
        AND deleted_at IS NULL
    `;

    const result = await executeQuery(sql, [
      kd_dokter || null,
      this.normalizeTanggalOp(tanggal_op),
      hasil_op.trim(),
      pre_op?.trim() || null,
      post_op?.trim() || null,
      implan?.trim() || null,
      kirim_pa === 'Ya' ? 'Ya' : 'Tidak',
      nm_op?.trim() || null,
      id,
      no_rawat,
    ]);

    if (!result.affectedRows) {
      throw new Error('Laporan operasi yang akan diperbarui tidak ditemukan');
    }

    return {
      success: true,
      message: 'Laporan operasi berhasil diperbarui',
    };
  }

  static async deleteReport(payload) {
    const { id, no_rawat } = payload || {};

    if (!id || !no_rawat) {
      throw new Error('id dan no_rawat wajib diisi');
    }

    const sql = `
      UPDATE mlite_lap_op
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND no_rawat = ?
        AND deleted_at IS NULL
    `;

    const result = await executeQuery(sql, [id, no_rawat]);

    if (!result.affectedRows) {
      throw new Error('Laporan operasi yang akan dihapus tidak ditemukan');
    }

    return {
      success: true,
      message: 'Laporan operasi berhasil dihapus',
    };
  }
}

export default OperationReportService;
