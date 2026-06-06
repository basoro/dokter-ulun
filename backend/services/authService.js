import bcrypt from 'bcryptjs';
import { executeQuery } from '../config/database.js';

// Authentication service
export class AuthService {
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
      return this.processUserData(user);
      
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
  static processUserData(user) {
    const capValue = user.cap || '';
    const kdPoliArray = capValue.split(',')
      .map(item => item.trim())
      .filter(item => item && item !== '');
    
    const kdPoliString = kdPoliArray.join(',');
    
    return {
      id_user: user.id_user,
      fullname: user.fullname,
      username: user.username,
      kd_poli: kdPoliString,
      all_poli: kdPoliArray,
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
      
      return this.processUserData(users[0]);
      
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
}