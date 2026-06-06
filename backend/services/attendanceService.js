import pool from '../config/database.js';

class AttendanceService {
  static async getAvailableShifts(username) {
    try {
      // Get user's department
      const userQuery = 'SELECT departemen FROM pegawai WHERE nik = ?';
      const [userRows] = await pool.execute(userQuery, [username]);
      
      if (userRows.length === 0) {
        throw new Error('User not found');
      }
      
      const departemen = userRows[0].departemen;
      
      // Get available shifts for department
      const shiftsQuery = `
        SELECT DISTINCT shift, jam_masuk, jam_pulang 
        FROM jam_jaga 
        WHERE dep_id = ?
        ORDER BY jam_masuk
      `;
      
      const [shiftsRows] = await pool.execute(shiftsQuery, [departemen]);
      
      return shiftsRows.map(row => ({
        shift: row.shift,
        jam_masuk: row.jam_masuk,
        jam_pulang: row.jam_pulang
      }));
    } catch (error) {
      console.error('Error getting available shifts:', error);
      throw error;
    }
  }

  static async getAttendanceHistory(username, limit = 30) {
    try {
      const query = `
        SELECT 
          rp.id,
          rp.shift,
          rp.jam_datang,
          rp.jam_pulang,
          rp.status,
          rp.keterlambatan,
          rp.durasi,
          rp.keterangan,
          rp.photo,
          DATE(rp.jam_datang) as tanggal,
          p.nama,
          p.jbtn as jabatan,
          p.departemen
        FROM rekap_presensi rp
        INNER JOIN pegawai p ON rp.id = p.id
        WHERE p.nik = ?
        ORDER BY rp.jam_datang DESC
        LIMIT ?
      `;
      
      const [rows] = await pool.execute(query, [username, limit]);
      
      return rows.map(row => ({
        id: row.id,
        shift: row.shift,
        tanggal: row.tanggal,
        jam_datang: row.jam_datang,
        jam_pulang: row.jam_pulang,
        status: row.status,
        keterlambatan: row.keterlambatan,
        durasi: row.durasi,
        keterangan: row.keterangan,
        photo: row.photo,
        nama: row.nama,
        jabatan: row.jabatan,
        departemen: row.departemen
      }));
    } catch (error) {
      console.error('Error getting attendance history:', error);
      throw error;
    }
  }

  static async getTodayAttendance(username, date = null) {
    try {
      // Get user info
      const userQuery = 'SELECT id, nama, departemen FROM pegawai WHERE nik = ?';
      const [userRows] = await pool.execute(userQuery, [username]);
      
      if (userRows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userRows[0];
      const departemen = user.departemen;
      
      // Get shifts for department
      const shiftsQuery = `
        SELECT shift, jam_masuk, jam_pulang 
        FROM jam_jaga 
        WHERE dep_id = ?
        ORDER BY jam_masuk
      `;
      
      const [shiftsRows] = await pool.execute(shiftsQuery, [departemen]);
      
      const shifts = shiftsRows.map(row => ({
        shift: row.shift,
        jam_masuk: row.jam_masuk,
        jam_pulang: row.jam_pulang
      }));
      
      // Get today's attendance
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const attendanceQuery = `
        SELECT 
          shift,
          jam_datang,
          jam_pulang,
          status,
          keterlambatan,
          durasi,
          keterangan,
          photo
        FROM rekap_presensi 
        WHERE id = ? AND DATE(jam_datang) = ?
        ORDER BY jam_datang DESC
        LIMIT 1
      `;
      
      const [attendanceRows] = await pool.execute(attendanceQuery, [user.id, targetDate]);
      
      return {
        user: {
          id: user.id,
          nama: user.nama,
          departemen: user.departemen
        },
        shifts: shifts,
        attendance: attendanceRows.length > 0 ? {
          shift: attendanceRows[0].shift,
          jam_datang: attendanceRows[0].jam_datang,
          jam_pulang: attendanceRows[0].jam_pulang,
          status: attendanceRows[0].status,
          keterlambatan: attendanceRows[0].keterlambatan,
          durasi: attendanceRows[0].durasi,
          keterangan: attendanceRows[0].keterangan,
          photo: attendanceRows[0].photo
        } : null
      };
    } catch (error) {
      console.error('Error getting today attendance:', error);
      throw error;
    }
  }

  static async getMonthlyAttendance(username, month) {
    try {
      // Parse month (YYYY-MM format)
      const [year, monthStr] = month.split('-');
      const monthNum = parseInt(monthStr);
      const startDate = `${year}-${monthStr.padStart(2, '0')}-01`;
      const lastDay = new Date(parseInt(year), monthNum, 0).getDate();
      const endDate = `${year}-${monthStr.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      const query = `
        SELECT 
          rp.id,
          rp.shift,
          rp.jam_datang,
          rp.jam_pulang,
          rp.status,
          rp.keterlambatan,
          rp.durasi,
          rp.keterangan,
          rp.photo,
          DATE(rp.jam_datang) as tanggal,
          p.nama,
          p.jbtn as jabatan,
          p.departemen
        FROM rekap_presensi rp
        INNER JOIN pegawai p ON rp.id = p.id
        WHERE p.nik = ?
        AND DATE(rp.jam_datang) BETWEEN ? AND ?
        ORDER BY rp.jam_datang DESC
      `;
      
      const [rows] = await pool.execute(query, [username, startDate, endDate]);
      
      const monthlyAttendance = rows.map(row => ({
        id: row.id,
        shift: row.shift,
        tanggal: row.tanggal,
        jam_datang: row.jam_datang,
        jam_pulang: row.jam_pulang,
        status: row.status,
        keterlambatan: row.keterlambatan,
        durasi: row.durasi,
        keterangan: row.keterangan,
        photo: row.photo,
        nama: row.nama,
        jabatan: row.jabatan,
        departemen: row.departemen
      }));
      
      return {
        data: monthlyAttendance,
        total: monthlyAttendance.length,
        month: month,
        period: { startDate, endDate }
      };
    } catch (error) {
      console.error('Error getting monthly attendance:', error);
      throw error;
    }
  }

  static async checkIn(username, selectedShift = null) {
    try {
      // Get user info
      const userQuery = 'SELECT id, nama, departemen FROM pegawai WHERE nik = ?';
      const [userRows] = await pool.execute(userQuery, [username]);
      
      if (userRows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userRows[0].id;
      const userName = userRows[0].nama;
      const departemen = userRows[0].departemen;
      
      // Check if already checked in today
      const now = new Date();
      const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      const today = wibNow.toISOString().split('T')[0];
      const currentTime = wibNow.toISOString().slice(0, 19).replace('T', ' ');
      
      const checkExistingQuery = `
        SELECT id FROM rekap_presensi 
        WHERE id = ? AND DATE(jam_datang) = ?
      `;
      const [existingRows] = await pool.execute(checkExistingQuery, [userId, today]);
      
      if (existingRows.length > 0) {
        throw new Error('Sudah melakukan check in hari ini');
      }
      
      // Determine shift and status
      let shift = selectedShift || 'Pagi';
      let status = 'Tepat Waktu';
      let keterlambatan = '0';
      
      if (selectedShift) {
        // Get shift schedule
        const shiftQuery = 'SELECT jam_masuk FROM jam_jaga WHERE dep_id = ? AND shift = ?';
        const [shiftRows] = await pool.execute(shiftQuery, [departemen, selectedShift]);
        
        if (shiftRows.length > 0) {
          const jamMasuk = shiftRows[0].jam_masuk;
          const [jamMasukHour, jamMasukMinute] = jamMasuk.split(':').map(Number);
          const scheduledTime = jamMasukHour * 60 + jamMasukMinute;
          const currentTimeMinutes = wibNow.getHours() * 60 + wibNow.getMinutes();
          
          if (currentTimeMinutes > scheduledTime) {
            const lateMinutes = currentTimeMinutes - scheduledTime;
            status = lateMinutes <= 15 ? 'Terlambat Toleransi' : 'Terlambat I';
            keterlambatan = lateMinutes.toString();
          }
        }
      }
      
      // Insert attendance record
      const insertQuery = `
        INSERT INTO rekap_presensi (id, shift, jam_datang, status, keterlambatan, keterangan, photo)
        VALUES (?, ?, ?, ?, ?, '', '')
      `;
      
      await pool.execute(insertQuery, [userId, shift, currentTime, status, keterlambatan]);
      
      return {
        success: true,
        message: 'Check in berhasil',
        time: currentTime,
        user: userName,
        shift: shift,
        status: status
      };
    } catch (error) {
      console.error('Error during check in:', error);
      throw error;
    }
  }

  static async checkOut(username) {
    try {
      // Get user info
      const userQuery = 'SELECT id, nama FROM pegawai WHERE nik = ?';
      const [userRows] = await pool.execute(userQuery, [username]);
      
      if (userRows.length === 0) {
        throw new Error('User not found');
      }
      
      const userId = userRows[0].id;
      const userName = userRows[0].nama;
      
      const now = new Date();
      const wibNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
      const today = wibNow.toISOString().split('T')[0];
      const currentTime = wibNow.toISOString().slice(0, 19).replace('T', ' ');
      
      // Check if there's a check in record without check out
      const checkQuery = `
        SELECT jam_datang FROM rekap_presensi 
        WHERE id = ? AND DATE(jam_datang) = ? AND jam_pulang IS NULL
        ORDER BY jam_datang DESC LIMIT 1
      `;
      const [checkRows] = await pool.execute(checkQuery, [userId, today]);
      
      if (checkRows.length === 0) {
        throw new Error('Belum check in hari ini atau sudah check out');
      }
      
      const jamDatang = checkRows[0].jam_datang;
      
      // Calculate duration
      const checkInTime = new Date(jamDatang);
      const checkOutTime = new Date(currentTime);
      const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      const durationString = `${Math.floor(durationMinutes / 60)}:${String(durationMinutes % 60).padStart(2, '0')}`;
      
      // Update attendance record
      const updateQuery = `
        UPDATE rekap_presensi 
        SET jam_pulang = ?, durasi = ?
        WHERE id = ? AND jam_datang = ?
      `;
      
      await pool.execute(updateQuery, [currentTime, durationString, userId, jamDatang]);
      
      return {
        success: true,
        message: 'Check out berhasil',
        time: currentTime,
        user: userName,
        duration: durationString
      };
    } catch (error) {
      console.error('Error during check out:', error);
      throw error;
    }
  }

  static async getAttendanceData(username, action, options = {}) {
    const { date, limit = 30, selectedShift, month } = options;
    
    switch (action) {
      case 'get_available_shifts':
        return await this.getAvailableShifts(username);
      
      case 'get_attendance_history':
        return await this.getAttendanceHistory(username, limit);
      
      case 'get_today_attendance':
        return await this.getTodayAttendance(username, date);
      
      case 'get_monthly_attendance':
        if (!month) {
          throw new Error('Month parameter required (YYYY-MM format)');
        }
        return await this.getMonthlyAttendance(username, month);
      
      case 'check_in':
        return await this.checkIn(username, selectedShift);
      
      case 'check_out':
        return await this.checkOut(username);
      
      default:
        throw new Error('Invalid action');
    }
  }
}

export { AttendanceService };