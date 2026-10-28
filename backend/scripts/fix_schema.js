const mysql = require('mysql2/promise');
async function fix() {
  const pool = await mysql.createPool({
    host:'localhost', port:3306,
    database:'crop_recommendation_db',
    user:'root', password:'Lavanya@123'
  });
  try {
    await pool.execute("ALTER TABLE market_prices ADD COLUMN unit VARCHAR(30) DEFAULT 'Rs/Quintal' AFTER modal_price");
    console.log('Added unit column to market_prices');
  } catch(e) { console.log('unit column:', e.message); }
  
  // Verify
  const [cols] = await pool.execute('DESCRIBE market_prices');
  console.log('Final columns:', cols.map(c => c.Field).join(', '));
  await pool.end();
}
fix().catch(console.error);
