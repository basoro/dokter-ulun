import express from 'express';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Middleware CORS
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'authorization, x-client-info, apikey, content-type'
  );
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

router.post('/login', async (req, res) => {
  const { username, password, remember } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username or password empty' });
  }

  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'test',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    });

    const [rows] = await connection.execute(
      `SELECT u.id as id_user, u.username, u.fullname, u.password, u.cap, d.no_telp
       FROM mlite_users u
       LEFT JOIN dokter d ON u.username = d.kd_dokter
       WHERE u.username = ?`,
      [username]
    );

    await connection.end();

    if (!rows || rows.length !== 1) {
      return res.status(401).json({ success: false, error: 'Kode dokter tidak terdaftar atau tidak aktif.' });
    }

    const user = rows[0];
    const storedPassword = user.password;
    let hashToCompare = storedPassword;

    if (storedPassword.startsWith('$2y$')) {
      hashToCompare = storedPassword.replace(/^\$2y\$/, '$2a$');
    }

    const isPasswordValid = bcrypt.compareSync(password, hashToCompare);

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Kata kunci tidak valid.' });
    }

    const capValue = user.cap || '';
    const kdPoliArray = capValue.split(',').map(p => p.trim()).filter(Boolean);
    const kdPoliString = kdPoliArray.join(',');

    return res.json({
      success: true,
      user: {
        id_user: user.id_user,
        fullname: user.fullname,
        username,
        kd_poli: kdPoliString,
        all_poli: kdPoliArray,
        no_telp: user.no_telp || null
      },
      remember: remember || false
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Database connection error' });
  }
});

export default router;

