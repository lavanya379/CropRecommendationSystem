const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'crop_recommendation_db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'Lavanya@123',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+05:30'
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('✅ Connected successfully to MySQL (crop_recommendation_db)!');
    conn.release();
  })
  .catch(err => {
    console.error('❌ MySQL connection failed:', err.message);
  });

module.exports = pool;
