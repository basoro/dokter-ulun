import { executeQuery } from '../config/database.js';

class SbarService {
  static async listByNoRawat(noRawat) {
    const normalizedNoRawat = String(noRawat || '').trim();
    if (!normalizedNoRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    const rows = await executeQuery(
      `
        SELECT
          ps.no_rawat,
          DATE_FORMAT(ps.tgl_perawatan, '%Y-%m-%d') AS tgl_perawatan,
          TIME_FORMAT(ps.jam_rawat, '%H:%i:%s') AS jam_rawat,
          ps.situasi,
          ps.latar_belakang,
          ps.penilaian,
          ps.rekomendasi,
          ps.nip,
          COALESCE(p.nama, '') AS pegawai,
          CASE WHEN ps.verified_at IS NULL THEN 0 ELSE 1 END AS is_verified,
          COALESCE(DATE_FORMAT(ps.verified_at, '%Y-%m-%d %H:%i:%s'), '') AS verified_at,
          COALESCE(ps.verified_by, '') AS verified_by,
          COALESCE(ps.verified_note, '') AS verified_note
        FROM pemeriksaan_sbar_ranap ps
        LEFT JOIN pegawai p ON TRIM(p.nik) = TRIM(ps.nip)
        WHERE ps.no_rawat = ?
        ORDER BY ps.tgl_perawatan DESC, ps.jam_rawat DESC
      `,
      [normalizedNoRawat]
    );

    return (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      situasi: String(row?.situasi || '').trim(),
      latar_belakang: String(row?.latar_belakang || '').trim(),
      penilaian: String(row?.penilaian || '').trim(),
      rekomendasi: String(row?.rekomendasi || '').trim(),
      nip: String(row?.nip || '').trim(),
      pegawai: String(row?.pegawai || '').trim(),
      is_verified: Number(row?.is_verified || 0),
      verified_at: String(row?.verified_at || '').trim(),
      verified_by: String(row?.verified_by || '').trim(),
      verified_note: String(row?.verified_note || '').trim()
    }));
  }

  static async verifySbar(noRawat, tglPerawatan, jamRawat, kdDokter) {
    const normalizedNoRawat = String(noRawat || '').trim();
    const normalizedDate = String(tglPerawatan || '').trim();
    const normalizedTime = String(jamRawat || '').trim();
    const normalizedKdDokter = String(kdDokter || '').trim().slice(0, 20);

    if (!normalizedNoRawat || !normalizedDate || !normalizedTime) {
      throw new Error('no_rawat, tgl_perawatan, dan jam_rawat wajib diisi');
    }

    if (!normalizedKdDokter) {
      throw new Error('Kode dokter wajib diisi untuk verifikasi SBAR');
    }

    const existingRows = await executeQuery(
      `
        SELECT no_rawat
        FROM pemeriksaan_sbar_ranap
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
        LIMIT 1
      `,
      [normalizedNoRawat, normalizedDate, normalizedTime]
    );

    if (!existingRows.length) {
      throw new Error('Data SBAR tidak ditemukan');
    }

    await executeQuery(
      `
        UPDATE pemeriksaan_sbar_ranap
        SET verified_at = NOW(), verified_by = ?, verified_note = NULL
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
      `,
      [normalizedKdDokter, normalizedNoRawat, normalizedDate, normalizedTime]
    );

    return {
      success: true,
      message: 'SBAR berhasil diverifikasi',
      no_rawat: normalizedNoRawat,
      tgl_perawatan: normalizedDate,
      jam_rawat: normalizedTime,
      verified_by: normalizedKdDokter,
      verified_note: null
    };
  }
}

export default SbarService;
