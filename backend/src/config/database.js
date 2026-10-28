const mysql = require('mysql2/promise');

// Parse database configuration supporting both DATABASE_URL (Cloud providers like TiDB, Aiven, Railway)
// and standard individual environment variables (DB_HOST, DB_USER, etc.)
function getPoolConfig() {
  const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

  // Serverless pooling defaults
  const baseOptions = {
    waitForConnections: true,
    connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT) : 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: '+05:30'
  };

  const useSsl = process.env.DB_SSL === 'true' || 
                 (dbUrl && (dbUrl.includes('ssl') || dbUrl.includes('tidbcloud') || dbUrl.includes('aivencloud')));

  if (dbUrl) {
    return {
      uri: dbUrl,
      ...baseOptions,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'crop_recommendation_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Lavanya@123',
    ...baseOptions,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined
  };
}

const pool = mysql.createPool(getPoolConfig());

// Gracefully verify connection on cold starts without terminating serverless invocations
pool.getConnection()
  .then(conn => {
    console.log(`✅ Connected successfully to MySQL (${process.env.DB_NAME || 'crop_recommendation_db'})!`);
    conn.release();
  })
  .catch(err => {
    console.warn('⚠️ MySQL connection notice on start:', err.message);
  });

module.exports = pool;
