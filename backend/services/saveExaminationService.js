import pool from '../config/database.js';

class SaveExaminationService {
  /**
   * Save examination data to appropriate table based on status_rawat
   * @param {Object} examinationData - Examination data
   * @returns {Promise<Object>} Result object
   */
  static async saveExamination(examinationData) {
    const connection = await pool.getConnection();
    
    try {
      const {
        no_rawat,
        status_rawat,
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

      console.log('Save examination request:', { no_rawat, status_rawat, tgl_perawatan });

      // Validate required fields
      if (!no_rawat || !status_rawat || !tgl_perawatan || !jam_rawat || !nip) {
        throw new Error('Missing required fields: no_rawat, status_rawat, tgl_perawatan, jam_rawat, nip');
      }

      let result;
      let tableName;

      if (status_rawat === 'Ralan') {
        // Insert into pemeriksaan_ralan table
        tableName = 'pemeriksaan_ralan';
        
        const query = `
          INSERT INTO pemeriksaan_ralan (
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi,
            tinggi, berat, gcs, keluhan, pemeriksaan, alergi, imun_ke, rtl, penilaian, nip, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
          ON DUPLICATE KEY UPDATE
          suhu_tubuh = VALUES(suhu_tubuh),
          tensi = VALUES(tensi),
          nadi = VALUES(nadi),
          respirasi = VALUES(respirasi),
          tinggi = VALUES(tinggi),
          berat = VALUES(berat),
          gcs = VALUES(gcs),
          keluhan = VALUES(keluhan),
          pemeriksaan = VALUES(pemeriksaan),
          alergi = VALUES(alergi),
          imun_ke = VALUES(imun_ke),
          rtl = VALUES(rtl),
          penilaian = VALUES(penilaian),
          nip = VALUES(nip),
          created_at = NOW()
        `;
        
        const values = [
          no_rawat, tgl_perawatan, jam_rawat, suhu, tensi, nadi, respirasi,
          tinggi, berat, gcs, keluhan, pemeriksaan, 'tidak ada', '-', rtl, penilaian, nip
        ];
        [result] = await connection.execute(query, values);
        
      } else {
        // Insert into pemeriksaan_ranap table
        tableName = 'pemeriksaan_ranap';

        const [existingRows] = await connection.execute(
          `
            SELECT verified_at
            FROM pemeriksaan_ranap
            WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
            LIMIT 1
          `,
          [no_rawat, tgl_perawatan, jam_rawat]
        );

        if (existingRows.length > 0 && existingRows[0]?.verified_at) {
          throw new Error('SOAP harian rawat inap yang sudah diverifikasi tidak dapat diubah');
        }
        
        const query = `
          INSERT INTO pemeriksaan_ranap (
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi,
            tinggi, berat, spo2, gcs, keluhan, pemeriksaan, alergi, rtl, penilaian, instruksi, evaluasi, nip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          suhu_tubuh = VALUES(suhu_tubuh),
          tensi = VALUES(tensi),
          nadi = VALUES(nadi),
          respirasi = VALUES(respirasi),
          tinggi = VALUES(tinggi),
          berat = VALUES(berat),
          spo2 = VALUES(spo2),
          gcs = VALUES(gcs),
          keluhan = VALUES(keluhan),
          pemeriksaan = VALUES(pemeriksaan),
          alergi = VALUES(alergi),
          rtl = VALUES(rtl),
          penilaian = VALUES(penilaian),
          instruksi = VALUES(instruksi),
          evaluasi = VALUES(evaluasi),
          nip = VALUES(nip)
        `;
        
        const values = [
          no_rawat, tgl_perawatan, jam_rawat, suhu, tensi, nadi, respirasi,
          tinggi, berat, spo2, gcs, keluhan, pemeriksaan, '', rtl, penilaian, instruksi, evaluasi, nip
        ];
        [result] = await connection.execute(query, values);
      }

      console.log(`Examination saved to ${tableName}:`, {
        affectedRows: result.affectedRows,
        insertId: result.insertId
      });

      return {
        success: true,
        message: 'Examination saved successfully',
        table: tableName,
        data: {
          no_rawat,
          tgl_perawatan,
          jam_rawat,
          affectedRows: result.affectedRows,
          action: result.affectedRows === 1 ? 'created' : 'updated'
        }
      };

    } catch (error) {
      console.error('Error saving examination:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get examination data by no_rawat and date
   * @param {string} no_rawat - Patient admission number
   * @param {string} tgl_perawatan - Treatment date
   * @param {string} status_rawat - Treatment status (Ralan/Ranap)
   * @returns {Promise<Object>} Examination data
   */
  static async getExamination(no_rawat, tgl_perawatan, status_rawat) {
    const connection = await pool.getConnection();
    
    try {
      const tableName = status_rawat === 'Ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
      
      let query;
      if (status_rawat === 'Ralan') {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, gcs, keluhan, pemeriksaan, rtl, penilaian, nip
          FROM pemeriksaan_ralan 
          WHERE no_rawat = ? AND tgl_perawatan = ?
          ORDER BY jam_rawat DESC
        `;
      } else {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, spo2, gcs, NULL as kesadaran, keluhan, pemeriksaan, rtl, penilaian, instruksi, evaluasi, nip
          FROM pemeriksaan_ranap 
          WHERE no_rawat = ? AND tgl_perawatan = ?
          ORDER BY jam_rawat DESC
        `;
      }
      
      const [rows] = await connection.execute(query, [no_rawat, tgl_perawatan]);
      
      return {
        success: true,
        data: rows,
        table: tableName
      };
      
    } catch (error) {
      console.error('Error getting examination:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Delete examination data
   * @param {string} no_rawat - Patient admission number
   * @param {string} tgl_perawatan - Treatment date
   * @param {string} jam_rawat - Treatment time
   * @param {string} status_rawat - Treatment status (Ralan/Ranap)
   * @returns {Promise<Object>} Result object
   */
  static async deleteExamination(no_rawat, tgl_perawatan, jam_rawat, status_rawat) {
    const connection = await pool.getConnection();
    
    try {
      const tableName = status_rawat === 'Ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
      
      const query = `
        DELETE FROM ${tableName} 
        WHERE no_rawat = ? AND tgl_perawatan = ? AND jam_rawat = ?
      `;
      
      const [result] = await connection.execute(query, [no_rawat, tgl_perawatan, jam_rawat]);
      
      if (result.affectedRows === 0) {
        throw new Error('Examination not found');
      }
      
      return {
        success: true,
        message: 'Examination deleted successfully',
        table: tableName,
        affectedRows: result.affectedRows
      };
      
    } catch (error) {
      console.error('Error deleting examination:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Get examination history for a patient
   * @param {string} no_rawat - Patient admission number
   * @param {string} status_rawat - Treatment status (Ralan/Ranap)
   * @param {number} limit - Number of records to return
   * @returns {Promise<Object>} Examination history
   */
  static async getExaminationHistory(no_rawat, status_rawat, limit = 10) {
    const connection = await pool.getConnection();
    
    try {
      const tableName = status_rawat === 'Ralan' ? 'pemeriksaan_ralan' : 'pemeriksaan_ranap';
      
      let query;
      if (status_rawat === 'Ralan') {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, gcs, keluhan, pemeriksaan, rtl, penilaian, nip
          FROM pemeriksaan_ralan 
          WHERE no_rawat = ?
          ORDER BY tgl_perawatan DESC, jam_rawat DESC
          LIMIT ?
        `;
      } else {
        query = `
          SELECT 
            no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh as suhu, tensi, nadi, respirasi,
            tinggi, berat, spo2, gcs, NULL as kesadaran, keluhan, pemeriksaan, rtl, penilaian, instruksi, evaluasi, nip
          FROM pemeriksaan_ranap 
          WHERE no_rawat = ?
          ORDER BY tgl_perawatan DESC, jam_rawat DESC
          LIMIT ?
        `;
      }
      
      const [rows] = await connection.execute(query, [no_rawat, limit]);
      
      return {
        success: true,
        data: rows,
        table: tableName,
        count: rows.length
      };
      
    } catch (error) {
      console.error('Error getting examination history:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Simpan catatan Konsul Terapi ke pemeriksaan_ralan.
   * Hanya no_rawat, rtl (catatan), penilaian ('Konsul Terapi'), nip, dan waktu yang diisi;
   * kolom lain diisi '-'.
   */
  static async saveKonsulTerapi(payload = {}) {
    const noRawat = String(payload.no_rawat || '').trim();
    const catatan = String(payload.catatan ?? payload.rtl ?? '').trim();
    const nip = String(payload.nip || '').trim();

    if (!noRawat) {
      throw new Error('Missing required field: no_rawat');
    }

    if (!nip) {
      throw new Error('Missing required field: nip');
    }

    if (!catatan) {
      throw new Error('Catatan konsul terapi tidak boleh kosong');
    }

    const connection = await pool.getConnection();

    try {
      const query = `
        INSERT INTO pemeriksaan_ralan (
          no_rawat, tgl_perawatan, jam_rawat, suhu_tubuh, tensi, nadi, respirasi,
          tinggi, berat, gcs, keluhan, pemeriksaan, alergi, imun_ke, rtl, penilaian, nip, created_at
        ) VALUES (?, CURDATE(), CURTIME(), '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', ?, 'Konsul Terapi', ?, NOW())
      `;

      const [result] = await connection.execute(query, [noRawat, catatan, nip]);

      return {
        success: true,
        message: 'Konsul terapi berhasil disimpan',
        table: 'pemeriksaan_ralan',
        data: {
          no_rawat: noRawat,
          affectedRows: result.affectedRows
        }
      };
    } catch (error) {
      console.error('Error saving konsul terapi:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Riwayat catatan Konsul Terapi pada pemeriksaan_ralan untuk satu kunjungan.
   */
  static async getKonsulTerapiHistory(noRawat) {
    const normalizedNoRawat = String(noRawat || '').trim();

    if (!normalizedNoRawat) {
      throw new Error('Missing required field: no_rawat');
    }

    const connection = await pool.getConnection();

    try {
      const query = `
        SELECT
          DATE_FORMAT(pr.tgl_perawatan, '%Y-%m-%d') AS tgl_perawatan,
          TIME_FORMAT(pr.jam_rawat, '%H:%i:%s') AS jam_rawat,
          pr.rtl,
          pr.penilaian,
          pr.nip,
          d.nm_dokter,
          pr.created_at
        FROM pemeriksaan_ralan pr
        LEFT JOIN dokter d ON pr.nip = d.kd_dokter
        WHERE pr.no_rawat = ?
        AND pr.penilaian = 'Konsul Terapi'
        ORDER BY pr.tgl_perawatan DESC, pr.jam_rawat DESC, pr.created_at DESC
      `;

      const [rows] = await connection.execute(query, [normalizedNoRawat]);

      return {
        success: true,
        data: rows
      };
    } catch (error) {
      console.error('Error getting konsul terapi history:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Hapus satu catatan Konsul Terapi berdasarkan kunci pemeriksaan_ralan.
   * Hanya baris dengan penilaian 'Konsul Terapi' yang boleh dihapus dari endpoint ini.
   */
  static async deleteKonsulTerapi({ no_rawat, tgl_perawatan, jam_rawat } = {}) {
    const normalizedNoRawat = String(no_rawat || '').trim();
    const normalizedTglPerawatan = String(tgl_perawatan || '').trim();
    const normalizedJamRawat = String(jam_rawat || '').trim();

    if (!normalizedNoRawat || !normalizedTglPerawatan || !normalizedJamRawat) {
      throw new Error('Missing required fields: no_rawat, tgl_perawatan, jam_rawat');
    }

    const connection = await pool.getConnection();

    try {
      const query = `
        DELETE FROM pemeriksaan_ralan
        WHERE no_rawat = ?
        AND tgl_perawatan = ?
        AND jam_rawat = ?
        AND penilaian = 'Konsul Terapi'
      `;

      const [result] = await connection.execute(query, [
        normalizedNoRawat,
        normalizedTglPerawatan,
        normalizedJamRawat
      ]);

      if (result.affectedRows === 0) {
        throw new Error('Data konsul terapi tidak ditemukan');
      }

      return {
        success: true,
        message: 'Konsul terapi berhasil dihapus',
        table: 'pemeriksaan_ralan',
        data: {
          no_rawat: normalizedNoRawat,
          affectedRows: result.affectedRows
        }
      };
    } catch (error) {
      console.error('Error deleting konsul terapi:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default SaveExaminationService;
