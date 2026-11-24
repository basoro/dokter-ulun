import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

// Authentication service
export class AuthService {
  static async getSessionPoliAssignments(username) {
    const sql = `
      SELECT jadwal.kd_poli, poliklinik.nm_poli
      FROM dokter
      JOIN jadwal ON dokter.kd_dokter = jadwal.kd_dokter
      JOIN poliklinik ON jadwal.kd_poli = poliklinik.kd_poli
      WHERE dokter.kd_dokter = ?
      GROUP BY jadwal.kd_poli
    `;

    const rows = await executeQuery(sql, [username]);
    const poliRows = Array.isArray(rows) ? rows : [];

    if (poliRows.length === 0) {
      return {
        jenis_poli: '',
        jenis_poli_sore: '',
        jenis_poli_list: [],
        jenis_poli_sore_list: [],
        jadwal_poli: []
      };
    }

    // Tentukan poli pagi dan sore berdasarkan nama poli (konvensi RS: "PAGI"/"SORE"),
    // bukan berdasarkan urutan baris, agar sesi tidak tertukar saat urutan tidak stabil.
    // Semua poli non-sore dijadikan sesi pagi (mis. POLI PARU PAGI + POLI MCU).
    const getPoliName = (row) => String(row?.nm_poli || '').toUpperCase();
    const sorePolis = poliRows.filter((row) => getPoliName(row).includes('SORE'));
    const pagiPolis = poliRows.filter((row) => !getPoliName(row).includes('SORE'));
    const sorePoli = sorePolis[0] || null;
    const pagiPoli = poliRows.find((row) => getPoliName(row).includes('PAGI'))
      || pagiPolis[0]
      || sorePoli
      || null;

    return {
      jenis_poli: pagiPoli?.kd_poli || '',
      jenis_poli_sore: sorePoli?.kd_poli || '',
      jenis_poli_list: pagiPolis.map((row) => row.kd_poli),
      jenis_poli_sore_list: sorePolis.map((row) => row.kd_poli),
      jadwal_poli: poliRows.map((row) => ({
        kd_poli: row.kd_poli,
        nm_poli: row.nm_poli
      }))
    };
  }

  // Authenticate user
  static async authenticateUser(username, password) {
    try {
      // Query user with doctor information
      const sql = `
        SELECT u.id as id_user, u.username, u.fullname, u.password, u.cap, d.no_telp, d.jk
        FROM mlite_users u 
        LEFT JOIN dokter d ON u.username = d.kd_dokter 
        WHERE u.username = ?
      `;
      
      const users = await executeQuery(sql, [username]);
      
      if (!users || users.length !== 1) {
        throw new Error('Kode dokter tidak terdaftar atau tidak aktif.');
      }
      
      const user = users[0];
      
      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.password);
      
      if (!isPasswordValid) {
        throw new Error('Kata kunci tidak valid.');
      }
      
      // Process user data
      return await this.processUserData(user);
      
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }
  
  // Verify password with bcrypt
  static async verifyPassword(plainPassword, hashedPassword) {
    try {
      let hashToCompare = hashedPassword;
      
      // Convert PHP $2y$ to Node.js compatible $2a$
      if (hashedPassword.startsWith('$2y$')) {
        hashToCompare = hashedPassword.replace(/^\$2y\$/, '$2a$');
      }
      
      return bcrypt.compareSync(plainPassword, hashToCompare);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }
  
  // Process user data
  static async processUserData(user) {
    const capValue = user.cap || '';
    const kdPoliArray = capValue.split(',')
      .map(item => item.trim())
      .filter(item => item && item !== '');
    
    const kdPoliString = kdPoliArray.join(',');
    const poliAssignments = await this.getSessionPoliAssignments(user.username);
    
    return {
      id_user: user.id_user,
      fullname: user.fullname,
      username: user.username,
      kd_poli: kdPoliString,
      all_poli: kdPoliArray,
      jenis_poli: poliAssignments.jenis_poli,
      jenis_poli_sore: poliAssignments.jenis_poli_sore,
      jadwal_poli: poliAssignments.jadwal_poli,
      jk: user.jk || 'L',
      no_telp: user.no_telp || null
    };
  }
  
  // Get user by username
  static async getUserByUsername(username) {
    try {
      const sql = `
        SELECT u.id as id_user, u.username, u.fullname, u.cap, d.no_telp, d.jk
        FROM mlite_users u 
        LEFT JOIN dokter d ON u.username = d.kd_dokter 
        WHERE u.username = ?
      `;
      
      const users = await executeQuery(sql, [username]);
      
      if (!users || users.length !== 1) {
        return null;
      }
      
      return await this.processUserData(users[0]);
      
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }
  
  // Validate user permissions for poli
  static async validatePoliAccess(username, kdPoli) {
    try {
      const user = await this.getUserByUsername(username);
      
      if (!user) {
        return false;
      }
      
      // Check if user has access to the requested poli
      return user.all_poli.includes(kdPoli);
      
    } catch (error) {
      console.error('Poli access validation error:', error);
      return false;
    }
  }

  static async changePassword(username, currentPassword, newPassword) {
    const normalizedUsername = String(username || '').trim();
    const normalizedCurrentPassword = String(currentPassword || '');
    const normalizedNewPassword = String(newPassword || '');

    if (!normalizedUsername || !normalizedCurrentPassword || !normalizedNewPassword) {
      throw new Error('Username, password lama, dan password baru wajib diisi');
    }

    if (normalizedNewPassword.length < 6) {
      throw new Error('Password baru minimal 6 karakter');
    }

    try {
      const sql = `
        SELECT username, password
        FROM mlite_users
        WHERE username = ?
        LIMIT 1
      `;
      const users = await executeQuery(sql, [normalizedUsername]);
      const user = Array.isArray(users) ? users[0] : null;

      if (!user) {
        throw new Error('Pengguna tidak ditemukan');
      }

      const isPasswordValid = await this.verifyPassword(
        normalizedCurrentPassword,
        String(user.password || '')
      );

      if (!isPasswordValid) {
        throw new Error('Password lama tidak sesuai');
      }

      const hashedPassword = bcrypt.hashSync(normalizedNewPassword, 10);

      await executeQuery(
        `
          UPDATE mlite_users
          SET password = ?
          WHERE username = ?
        `,
        [hashedPassword, normalizedUsername]
      );

      return {
        success: true,
        message: 'Password berhasil diperbarui'
      };
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }
}
