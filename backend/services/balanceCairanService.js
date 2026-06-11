import { executeQuery } from '../config/database.js';

class BalanceCairanService {
  static normalizeNumber(value) {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return 0;
    }

    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error('Nilai balance cairan harus berupa angka 0 atau lebih');
    }

    return parsed;
  }

  static async listByNoRawat(noRawat) {
    const normalizedNoRawat = String(noRawat || '').trim();
    if (!normalizedNoRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    const rows = await executeQuery(
      `
        SELECT
          id,
          no_rawat,
          user,
          tanggal,
          bc_ke,
          COALESCE(minum, 0) AS minum,
          COALESCE(makan, 0) AS makan,
          COALESCE(infus, 0) AS infus,
          COALESCE(muntah, 0) AS muntah,
          COALESCE(urine, 0) AS urine,
          COALESCE(bab, 0) AS bab,
          COALESCE(total_in, COALESCE(minum, 0) + COALESCE(makan, 0) + COALESCE(infus, 0)) AS total_in,
          COALESCE(total_out, COALESCE(muntah, 0) + COALESCE(urine, 0) + COALESCE(bab, 0)) AS total_out,
          created_at
        FROM mlite_balance_cairan
        WHERE no_rawat = ?
          AND deleted_at IS NULL
        ORDER BY tanggal DESC, bc_ke DESC, created_at DESC, id DESC
      `,
      [normalizedNoRawat]
    );

    return (Array.isArray(rows) ? rows : []).map((row) => {
      const totalIn = Number(row.total_in || 0);
      const totalOut = Number(row.total_out || 0);
      return {
        ...row,
        total_in: totalIn,
        total_out: totalOut,
        balance: totalIn - totalOut,
        is_intake_reference: totalIn > 0
      };
    });
  }

  static async createOuttake(payload = {}) {
    const referenceId = this.normalizeNumber(payload.id);
    const noRawat = String(payload.no_rawat || '').trim();
    const userName = String(payload.user || '').trim();
    const muntah = this.normalizeNumber(payload.muntah);
    const urine = this.normalizeNumber(payload.urine);
    const bab = this.normalizeNumber(payload.bab);

    if (!referenceId) {
      throw new Error('Maaf Belum Ada Intake');
    }

    if (!noRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    if (!userName) {
      throw new Error('User balance cairan wajib diisi');
    }

    const referenceRows = await executeQuery(
      `
        SELECT id, no_rawat, tanggal, bc_ke
        FROM mlite_balance_cairan
        WHERE id = ?
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [referenceId]
    );

    const referenceRow = Array.isArray(referenceRows) ? referenceRows[0] : null;
    if (!referenceRow) {
      throw new Error('Data intake balance cairan tidak ditemukan');
    }

    if (String(referenceRow.no_rawat || '').trim() !== noRawat) {
      throw new Error('Data intake tidak sesuai dengan nomor rawat aktif');
    }

    const totalOut = muntah + urine + bab;

    await executeQuery(
      `
        INSERT INTO mlite_balance_cairan (
          no_rawat,
          user,
          tanggal,
          bc_ke,
          muntah,
          urine,
          bab,
          total_out,
          created_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NULL)
      `,
      [
        noRawat,
        userName,
        referenceRow.tanggal,
        referenceRow.bc_ke,
        muntah,
        urine,
        bab,
        totalOut
      ]
    );

    return {
      success: true,
      message: 'Balance cairan berhasil disimpan'
    };
  }
}

export default BalanceCairanService;
