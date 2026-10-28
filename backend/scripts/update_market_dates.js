const db = require('../src/config/database');

async function updateMarketDates() {
  try {
    console.log('Fetching all market price rows...');
    const [rows] = await db.execute('SELECT id, commodity, district, market FROM market_prices ORDER BY commodity, id');
    console.log(`Found ${rows.length} rows to update.`);

    // Group rows by commodity so each commodity has chronological dates across 2024 and 2025
    const commMap = {};
    rows.forEach(r => {
      if (!commMap[r.commodity]) commMap[r.commodity] = [];
      commMap[r.commodity].push(r);
    });

    // Date generation helper: spread across 2023-08 to 2025-10
    // Start date: 2023-08-01, End date: 2025-10-10
    const startMs = new Date('2023-08-01').getTime();
    const endMs   = new Date('2025-10-05').getTime();
    const totalSpan = endMs - startMs;

    let updateCount = 0;
    const batchSize = 100;

    for (const comm of Object.keys(commMap)) {
      const commRows = commMap[comm];
      const n = commRows.length;

      for (let i = 0; i < n; i++) {
        const row = commRows[i];
        // Calculate proportional timestamp + slight random jitter (up to 3 days)
        const progress = n === 1 ? 0.85 : (i / (n - 1));
        const targetMs = startMs + Math.round(progress * totalSpan);
        const jitterMs = ((i * 7) % 5 - 2) * 24 * 60 * 60 * 1000;
        const d = new Date(Math.min(endMs, Math.max(startMs, targetMs + jitterMs)));
        
        const yyyy = d.getFullYear();
        const mm   = String(d.getMonth() + 1).padStart(2, '0');
        const dd   = String(d.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        await db.execute('UPDATE market_prices SET arrival_date = ? WHERE id = ?', [dateStr, row.id]);
        updateCount++;
      }
    }

    console.log(`Successfully updated ${updateCount} rows with dates distributed across 2024 and 2025!`);

    // Verify sample distribution
    const [stats] = await db.execute(`
      SELECT 
        YEAR(arrival_date) as year, 
        COUNT(*) as count,
        MIN(arrival_date) as min_date,
        MAX(arrival_date) as max_date
      FROM market_prices 
      GROUP BY YEAR(arrival_date) 
      ORDER BY year
    `);
    console.table(stats);

    process.exit(0);
  } catch (err) {
    console.error('Error updating market dates:', err);
    process.exit(1);
  }
}

updateMarketDates();
