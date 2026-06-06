import db from '../config/database.js';

class ClinicalPathwayService {
  async getPatientData(no_rkm_medis, no_rawat) {
    try {
      console.log('=== Clinical Pathway Service - Get Patient Data ===');
      console.log('No RM:', no_rkm_medis);
      console.log('No Rawat:', no_rawat);

      // Query untuk mendapatkan data pasien dari registrasi
      const patientQuery = `
        SELECT 
          p.no_rkm_medis,
          p.nm_pasien,
          p.jk,
          p.tgl_lahir,
          p.alamat,
          p.no_tlp,
          r.no_rawat,
          r.tgl_registrasi,
          r.jam_reg,
          r.kd_dokter,
          d.nm_dokter,
          r.kd_poli,
          po.nm_poli,
          r.no_reg,
          r.kd_pj,
          pj.png_jawab,
          r.almt_pj,
          r.hubunganpj,
          r.biaya_reg,
          r.stts_daftar,
          r.status_lanjut,
          TIMESTAMPDIFF(YEAR, p.tgl_lahir, CURDATE()) as umur
        FROM pasien p
        LEFT JOIN reg_periksa r ON p.no_rkm_medis = r.no_rkm_medis
        LEFT JOIN dokter d ON r.kd_dokter = d.kd_dokter
        LEFT JOIN poliklinik po ON r.kd_poli = po.kd_poli
        LEFT JOIN penjab pj ON r.kd_pj = pj.kd_pj
        WHERE p.no_rkm_medis = ? AND r.no_rawat = ?
        LIMIT 1
      `;

      const [patientRows] = await db.execute(patientQuery, [no_rkm_medis, no_rawat]);
      
      if (patientRows.length === 0) {
        return {
          success: false,
          message: 'Data pasien tidak ditemukan',
          data: null
        };
      }

      const patient = patientRows[0];

      // // Query untuk mendapatkan diagnosis
      // const diagnosisQuery = `
      //   SELECT 
      //     pd.kd_penyakit,
      //     p.nm_penyakit,
      //     pd.status,
      //     pd.prioritas,
      //     pd.status as diagnosis_status
      //   FROM penyakit_pasien pd
      //   LEFT JOIN penyakit p ON pd.kd_penyakit = p.kd_penyakit
      //   WHERE pd.no_rawat = ?
      //   ORDER BY pd.prioritas ASC, pd.status DESC
      // `;

      // const [diagnosisRows] = await db.execute(diagnosisQuery, [no_rawat]);

      // // Query untuk mendapatkan pemeriksaan/tindakan
      // const examinationQuery = `
      //   SELECT 
      //     pr.tgl_perawatan,
      //     pr.jam_rawat,
      //     pr.suhu_tubuh,
      //     pr.tensi,
      //     pr.nadi,
      //     pr.respirasi,
      //     pr.tinggi,
      //     pr.berat,
      //     pr.spo2,
      //     pr.gcs,
      //     pr.kesadaran,
      //     pr.keluhan,
      //     pr.pemeriksaan,
      //     pr.rtl,
      //     pr.penilaian,
      //     pr.instruksi,
      //     pr.evaluasi,
      //     d.nm_dokter,
      //     p.nm_perawat
      //   FROM pemeriksaan_ralan pr
      //   LEFT JOIN dokter d ON pr.kd_dokter = d.kd_dokter
      //   LEFT JOIN perawat p ON pr.nip = p.nip
      //   WHERE pr.no_rawat = ?
      //   ORDER BY pr.tgl_perawatan DESC, pr.jam_rawat DESC
      // `;

      // const [examinationRows] = await db.execute(examinationQuery, [no_rawat]);

      // // Query untuk mendapatkan data rawat inap jika ada
      // const inpatientQuery = `
      //   SELECT 
      //     ki.no_rawat,
      //     ki.tgl_masuk,
      //     ki.jam_masuk,
      //     ki.tgl_keluar,
      //     ki.jam_keluar,
      //     ki.lama,
      //     ki.ttl_biaya,
      //     ki.stts_pulang,
      //     k.nm_kamar,
      //     b.nm_bangsal,
      //     k.kelas,
      //     k.tarif_kamar
      //   FROM kamar_inap ki
      //   LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      //   LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      //   WHERE ki.no_rawat = ?
      //   ORDER BY ki.tgl_masuk DESC, ki.jam_masuk DESC
      //   LIMIT 1
      // `;

      // const [inpatientRows] = await db.execute(inpatientQuery, [no_rawat]);

      // Format response data
      const responseData = {
        patient_info: {
          no_rkm_medis: patient.no_rkm_medis,
          nm_pasien: patient.nm_pasien,
          jk: patient.jk,
          tgl_lahir: patient.tgl_lahir,
          umur: patient.umur,
          alamat: patient.alamat,
          no_tlp: patient.no_tlp
        },
        // registration_info: {
        //   no_rawat: patient.no_rawat,
        //   tgl_registrasi: patient.tgl_registrasi,
        //   jam_reg: patient.jam_reg,
        //   nm_dokter: patient.nm_dokter,
        //   nm_poli: patient.nm_poli,
        //   png_jawab: patient.png_jawab,
        //   status_lanjut: patient.status_lanjut,
        //   kelas: patient.kelas
        // },
        // diagnoses: diagnosisRows.map(diag => ({
        //   kd_penyakit: diag.kd_penyakit,
        //   nm_penyakit: diag.nm_penyakit,
        //   status: diag.status,
        //   prioritas: diag.prioritas
        // })),
        // examinations: examinationRows.map(exam => ({
        //   tgl_perawatan: exam.tgl_perawatan,
        //   jam_rawat: exam.jam_rawat,
        //   vital_signs: {
        //     suhu_tubuh: exam.suhu_tubuh,
        //     tensi: exam.tensi,
        //     nadi: exam.nadi,
        //     respirasi: exam.respirasi,
        //     spo2: exam.spo2,
        //     tinggi: exam.tinggi,
        //     berat: exam.berat,
        //     gcs: exam.gcs,
        //     kesadaran: exam.kesadaran
        //   },
        //   keluhan: exam.keluhan,
        //   pemeriksaan: exam.pemeriksaan,
        //   penilaian: exam.penilaian,
        //   rtl: exam.rtl,
        //   instruksi: exam.instruksi,
        //   evaluasi: exam.evaluasi,
        //   nm_dokter: exam.nm_dokter,
        //   nm_perawat: exam.nm_perawat
        // })),
        // inpatient_info: inpatientRows.length > 0 ? {
        //   tgl_masuk: inpatientRows[0].tgl_masuk,
        //   jam_masuk: inpatientRows[0].jam_masuk,
        //   tgl_keluar: inpatientRows[0].tgl_keluar,
        //   jam_keluar: inpatientRows[0].jam_keluar,
        //   lama: inpatientRows[0].lama,
        //   nm_kamar: inpatientRows[0].nm_kamar,
        //   nm_bangsal: inpatientRows[0].nm_bangsal,
        //   kelas: inpatientRows[0].kelas,
        //   stts_pulang: inpatientRows[0].stts_pulang
        // } : null
      };

      console.log('Patient data retrieved successfully');
      // console.log('Diagnoses count:', diagnosisRows.length);
      // console.log('Examinations count:', examinationRows.length);
      // console.log('Inpatient data:', inpatientRows.length > 0 ? 'Available' : 'Not available');

      return {
        success: true,
        message: 'Data pasien berhasil diambil',
        data: responseData
      };

    } catch (error) {
      console.error('Error in getPatientData:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat mengambil data pasien',
        error: error.message,
        data: null
      };
    }
  }

  async saveClinicalPathway(pathwayData) {
    try {
      console.log('=== Clinical Pathway Service - Save Clinical Pathway ===');
      console.log('ICD-10 Primary:', JSON.stringify(pathwayData.icd10_primary, null, 2));
      console.log('ICD-10 Secondary:', JSON.stringify(pathwayData.icd10_secondary, null, 2));
      console.log('ICD-9 Primary:', JSON.stringify(pathwayData.icd9_primary, null, 2));
      console.log('ICD-9 Secondary:', JSON.stringify(pathwayData.icd9_secondary, null, 2));
      console.log('Full pathway data:', JSON.stringify(pathwayData, null, 2));

      // Implementasi untuk menyimpan clinical pathway
      // Bisa disesuaikan dengan struktur database yang diinginkan
      
      return {
        success: true,
        message: 'Clinical pathway berhasil disimpan',
        data: pathwayData
      };

    } catch (error) {
      console.error('Error in saveClinicalPathway:', error);
      return {
        success: false,
        message: 'Terjadi kesalahan saat menyimpan clinical pathway',
        error: error.message
      };
    }
  }
}

export { ClinicalPathwayService };