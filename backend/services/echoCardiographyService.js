import { getConnection } from '../config/database.js';

class EchoCardiographyService {
  static ALLOWED_TITLES = [
    'Echocardiography',
    'Holter Monitoring',
    'Treadmill Test',
    'Kateterisasi Jantung'
  ];
  static DEFAULT_TITLE = 'Echocardiography';
  static RANAP_TINDAKAN_KODE = 'RI98227';

  static normalizeTitle(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return this.DEFAULT_TITLE;
    }

    const matched = this.ALLOWED_TITLES.find(
      (title) => title.toLowerCase() === normalized.toLowerCase()
    );

    if (!matched) {
      throw new Error(
        `Judul tidak valid. Pilihan judul: ${this.ALLOWED_TITLES.join(', ')}`
      );
    }

    return matched;
  }

  static normalizeNoRawat(noRawat) {
    const normalized = String(noRawat || '').trim();
    if (!normalized) {
      throw new Error('no_rawat wajib diisi');
    }

    return normalized;
  }

  static normalizeText(value) {
    return String(value ?? '').trim();
  }

  static normalizeBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value || '').trim().toLowerCase();
    return ['1', 'true', 'yes', 'checked', 'on'].includes(normalized);
  }

  static normalizeEditDate(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    const dateOnlyMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
    }

    // Tangani ISO string hasil serialisasi Date (mis. 2026-09-20T17:00:00.000Z)
    // dengan mengonversinya kembali ke tanggal lokal.
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    return normalized;
  }

  static normalizeEditTime(value) {
    const normalized = String(value || '').trim();
    if (!normalized) {
      return '';
    }

    const timeMatch = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      const hours = timeMatch[1].padStart(2, '0');
      const minutes = timeMatch[2];
      const seconds = timeMatch[3] || '00';
      return `${hours}:${minutes}:${seconds}`;
    }

    return normalized;
  }

  static getCurrentSystemDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  }

  static async list(payload = {}) {
    const normalizedNoRawat = this.normalizeNoRawat(
      typeof payload === 'string' ? payload : payload?.no_rawat
    );
    const connection = await getConnection();

    try {
      const judulPlaceholders = this.ALLOWED_TITLES.map(() => '?').join(', ');
      const [rows] = await connection.execute(
        `
          SELECT
            skr.no_rawat,
            DATE_FORMAT(skr.tgl_periksa, '%Y-%m-%d') AS tgl_periksa,
            TIME_FORMAT(skr.jam, '%H:%i:%s') AS jam,
            skr.judul,
            hr.hasil,
            skr.saran,
            skr.kesan
          FROM saran_kesan_rad skr
          LEFT JOIN hasil_radiologi hr
            ON hr.no_rawat = skr.no_rawat
            AND hr.tgl_periksa = skr.tgl_periksa
            AND hr.jam = skr.jam
          WHERE skr.no_rawat = ?
            AND skr.judul IN (${judulPlaceholders})
          ORDER BY skr.tgl_periksa DESC, skr.jam DESC
        `,
        [normalizedNoRawat, ...this.ALLOWED_TITLES]
      );

      return rows.map((row) => ({
        no_rawat: row.no_rawat || '',
        tgl_periksa: row.tgl_periksa || '',
        jam: row.jam || '',
        judul: row.judul || '',
        hasil: row.hasil || '',
        kesan: row.kesan || '',
        saran: row.saran || ''
      }));
    } finally {
      connection.release();
    }
  }

  static async save(payload = {}) {
    const noRawat = this.normalizeNoRawat(payload.no_rawat);
    const hasil = this.normalizeText(payload.hasil);
    const kesan = this.normalizeText(payload.kesan);
    const saran = this.normalizeText(payload.saran);
    const addBilling = this.normalizeBoolean(payload.add_billing);
    const mode = String(payload.mode || '').trim().toLowerCase() === 'edit' ? 'edit' : 'create';
    const kdDokter = this.normalizeText(payload.kd_dokter);
    const editTanggal = this.normalizeEditDate(payload.tgl_periksa);
    const editJam = this.normalizeEditTime(payload.jam);
    const judul = this.normalizeTitle(payload.judul);

    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      let tanggal = editTanggal;
      let jam = editJam;

      if (mode === 'edit') {
        if (!tanggal || !jam) {
          throw new Error('Data echo yang akan diedit tidak valid');
        }

        const [updateSaranResult] = await connection.execute(
          `
            UPDATE saran_kesan_rad
            SET saran = ?, kesan = ?
            WHERE no_rawat = ?
              AND tgl_periksa = ?
              AND jam = ?
              AND judul = ?
          `,
          [saran, kesan, noRawat, tanggal, jam, judul]
        );

        if (!updateSaranResult || Number(updateSaranResult.affectedRows) === 0) {
          throw new Error(
            'Data echo yang akan diedit tidak ditemukan. Muat ulang riwayat lalu coba lagi.'
          );
        }

        const [updateHasilResult] = await connection.execute(
          `
            UPDATE hasil_radiologi
            SET hasil = ?
            WHERE no_rawat = ?
              AND tgl_periksa = ?
              AND jam = ?
          `,
          [hasil, noRawat, tanggal, jam]
        );

        if ((!updateHasilResult || Number(updateHasilResult.affectedRows) === 0) && hasil) {
          await connection.execute(
            `
              INSERT INTO hasil_radiologi (
                no_rawat,
                tgl_periksa,
                jam,
                hasil
              ) VALUES (?, ?, ?, ?)
            `,
            [noRawat, tanggal, jam, hasil]
          );
        }
      } else {
        const currentSystemDateTime = this.getCurrentSystemDateTime();
        tanggal = currentSystemDateTime.date;
        jam = currentSystemDateTime.time;

        await connection.execute(
          `
            INSERT INTO saran_kesan_rad (
              no_rawat,
              tgl_periksa,
              jam,
              judul,
              saran,
              kesan
            ) VALUES (?, ?, ?, ?, ?, ?)
          `,
          [noRawat, tanggal, jam, judul, saran, kesan]
        );

        await connection.execute(
          `
            INSERT INTO hasil_radiologi (
              no_rawat,
              tgl_periksa,
              jam,
              hasil
            ) VALUES (?, ?, ?, ?)
          `,
          [noRawat, tanggal, jam, hasil]
        );

        if (addBilling) {
          if (!kdDokter) {
            throw new Error('Kode dokter wajib diisi untuk menambahkan billing');
          }

          const [tarifRows] = await connection.execute(
            `
              SELECT total_byrdr
              FROM jns_perawatan_inap
              WHERE kd_jenis_prw = ?
              LIMIT 1
            `,
            [this.RANAP_TINDAKAN_KODE]
          );

          const tarif = Number(tarifRows?.[0]?.total_byrdr || 0);

          await connection.execute(
            `
              INSERT INTO rawat_inap_dr (
                no_rawat,
                kd_jenis_prw,
                kd_dokter,
                tgl_perawatan,
                jam_rawat,
                material,
                bhp,
                tarif_tindakandr,
                kso,
                menejemen,
                biaya_rawat
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              noRawat,
              this.RANAP_TINDAKAN_KODE,
              kdDokter,
              tanggal,
              jam,
              0,
              0,
              tarif,
              0,
              0,
              tarif
            ]
          );
        }
      }

      await connection.commit();

      return {
        success: true,
        message: mode === 'edit'
          ? `${judul} berhasil diperbarui`
          : `${judul} berhasil disimpan`,
        data: {
          no_rawat: noRawat,
          tgl_periksa: tanggal,
          jam,
          judul
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async delete(payload = {}) {
    const noRawat = this.normalizeNoRawat(payload.no_rawat);
    const tanggal = this.normalizeEditDate(payload.tgl_periksa);
    const jam = this.normalizeEditTime(payload.jam);
    const judul = this.normalizeTitle(payload.judul);

    if (!tanggal || !jam) {
      throw new Error('Tanggal dan jam data yang akan dihapus tidak valid');
    }

    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const [deleteSaranResult] = await connection.execute(
        `
          DELETE FROM saran_kesan_rad
          WHERE no_rawat = ?
            AND tgl_periksa = ?
            AND jam = ?
            AND judul = ?
        `,
        [noRawat, tanggal, jam, judul]
      );

      if (!deleteSaranResult || Number(deleteSaranResult.affectedRows) === 0) {
        throw new Error(
          'Data yang akan dihapus tidak ditemukan. Muat ulang riwayat lalu coba lagi.'
        );
      }

      await connection.execute(
        `
          DELETE FROM hasil_radiologi
          WHERE no_rawat = ?
            AND tgl_periksa = ?
            AND jam = ?
        `,
        [noRawat, tanggal, jam]
      );

      await connection.commit();

      return {
        success: true,
        message: `${judul} berhasil dihapus`,
        data: {
          no_rawat: noRawat,
          tgl_periksa: tanggal,
          jam,
          judul
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default EchoCardiographyService;
