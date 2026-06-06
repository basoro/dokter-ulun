import { executeQuery, getConnection } from '../config/database.js';

class ResumePasienDataService {
  // Format date to YYYY-MM-DD format
  formatDateOnly(dateStr) {
    if (!dateStr) return '';
    
    // Handle MySQL DATE format (YYYY-MM-DD)
    if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // Handle Date object or ISO string
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error('Error formatting date:', dateStr, error);
      return '';
    }
  }

  // Get resume pasien data with pagination and filters
  async getResumePasienData({
    page = "1",
    itemsPerPage = "50", 
    search = "",
    statusPulang = "all",
    startDate,
    endDate
  }) {
    try {
      // Validate and limit itemsPerPage
      const limit = Math.min(parseInt(itemsPerPage), 500);
      const offset = (parseInt(page) - 1) * limit;
      console.log('Pagination - Page:', page, 'Items per page:', limit, 'Offset:', offset);

      // Build the WHERE clause - start with kamar_inap filter
      let whereConditions = ['ki.no_rawat IS NOT NULL'];
      let params = [];

      // Search filter
      if (search && search.trim()) {
        whereConditions.push(`(
          p.nm_pasien LIKE ? OR
          p.no_rkm_medis LIKE ? OR
          ki.no_rawat LIKE ? OR
          d.nm_dokter LIKE ? OR
          rpr.diagnosa_utama LIKE ? OR
          rpr.diagnosa_sekunder LIKE ?
        )`);
        const searchParam = `%${search.trim()}%`;
        params.push(searchParam, searchParam, searchParam, searchParam, searchParam, searchParam);
      }

      // Status pulang filter
      if (statusPulang && statusPulang !== 'all') {
        whereConditions.push('ki.stts_pulang = ?');
        params.push(statusPulang);
      }

      // Date range filter - using tgl_keluar from kamar_inap
      if (startDate && endDate) {
        whereConditions.push('DATE(ki.tgl_keluar) BETWEEN ? AND ?');
        params.push(startDate, endDate);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      console.log('WHERE clause:', whereClause);
      console.log('Parameters:', params);

      // Main query - start from kamar_inap and LEFT JOIN to resume_pasien_ranap
      const query = `
        SELECT 
          ki.no_rawat,
          p.no_rkm_medis,
          p.nm_pasien,
          p.jk as jenis_kelamin,
          p.tgl_lahir,
          ki.tgl_masuk,
          ki.tgl_keluar,
          ki.lama,
          ki.stts_pulang,
          k.kd_kamar,
          b.nm_bangsal,
          GROUP_CONCAT(DISTINCT CONCAT(d.nm_dokter, ' (', COALESCE(dr.jenis_dpjp, 'Tidak Diketahui'), ')') SEPARATOR ', ') as dokter_dpjp,
          rpr.diagnosa_awal,
          rpr.kd_diagnosa_utama,
          rpr.diagnosa_utama,
          rpr.kd_diagnosa_sekunder,
          rpr.diagnosa_sekunder,
          rpr.prosedur_utama,
          rpr.prosedur_sekunder,
          rpr.keadaan,
          rpr.ket_keadaan,
          CASE 
            WHEN rpr.no_rawat IS NOT NULL THEN 'sudah_resume'
            ELSE 'belum_resume'
          END as status_resume
        FROM kamar_inap ki
        LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
        LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        ${whereClause}
        GROUP BY ki.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir, ki.tgl_masuk, ki.tgl_keluar, ki.lama, ki.stts_pulang, k.kd_kamar, b.nm_bangsal, rpr.diagnosa_awal, rpr.kd_diagnosa_utama, rpr.diagnosa_utama, rpr.kd_diagnosa_sekunder, rpr.diagnosa_sekunder, rpr.prosedur_utama, rpr.prosedur_sekunder, rpr.keadaan, rpr.ket_keadaan
        ORDER BY ki.tgl_keluar DESC
        LIMIT ? OFFSET ?
      `;

      // Count query - start from kamar_inap
      const countQuery = `
        SELECT COUNT(*) as total
        FROM kamar_inap ki
        LEFT JOIN resume_pasien_ranap rpr ON ki.no_rawat = rpr.no_rawat
        LEFT JOIN reg_periksa rp ON ki.no_rawat = rp.no_rawat
        LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
        LEFT JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
        LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
        LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
        LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
        ${whereClause}
      `;

      console.log('Executing count query...');
      const countResult = await executeQuery(countQuery, params);
      const total = countResult[0]?.total || 0;

      console.log('Executing data query...');
      const dataResult = await executeQuery(query, [...params, limit, offset]);
      
      console.log(`Found ${dataResult.length} records out of ${total} total`);

      // Format date fields
      const formattedData = dataResult.map(row => ({
        ...row,
        tgl_lahir: this.formatDateOnly(row.tgl_lahir),
        tgl_masuk: this.formatDateOnly(row.tgl_masuk),
        tgl_keluar: this.formatDateOnly(row.tgl_keluar),
        tgl_registrasi: this.formatDateOnly(row.tgl_registrasi)
      }));

      return {
        success: true,
        data: formattedData,
        total,
        limit,
        offset,
        page: parseInt(page),
        totalPages: Math.ceil(total / limit)
      };

    } catch (error) {
      console.error('Error getting resume pasien data:', error);
      throw error;
    }
  }

  // Get resume detail for specific patient
  async getResumeDetail(no_rawat) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const query = `
      SELECT 
        rpr.*,
        p.no_rkm_medis,
        p.nm_pasien,
        p.jk as jenis_kelamin,
        p.tgl_lahir,
        ki.tgl_masuk,
        ki.tgl_keluar,
        ki.lama,
        ki.stts_pulang,
        k.kd_kamar,
        b.nm_bangsal,
        GROUP_CONCAT(DISTINCT CONCAT(d.nm_dokter, ' (', COALESCE(dr.jenis_dpjp, 'Tidak Diketahui'), ')') SEPARATOR ', ') as dokter_dpjp
      FROM resume_pasien_ranap rpr
      LEFT JOIN kamar_inap ki ON rpr.no_rawat = ki.no_rawat
      LEFT JOIN reg_periksa rp ON rpr.no_rawat = rp.no_rawat
      LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis
      LEFT JOIN dpjp_ranap dr ON rpr.no_rawat = dr.no_rawat
      LEFT JOIN dokter d ON dr.kd_dokter = d.kd_dokter
      LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar
      LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal
      WHERE rpr.no_rawat = ?
      GROUP BY rpr.no_rawat, p.no_rkm_medis, p.nm_pasien, p.jk, p.tgl_lahir, ki.tgl_masuk, ki.tgl_keluar, ki.lama, ki.stts_pulang, k.kd_kamar, b.nm_bangsal
    `;

    try {
      const result = await executeQuery(query, [no_rawat]);
      
      if (result.length === 0) {
        return {
          success: false,
          error: 'Resume not found'
        };
      }

      // Format date fields
      const formattedData = {
        ...result[0],
        tgl_lahir: this.formatDateOnly(result[0].tgl_lahir),
        tgl_masuk: this.formatDateOnly(result[0].tgl_masuk),
        tgl_keluar: this.formatDateOnly(result[0].tgl_keluar)
      };

      return {
        success: true,
        data: formattedData
      };
    } catch (error) {
      console.error('Error getting resume detail:', error);
      throw error;
    }
  }

  // Create or update resume pasien
  async saveResume(no_rawat, resumeData) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const connection = await getConnection();
    
    try {
      await connection.beginTransaction();

      // Check if resume already exists
      const checkQuery = 'SELECT no_rawat FROM resume_pasien_ranap WHERE no_rawat = ?';
      const existingResume = await executeQuery(checkQuery, [no_rawat]);

      let query;
      let params;

      if (existingResume.length > 0) {
        // Update existing resume
        query = `
          UPDATE resume_pasien_ranap SET
            diagnosa_awal = ?,
            kd_diagnosa_utama = ?,
            diagnosa_utama = ?,
            kd_diagnosa_sekunder = ?,
            diagnosa_sekunder = ?,
            prosedur_utama = ?,
            prosedur_sekunder = ?,
            keadaan = ?,
            ket_keadaan = ?
          WHERE no_rawat = ?
        `;
        params = [
          resumeData.diagnosa_awal || '',
          resumeData.kd_diagnosa_utama || '',
          resumeData.diagnosa_utama || '',
          resumeData.kd_diagnosa_sekunder || '',
          resumeData.diagnosa_sekunder || '',
          resumeData.prosedur_utama || '',
          resumeData.prosedur_sekunder || '',
          resumeData.keadaan || '',
          resumeData.ket_keadaan || '',
          no_rawat
        ];
      } else {
        // Insert new resume
        query = `
          INSERT INTO resume_pasien_ranap (
            no_rawat,
            diagnosa_awal,
            kd_diagnosa_utama,
            diagnosa_utama,
            kd_diagnosa_sekunder,
            diagnosa_sekunder,
            prosedur_utama,
            prosedur_sekunder,
            keadaan,
            ket_keadaan
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        params = [
          no_rawat,
          resumeData.diagnosa_awal || '',
          resumeData.kd_diagnosa_utama || '',
          resumeData.diagnosa_utama || '',
          resumeData.kd_diagnosa_sekunder || '',
          resumeData.diagnosa_sekunder || '',
          resumeData.prosedur_utama || '',
          resumeData.prosedur_sekunder || '',
          resumeData.keadaan || '',
          resumeData.ket_keadaan || ''
        ];
      }

      await executeQuery(query, params);
      await connection.commit();

      return {
        success: true,
        message: existingResume.length > 0 ? 'Resume updated successfully' : 'Resume created successfully'
      };

    } catch (error) {
      await connection.rollback();
      console.error('Error saving resume:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  // Delete resume pasien
  async deleteResume(no_rawat) {
    if (!no_rawat) {
      throw new Error('no_rawat is required');
    }

    const query = 'DELETE FROM resume_pasien_ranap WHERE no_rawat = ?';
    
    try {
      const result = await executeQuery(query, [no_rawat]);
      
      if (result.affectedRows === 0) {
        return {
          success: false,
          error: 'Resume not found'
        };
      }

      return {
        success: true,
        message: 'Resume deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting resume:', error);
      throw error;
    }
  }
}

export default new ResumePasienDataService();