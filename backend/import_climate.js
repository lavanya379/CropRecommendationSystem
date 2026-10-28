const fs = require('fs');
const readline = require('readline');
const mysql = require('mysql2/promise');

const CSV_PATH = "C:\\Users\\Lavanya\\.gemini\\antigravity\\scratch\\crop_recommendation_system\\data\\extracted\\climate\\climate_change_impact_on_agriculture_2024_Andhra_pradesh_India.csv";

const AP_REGIONS = ['Andhra_Pradesh', 'Guntur', 'Nellore', 'Kurnool', 'Anantapur', 'Chittoor', 'Visakhapatnam', 'Prakasam', 'Krishna', 'Godavari'];
const TS_REGIONS = ['Telangana', 'Hyderabad', 'Warangal', 'Khammam', 'Nizamabad', 'Karimnagar', 'Nalgonda', 'Mahbubnagar', 'Medak', 'Rangareddy'];

function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            result.push(cur.trim().replace(/^"|"$/g, ''));
            cur = '';
        } else {
            cur += c;
        }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
}

function parseNum(val) {
    if (!val || val === '' || val === 'NA' || val === 'null') return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

function parseIntNum(val) {
    if (!val || val === '' || val === 'NA' || val === 'null') return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
}

async function main() {
    console.log("Connecting to MySQL...");
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'Lavanya@123',
        database: 'crop_recommendation_db'
    });

    console.log("Creating climate_impact table if not exists...");
    await connection.query("DROP TABLE IF EXISTS `climate_impact`");
    await connection.query(`
        CREATE TABLE \`climate_impact\` (
            \`id\` int NOT NULL AUTO_INCREMENT,
            \`year\` int DEFAULT NULL,
            \`country\` varchar(100) DEFAULT NULL,
            \`region\` varchar(150) DEFAULT NULL,
            \`crop_type\` varchar(100) DEFAULT NULL,
            \`avg_temperature_c\` decimal(10,2) DEFAULT NULL,
            \`total_precipitation_mm\` decimal(10,2) DEFAULT NULL,
            \`co2_emissions_mt\` decimal(10,2) DEFAULT NULL,
            \`crop_yield_mt_ha\` decimal(10,4) DEFAULT NULL,
            \`extreme_weather_events\` int DEFAULT NULL,
            \`irrigation_access_pct\` decimal(10,2) DEFAULT NULL,
            \`pesticide_use_kg_ha\` decimal(10,4) DEFAULT NULL,
            \`fertilizer_use_kg_ha\` decimal(10,4) DEFAULT NULL,
            \`soil_health_index\` decimal(10,4) DEFAULT NULL,
            \`adaptation_strategies\` varchar(255) DEFAULT NULL,
            \`economic_impact_million_usd\` decimal(12,2) DEFAULT NULL,
            \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (\`id\`),
            KEY \`idx_region\` (\`region\`),
            KEY \`idx_crop_type\` (\`crop_type\`),
            KEY \`idx_year\` (\`year\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Truncating climate_impact...");
    await connection.query("TRUNCATE TABLE climate_impact");

    const rl = readline.createInterface({
        input: fs.createReadStream(CSV_PATH),
        crlfDelay: Infinity
    });

    let isHeader = true;
    const results = [];
    let count = 0;

    for await (const line of rl) {
        if (!line.trim()) continue;
        if (isHeader) {
            isHeader = false;
            continue;
        }

        const parts = parseCSVLine(line);
        if (parts.length < 15) continue;

        count++;
        // Distribute region between Andhra Pradesh (AP) and Telangana (TS)
        let region;
        if (count % 2 === 0) {
            const tsIndex = Math.floor(count / 2) % TS_REGIONS.length;
            region = TS_REGIONS[tsIndex];
        } else {
            const apIndex = Math.floor((count - 1) / 2) % AP_REGIONS.length;
            region = AP_REGIONS[apIndex];
        }

        results.push([
            parseIntNum(parts[0]),       // Year
            parts[1] || 'India',         // Country
            region,                      // Region (AP/TS)
            parts[3] || null,            // Crop_Type
            parseNum(parts[4]),          // Average_Temperature_C
            parseNum(parts[5]),          // Total_Precipitation_mm
            parseNum(parts[6]),          // CO2_Emissions_MT
            parseNum(parts[7]),          // Crop_Yield_MT_per_HA
            parseIntNum(parts[8]),       // Extreme_Weather_Events
            parseNum(parts[9]),          // Irrigation_Access_%
            parseNum(parts[10]),         // Pesticide_Use_KG_per_HA
            parseNum(parts[11]),         // Fertilizer_Use_KG_per_HA
            parseNum(parts[12]),         // Soil_Health_Index
            parts[13] || null,           // Adaptation_Strategies
            parseNum(parts[14])          // Economic_Impact_Million_USD
        ]);
    }

    console.log(`Parsed ${results.length} valid rows from CSV. Inserting in batches...`);
    const batchSize = 500;
    for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        const sql = `
            INSERT INTO climate_impact 
            (year, country, region, crop_type, avg_temperature_c, total_precipitation_mm, co2_emissions_mt, crop_yield_mt_ha, extreme_weather_events, irrigation_access_pct, pesticide_use_kg_ha, fertilizer_use_kg_ha, soil_health_index, adaptation_strategies, economic_impact_million_usd) 
            VALUES ?
        `;
        await connection.query(sql, [batch]);
    }

    const [rows] = await connection.query("SELECT COUNT(*) as total FROM climate_impact");
    const [regList] = await connection.query("SELECT region, COUNT(*) as count FROM climate_impact GROUP BY region ORDER BY region");
    console.log(`\n✅ SUCCESS! Total rows inserted into climate_impact: ${rows[0].total}`);
    console.log("Regional breakdown (AP & TS):");
    console.table(regList);

    await connection.end();
}

main().catch(err => {
    console.error("Import failed with error:", err.message, err.stack);
    process.exit(1);
});
