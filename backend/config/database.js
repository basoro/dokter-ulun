import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
// Catatan: mysql2 hanya mengenali opsi pool di bawah ini. Opsi lama seperti
// `acquireTimeout`, `timeout`, dan `reconnect` diabaikan oleh mysql2 sehingga
// backend tidak pernah benar-benar punya batas waktu menunggu koneksi.
const POOL_LIMIT = Number(process.env.DB_POOL_LIMIT || 15);
const ACQUIRE_TIMEOUT_MS = Number(process.env.DB_ACQUIRE_TIMEOUT_MS || 15000);
const QUERY_TIMEOUT_MS = Number(process.env.DB_QUERY_TIMEOUT_MS || 30000);
const LOCK_WAIT_TIMEOUT_SECONDS = Number(process.env.DB_LOCK_WAIT_TIMEOUT_S || 20);
const MAX_EXECUTION_TIME_MS = Number(process.env.DB_MAX_EXECUTION_TIME_MS || 30000);
const SESSION_GUARDS_ENABLED = String(process.env.DB_SESSION_GUARDS || 'on').toLowerCase() !== 'off';

const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'mlite',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: POOL_LIMIT,
  maxIdle: POOL_LIMIT,
  idleTimeout: 60000,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Pool wajib punya listener 'error': tanpa ini, error koneksi idle yang kedua
// akan menjadi unhandled 'error' event dan mematikan proses Node.
pool.on('error', (error) => {
  console.error('❌ MySQL pool error:', error.message);
});

// Batas waktu per sesi: lock wait dan durasi SELECT. Ini hanya berlaku untuk
// koneksi milik backend ini (SET SESSION), bukan perubahan konfigurasi server.
if (SESSION_GUARDS_ENABLED) {
  pool.pool.on('connection', (connection) => {
    connection.query(
      `SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_SECONDS}, max_execution_time = ${MAX_EXECUTION_TIME_MS}`,
      (error) => {
        if (error) {
          console.error('⚠️ Gagal memasang session guard MySQL:', error.message);
        }
      }
    );
  });
}

// Batasi durasi query agar satu query lambat tidak menahan koneksi pool.
const applyQueryTimeout = (executor) => (sql, values) => {
  if (typeof sql === 'string') {
    return executor({ sql, timeout: QUERY_TIMEOUT_MS }, values);
  }

  if (sql && typeof sql === 'object' && sql.timeout === undefined) {
    return executor({ ...sql, timeout: QUERY_TIMEOUT_MS }, values);
  }

  return executor(sql, values);
};

pool.execute = applyQueryTimeout(pool.execute.bind(pool));
pool.query = applyQueryTimeout(pool.query.bind(pool));

// Test database connection
export const testConnection = async () => {
  try {
    const connection = await getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Ambil koneksi dari pool mana pun dengan batas waktu.
// mysql2 menaruh permintaan di queue tanpa batas waktu ketika pool penuh, jadi
// backend bisa menggantung selamanya. Promise.race di bawah memaksa gagal cepat.
export const acquireConnection = async (targetPool, timeoutMs = ACQUIRE_TIMEOUT_MS) => {
  const pending = targetPool.getConnection();
  let timer;

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(
        `Timeout ${timeoutMs}ms menunggu koneksi database (pool penuh)`
      );
      error.code = 'POOL_ACQUIRE_TIMEOUT';
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([pending, timeoutPromise]);
  } catch (error) {
    // Kalau pool akhirnya memberikan koneksi setelah timeout, koneksi itu harus
    // dikembalikan supaya tidak hilang dari pool.
    pending
      .then((connection) => connection.release())
      .catch(() => {});
    console.error('Error getting database connection:', error.message);
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

// Get connection from the shared pool.
export const getConnection = async (timeoutMs = ACQUIRE_TIMEOUT_MS) =>
  acquireConnection(pool, timeoutMs);

// Pool terpisah untuk service yang butuh opsi koneksi berbeda (mis. timezone),
// tetap memakai timeout dan keep-alive yang sama.
export const createServicePool = (overrides = {}, { connectionLimit = 5, label = 'service' } = {}) => {
  const servicePool = mysql.createPool({
    ...dbConfig,
    connectionLimit,
    maxIdle: connectionLimit,
    ...overrides
  });

  servicePool.on('error', (error) => {
    console.error(`❌ MySQL ${label} pool error:`, error.message);
  });

  servicePool.execute = applyQueryTimeout(servicePool.execute.bind(servicePool));
  servicePool.query = applyQueryTimeout(servicePool.query.bind(servicePool));

  return servicePool;
};

// Execute query with automatic connection management
export const executeQuery = async (sql, params = []) => {
  let connection;
  try {
    connection = await getConnection();
    const [rows] = await connection.execute({ sql, timeout: QUERY_TIMEOUT_MS }, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Statistik pool untuk endpoint /health.
export const getPoolStats = () => {
  const corePool = pool.pool;
  return {
    limit: POOL_LIMIT,
    allConnections: corePool?._allConnections?.length ?? 0,
    freeConnections: corePool?._freeConnections?.length ?? 0,
    queuedRequests: corePool?._connectionQueue?.length ?? 0,
    acquireTimeoutMs: ACQUIRE_TIMEOUT_MS,
    queryTimeoutMs: QUERY_TIMEOUT_MS
  };
};

// Close pool
export const closePool = async () => {
  try {
    await pool.end();
    console.log('Database pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

export default pool;
