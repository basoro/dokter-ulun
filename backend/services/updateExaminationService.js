import { executeQuery } from '../config/database.js';

export const updateExaminationData = async (examinationData) => {
  const {
    no_rawat,
    status_rawat,
    original_date,
    original_time,
    tgl_perawatan,
    jam_rawat,
    suhu,
    tensi,
    nadi,
    respirasi,
    tinggi,
    berat,
    spo2,
    gcs,
    kesadaran,
    keluhan,
    pemeriksaan,
    rtl,
    penilaian,
    instruksi,
    evaluasi,
    nip
  } = examinationData;

  try {
    let query;
    let params;
    let tableName;

    if (status_rawat === 'Ralan') {
      // Update pemeriksaan_ralan table (no spo2, instruksi, evaluasi, kesadaran columns)
      tableName = 'pemeriksaan_ralan';
      query = `
        UPDATE pemeriksaan_ralan SET 
          tgl_perawatan = ?,
          jam_rawat = ?,
          suhu_tubuh = ?,
          tensi = ?,
          nadi = ?,
          respirasi = ?,
          tinggi = ?,
          berat = ?,
          gcs = ?,
          keluhan = ?,
          pemeriksaan = ?,
          rtl = ?,
          penilaian = ?,
          nip = ?
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
      `;
      params = [
        tgl_perawatan || null, jam_rawat || null, suhu || null, tensi || null, nadi || null, respirasi || null,
        tinggi || null, berat || null, gcs || null, keluhan || null, pemeriksaan || null, rtl || null, penilaian || null, nip || null,
        no_rawat, original_date, original_time
      ];
    } else {
      // Update pemeriksaan_ranap table
      tableName = 'pemeriksaan_ranap';
      query = `
        UPDATE pemeriksaan_ranap SET 
          tgl_perawatan = ?,
          jam_rawat = ?,
          suhu_tubuh = ?,
          tensi = ?,
          nadi = ?,
          respirasi = ?,
          tinggi = ?,
          berat = ?,
          spo2 = ?,
          gcs = ?,
          kesadaran = ?,
          keluhan = ?,
          pemeriksaan = ?,
          rtl = ?,
          penilaian = ?,
          instruksi = ?,
          evaluasi = ?,
          nip = ?
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
      `;
      params = [
        tgl_perawatan || null, jam_rawat || null, suhu || null, tensi || null, nadi || null, respirasi || null,
        tinggi || null, berat || null, spo2 || null, gcs || null, kesadaran || null, keluhan || null, pemeriksaan || null, rtl || null, penilaian || null, instruksi || null, evaluasi || null, nip || null,
        no_rawat, original_date, original_time
      ];
    }

    console.log(`🔄 Updating ${tableName} for no_rawat: ${no_rawat}`);
    
    const result = await executeQuery(query, params);
    
    if (result.affectedRows === 0) {
      throw new Error(`No examination record found to update in ${tableName}`);
    }

    console.log(`✅ Successfully updated ${result.affectedRows} record(s) in ${tableName}`);
    
    return {
      affectedRows: result.affectedRows,
      table: tableName,
      no_rawat,
      tgl_perawatan,
      jam_rawat
    };

  } catch (error) {
    console.error('❌ Error in updateExaminationData:', error);
    throw error;
  }
};