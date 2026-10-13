import db from '../config/database.js';

class VerifyExaminationService {
  static async verifyInpatientExamination(no_rawat, tgl_perawatan, jam_rawat, username = '', kd_dokter = '', catatan = '') {
    const normalizedNoRawat = String(no_rawat || '').trim();
    const normalizedDate = String(tgl_perawatan || '').trim();
    const normalizedTime = String(jam_rawat || '').trim();
    const normalizedUsername = String(username || '').trim();
    const normalizedKdDokter = String(kd_dokter || '').trim().slice(0, 20);
    const normalizedCatatan = String(catatan || '').trim();

    if (!normalizedNoRawat || !normalizedDate || !normalizedTime) {
      throw new Error('Missing required parameters: no_rawat, tgl_perawatan, jam_rawat');
    }

    if (!normalizedUsername) {
      throw new Error('Username wajib diisi untuk verifikasi SOAP harian rawat inap');
    }

    if (!normalizedKdDokter) {
      throw new Error('kd_dokter wajib diisi dari akun login');
    }
    if (!normalizedCatatan || normalizedCatatan.length > 255) {
      throw new Error('Catatan verifikasi wajib diisi (maksimal 255 karakter)');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [rows] = await connection.execute(
        `
          SELECT nip, verified_at
          FROM pemeriksaan_ranap
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
          LIMIT 1
          FOR UPDATE
        `,
        [normalizedNoRawat, normalizedDate, normalizedTime]
      );

      if (!rows.length) {
        throw new Error('Data SOAP harian rawat inap tidak ditemukan');
      }

      const record = rows[0] || {};
      if (record.verified_at) {
        throw new Error('SOAP harian rawat inap ini sudah diverifikasi');
      }
      const nip = String(record.nip || '').trim();
      if (!nip) {
        throw new Error('NIP pada SOAP tidak ditemukan');
      }

      const [updateResult] = await connection.execute(
        `
          UPDATE pemeriksaan_ranap
          SET verified_at = NOW()
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? AND verified_at IS NULL
        `,
        [normalizedNoRawat, normalizedDate, normalizedTime]
      );

      if (!updateResult?.affectedRows) {
        throw new Error('Verifikasi SOAP harian rawat inap gagal diproses');
      }

      await connection.execute(
        `
          INSERT INTO catatan_verif_soap (
            no_rawat, tgl_perawatan, jam_rawat, nip, catatan, kd_dokter
          ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [normalizedNoRawat, normalizedDate, normalizedTime, nip, normalizedCatatan, normalizedKdDokter]
      );

      const [updatedRows] = await connection.execute(
        `
          SELECT verified_at
          FROM pemeriksaan_ranap
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
          LIMIT 1
        `,
        [normalizedNoRawat, normalizedDate, normalizedTime]
      );

      await connection.commit();

      return {
        success: true,
        message: 'SOAP harian rawat inap berhasil diverifikasi dan catatan tersimpan',
        action_type: 'verify',
        no_rawat: normalizedNoRawat,
        tgl_perawatan: normalizedDate,
        jam_rawat: normalizedTime,
        verified_at: updatedRows?.[0]?.verified_at || null
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default VerifyExaminationService;
