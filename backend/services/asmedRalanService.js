import { executeQuery } from '../config/database.js';

const TEXT_FIELDS = [
  'keluhan_utama',
  'rw_penyakit_sekarang',
  'rw_alergi',
  'rw_penyakit_dahulu',
  'rw_pengobatan',
  'rw_penyakit_keluarga',
  'pemeriksaan',
  'diagnosa',
  'planning',
  'tindakan'
];

class AsmedRalanService {
  static normalizeText(value) {
    return String(value ?? '').trim().slice(0, 500);
  }

  static async getAssessment(noRawat, kategori) {
    const normalizedNoRawat = String(noRawat || '').trim();
    const normalizedKategori = String(kategori || '').trim().toLowerCase();
    if (!normalizedNoRawat) {
      const error = new Error('no_rawat wajib diisi');
      error.statusCode = 400;
      throw error;
    }
    if (!['ralan', 'ranap'].includes(normalizedKategori)) {
      const error = new Error('kategori harus ralan atau ranap');
      error.statusCode = 400;
      throw error;
    }

    const rows = await executeQuery(
      `
        SELECT
          asmed_ralan.*,
          COALESCE(d.nm_dokter, '') AS nm_dokter
        FROM asmed_ralan
        LEFT JOIN dokter d ON TRIM(d.kd_dokter) = TRIM(asmed_ralan.kd_dokter)
        WHERE asmed_ralan.no_rawat = ? AND asmed_ralan.kategori = ?
        ORDER BY asmed_ralan.tanggal DESC, asmed_ralan.jam DESC, asmed_ralan.id DESC
      `,
      [normalizedNoRawat, normalizedKategori]
    );

    return {
      success: true,
      data: Array.isArray(rows) ? rows : []
    };
  }

  static async saveAssessment(payload = {}) {
    const noRawat = String(payload.no_rawat || '').trim();
    const kategori = String(payload.kategori || '').trim().toLowerCase();
    if (!noRawat) {
      const error = new Error('no_rawat wajib diisi');
      error.statusCode = 400;
      throw error;
    }
    if (!['ralan', 'ranap'].includes(kategori)) {
      const error = new Error('kategori harus ralan atau ranap');
      error.statusCode = 400;
      throw error;
    }
    const kdDokter = String(payload.kd_dokter || '').trim().slice(0, 20);
    if (!kdDokter) {
      const error = new Error('kd_dokter wajib diisi dari akun login');
      error.statusCode = 400;
      throw error;
    }

    const registrations = await executeQuery(
      `
        SELECT no_rawat
        FROM reg_periksa
        WHERE no_rawat = ? AND status_lanjut = ?
        LIMIT 1
      `,
      [noRawat, kategori === 'ranap' ? 'Ranap' : 'Ralan']
    );
    const registration = Array.isArray(registrations) ? registrations[0] : null;
    if (!registration?.no_rawat) {
      const error = new Error(`Registrasi ${kategori} tidak ditemukan`);
      error.statusCode = 404;
      throw error;
    }

    const now = new Date();
    const tanggal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const jamSelesai = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const jamInput = String(payload.jam || '').trim();
    const type = String(payload.type || '').trim();
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(jamInput)) {
      const error = new Error('jam harus diisi dengan format waktu yang valid');
      error.statusCode = 400;
      throw error;
    }
    if (!['Awal', 'Lanjutan'].includes(type)) {
      const error = new Error('type harus Awal atau Lanjutan');
      error.statusCode = 400;
      throw error;
    }
    const jam = jamInput.length === 5 ? `${jamInput}:00` : jamInput;
    const values = TEXT_FIELDS.map((field) => this.normalizeText(payload[field]));

    if (payload.id !== undefined && payload.id !== null && String(payload.id).trim() !== '') {
      const id = Number(payload.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        const error = new Error('id asesmen tidak valid');
        error.statusCode = 400;
        throw error;
      }

      const existingRows = await executeQuery(
        `
          SELECT id
          FROM asmed_ralan
          WHERE id = ? AND no_rawat = ? AND kategori = ?
          LIMIT 1
        `,
        [id, noRawat, kategori]
      );
      if (!Array.isArray(existingRows) || !existingRows[0]) {
        const error = new Error('Asesmen awal medis tidak ditemukan');
        error.statusCode = 404;
        throw error;
      }

      await executeQuery(
        `
          UPDATE asmed_ralan
          SET jam = ?, jam_selesai = ?, type = ?,
              keluhan_utama = ?, rw_penyakit_sekarang = ?, rw_alergi = ?,
              rw_penyakit_dahulu = ?, rw_pengobatan = ?, rw_penyakit_keluarga = ?,
              pemeriksaan = ?, diagnosa = ?, planning = ?, tindakan = ?
          WHERE id = ? AND no_rawat = ? AND kategori = ?
        `,
        [jam, jamSelesai, type, ...values, id, noRawat, kategori]
      );

      return {
        success: true,
        message: 'Asesmen awal medis berhasil diperbarui'
      };
    }

    await executeQuery(
      `
        INSERT INTO asmed_ralan (
          no_rawat, kategori, tanggal, jam, jam_selesai, type, keluhan_utama, rw_penyakit_sekarang, rw_alergi,
          rw_penyakit_dahulu, rw_pengobatan, rw_penyakit_keluarga, pemeriksaan,
          diagnosa, planning, tindakan, kd_dokter, nip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [noRawat, kategori, tanggal, jam, jamSelesai, type, ...values, kdDokter, null]
    );

    return {
      success: true,
      message: 'Asesmen awal medis berhasil disimpan'
    };
  }

  static async deleteAssessment(idValue, noRawatValue, kategoriValue) {
    const id = Number(idValue);
    const noRawat = String(noRawatValue || '').trim();
    const kategori = String(kategoriValue || '').trim().toLowerCase();
    if (!Number.isSafeInteger(id) || id <= 0) {
      const error = new Error('id asesmen tidak valid');
      error.statusCode = 400;
      throw error;
    }
    if (!noRawat) {
      const error = new Error('no_rawat wajib diisi');
      error.statusCode = 400;
      throw error;
    }
    if (!['ralan', 'ranap'].includes(kategori)) {
      const error = new Error('kategori harus ralan atau ranap');
      error.statusCode = 400;
      throw error;
    }

    const existingRows = await executeQuery(
      `
        SELECT id
        FROM asmed_ralan
        WHERE id = ? AND no_rawat = ? AND kategori = ?
        LIMIT 1
      `,
      [id, noRawat, kategori]
    );
    if (!Array.isArray(existingRows) || !existingRows[0]) {
      const error = new Error('Asesmen awal medis tidak ditemukan');
      error.statusCode = 404;
      throw error;
    }

    await executeQuery(
      'DELETE FROM asmed_ralan WHERE id = ? AND no_rawat = ? AND kategori = ?',
      [id, noRawat, kategori]
    );

    return {
      success: true,
      message: 'Asesmen awal medis berhasil dihapus'
    };
  }
}

export default AsmedRalanService;