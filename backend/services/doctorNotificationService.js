import { executeQuery } from '../config/database.js';

const ZERO_DATE = '0000-00-00';
const ZERO_TIME = '00:00:00';

class DoctorNotificationService {
  normalizeDoctorId(value) {
    return String(value || '').trim();
  }

  normalizeDate(dateValue) {
    const normalized = String(dateValue || '').trim();
    if (!normalized || normalized === ZERO_DATE) {
      return '';
    }

    return normalized;
  }

  normalizeTime(timeValue) {
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

  async getDoctorNotifications(doctorId, limit = 8) {
    const normalizedDoctorId = this.normalizeDoctorId(doctorId);
    if (!normalizedDoctorId) {
      throw new Error('doctorId is required');
    }

    const normalizedLimit = Math.min(Math.max(Number(limit) || 8, 1), 20);

    const [prescriptions, laboratories, radiologies] = await Promise.all([
      this.getPrescriptionNotifications(normalizedDoctorId, normalizedLimit),
      this.getLaboratoryNotifications(normalizedDoctorId, normalizedLimit),
      this.getRadiologyNotifications(normalizedDoctorId, normalizedLimit)
    ]);

    const notifications = [...prescriptions, ...laboratories, ...radiologies]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, normalizedLimit * 3);

    const summary = {
      active: notifications.filter((item) => item.status !== 'selesai').length,
      menunggu: notifications.filter((item) => item.status === 'menunggu').length,
      diproses: notifications.filter((item) => item.status === 'diproses').length,
      selesai: notifications.filter((item) => item.status === 'selesai').length,
      prescription: notifications.filter((item) => item.type === 'prescription' && item.status !== 'selesai').length,
      laboratory: notifications.filter((item) => item.type === 'laboratory' && item.status !== 'selesai').length,
      radiology: notifications.filter((item) => item.type === 'radiology' && item.status !== 'selesai').length
    };

    return {
      success: true,
      summary,
      data: notifications
    };
  }
}

export default new DoctorNotificationService();
