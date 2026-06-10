import pool from '../config/database.js';

class ProcedureService {
  static padNumber(value) {
    return String(value).padStart(2, '0');
  }

  static formatMysqlDate(date) {
    return [
      date.getFullYear(),
      this.padNumber(date.getMonth() + 1),
      this.padNumber(date.getDate())
    ].join('-');
  }

  static formatMysqlTime(date) {
    return [
      this.padNumber(date.getHours()),
      this.padNumber(date.getMinutes()),
      this.padNumber(date.getSeconds())
    ].join(':');
  }

  static async getRegistration(noRawat, connection) {
    const [rows] = await connection.execute(
      `
        SELECT no_rawat, status_lanjut, kd_dokter, kd_poli, kd_pj
        FROM reg_periksa
        WHERE no_rawat = ?
        LIMIT 1
      `,
      [noRawat]
    );

    if (!rows.length) {
      throw new Error('Data registrasi tidak ditemukan');
    }

    return rows[0];
  }

  static getProcedureConfig(statusLanjut) {
    const isRanap = statusLanjut === 'Ranap';

    return {
      statusRawat: isRanap ? 'Ranap' : 'Ralan',
      procedureTable: isRanap ? 'rawat_inap_dr' : 'rawat_jl_dr',
      referenceTable: isRanap ? 'jns_perawatan_inap' : 'jns_perawatan'
    };
  }

  static normalizeStatusRawat(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();

    if (normalizedValue === 'ranap' || normalizedValue === 'rawat inap') {
      return 'Ranap';
    }

    if (normalizedValue === 'ralan' || normalizedValue === 'rawat jalan') {
      return 'Ralan';
    }

    return null;
  }

  static calculateDoctorProcedureCost(reference) {
    if (reference.total_byrdr !== null && reference.total_byrdr !== undefined) {
      return Number(reference.total_byrdr) || 0;
    }

    return (
      (Number(reference.material) || 0) +
      (Number(reference.bhp) || 0) +
      (Number(reference.tarif_tindakandr) || 0) +
      (Number(reference.kso) || 0) +
      (Number(reference.menejemen) || 0)
    );
  }

  static async executeProcedureSearch(connection, referenceTable, conditions, queryParams, keyword, limit) {
    let orderClause = 'ORDER BY nm_perawatan ASC';
    const effectiveParams = [...queryParams];

    if (keyword) {
      orderClause = `
        ORDER BY
          CASE
            WHEN kd_jenis_prw = ? THEN 0
            WHEN kd_jenis_prw LIKE ? THEN 1
            WHEN nm_perawatan LIKE ? THEN 2
            ELSE 3
          END,
          nm_perawatan ASC
      `;
      effectiveParams.push(keyword, `${keyword}%`, `${keyword}%`);
    }

    effectiveParams.push(limit);

    const [rows] = await connection.execute(
      `
        SELECT
          kd_jenis_prw,
          nm_perawatan,
          COALESCE(material, 0) AS material,
          COALESCE(bhp, 0) AS bhp,
          COALESCE(tarif_tindakandr, 0) AS tarif_tindakandr,
          COALESCE(kso, 0) AS kso,
          COALESCE(menejemen, 0) AS menejemen,
          COALESCE(total_byrdr, 0) AS total_byrdr
        FROM ${referenceTable}
        ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
        ${orderClause}
        LIMIT ?
      `,
      effectiveParams
    );

    return rows;
  }

  static async searchProcedureOptions(noRawat, search = '', limit = 20, statusRawatInput = null) {
    const connection = await pool.getConnection();

    try {
      const registration = await this.getRegistration(noRawat, connection);
      const derivedStatusRawat = this.getProcedureConfig(registration.status_lanjut).statusRawat;
      const statusRawat = this.normalizeStatusRawat(statusRawatInput) || derivedStatusRawat;
      const referenceTable = statusRawat === 'Ranap' ? 'jns_perawatan_inap' : 'jns_perawatan';
      const keyword = search.trim();
      const effectiveLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
      const strictQueryParams = [];
      const strictConditions = [`status = '1'`];

      if (registration.kd_pj) {
        strictConditions.push('kd_pj = ?');
        strictQueryParams.push(registration.kd_pj);
      }

      if (statusRawat === 'Ralan' && registration.kd_poli) {
        strictConditions.push('kd_poli = ?');
        strictQueryParams.push(registration.kd_poli);
      }

      if (keyword) {
        strictConditions.push('(kd_jenis_prw LIKE ? OR nm_perawatan LIKE ?)');
        strictQueryParams.push(`%${keyword}%`, `%${keyword}%`);
      }

      let rows = await this.executeProcedureSearch(
        connection,
        referenceTable,
        strictConditions,
        strictQueryParams,
        keyword,
        effectiveLimit
      );

      if (!rows.length) {
        const fallbackConditions = [];
        const fallbackQueryParams = [];

        if (keyword) {
          fallbackConditions.push('(kd_jenis_prw LIKE ? OR nm_perawatan LIKE ?)');
          fallbackQueryParams.push(`%${keyword}%`, `%${keyword}%`);
        }

        rows = await this.executeProcedureSearch(
          connection,
          referenceTable,
          fallbackConditions,
          fallbackQueryParams,
          keyword,
          effectiveLimit
        );
      }

      return {
        success: true,
        status_rawat: statusRawat,
        data: rows.map((row) => ({
          kode: row.kd_jenis_prw,
          nama: row.nm_perawatan,
          biaya_rawat: this.calculateDoctorProcedureCost(row)
        }))
      };
    } finally {
      connection.release();
    }
  }

  static async saveProcedures(payload) {
    const { no_rawat: noRawat, username, procedures, status_rawat: statusRawatInput } = payload;

    if (!noRawat) {
      throw new Error('no_rawat wajib diisi');
    }

    if (!Array.isArray(procedures) || procedures.length === 0) {
      throw new Error('Data tindakan wajib diisi');
    }

    const normalizedProcedures = procedures
      .map((procedure) => ({
        kode: String(procedure.kode || '').trim(),
        nama: String(procedure.nama || '').trim(),
        hasil: String(procedure.hasil || '').trim()
      }))
      .filter((procedure) => procedure.kode && procedure.nama);

    if (!normalizedProcedures.length) {
      throw new Error('Tidak ada tindakan valid untuk disimpan');
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const registration = await this.getRegistration(noRawat, connection);
      const derivedStatusRawat = this.getProcedureConfig(registration.status_lanjut).statusRawat;
      const statusRawat = this.normalizeStatusRawat(statusRawatInput) || derivedStatusRawat;
      const procedureTable = statusRawat === 'Ranap' ? 'rawat_inap_dr' : 'rawat_jl_dr';
      const referenceTable = statusRawat === 'Ranap' ? 'jns_perawatan_inap' : 'jns_perawatan';

      const sessionUsername = String(username || '').trim();

      if (!sessionUsername) {
        throw new Error('username user login tidak ditemukan');
      }

      const uniqueCodes = [...new Set(normalizedProcedures.map((procedure) => procedure.kode))];
      const placeholders = uniqueCodes.map(() => '?').join(', ');
      const [referenceRows] = await connection.execute(
        `
          SELECT
            kd_jenis_prw,
            nm_perawatan,
            COALESCE(material, 0) AS material,
            COALESCE(bhp, 0) AS bhp,
            COALESCE(tarif_tindakandr, 0) AS tarif_tindakandr,
            COALESCE(kso, 0) AS kso,
            COALESCE(menejemen, 0) AS menejemen,
            COALESCE(total_byrdr, 0) AS total_byrdr
          FROM ${referenceTable}
          WHERE kd_jenis_prw IN (${placeholders})
        `,
        uniqueCodes
      );

      const referencesByCode = new Map(
        referenceRows.map((row) => [row.kd_jenis_prw, row])
      );

      const baseDate = new Date();
      let insertedCount = 0;

      for (let index = 0; index < normalizedProcedures.length; index += 1) {
        const procedure = normalizedProcedures[index];
        const reference = referencesByCode.get(procedure.kode);

        if (!reference) {
          throw new Error(`Referensi tindakan tidak ditemukan untuk kode ${procedure.kode}`);
        }

        const actionDate = new Date(baseDate.getTime() + index * 1000);
        const tglPerawatan = this.formatMysqlDate(actionDate);
        const jamRawat = this.formatMysqlTime(actionDate);
        const biayaRawat = this.calculateDoctorProcedureCost(reference);
        const values = [
          noRawat,
          reference.kd_jenis_prw,
          sessionUsername,
          tglPerawatan,
          jamRawat,
          Number(reference.material) || 0,
          Number(reference.bhp) || 0,
          Number(reference.tarif_tindakandr) || 0,
          Number(reference.kso) || 0,
          Number(reference.menejemen) || 0,
          biayaRawat
        ];

        if (statusRawat === 'Ralan') {
          await connection.execute(
            `
              INSERT INTO rawat_jl_dr (
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
                biaya_rawat,
                stts_bayar
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Belum')
            `,
            values
          );
        } else {
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
            values
          );
        }

        insertedCount += 1;
      }

      await connection.commit();

      return {
        success: true,
        message: 'Tindakan berhasil disimpan',
        table: procedureTable,
        status_rawat: statusRawat,
        data: {
          no_rawat: noRawat,
          inserted: insertedCount
        }
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteProcedure(payload) {
    const {
      no_rawat: noRawat,
      status_rawat: statusRawatInput,
      kd_jenis_prw: kdJenisPrw,
      tgl_perawatan: tglPerawatan,
      jam_rawat: jamRawat,
      record_type: recordType,
      kd_dokter: kdDokter,
      nip,
      username
    } = payload;

    if (!noRawat || !kdJenisPrw || !tglPerawatan || !jamRawat || !recordType) {
      throw new Error('no_rawat, kd_jenis_prw, tgl_perawatan, jam_rawat, dan record_type wajib diisi');
    }

    const normalizedRecordType = String(recordType).trim().toLowerCase();

    if (!['dr', 'pr', 'drpr'].includes(normalizedRecordType)) {
      throw new Error('record_type tindakan tidak valid');
    }

    const connection = await pool.getConnection();

    try {
      const registration = await this.getRegistration(noRawat, connection);
      const derivedStatusRawat = this.getProcedureConfig(registration.status_lanjut).statusRawat;
      const statusRawat = String(statusRawatInput || derivedStatusRawat).trim();
      const baseTable = statusRawat === 'Ranap' ? 'rawat_inap' : 'rawat_jl';
      const procedureTable = `${baseTable}_${normalizedRecordType}`;
      const normalizedUsername = String(username || '').trim();
      const conditions = [
        'no_rawat = ?',
        'kd_jenis_prw = ?',
        'tgl_perawatan = ?',
        'jam_rawat = ?'
      ];
      const values = [noRawat, kdJenisPrw, tglPerawatan, jamRawat];

      if (normalizedRecordType === 'dr' || normalizedRecordType === 'drpr') {
        const normalizedKdDokter = String(kdDokter || '').trim();
        if (normalizedKdDokter) {
          conditions.push('kd_dokter = ?');
          values.push(normalizedKdDokter);
        }
      }

      if (normalizedRecordType === 'pr' || normalizedRecordType === 'drpr') {
        const normalizedNip = String(nip || '').trim();
        if (normalizedNip) {
          conditions.push('nip = ?');
          values.push(normalizedNip);
        }
      }

      if (normalizedUsername) {
        const ownershipFields = [];

        if (normalizedRecordType === 'dr' || normalizedRecordType === 'drpr') {
          ownershipFields.push('kd_dokter');
        }

        if (normalizedRecordType === 'pr' || normalizedRecordType === 'drpr') {
          ownershipFields.push('nip');
        }

        const [ownershipRows] = await connection.execute(
          `
            SELECT ${ownershipFields.join(', ')}
            FROM ${procedureTable}
            WHERE ${conditions.join(' AND ')}
            LIMIT 1
          `,
          values
        );

        if (!ownershipRows.length) {
          throw new Error('Data tindakan tidak ditemukan atau sudah dihapus');
        }

        const owner = ownershipRows[0];
        const isOwner = [
          String(owner.kd_dokter || '').trim(),
          String(owner.nip || '').trim()
        ].some((value) => value && value === normalizedUsername);

        if (!isOwner) {
          throw new Error('Anda tidak berhak menghapus data tindakan ini');
        }
      }

      const [result] = await connection.execute(
        `
          DELETE FROM ${procedureTable}
          WHERE ${conditions.join(' AND ')}
          LIMIT 1
        `,
        values
      );

      if (result.affectedRows === 0) {
        throw new Error('Data tindakan tidak ditemukan atau sudah dihapus');
      }

      return {
        success: true,
        message: 'Tindakan berhasil dihapus',
        table: procedureTable,
        status_rawat: statusRawat,
        affectedRows: result.affectedRows
      };
    } finally {
      connection.release();
    }
  }
}

export default ProcedureService;
