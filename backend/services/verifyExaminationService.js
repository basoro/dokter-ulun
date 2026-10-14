import db from '../config/database.js';

const NOTE_TABLE = 'catatan_verif_soap';

const normalizeTimePart = (value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '';
};

const normalizeNoRawat = (value) => String(value || '').trim();
const normalizeDate = (value) => String(value || '').trim();

class VerifyExaminationService {
  static async verifyInpatientExamination(no_rawat, tgl_perawatan, jam_rawat, username = '', kd_dokter = '', catatan = '') {
    const normalizedNoRawat = normalizeNoRawat(no_rawat);
    const normalizedDate = normalizeDate(tgl_perawatan);
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
    if (normalizedCatatan.length > 255) {
      throw new Error('Catatan verifikasi maksimal 255 karakter');
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

      if (normalizedCatatan) {
        await connection.execute(
          `
            INSERT INTO ${NOTE_TABLE} (
              no_rawat, tgl_perawatan, jam_rawat, nip, catatan, kd_dokter
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [normalizedNoRawat, normalizedDate, normalizedTime, nip, normalizedCatatan, normalizedKdDokter]
        );
      }

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
        message: normalizedCatatan
          ? 'SOAP harian rawat inap berhasil diverifikasi dan catatan tersimpan'
          : 'SOAP harian rawat inap berhasil diverifikasi tanpa catatan',
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

  /**
   * Verifikasi beberapa SOAP harian rawat inap sekaligus tanpa menulis catatan
   * (tidak melakukan insert ke tabel catatan_verif_soap).
   */
  static async bulkVerifyInpatientExaminations(items = [], username = '', kd_dokter = '') {
    const normalizedUsername = String(username || '').trim();
    const normalizedKdDokter = String(kd_dokter || '').trim().slice(0, 20);

    if (!normalizedUsername) {
      throw new Error('Username wajib diisi untuk verifikasi SOAP harian rawat inap');
    }

    if (!normalizedKdDokter) {
      throw new Error('kd_dokter wajib diisi dari akun login');
    }

    const normalizedItems = (Array.isArray(items) ? items : [])
      .map((item) => ({
        no_rawat: normalizeNoRawat(item?.no_rawat),
        tgl_perawatan: normalizeDate(item?.tgl_perawatan),
        jam_rawat: String(item?.jam_rawat || '').trim()
      }))
      .filter((item) => item.no_rawat && item.tgl_perawatan && item.jam_rawat);

    if (!normalizedItems.length) {
      throw new Error('Tidak ada SOAP harian rawat inap yang dipilih untuk diverifikasi');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const results = [];
      let verifiedCount = 0;

      for (const item of normalizedItems) {
        const [rows] = await connection.execute(
          `
            SELECT verified_at
            FROM pemeriksaan_ranap
            WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
            LIMIT 1
            FOR UPDATE
          `,
          [item.no_rawat, item.tgl_perawatan, item.jam_rawat]
        );

        if (!rows.length) {
          results.push({ ...item, success: false, message: 'Data SOAP harian rawat inap tidak ditemukan' });
          continue;
        }

        if (rows[0]?.verified_at) {
          results.push({ ...item, success: false, message: 'SOAP harian rawat inap sudah diverifikasi' });
          continue;
        }

        const [updateResult] = await connection.execute(
          `
            UPDATE pemeriksaan_ranap
            SET verified_at = NOW()
            WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ? AND verified_at IS NULL
          `,
          [item.no_rawat, item.tgl_perawatan, item.jam_rawat]
        );

        if (!updateResult?.affectedRows) {
          results.push({ ...item, success: false, message: 'Verifikasi SOAP harian rawat inap gagal diproses' });
          continue;
        }

        verifiedCount += 1;
        results.push({ ...item, success: true, message: 'Berhasil diverifikasi tanpa catatan' });
      }

      await connection.commit();

      const failedCount = normalizedItems.length - verifiedCount;
      return {
        success: verifiedCount > 0,
        message: failedCount
          ? `${verifiedCount} dari ${normalizedItems.length} SOAP harian rawat inap berhasil diverifikasi tanpa catatan, ${failedCount} gagal`
          : `${verifiedCount} SOAP harian rawat inap berhasil diverifikasi tanpa catatan`,
        action_type: 'verify_bulk',
        verified_count: verifiedCount,
        failed_count: failedCount,
        total: normalizedItems.length,
        results
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Simpan/ubah catatan verifikasi SOAP harian rawat inap (upsert).
   */
  static async saveVerificationNote(no_rawat, tgl_perawatan, jam_rawat, catatan, kd_dokter = '') {
    const normalizedNoRawat = normalizeNoRawat(no_rawat);
    const normalizedDate = normalizeDate(tgl_perawatan);
    const normalizedTime = String(jam_rawat || '').trim();
    const normalizedCatatan = String(catatan || '').trim();
    const normalizedKdDokter = String(kd_dokter || '').trim().slice(0, 20);

    if (!normalizedNoRawat || !normalizedDate || !normalizedTime) {
      throw new Error('Missing required parameters: no_rawat, tgl_perawatan, jam_rawat');
    }

    if (!normalizedCatatan || normalizedCatatan.length > 255) {
      throw new Error('Catatan verifikasi wajib diisi (maksimal 255 karakter)');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [examRows] = await connection.execute(
        `
          SELECT nip
          FROM pemeriksaan_ranap
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
          LIMIT 1
        `,
        [normalizedNoRawat, normalizedDate, normalizedTime]
      );

      if (!examRows.length) {
        throw new Error('Data SOAP harian rawat inap tidak ditemukan');
      }

      const nip = String(examRows[0]?.nip || '').trim();
      if (!nip) {
        throw new Error('NIP pada SOAP tidak ditemukan');
      }

      const [noteRows] = await connection.execute(
        `
          SELECT no_rawat, tgl_perawatan, jam_rawat
          FROM ${NOTE_TABLE}
          WHERE TRIM(no_rawat) = TRIM(?) AND tgl_perawatan = ?
        `,
        [normalizedNoRawat, normalizedDate]
      );

      const existingNote = noteRows.find(
        (row) => normalizeTimePart(row.jam_rawat) === normalizeTimePart(normalizedTime)
      );

      if (existingNote) {
        await connection.execute(
          `
            UPDATE ${NOTE_TABLE}
            SET catatan = ?, kd_dokter = ?
            WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
          `,
          [normalizedCatatan, normalizedKdDokter, existingNote.no_rawat, existingNote.tgl_perawatan, existingNote.jam_rawat]
        );
      } else {
        await connection.execute(
          `
            INSERT INTO ${NOTE_TABLE} (
              no_rawat, tgl_perawatan, jam_rawat, nip, catatan, kd_dokter
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [normalizedNoRawat, normalizedDate, normalizedTime, nip, normalizedCatatan, normalizedKdDokter]
        );
      }

      await connection.commit();

      return {
        success: true,
        message: existingNote
          ? 'Catatan verifikasi berhasil diperbarui'
          : 'Catatan verifikasi berhasil ditambahkan',
        action_type: existingNote ? 'update_note' : 'create_note',
        no_rawat: normalizedNoRawat,
        tgl_perawatan: normalizedDate,
        jam_rawat: normalizedTime,
        catatan: normalizedCatatan
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Hapus catatan verifikasi SOAP harian rawat inap (tanpa membatalkan verifikasi).
   */
  static async deleteVerificationNote(no_rawat, tgl_perawatan, jam_rawat) {
    const normalizedNoRawat = normalizeNoRawat(no_rawat);
    const normalizedDate = normalizeDate(tgl_perawatan);
    const normalizedTime = String(jam_rawat || '').trim();

    if (!normalizedNoRawat || !normalizedDate || !normalizedTime) {
      throw new Error('Missing required parameters: no_rawat, tgl_perawatan, jam_rawat');
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [noteRows] = await connection.execute(
        `
          SELECT no_rawat, tgl_perawatan, jam_rawat
          FROM ${NOTE_TABLE}
          WHERE TRIM(no_rawat) = TRIM(?) AND tgl_perawatan = ?
        `,
        [normalizedNoRawat, normalizedDate]
      );

      const existingNote = noteRows.find(
        (row) => normalizeTimePart(row.jam_rawat) === normalizeTimePart(normalizedTime)
      );

      if (!existingNote) {
        throw new Error('Catatan verifikasi tidak ditemukan');
      }

      await connection.execute(
        `
          DELETE FROM ${NOTE_TABLE}
          WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        `,
        [existingNote.no_rawat, existingNote.tgl_perawatan, existingNote.jam_rawat]
      );

      await connection.commit();

      return {
        success: true,
        message: 'Catatan verifikasi berhasil dihapus',
        action_type: 'delete_note',
        no_rawat: normalizedNoRawat,
        tgl_perawatan: normalizedDate,
        jam_rawat: normalizedTime
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
