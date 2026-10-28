const express = require('express');
const { body, validationResult } = require('express-validator');
const db   = require('../config/database');
const auth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(auth);

// ── GET /api/farms — all farms for logged-in user
router.get('/', async (req, res) => {
  try {
    let [farms] = await db.execute(
      'SELECT * FROM farms WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]
    );

    // Auto-create a primary farm for user if they have 0 registered farms
    if (farms.length === 0) {
      try {
        const [farmIns] = await db.execute(
          `INSERT INTO farms (user_id, farm_name, area, area_unit, soil_type, state, district, village)
           VALUES (?, 'Primary Field', 5.0, 'acres', 'Black Soil', 'Andhra Pradesh', 'Nandyal', 'Nandyal')`,
          [req.user.id]
        );
        const [newFarms] = await db.execute('SELECT * FROM farms WHERE id=?', [farmIns.insertId]);
        farms = newFarms;
      } catch(e) {
        console.error('Auto-create farm error:', e);
      }
    }

    return res.json({ success: true, farms });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch farms: ' + err.message });
  }
});

// ── POST /api/farms
router.post('/', [
  body('farm_name').trim().notEmpty().withMessage('Farm name is required'),
  body('area').optional().isFloat({ min: 0 }),
  body('latitude').optional().isFloat(),
  body('longitude').optional().isFloat()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { farm_name, area, area_unit, soil_type, irrigation_type, state, district, village, latitude, longitude } = req.body;
  try {
    const [result] = await db.execute(
      `INSERT INTO farms (user_id, farm_name, area, area_unit, soil_type, irrigation_type,
       state, district, village, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, farm_name, area || null, area_unit || 'acres', soil_type || null,
       irrigation_type || null, state || null, district || null, village || null,
       latitude || null, longitude || null]
    );
    return res.status(201).json({
      success: true,
      message: 'Farm created.',
      farmId: result.insertId,
      farm: { id: result.insertId, farm_name, state, district, village }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not create farm: ' + err.message });
  }
});

// ── GET /api/farms/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM farms WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Farm not found.' });
    return res.json({ success: true, farm: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch farm.' });
  }
});

// ── PUT /api/farms/:id
router.put('/:id', async (req, res) => {
  const { farm_name, area, area_unit, soil_type, irrigation_type, state, district, village } = req.body;
  try {
    const [check] = await db.execute('SELECT id FROM farms WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!check.length) return res.status(404).json({ success: false, message: 'Farm not found.' });

    await db.execute(
      `UPDATE farms SET farm_name=?, area=?, area_unit=?, soil_type=?, irrigation_type=?, state=?, district=?, village=? WHERE id=?`,
      [farm_name, area, area_unit, soil_type, irrigation_type, state, district, village, req.params.id]
    );
    return res.json({ success: true, message: 'Farm updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not update farm.' });
  }
});

// ── DELETE /api/farms/:id
router.delete('/:id', async (req, res) => {
  try {
    const [check] = await db.execute('SELECT id FROM farms WHERE id=? AND user_id=?', [req.params.id, req.user.id]);
    if (!check.length) return res.status(404).json({ success: false, message: 'Farm not found.' });

    await db.execute('DELETE FROM farms WHERE id=?', [req.params.id]);
    return res.json({ success: true, message: 'Farm deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not delete farm.' });
  }
});

module.exports = router;
