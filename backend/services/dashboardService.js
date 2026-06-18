import { executeQuery } from '../config/database.js';

export class DashboardService {
  // Get dashboard data for a specific user and poli
  static async getDashboardData(username, kdPoli) {
    try {
      // Get current date in Indonesian timezone (WIB, UTC+7)
      const indonesianDate = new Date(new Date().getTime() + (7 * 60 * 60 * 1000));
      const year = indonesianDate.getUTCFullYear();
      const month = String(indonesianDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(indonesianDate.getUTCDate()).padStart(2, '0');
      const currentMonth = `${year}-${month}`;
      const currentDateStr = `${year}-${month}-${day}`;
      const shiftLike = indonesianDate.getUTCHours() < 12 ? '%pagi%' : '%sore%';

      console.log('Current date:', currentDateStr, 'Current month:', currentMonth);

      // 1. Total Pasien
      const totalPatientsResult = await executeQuery('SELECT COUNT(no_rkm_medis) as total FROM pasien');
      const totalPatients = totalPatientsResult[0]?.total || 0;

      // 2. Bulan Ini
      const monthlyPatientsResult = await executeQuery('SELECT COUNT(no_rkm_medis) as total FROM pasien WHERE tgl_daftar LIKE ?', [`${currentMonth}%`]);
      const monthlyPatients = monthlyPatientsResult[0]?.total || 0;

      // 3. Poli Bulan Ini (if kdPoli is provided)
      let monthlyPoliPatients = 0;
      if (kdPoli && kdPoli.trim()) {
        // Convert comma-separated values to array for IN clause
        const poliCodes = kdPoli.split(',').map(code => code.trim());
        const placeholders = poliCodes.map(() => '?').join(',');
        const monthlyPoliResult = await executeQuery(
          `SELECT COUNT(r.no_rawat) as total
           FROM reg_periksa r
           INNER JOIN poliklinik p ON r.kd_poli = p.kd_poli
           WHERE r.kd_poli IN (${placeholders})
             AND r.stts != "Belum"
             AND r.tgl_registrasi LIKE ?
             AND LOWER(p.nm_poli) LIKE ?`,
          [...poliCodes, `${currentMonth}%`, shiftLike]
        );
        monthlyPoliPatients = monthlyPoliResult[0]?.total || 0;
      }

      // 4. Poli Hari Ini (if kdPoli is provided)
      let dailyPoliPatients = 0;
      if (kdPoli && kdPoli.trim()) {
        // Convert comma-separated values to array for IN clause
        const poliCodes = kdPoli.split(',').map(code => code.trim());
        const placeholders = poliCodes.map(() => '?').join(',');
        const dailyPoliResult = await executeQuery(
          `SELECT COUNT(r.no_rawat) as total
           FROM reg_periksa r
           INNER JOIN poliklinik p ON r.kd_poli = p.kd_poli
           WHERE r.kd_poli IN (${placeholders})
             AND r.tgl_registrasi = ?
             AND LOWER(p.nm_poli) LIKE ?`,
          [...poliCodes, currentDateStr, shiftLike]
        );
        dailyPoliPatients = dailyPoliResult[0]?.total || 0;
      }

      // 5. Grafik Poliklinik Hari Ini
      const chartDataResult = await executeQuery(`
        SELECT p.nm_poli, COUNT(*) as jumlah 
        FROM reg_periksa r 
        INNER JOIN poliklinik p ON r.kd_poli = p.kd_poli 
        WHERE r.tgl_registrasi = ? AND p.nm_poli != '-' 
        GROUP BY r.kd_poli 
        ORDER BY COUNT(*) DESC
      `, [currentDateStr]);

      const chartData = chartDataResult.map(row => ({
        name: row.nm_poli,
        value: row.jumlah
      }));

      // 6. Pasien Paling Aktif
      const activePatientsResult = await executeQuery(`
        SELECT no_rkm_medis, COUNT(no_rkm_medis) as jumlah 
        FROM reg_periksa 
        WHERE kd_dokter = ? 
        GROUP BY no_rkm_medis 
        ORDER BY jumlah DESC 
        LIMIT 10
      `, [username]);

      const activePatients = [];
      for (const row of activePatientsResult) {
        const patientNameResult = await executeQuery('SELECT nm_pasien FROM pasien WHERE no_rkm_medis = ?', [row.no_rkm_medis]);
        const patientName = patientNameResult[0]?.nm_pasien || 'Unknown';
        
        activePatients.push({
          id: row.no_rkm_medis,
          name: this.formatName(patientName),
          visits: row.jumlah
        });
      }

      // 7. Antrian 10 Pasien Terakhir
      const queuePatients = [];
      if (kdPoli && kdPoli.trim()) {
        // Convert comma-separated values to array for IN clause
        const poliCodes = kdPoli.split(',').map(code => code.trim());
        const placeholders = poliCodes.map(() => '?').join(',');
        const queueResult = await executeQuery(`
          SELECT a.no_rawat, b.no_rkm_medis, b.nm_pasien, a.stts 
          FROM reg_periksa a, pasien b 
          WHERE a.kd_poli IN (${placeholders}) AND a.no_rkm_medis = b.no_rkm_medis AND a.tgl_registrasi = ? 
          ORDER BY a.jam_reg DESC 
          LIMIT 10
        `, [...poliCodes, currentDateStr]);

        queueResult.forEach((row, index) => {
          queuePatients.push({
            id: index + 1,
            name: this.formatName(row.nm_pasien),
            status: row.stts,
            no_rawat: row.no_rawat
          });
        });
      }

      return {
        success: true,
        data: {
          stats: {
            totalPatients,
            monthlyPatients,
            monthlyPoliPatients,
            dailyPoliPatients
          },
          chartData,
          activePatients,
          queuePatients
        }
      };

    } catch (error) {
      console.error('Dashboard data error:', error);
      throw error;
    }
  }

  // Helper function to format patient names
  static formatName(name) {
    if (!name) return 'Unknown';
    return name.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
}
