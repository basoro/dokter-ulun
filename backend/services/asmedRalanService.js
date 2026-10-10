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
    const jam = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const values = TEXT_FIELDS.map((field) => this.normalizeText(payload[field]));
    await executeQuery(
      `
        INSERT INTO asmed_ralan (
          no_rawat, kategori, tanggal, jam, keluhan_utama, rw_penyakit_sekarang, rw_alergi,
          rw_penyakit_dahulu, rw_pengobatan, rw_penyakit_keluarga, pemeriksaan,
          diagnosa, planning, tindakan, kd_dokter, nip
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [noRawat, kategori, tanggal, jam, ...values, kdDokter, null]
    );

    return {
      success: true,
      message: 'Asesmen awal medis berhasil disimpan'
    };
  }
}

export default AsmedRalanService;