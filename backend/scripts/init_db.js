const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function setup() {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'Basheer@123';

  console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);
  const conn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });

  console.log('Reading schema.sql...');
  const schemaSql = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
  console.log('Applying schema.sql...');
  await conn.query(schemaSql);
  console.log('✅ Schema applied successfully.');

  console.log('Reading seed.sql...');
  const seedSql = fs.readFileSync(path.join(__dirname, '../database/seed.sql'), 'utf8');
  console.log('Applying seed.sql...');
  try {
    await conn.query(seedSql);
    console.log('✅ Seed data inserted successfully.');
  } catch (e) {
    console.log('⚠️ Seed note:', e.message);
  }

  await conn.end();
  console.log('Database initialization completed successfully!');
}

setup().catch(err => {
  console.error('❌ Database setup failed:', err);
  process.exit(1);
});
