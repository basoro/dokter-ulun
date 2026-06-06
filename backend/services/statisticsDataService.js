import pool from '../config/database.js';

class StatisticsDataService {

  /**
   * Get statistics data based on type
   * @param {string} statisticType - Type of statistics (visits, diagnosis, doctors, summary)
   * @param {string} periodType - Period type for visits (daily, weekly, monthly, yearly)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {number} limit - Limit for results
   * @returns {Promise<Object>} - Statistics data
   */
  static async getStatisticsData(statisticType, periodType, startDate, endDate, limit = 10) {
    try {
      let result = {};

      switch (statisticType) {
        case 'visits':
          result = await this.getVisitStatistics(periodType, startDate, endDate);
          break;
        case 'diagnosis':
          result = await this.getDiagnosisStatistics(startDate, endDate, limit);
          break;
        case 'doctors':
          result = await this.getDoctorStatistics(startDate, endDate, limit);
          break;
        case 'summary':
          result = await this.getSummaryStatistics(startDate, endDate);
          break;
        default:
          throw new Error('Invalid statistic type');
      }

      return {
        success: true,
        data: result,
        statisticType
      };

    } catch (error) {
      console.error('Error in statistics service:', error);
      throw error;
    }
  }

  /**
   * Get visit statistics grouped by period
   */
  static async getVisitStatistics(periodType, startDate, endDate) {
    console.log('Fetching visit statistics');
    
    let groupBy = '';
    let dateFormat = '';
    
    switch (periodType) {
      case 'daily':
        groupBy = 'DATE(rp.tgl_registrasi)';
        dateFormat = 'DATE(rp.tgl_registrasi) as period';
        break;
      case 'weekly':
        groupBy = 'YEARWEEK(rp.tgl_registrasi)';
        dateFormat = 'CONCAT(YEAR(rp.tgl_registrasi), "-W", WEEK(rp.tgl_registrasi)) as period';
        break;
      case 'monthly':
        groupBy = 'YEAR(rp.tgl_registrasi), MONTH(rp.tgl_registrasi)';
        dateFormat = 'CONCAT(YEAR(rp.tgl_registrasi), "-", LPAD(MONTH(rp.tgl_registrasi), 2, "0")) as period';
        break;
      case 'yearly':
        groupBy = 'YEAR(rp.tgl_registrasi)';
        dateFormat = 'YEAR(rp.tgl_registrasi) as period';
        break;
      default:
        groupBy = 'YEAR(rp.tgl_registrasi), MONTH(rp.tgl_registrasi)';
        dateFormat = 'CONCAT(YEAR(rp.tgl_registrasi), "-", LPAD(MONTH(rp.tgl_registrasi), 2, "0")) as period';
    }

    const sql = `
      SELECT 
        ${dateFormat},
        COUNT(*) as total_visits,
        SUM(CASE WHEN rp.status_lanjut = 'Ralan' THEN 1 ELSE 0 END) as rawat_jalan,
        SUM(CASE WHEN rp.status_lanjut = 'Ranap' THEN 1 ELSE 0 END) as rawat_inap
      FROM reg_periksa rp
      WHERE rp.tgl_registrasi BETWEEN ? AND ?
      GROUP BY ${groupBy}
      ORDER BY rp.tgl_registrasi ASC
      LIMIT 100
    `;

    const [visitResult] = await pool.execute(sql, [startDate, endDate]);
    
    return {
      visits: visitResult || [],
      totalVisits: visitResult?.reduce((sum, row) => sum + row.total_visits, 0) || 0,
      totalRawatJalan: visitResult?.reduce((sum, row) => sum + row.rawat_jalan, 0) || 0,
      totalRawatInap: visitResult?.reduce((sum, row) => sum + row.rawat_inap, 0) || 0
    };
  }

  /**
   * Get diagnosis statistics
   */
  static async getDiagnosisStatistics(startDate, endDate, limit = 10) {
    console.log('Fetching diagnosis statistics');
    
    const sql = `
      SELECT 
        p.nm_penyakit,
        COUNT(*) as total_cases,
        ROUND((COUNT(*) * 100.0 / (
          SELECT COUNT(*) 
          FROM reg_periksa rp2 
          LEFT JOIN diagnosa_pasien dp2 ON rp2.no_rawat = dp2.no_rawat 
          WHERE rp2.tgl_registrasi BETWEEN ? AND ? 
          AND dp2.kd_penyakit IS NOT NULL
        )), 2) as percentage
      FROM reg_periksa rp
      LEFT JOIN diagnosa_pasien dp ON rp.no_rawat = dp.no_rawat
      LEFT JOIN penyakit p ON dp.kd_penyakit = p.kd_penyakit
      WHERE rp.tgl_registrasi BETWEEN ? AND ?
      AND p.nm_penyakit IS NOT NULL
      GROUP BY p.kd_penyakit, p.nm_penyakit
      ORDER BY total_cases DESC
      LIMIT ?
    `;

    const [diagnosisResult] = await pool.execute(sql, [startDate, endDate, startDate, endDate, limit]);
    
    return diagnosisResult || [];
  }

  /**
   * Get doctor statistics
   */
  static async getDoctorStatistics(startDate, endDate, limit = 10) {
    console.log('Fetching doctor statistics');
    
    const sql = `
      SELECT 
        d.nm_dokter,
        d.kd_dokter,
        d.jk as gender,
        (
          SELECT COUNT(*)
          FROM reg_periksa rp_ralan
          WHERE rp_ralan.tgl_registrasi BETWEEN ? AND ?
          AND rp_ralan.kd_dokter = d.kd_dokter
          AND rp_ralan.status_lanjut = 'Ralan'
        ) as rawat_jalan,
        (
          SELECT COUNT(*)
          FROM kamar_inap ki
          JOIN dpjp_ranap dr ON ki.no_rawat = dr.no_rawat
          JOIN reg_periksa rp_ranap ON ki.no_rawat = rp_ranap.no_rawat
          WHERE rp_ranap.tgl_registrasi BETWEEN ? AND ?
          AND dr.kd_dokter = d.kd_dokter
        ) as rawat_inap,
        (
          SELECT COUNT(*)
          FROM resep_obat ro
          WHERE ro.tgl_peresepan BETWEEN ? AND ?
          AND ro.kd_dokter = d.kd_dokter
        ) as resep,
        ROUND(
          (
            SELECT SUM(CASE WHEN rp_bayar.status_bayar = 'Sudah Bayar' THEN 1 ELSE 0 END) * 100.0 / COUNT(rp_bayar.no_rawat)
            FROM reg_periksa rp_bayar
            WHERE rp_bayar.tgl_registrasi BETWEEN ? AND ?
            AND rp_bayar.kd_dokter = d.kd_dokter
          ), 
          2
        ) as payment_rate
      FROM dokter d
      WHERE d.kd_dokter IN (
        SELECT DISTINCT kd_dokter 
        FROM reg_periksa 
        WHERE tgl_registrasi BETWEEN ? AND ?
      )
      ORDER BY d.nm_dokter ASC
    `;

    const [doctorResult] = await pool.execute(sql, [
      startDate, endDate, startDate, endDate, startDate, endDate, 
      startDate, endDate, startDate, endDate
    ]);
    
    return doctorResult || [];
  }

  /**
   * Get summary statistics
   */
  static async getSummaryStatistics(startDate, endDate) {
    console.log('Fetching summary statistics');
    
    // Total visits
    const [totalVisitsResult] = await pool.execute(`
      SELECT COUNT(*) as total_visits
      FROM reg_periksa 
      WHERE tgl_registrasi BETWEEN ? AND ?
    `, [startDate, endDate]);

    // Rawat jalan vs rawat inap
    const [careTypeResult] = await pool.execute(`
      SELECT 
        status_lanjut,
        COUNT(*) as count
      FROM reg_periksa 
      WHERE tgl_registrasi BETWEEN ? AND ?
      GROUP BY status_lanjut
    `, [startDate, endDate]);

    // Payment status
    const [paymentResult] = await pool.execute(`
      SELECT 
        status_bayar,
        COUNT(*) as count
      FROM reg_periksa 
      WHERE tgl_registrasi BETWEEN ? AND ?
      GROUP BY status_bayar
    `, [startDate, endDate]);

    // Active doctors
    const [activeDoctorsResult] = await pool.execute(`
      SELECT COUNT(DISTINCT kd_dokter) as active_doctors
      FROM reg_periksa 
      WHERE tgl_registrasi BETWEEN ? AND ?
    `, [startDate, endDate]);

    // Top diagnoses
    const [topDiagnosesResult] = await pool.execute(`
      SELECT 
        p.nm_penyakit,
        COUNT(*) as cases
      FROM reg_periksa rp
      LEFT JOIN diagnosa_pasien dp ON rp.no_rawat = dp.no_rawat
      LEFT JOIN penyakit p ON dp.kd_penyakit = p.kd_penyakit
      WHERE rp.tgl_registrasi BETWEEN ? AND ?
      AND p.nm_penyakit IS NOT NULL
      GROUP BY p.kd_penyakit, p.nm_penyakit
      ORDER BY cases DESC
      LIMIT 5
    `, [startDate, endDate]);

    return {
      totalVisits: totalVisitsResult?.[0]?.total_visits || 0,
      careTypes: careTypeResult || [],
      paymentStatus: paymentResult || [],
      activeDoctors: activeDoctorsResult?.[0]?.active_doctors || 0,
      topDiagnoses: topDiagnosesResult || []
    };
  }
}

export default StatisticsDataService;