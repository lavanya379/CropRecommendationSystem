/**
 * CropAI – Market Prices Import (fixed)
 * Run: node backend/scripts/import_market.js
 */

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function main() {
  const pool = await mysql.createPool({
    host: 'localhost', port: 3306,
    database: 'crop_recommendation_db',
    user: 'root', password: 'Lavanya@123',
    waitForConnections: true, connectionLimit: 5
  });

  const DATA_DIR = path.join(__dirname, '../../data/raw');
  const csvPath  = path.join(DATA_DIR, 'Price_Agriculture_commodities_Week.csv');

  // Read CSV
  const raw     = fs.readFileSync(csvPath, 'utf8');
  const lines   = raw.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  console.log(`CSV has ${lines.length - 1} data rows, headers: ${headers}`);

  // Ensure source column exists
  try { await pool.execute("ALTER TABLE market_prices ADD COLUMN source VARCHAR(100) DEFAULT 'Agmarknet'"); }
  catch(e) { /* already exists */ }

  // Only delete Agmarknet rows (from previous runs)
  const [before] = await pool.execute('SELECT COUNT(*) AS c FROM market_prices');
  console.log(`Rows before import: ${before[0].c}`);
  await pool.execute("DELETE FROM market_prices WHERE source = 'Agmarknet'");

  let imported = 0, skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 10) { skipped++; continue; }

    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ? cols[idx].trim() : null; });

    // Parse date "DD-MM-YYYY" → "YYYY-MM-DD"
    let dateVal = null;
    if (row['Arrival_Date']) {
      const p = row['Arrival_Date'].split('-');
      if (p.length === 3 && p[2].length === 4) {
        dateVal = `${p[2]}-${p[1].padStart(2,'0')}-${p[0].padStart(2,'0')}`;
      }
    }

    try {
      await pool.execute(
        `INSERT INTO market_prices
           (state, district, market, commodity, variety, grade, arrival_date,
            min_price, max_price, modal_price, source)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          row['State']     || null,
          row['District']  || null,
          row['Market']    || null,
          row['Commodity'] || null,
          row['Variety']   || null,
          row['Grade']     || null,
          dateVal,
          parseFloat(row['Min Price'])   || null,
          parseFloat(row['Max Price'])   || null,
          parseFloat(row['Modal Price']) || null,
          'Agmarknet'
        ]
      );
      imported++;
    } catch (e) {
      skipped++;
      if (skipped <= 3) console.error(`  Skip row ${i}: ${e.message}`);
    }

    if (imported % 500 === 0 && imported > 0) {
      console.log(`  ... ${imported} imported`);
    }
  }

  const [after] = await pool.execute('SELECT COUNT(*) AS c FROM market_prices');
  console.log(`\nDone: ${imported} imported, ${skipped} skipped`);
  console.log(`Total rows after: ${after[0].c}`);

  // Show sample
  const [sample] = await pool.execute(
    'SELECT commodity, district, modal_price, arrival_date FROM market_prices ORDER BY arrival_date DESC LIMIT 5'
  );
  console.log('\nSample rows:');
  sample.forEach(r => console.log(`  ${r.commodity} | ${r.district} | Rs.${r.modal_price} | ${r.arrival_date}`));

  await pool.end();
}

main().catch(err => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
