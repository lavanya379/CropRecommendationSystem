const express = require('express');
const db   = require('../config/database');
const auth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(auth);

// ── GET /api/crop-history/:farmId
router.get('/:farmId', async (req, res) => {
  try {
    const [check] = await db.query('SELECT id FROM farms WHERE id=? AND user_id=?', [req.params.farmId, req.user.id]);
    if (!check.length) return res.status(403).json({ success: false, message: 'Farm not found.' });
    const [records] = await db.query(
      'SELECT * FROM crop_history WHERE farm_id=? ORDER BY year DESC, created_at DESC', [req.params.farmId]
    );
    return res.json({ success: true, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch crop history.' });
  }
});

// ── POST /api/crop-history
router.post('/', async (req, res) => {
  const { farm_id, crop_name, season, year, yield_amount, yield_unit, area_cultivated,
          irrigation_used, fertilizer_info, crop_performance, notes } = req.body;
  if (!farm_id || !crop_name || !season || !year) {
    return res.status(400).json({ success: false, message: 'farm_id, crop_name, season and year are required.' });
  }
  try {
    const [check] = await db.query('SELECT id FROM farms WHERE id=? AND user_id=?', [farm_id, req.user.id]);
    if (!check.length) return res.status(403).json({ success: false, message: 'Farm not found.' });

    const [result] = await db.query(
      `INSERT INTO crop_history (farm_id, crop_name, season, year, yield_amount, yield_unit,
       area_cultivated, irrigation_used, fertilizer_info, crop_performance, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [farm_id, crop_name, season, year, yield_amount || null, yield_unit || 'quintals',
       area_cultivated || null, irrigation_used || null, fertilizer_info || null,
       crop_performance || null, notes || null]
    );
    return res.status(201).json({ success: true, message: 'Crop history saved.', id: result.insertId });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not save crop history.' });
  }
});

// ── PUT /api/crop-history/:id
router.put('/:id', async (req, res) => {
  const { crop_name, season, year, yield_amount, yield_unit, area_cultivated,
          irrigation_used, fertilizer_info, crop_performance, notes } = req.body;
  try {
    // Verify ownership via farm
    const [rows] = await db.query(
      `SELECT ch.id FROM crop_history ch JOIN farms f ON ch.farm_id=f.id
       WHERE ch.id=? AND f.user_id=?`, [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });

    await db.query(
      `UPDATE crop_history SET crop_name=COALESCE(?,crop_name), season=COALESCE(?,season),
       year=COALESCE(?,year), yield_amount=COALESCE(?,yield_amount),
       yield_unit=COALESCE(?,yield_unit), area_cultivated=COALESCE(?,area_cultivated),
       irrigation_used=COALESCE(?,irrigation_used), fertilizer_info=COALESCE(?,fertilizer_info),
       crop_performance=COALESCE(?,crop_performance), notes=COALESCE(?,notes) WHERE id=?`,
      [crop_name, season, year, yield_amount, yield_unit, area_cultivated,
       irrigation_used, fertilizer_info, crop_performance, notes, req.params.id]
    );
    return res.json({ success: true, message: 'Crop history updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not update record.' });
  }
});

// ── DELETE /api/crop-history/:id
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ch.id FROM crop_history ch JOIN farms f ON ch.farm_id=f.id
       WHERE ch.id=? AND f.user_id=?`, [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Record not found.' });
    await db.query('DELETE FROM crop_history WHERE id=?', [req.params.id]);
    return res.json({ success: true, message: 'Crop history deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not delete record.' });
  }
});

module.exports = router;
