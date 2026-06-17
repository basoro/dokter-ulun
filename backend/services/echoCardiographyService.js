import { getConnection } from '../config/database.js';

class EchoCardiographyService {
  static ECHO_TITLE = 'Echocardiography';
  static RANAP_TINDAKAN_KODE = 'RI98227';

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

  static async list(noRawat) {
    const normalizedNoRawat = this.normalizeNoRawat(noRawat);
    const connection = await getConnection();

    try {
      const [rows] = await connection.execute(
        `
          SELECT
            hr.no_rawat,
            hr.tgl_periksa,
            hr.jam,
            hr.hasil,
            skr.saran,
            skr.kesan
          FROM hasil_radiologi hr
          INNER JOIN saran_kesan_rad skr
            ON hr.no_rawat = skr.no_rawat
            AND hr.tgl_periksa = skr.tgl_periksa
            AND hr.jam = skr.jam
          WHERE hr.no_rawat = ?
            AND skr.judul = ?
          ORDER BY hr.tgl_periksa DESC, hr.jam DESC
        `,
        [normalizedNoRawat, this.ECHO_TITLE]
      );

      return rows.map((row) => ({
        no_rawat: row.no_rawat || '',
        tgl_periksa: row.tgl_periksa || '',
        jam: row.jam || '',
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
    const editTanggal = this.normalizeText(payload.tgl_periksa);
    const editJam = this.normalizeText(payload.jam);

    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      let tanggal = editTanggal;
      let jam = editJam;

      if (mode === 'edit') {
        if (!tanggal || !jam) {
          throw new Error('Data echo yang akan diedit tidak valid');
        }

        await connection.execute(
          `
            UPDATE saran_kesan_rad
            SET saran = ?, kesan = ?
            WHERE no_rawat = ?
              AND tgl_periksa = ?
              AND jam = ?
              AND judul = ?
          `,
          [saran, kesan, noRawat, tanggal, jam, this.ECHO_TITLE]
        );

        await connection.execute(
          `
            UPDATE hasil_radiologi
            SET hasil = ?
            WHERE no_rawat = ?
              AND tgl_periksa = ?
              AND jam = ?
          `,
          [hasil, noRawat, tanggal, jam]
        );
      } else {
        const [timestampRows] = await connection.execute(
          `
            SELECT
              DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS tanggal,
              TIME_FORMAT(CURTIME(), '%H:%i:%s') AS jam
          `
        );

        tanggal = timestampRows?.[0]?.tanggal || '';
        jam = timestampRows?.[0]?.jam || '';

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
          [noRawat, tanggal, jam, this.ECHO_TITLE, saran, kesan]
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
          ? 'Echocardiography berhasil diperbarui'
          : 'Echocardiography berhasil disimpan',
        data: {
          no_rawat: noRawat,
          tgl_periksa: tanggal,
          jam
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
