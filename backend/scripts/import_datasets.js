/**
 * CropAI – Dataset Import Script
 * Imports real CSV datasets into MySQL:
 *   1. Price_Agriculture_commodities_Week.csv → market_prices
 *   2. soil_properties_AP_TS.csv              → soil_benchmarks (reference)
 *   3. daily-rainfall-at-state-level.csv      → weather_records
 *
 * Run: node backend/scripts/import_datasets.js
 */

const path = require('path');
const fs   = require('fs');
const mysql = require('mysql2/promise');

// Parse simple CSV
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ? cols[idx].trim() : null; });
    rows.push(row);
  }
  return { headers, rows };
}

async function main() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME || 'crop_recommendation_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Basheer@123',
    waitForConnections: true, connectionLimit: 5
  });

  const DATA_DIR = path.join(__dirname, '../../data/raw');

  // ── 1. Market Prices ──────────────────────────────────────────────────────
  console.log('\n[1/3] Importing market prices …');
  const { rows: mRows } = parseCSV(path.join(DATA_DIR, 'Price_Agriculture_commodities_Week.csv'));

  // Ensure market_prices table has right columns
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS market_prices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      state VARCHAR(100),
      district VARCHAR(100),
      market VARCHAR(150),
      commodity VARCHAR(100),
      variety VARCHAR(100),
      grade VARCHAR(50),
      arrival_date DATE,
      min_price DECIMAL(10,2),
      max_price DECIMAL(10,2),
      modal_price DECIMAL(10,2),
      unit VARCHAR(30) DEFAULT 'Rs/Quintal',
      source VARCHAR(100) DEFAULT 'Agmarknet',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_commodity (commodity),
      INDEX idx_district (district),
      INDEX idx_arrival_date (arrival_date)
    )
  `);

  // Add source column if missing (upgrade)
  try {
    await pool.execute("ALTER TABLE market_prices ADD COLUMN source VARCHAR(100) DEFAULT 'Agmarknet'");
  } catch(e) { /* already exists */ }

  // Clear old imported data
  await pool.execute("DELETE FROM market_prices WHERE source = 'Agmarknet' OR source IS NULL");

  let mImported = 0, mSkipped = 0;
  for (const r of mRows) {
    try {
      // Parse date: "28-07-2023" → "2023-07-28"
      let dateVal = null;
      if (r['Arrival_Date']) {
        const parts = r['Arrival_Date'].split('-');
        if (parts.length === 3) dateVal = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      await pool.execute(
        `INSERT INTO market_prices (state, district, market, commodity, variety, grade,
          arrival_date, min_price, max_price, modal_price, unit, source)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r['State'] || null,
          r['District'] || null,
          r['Market'] || null,
          r['Commodity'] || null,
          r['Variety'] || null,
          r['Grade'] || null,
          dateVal,
          parseFloat(r['Min Price']) || null,
          parseFloat(r['Max Price']) || null,
          parseFloat(r['Modal Price']) || null,
          'Rs/Quintal',
          'Agmarknet'
        ]
      );
      mImported++;
    } catch (e) {
      mSkipped++;
    }
  }
  console.log(`  Market prices: ${mImported} imported, ${mSkipped} skipped`);

  // ── 2. Soil Benchmarks ───────────────────────────────────────────────────
  console.log('\n[2/3] Importing soil benchmark data …');
  const { rows: sRows } = parseCSV(path.join(DATA_DIR, 'soil_properties_AP_TS.csv'));

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS soil_benchmarks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      state VARCHAR(100),
      district VARCHAR(100),
      soil_type VARCHAR(100),
      nitrogen_kg_ha DECIMAL(8,2),
      phosphorus_kg_ha DECIMAL(8,2),
      potassium_kg_ha DECIMAL(8,2),
      ph DECIMAL(4,2),
      organic_carbon_pct DECIMAL(5,3),
      soil_moisture_pct DECIMAL(5,2),
      ec_ds_m DECIMAL(6,3),
      source VARCHAR(100) DEFAULT 'soil_properties_AP_TS',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_district (district),
      INDEX idx_soil_type (soil_type)
    )
  `);
  await pool.execute("DELETE FROM soil_benchmarks WHERE source = 'soil_properties_AP_TS'");

  let sImported = 0, sSkipped = 0;
  for (const r of sRows) {
    try {
      await pool.execute(
        `INSERT INTO soil_benchmarks (state, district, soil_type, nitrogen_kg_ha, phosphorus_kg_ha,
          potassium_kg_ha, ph, organic_carbon_pct, soil_moisture_pct, ec_ds_m, source)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          r['State'] || null,
          r['District'] || null,
          r['Soil_Type'] || null,
          parseFloat(r['Nitrogen_kg_ha']) || null,
          parseFloat(r['Phosphorus_kg_ha']) || null,
          parseFloat(r['Potassium_kg_ha']) || null,
          parseFloat(r['pH']) || null,
          parseFloat(r['Organic_Carbon_percent']) || null,
          parseFloat(r['Soil_Moisture_percent']) || null,
          parseFloat(r['EC_dS_m']) || null,
          'soil_properties_AP_TS'
        ]
      );
      sImported++;
    } catch (e) {
      sSkipped++;
    }
  }
  console.log(`  Soil benchmarks: ${sImported} imported, ${sSkipped} skipped`);

  // ── 3. Rainfall Data ─────────────────────────────────────────────────────
  console.log('\n[3/3] Importing rainfall data …');
  const { rows: rRows } = parseCSV(path.join(DATA_DIR, 'daily-rainfall-at-state-level.csv'));

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS rainfall_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      state VARCHAR(100),
      date DATE,
      normal_mm DECIMAL(8,2),
      actual_mm DECIMAL(8,2),
      departure_pct DECIMAL(7,2),
      source VARCHAR(100) DEFAULT 'IMD',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_state (state),
      INDEX idx_date (date)
    )
  `);
  await pool.execute("DELETE FROM rainfall_records WHERE source = 'IMD'");

  let rImported = 0, rSkipped = 0;
  for (const r of rRows) {
    try {
      // Detect column names (may vary)
      const stateKey = Object.keys(r).find(k => k.toLowerCase().includes('state'));
      const dateKey  = Object.keys(r).find(k => k.toLowerCase().includes('date'));
      const normalKey = Object.keys(r).find(k => k.toLowerCase().includes('normal'));
      const actualKey = Object.keys(r).find(k => k.toLowerCase().includes('actual'));
      const departureKey = Object.keys(r).find(k => k.toLowerCase().includes('departure'));

      let dateVal = null;
      if (r[dateKey]) {
        const d = r[dateKey];
        // Try YYYY-MM-DD or DD-MM-YYYY
        if (/^\d{4}-\d{2}-\d{2}/.test(d)) dateVal = d.slice(0, 10);
        else if (/^\d{2}-\d{2}-\d{4}/.test(d)) {
          const p = d.split('-'); dateVal = `${p[2]}-${p[1]}-${p[0]}`;
        }
      }

      await pool.execute(
        `INSERT INTO rainfall_records (state, date, normal_mm, actual_mm, departure_pct, source)
         VALUES (?,?,?,?,?,?)`,
        [
          stateKey ? r[stateKey] : null,
          dateVal,
          normalKey ? parseFloat(r[normalKey]) || null : null,
          actualKey ? parseFloat(r[actualKey]) || null : null,
          departureKey ? parseFloat(r[departureKey]) || null : null,
          'IMD'
        ]
      );
      rImported++;
    } catch (e) {
      rSkipped++;
    }
  }
  console.log(`  Rainfall records: ${rImported} imported, ${rSkipped} skipped`);

  console.log('\n✅ Dataset import complete!');
  await pool.end();
}

main().catch(err => {
  console.error('❌ Import failed:', err.message);
  process.exit(1);
});
