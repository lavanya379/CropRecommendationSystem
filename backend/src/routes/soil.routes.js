const express = require('express');
const db      = require('../config/database');
const auth    = require('../middleware/auth.middleware');

const router = express.Router();
router.use(auth);

// ── POST /api/soil — save soil record ────────────────────────────────────────
router.post('/', async (req, res) => {
  const { farm_id, nitrogen, phosphorus, potassium, ph, moisture, organic_carbon, soil_type } = req.body;
  if (!farm_id) return res.status(400).json({ success: false, message: 'farm_id is required.' });

  try {
    const [check] = await db.execute(
      'SELECT id FROM farms WHERE id=? AND user_id=?',
      [farm_id, req.user.id]
    );
    if (!check.length) return res.status(403).json({ success: false, message: 'Farm not found or access denied.' });

    // Check if soil_records table has soil_type column
    let sql, params;
    try {
      sql = `INSERT INTO soil_records (farm_id, nitrogen, phosphorus, potassium, ph, moisture, organic_carbon, soil_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      params = [
        farm_id,
        nitrogen    !== undefined ? parseFloat(nitrogen)    : null,
        phosphorus  !== undefined ? parseFloat(phosphorus)  : null,
        potassium   !== undefined ? parseFloat(potassium)   : null,
        ph          !== undefined ? parseFloat(ph)          : null,
        moisture    !== undefined ? parseFloat(moisture)    : null,
        organic_carbon !== undefined ? parseFloat(organic_carbon) : null,
        soil_type   || null
      ];
    } catch(e) {
      sql = `INSERT INTO soil_records (farm_id, nitrogen, phosphorus, potassium, ph) VALUES (?,?,?,?,?)`;
      params = [farm_id, parseFloat(nitrogen)||null, parseFloat(phosphorus)||null, parseFloat(potassium)||null, parseFloat(ph)||null];
    }

    const [result] = await db.execute(sql, params);
    return res.status(201).json({ success: true, message: 'Soil record saved.', soilId: result.insertId });
  } catch (err) {
    // Try without soil_type if column missing
    try {
      const [result] = await db.execute(
        `INSERT INTO soil_records (farm_id, nitrogen, phosphorus, potassium, ph, moisture, organic_carbon) VALUES (?,?,?,?,?,?,?)`,
        [farm_id, parseFloat(nitrogen)||null, parseFloat(phosphorus)||null, parseFloat(potassium)||null,
         parseFloat(ph)||null, parseFloat(moisture)||null, parseFloat(organic_carbon)||null]
      );
      return res.status(201).json({ success: true, message: 'Soil record saved.', soilId: result.insertId });
    } catch(err2) {
      console.error('Soil save error:', err2.message);
      return res.status(500).json({ success: false, message: 'Could not save soil data: ' + err2.message });
    }
  }
});

// ── GET /api/soil/:farmId — get soil records for a farm ───────────────────────
router.get('/:farmId', async (req, res) => {
  try {
    const [check] = await db.execute(
      'SELECT id FROM farms WHERE id=? AND user_id=?',
      [req.params.farmId, req.user.id]
    );
    if (!check.length) return res.status(403).json({ success: false, message: 'Farm not found.' });

    const [records] = await db.execute(
      'SELECT * FROM soil_records WHERE farm_id=? ORDER BY created_at DESC',
      [req.params.farmId]
    );
    return res.json({ success: true, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch soil data.' });
  }
});

// ── GET /api/soil/benchmarks/:district — get AP/TS soil reference data ────────
router.get('/benchmarks/:district', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT * FROM soil_benchmarks WHERE district LIKE ? ORDER BY district LIMIT 10`,
      [`%${req.params.district}%`]
    );
    return res.json({ success: true, benchmarks: rows });
  } catch (err) {
    return res.json({ success: true, benchmarks: [], message: 'Benchmark table not available.' });
  }
});

module.exports = router;
