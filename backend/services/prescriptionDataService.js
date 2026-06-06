import { executeQuery, getConnection } from '../config/database.js';

class PrescriptionDataService {
  // Get prescriptions for a patient
  async getPrescriptions(no_rawat) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const query = `
      SELECT ro.*, d.nm_dokter 
      FROM resep_obat ro
      LEFT JOIN dokter d ON ro.kd_dokter = d.kd_dokter
      WHERE ro.no_rawat = ?
      ORDER BY ro.tgl_peresepan DESC, ro.jam_peresepan DESC
    `;
    
    try {
      const result = await executeQuery(query, [no_rawat]);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting prescriptions:', error);
      throw error;
    }
  }

  // Get prescription details (medicines and compounds)
  async getPrescriptionDetails(no_resep) {
    if (!no_resep) {
      throw new Error('no_resep is required');
    }

    try {
      // Get prescription medicines
      const medicineQuery = `
        SELECT rd.*, db.nama_brng, db.satuan, db.harga
        FROM resep_dokter rd
        LEFT JOIN databarang db ON rd.kode_brng = db.kode_brng
        WHERE rd.no_resep = ?
      `;
      
      // Get prescription compounds
      const compoundQuery = `
        SELECT rdr.*, mr.nm_racik
        FROM resep_dokter_racikan rdr
        LEFT JOIN metode_racik mr ON rdr.kd_racik = mr.kd_racik
        WHERE rdr.no_resep = ?
      `;
      
      const [medicines, compounds] = await Promise.all([
        executeQuery(medicineQuery, [no_resep]),
        executeQuery(compoundQuery, [no_resep])
      ]);
      
      return {
        success: true,
        medicines,
        compounds
      };
    } catch (error) {
      console.error('Error getting prescription details:', error);
      throw error;
    }
  }

  // Get available medicines
  async getMedicines() {
    const query = `
      SELECT kode_brng, nama_brng, kode_sat as satuan, kelas1 as harga
      FROM databarang
      WHERE status = '1'
      ORDER BY nama_brng
      LIMIT 100
    `;
    
    try {
      const result = await executeQuery(query);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting medicines:', error);
      throw error;
    }
  }

  // Get compound methods
  async getCompoundMethods() {
    const query = `SELECT * FROM metode_racik ORDER BY nm_racik`;
    
    try {
      const result = await executeQuery(query);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      console.error('Error getting compound methods:', error);
      throw error;
    }
  }

  // Create new prescription
  async createPrescription(no_rawat, kd_dokter, medicines, compounds) {
    if (!no_rawat || !kd_dokter) {
      throw new Error('no_rawat and kd_dokter are required');
    }

    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Generate prescription number
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
      const no_resep = `${today}${timeStr}`;
      
      // Insert main prescription
      const insertPrescriptionQuery = `
        INSERT INTO resep_obat (no_resep, tgl_perawatan, jam, no_rawat, kd_dokter, tgl_peresepan, jam_peresepan, status, tgl_penyerahan, jam_penyerahan)
        VALUES (?, CURDATE(), CURTIME(), ?, ?, CURDATE(), CURTIME(), 'ralan', '0000-00-00', '00:00:00')
      `;
      
      await connection.execute(insertPrescriptionQuery, [no_resep, no_rawat, kd_dokter]);
      
      // Insert medicines
      if (medicines && medicines.length > 0) {
        for (const medicine of medicines) {
          const insertMedicineQuery = `
            INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai)
            VALUES (?, ?, ?, ?)
          `;
          await connection.execute(insertMedicineQuery, [no_resep, medicine.kode_brng, medicine.jml, medicine.aturan_pakai]);
        }
      }
      
      // Insert compounds
      if (compounds && compounds.length > 0) {
        for (const compound of compounds) {
          const insertCompoundQuery = `
            INSERT INTO resep_dokter_racikan (no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          await connection.execute(insertCompoundQuery, [no_resep, compound.no_racik, compound.nama_racik, compound.kd_racik, compound.jml_dr, compound.aturan_pakai, compound.keterangan]);
        }
      }
      
      await connection.commit();
      
      return {
        success: true,
        no_resep
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error creating prescription:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update existing prescription
  async updatePrescription(no_resep, medicines, compounds) {
    if (!no_resep) {
      throw new Error('no_resep is required');
    }

    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Delete existing medicines and compounds
      await connection.execute('DELETE FROM resep_dokter WHERE no_resep = ?', [no_resep]);
      await connection.execute('DELETE FROM resep_dokter_racikan WHERE no_resep = ?', [no_resep]);
      
      // Insert updated medicines
      if (medicines && medicines.length > 0) {
        for (const medicine of medicines) {
          const insertMedicineQuery = `
            INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai)
            VALUES (?, ?, ?, ?)
          `;
          await connection.execute(insertMedicineQuery, [no_resep, medicine.kode_brng, medicine.jml, medicine.aturan_pakai]);
        }
      }
      
      // Insert updated compounds
      if (compounds && compounds.length > 0) {
        for (const compound of compounds) {
          const insertCompoundQuery = `
            INSERT INTO resep_dokter_racikan (no_resep, no_racik, nama_racik, kd_racik, jml_dr, aturan_pakai, keterangan)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `;
          await connection.execute(insertCompoundQuery, [no_resep, compound.no_racik, compound.nama_racik, compound.kd_racik, compound.jml_dr, compound.aturan_pakai, compound.keterangan]);
        }
      }
      
      await connection.commit();
      
      return {
        success: true
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error updating prescription:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Delete prescription
  async deletePrescription(no_resep) {
    if (!no_resep) {
      throw new Error('no_resep is required');
    }

    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();
      
      // Delete related records first
      await connection.execute('DELETE FROM resep_dokter WHERE no_resep = ?', [no_resep]);
      await connection.execute('DELETE FROM resep_dokter_racikan WHERE no_resep = ?', [no_resep]);
      
      // Delete main prescription
      await connection.execute('DELETE FROM resep_obat WHERE no_resep = ?', [no_resep]);
      
      await connection.commit();
      
      return {
        success: true
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error deleting prescription:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

export default new PrescriptionDataService();