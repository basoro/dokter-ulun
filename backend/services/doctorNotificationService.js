import { executeQuery } from '../config/database.js';

const ZERO_DATE = '0000-00-00';
const ZERO_TIME = '00:00:00';

class DoctorNotificationService {
  normalizeDoctorId(value) {
    return String(value || '').trim();
  }

  normalizeDate(dateValue) {
    if (dateValue instanceof Date) {
      if (Number.isNaN(dateValue.getTime())) {
        return '';
      }

      const year = dateValue.getUTCFullYear();
      const month = String(dateValue.getUTCMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    const normalized = String(dateValue || '').trim();
    if (!normalized || normalized === ZERO_DATE) {
      return '';
    }

    return normalized;
  }

  normalizeTime(timeValue) {
    if (timeValue instanceof Date) {
      if (Number.isNaN(timeValue.getTime())) {
        return '';
      }

      const hours = String(timeValue.getUTCHours()).padStart(2, '0');
      const minutes = String(timeValue.getUTCMinutes()).padStart(2, '0');
      const seconds = String(timeValue.getUTCSeconds()).padStart(2, '0');
      const normalizedDateTime = `${hours}:${minutes}:${seconds}`;
      return normalizedDateTime === ZERO_TIME ? '' : normalizedDateTime;
    }

    const normalized = String(timeValue || '').trim();
    if (!normalized || normalized === ZERO_TIME) {
      return '';
    }

    return normalized;
  }

  buildDateTime(dateValue, timeValue) {
    const date = this.normalizeDate(dateValue);
    const time = this.normalizeTime(timeValue);

    if (!date) {
      return '';
    }

    return `${date} ${time || '00:00:00'}`;
  }

  getLabOrRadiologyStatus(sampleDate, sampleTime, resultDate, resultTime) {
    const normalizedResultDate = this.normalizeDate(resultDate);
    const normalizedResultTime = this.normalizeTime(resultTime);

    if (normalizedResultDate || normalizedResultTime) {
      return 'selesai';
    }

    const normalizedSampleDate = this.normalizeDate(sampleDate);
    const normalizedSampleTime = this.normalizeTime(sampleTime);

    if (normalizedSampleDate || normalizedSampleTime) {
      return 'diproses';
    }

    return 'menunggu';
  }

  mapPrescriptionStatus(serviceStatus) {
    return String(serviceStatus || '').trim().toLowerCase() === 'sudah terlayani'
      ? 'selesai'
      : 'menunggu';
  }

  async getPrescriptionNotifications(doctorId, limit) {
    const rows = await executeQuery(
      `
        SELECT
          ro.no_resep AS reference_id,
          ro.no_rawat,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          ro.tgl_peresepan,
          ro.jam_peresepan,
          ro.tgl_perawatan,
          ro.jam,
          IF(ro.jam_peresepan = ro.jam, 'Belum Terlayani', 'Sudah Terlayani') AS service_status
        FROM resep_obat ro
        LEFT JOIN reg_periksa rp ON rp.no_rawat = ro.no_rawat
        LEFT JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        LEFT JOIN dokter d ON d.kd_dokter = ro.kd_dokter
        WHERE ro.kd_dokter = ?
        ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC
        LIMIT ?
      `,
      [doctorId, limit]
    );

    return rows.map((row) => {
      const serviceStatus = String(row.service_status || '').trim();
      const status = this.mapPrescriptionStatus(serviceStatus);
      return {
        id: `prescription-${row.reference_id}`,
        type: 'prescription',
        title: 'Proses peresepan',
        status,
        status_label: serviceStatus || 'Belum Terlayani',
        description: serviceStatus === 'Sudah Terlayani'
          ? 'Resep sudah terlayani oleh farmasi'
          : 'Resep menunggu pelayanan farmasi',
        reference_id: String(row.reference_id || '').trim(),
        no_rawat: String(row.no_rawat || '').trim(),
        no_rkm_medis: String(row.no_rkm_medis || '').trim(),
        patient_name: String(row.nm_pasien || '').trim(),
        doctor_name: String(row.nm_dokter || '').trim(),
        created_at: this.buildDateTime(row.tgl_peresepan, row.jam_peresepan),
        processed_at: this.buildDateTime(row.tgl_perawatan, row.jam),
      };
    });
  }

  async getLaboratoryNotifications(doctorId, limit) {
    const rows = await executeQuery(
      `
        SELECT
          pl.noorder AS reference_id,
          pl.no_rawat,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          pl.tgl_permintaan,
          pl.jam_permintaan,
          pl.tgl_sampel,
          pl.jam_sampel,
          pl.tgl_hasil,
          pl.jam_hasil,
          GROUP_CONCAT(DISTINCT jpl.nm_perawatan ORDER BY jpl.nm_perawatan SEPARATOR ', ') AS examination_names
        FROM permintaan_lab pl
        LEFT JOIN reg_periksa rp ON rp.no_rawat = pl.no_rawat
        LEFT JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        LEFT JOIN dokter d ON d.kd_dokter = pl.dokter_perujuk
        LEFT JOIN permintaan_pemeriksaan_lab ppl ON ppl.noorder = pl.noorder
        LEFT JOIN jns_perawatan_lab jpl ON jpl.kd_jenis_prw = ppl.kd_jenis_prw
        WHERE pl.dokter_perujuk = ?
        GROUP BY
          pl.noorder,
          pl.no_rawat,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          pl.tgl_permintaan,
          pl.jam_permintaan,
          pl.tgl_sampel,
          pl.jam_sampel,
          pl.tgl_hasil,
          pl.jam_hasil
        ORDER BY pl.tgl_permintaan DESC, pl.jam_permintaan DESC
        LIMIT ?
      `,
      [doctorId, limit]
    );

    return rows.map((row) => {
      const status = this.getLabOrRadiologyStatus(
        row.tgl_sampel,
        row.jam_sampel,
        row.tgl_hasil,
        row.jam_hasil
      );

      const statusLabelMap = {
        menunggu: 'Menunggu Sampel',
        diproses: 'Diproses Lab',
        selesai: 'Hasil Tersedia'
      };

      return {
        id: `laboratory-${row.reference_id}`,
        type: 'laboratory',
        title: 'Pemeriksaan laboratorium',
        status,
        status_label: statusLabelMap[status],
        description: String(row.examination_names || '').trim() || 'Permintaan laboratorium',
        reference_id: String(row.reference_id || '').trim(),
        no_rawat: String(row.no_rawat || '').trim(),
        no_rkm_medis: String(row.no_rkm_medis || '').trim(),
        patient_name: String(row.nm_pasien || '').trim(),
        doctor_name: String(row.nm_dokter || '').trim(),
        created_at: this.buildDateTime(row.tgl_permintaan, row.jam_permintaan),
        sampled_at: this.buildDateTime(row.tgl_sampel, row.jam_sampel),
        result_at: this.buildDateTime(row.tgl_hasil, row.jam_hasil),
      };
    });
  }

  async getRadiologyNotifications(doctorId, limit) {
    const rows = await executeQuery(
      `
        SELECT
          pr.noorder AS reference_id,
          pr.no_rawat,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          pr.tgl_permintaan,
          pr.jam_permintaan,
          pr.tgl_sampel,
          pr.jam_sampel,
          pr.tgl_hasil,
          pr.jam_hasil,
          GROUP_CONCAT(DISTINCT jpr.nm_perawatan ORDER BY jpr.nm_perawatan SEPARATOR ', ') AS examination_names
        FROM permintaan_radiologi pr
        LEFT JOIN reg_periksa rp ON rp.no_rawat = pr.no_rawat
        LEFT JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        LEFT JOIN dokter d ON d.kd_dokter = pr.dokter_perujuk
        LEFT JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = pr.noorder
        LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = ppr.kd_jenis_prw
        WHERE pr.dokter_perujuk = ?
        GROUP BY
          pr.noorder,
          pr.no_rawat,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          pr.tgl_permintaan,
          pr.jam_permintaan,
          pr.tgl_sampel,
          pr.jam_sampel,
          pr.tgl_hasil,
          pr.jam_hasil
        ORDER BY pr.tgl_permintaan DESC, pr.jam_permintaan DESC
        LIMIT ?
      `,
      [doctorId, limit]
    );

    return rows.map((row) => {
      const status = this.getLabOrRadiologyStatus(
        row.tgl_sampel,
        row.jam_sampel,
        row.tgl_hasil,
        row.jam_hasil
      );

      const statusLabelMap = {
        menunggu: 'Menunggu Pemeriksaan',
        diproses: 'Diproses Radiologi',
        selesai: 'Hasil Tersedia'
      };

      return {
        id: `radiology-${row.reference_id}`,
        type: 'radiology',
        title: 'Pemeriksaan radiologi',
        status,
        status_label: statusLabelMap[status],
        description: String(row.examination_names || '').trim() || 'Permintaan radiologi',
        reference_id: String(row.reference_id || '').trim(),
        no_rawat: String(row.no_rawat || '').trim(),
        no_rkm_medis: String(row.no_rkm_medis || '').trim(),
        patient_name: String(row.nm_pasien || '').trim(),
        doctor_name: String(row.nm_dokter || '').trim(),
        created_at: this.buildDateTime(row.tgl_permintaan, row.jam_permintaan),
        sampled_at: this.buildDateTime(row.tgl_sampel, row.jam_sampel),
        result_at: this.buildDateTime(row.tgl_hasil, row.jam_hasil),
      };
    });
  }

  async getLaboratoryNotificationResult(referenceId) {
    const normalizedReferenceId = String(referenceId || '').trim();
    if (!normalizedReferenceId) {
      throw new Error('referenceId is required');
    }

    const requestRows = await executeQuery(
      `
        SELECT
          pl.noorder AS reference_id,
          pl.no_rawat,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          pl.tgl_permintaan,
          pl.jam_permintaan,
          pl.tgl_sampel,
          pl.jam_sampel,
          pl.tgl_hasil,
          pl.jam_hasil
        FROM permintaan_lab pl
        LEFT JOIN reg_periksa rp ON rp.no_rawat = pl.no_rawat
        LEFT JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        LEFT JOIN dokter d ON d.kd_dokter = pl.dokter_perujuk
        WHERE pl.noorder = ?
        LIMIT 1
      `,
      [normalizedReferenceId]
    );

    const request = requestRows?.[0];
    if (!request) {
      throw new Error('Data notifikasi laboratorium tidak ditemukan');
    }

    const resultRows = await executeQuery(
      `
        SELECT
          pl.noorder AS reference_id,
          pl.no_rawat,
          periksa.tgl_periksa,
          periksa.jam,
          jpl.nm_perawatan,
          tl.Pemeriksaan AS pemeriksaan,
          dpl.nilai,
          dpl.nilai_rujukan,
          dpl.keterangan
        FROM permintaan_lab pl
        INNER JOIN permintaan_pemeriksaan_lab ppl ON ppl.noorder = pl.noorder
        INNER JOIN periksa_lab periksa
          ON periksa.no_rawat = pl.no_rawat
         AND periksa.kd_jenis_prw = ppl.kd_jenis_prw
         AND periksa.tgl_periksa = pl.tgl_hasil
         AND periksa.jam = pl.jam_hasil
        LEFT JOIN jns_perawatan_lab jpl ON jpl.kd_jenis_prw = periksa.kd_jenis_prw
        LEFT JOIN detail_periksa_lab dpl
          ON dpl.no_rawat = periksa.no_rawat
         AND dpl.kd_jenis_prw = periksa.kd_jenis_prw
         AND dpl.tgl_periksa = periksa.tgl_periksa
         AND dpl.jam = periksa.jam
        LEFT JOIN template_laboratorium tl ON tl.id_template = dpl.id_template
        WHERE pl.noorder = ?
        ORDER BY periksa.tgl_periksa DESC, periksa.jam DESC, jpl.nm_perawatan ASC, tl.Pemeriksaan ASC
      `,
      [normalizedReferenceId]
    );

    const groupedByDate = new Map();

    resultRows.forEach((row) => {
      const dateKey = this.buildDateTime(
        row.tgl_periksa || request.tgl_hasil,
        row.jam || request.jam_hasil
      ) || this.buildDateTime(request.tgl_hasil, request.jam_hasil);
      if (!groupedByDate.has(dateKey)) {
        groupedByDate.set(dateKey, {
          reference_id: normalizedReferenceId,
          tanggal: dateKey,
          no_rawat: String(row.no_rawat || request.no_rawat || '').trim(),
          pemeriksaan: []
        });
      }

      groupedByDate.get(dateKey).pemeriksaan.push({
        nama: String(row.nm_perawatan || '').trim(),
        pemeriksaan: String(row.pemeriksaan || '').trim(),
        hasil: String(row.nilai || '').trim(),
        rujukan: String(row.nilai_rujukan || '').trim(),
        keterangan: String(row.keterangan || '').trim()
      });
    });

    return {
      success: true,
      data: {
        type: 'laboratory',
        reference_id: normalizedReferenceId,
        no_rawat: String(request.no_rawat || '').trim(),
        no_rkm_medis: String(request.no_rkm_medis || '').trim(),
        patient_name: String(request.nm_pasien || '').trim(),
        doctor_name: String(request.nm_dokter || '').trim(),
        created_at: this.buildDateTime(request.tgl_permintaan, request.jam_permintaan),
        sampled_at: this.buildDateTime(request.tgl_sampel, request.jam_sampel),
        result_at: this.buildDateTime(request.tgl_hasil, request.jam_hasil),
        results: Array.from(groupedByDate.values())
      }
    };
  }

  async getRadiologyNotificationResult(referenceId) {
    const normalizedReferenceId = String(referenceId || '').trim();
    if (!normalizedReferenceId) {
      throw new Error('referenceId is required');
    }

    const requestRows = await executeQuery(
      `
        SELECT
          pr.noorder AS reference_id,
          pr.no_rawat,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          pr.tgl_permintaan,
          pr.jam_permintaan,
          pr.tgl_sampel,
          pr.jam_sampel,
          pr.tgl_hasil,
          pr.jam_hasil
        FROM permintaan_radiologi pr
        LEFT JOIN reg_periksa rp ON rp.no_rawat = pr.no_rawat
        LEFT JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        LEFT JOIN dokter d ON d.kd_dokter = pr.dokter_perujuk
        WHERE pr.noorder = ?
        LIMIT 1
      `,
      [normalizedReferenceId]
    );

    const request = requestRows?.[0];
    if (!request) {
      throw new Error('Data notifikasi radiologi tidak ditemukan');
    }

    const resultRows = await executeQuery(
      `
        SELECT
          req.noorder AS reference_id,
          req.no_rawat,
          periksa.tgl_periksa,
          periksa.jam,
          jpr.nm_perawatan,
          hasil.hasil,
          skr.judul,
          skr.saran,
          skr.kesan
        FROM permintaan_radiologi req
        INNER JOIN permintaan_pemeriksaan_radiologi ppr ON ppr.noorder = req.noorder
        INNER JOIN periksa_radiologi periksa
          ON periksa.no_rawat = req.no_rawat
         AND periksa.kd_jenis_prw = ppr.kd_jenis_prw
         AND periksa.tgl_periksa = req.tgl_hasil
         AND periksa.jam = req.jam_hasil
        LEFT JOIN jns_perawatan_radiologi jpr ON jpr.kd_jenis_prw = periksa.kd_jenis_prw
        LEFT JOIN hasil_radiologi hasil
          ON hasil.no_rawat = periksa.no_rawat
         AND hasil.tgl_periksa = periksa.tgl_periksa
         AND hasil.jam = periksa.jam
        LEFT JOIN saran_kesan_rad skr
          ON skr.no_rawat = periksa.no_rawat
         AND skr.tgl_periksa = periksa.tgl_periksa
         AND skr.jam = periksa.jam
        WHERE req.noorder = ?
        ORDER BY periksa.tgl_periksa DESC, periksa.jam DESC, jpr.nm_perawatan ASC
      `,
      [normalizedReferenceId]
    );

    const mappedRows = resultRows.map((row) => ({
      reference_id: normalizedReferenceId,
      tanggal: this.buildDateTime(
        row.tgl_periksa || request.tgl_hasil,
        row.jam || request.jam_hasil
      ) || this.buildDateTime(request.tgl_hasil, request.jam_hasil),
      no_rawat: String(row.no_rawat || request.no_rawat || '').trim(),
      pemeriksaan: String(row.nm_perawatan || row.judul || '').trim(),
      judul: String(row.judul || '').trim(),
      hasil: String(row.hasil || '').trim(),
      saran: String(row.saran || '').trim(),
      kesan: String(row.kesan || '').trim()
    }));

    return {
      success: true,
      data: {
        type: 'radiology',
        reference_id: normalizedReferenceId,
        no_rawat: String(request.no_rawat || '').trim(),
        no_rkm_medis: String(request.no_rkm_medis || '').trim(),
        patient_name: String(request.nm_pasien || '').trim(),
        doctor_name: String(request.nm_dokter || '').trim(),
        created_at: this.buildDateTime(request.tgl_permintaan, request.jam_permintaan),
        sampled_at: this.buildDateTime(request.tgl_sampel, request.jam_sampel),
        result_at: this.buildDateTime(request.tgl_hasil, request.jam_hasil),
        results: mappedRows
      }
    };
  }

  async getNotificationResult(type, referenceId) {
    const normalizedType = String(type || '').trim().toLowerCase();

    if (normalizedType === 'laboratory') {
      return this.getLaboratoryNotificationResult(referenceId);
    }

    if (normalizedType === 'radiology') {
      return this.getRadiologyNotificationResult(referenceId);
    }

    throw new Error('Unsupported notification result type');
  }  async getAutoStopOrderNotifications(doctorId, limit) {
    const rows = await executeQuery(
      `
        SELECT
          aso.id AS reference_id,
          aso.no_rawat,
          aso.tgl_perawatan,
          aso.jam_rawat,
          aso.tgl_berakhir,
          aso.created_by,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter,
          GROUP_CONCAT(DISTINCT COALESCE(NULLIF(TRIM(db.nama_brng), ''), TRIM(aso.kode_barang)) ORDER BY COALESCE(NULLIF(TRIM(db.nama_brng), ''), TRIM(aso.kode_barang)) SEPARATOR ', ') AS item_names
        FROM mlite_auto_stop_order aso
        INNER JOIN reg_periksa rp ON TRIM(rp.no_rawat) = TRIM(aso.no_rawat)
        LEFT JOIN pasien p ON p.no_rkm_medis = rp.no_rkm_medis
        LEFT JOIN dokter d ON d.kd_dokter = rp.kd_dokter
        LEFT JOIN databarang db ON TRIM(db.kode_brng) = TRIM(aso.kode_barang)
        WHERE TRIM(rp.kd_dokter) = TRIM(?)
        GROUP BY
          aso.id,
          aso.no_rawat,
          aso.tgl_perawatan,
          aso.jam_rawat,
          aso.tgl_berakhir,
          aso.created_by,
          rp.no_rkm_medis,
          p.nm_pasien,
          d.nm_dokter
        ORDER BY aso.tgl_perawatan DESC, aso.jam_rawat DESC, aso.id DESC
        LIMIT ?
      `,
      [doctorId, limit]
    );

    return rows.map((row) => {
      const endDateTime = this.buildDateTime(row.tgl_berakhir, null);
      const createdDateTime = this.buildDateTime(row.tgl_perawatan, row.jam_rawat);

      return {
        id: `auto-stop-order-${row.reference_id}`,
        type: 'auto_stop_order',
        title: 'Automatic Stop Order',
        status: 'menunggu',
        status_label: 'Stop Order Otomatis',
        description: String(row.item_names || '').trim() || 'Automatic stop order obat pasien',
        reference_id: String(row.reference_id || '').trim(),
        no_rawat: String(row.no_rawat || '').trim(),
        no_rkm_medis: String(row.no_rkm_medis || '').trim(),
        patient_name: String(row.nm_pasien || '').trim(),
        doctor_name: String(row.nm_dokter || '').trim(),
        created_by: String(row.created_by || '').trim(),
        end_at: endDateTime,
        created_at: createdDateTime
      };
    });
  }

  async getDoctorNotifications(doctorId, limit = 8) {
    const normalizedDoctorId = this.normalizeDoctorId(doctorId);
    if (!normalizedDoctorId) {
      throw new Error('doctorId is required');
    }

    const normalizedLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);

    const [prescriptions, laboratories, radiologies, autoStopOrders] = await Promise.all([
      this.getPrescriptionNotifications(normalizedDoctorId, normalizedLimit),
      this.getLaboratoryNotifications(normalizedDoctorId, normalizedLimit),
      this.getRadiologyNotifications(normalizedDoctorId, normalizedLimit),
      this.getAutoStopOrderNotifications(normalizedDoctorId, normalizedLimit)
    ]);

    const notifications = [...prescriptions, ...laboratories, ...radiologies, ...autoStopOrders]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, normalizedLimit * 3);

    const summary = {
      active: notifications.filter((item) => item.status !== 'selesai').length,
      menunggu: notifications.filter((item) => item.status === 'menunggu').length,
      diproses: notifications.filter((item) => item.status === 'diproses').length,
      selesai: notifications.filter((item) => item.status === 'selesai').length,
      prescription: notifications.filter((item) => item.type === 'prescription' && item.status !== 'selesai').length,
      laboratory: notifications.filter((item) => item.type === 'laboratory' && item.status !== 'selesai').length,
      radiology: notifications.filter((item) => item.type === 'radiology' && item.status !== 'selesai').length,
      auto_stop_order: notifications.filter((item) => item.type === 'auto_stop_order').length
    };

    return {
      success: true,
      summary,
      data: notifications
    };
  }
}

export default new DoctorNotificationService();
