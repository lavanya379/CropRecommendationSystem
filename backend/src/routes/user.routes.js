const express = require('express');
const { body, validationResult } = require('express-validator');
const db   = require('../config/database');
const auth = require('../middleware/auth.middleware');

const router = express.Router();
router.use(auth);

// ── GET /api/users/profile
router.get('/profile', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, email, phone, state, district, village, preferred_language, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch profile.' });
  }
});

// ── PUT /api/users/profile
router.put('/profile', [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().isMobilePhone(),
  body('state').optional().trim(),
  body('district').optional().trim(),
  body('village').optional().trim(),
  body('preferred_language').optional().trim()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, phone, state, district, village, preferred_language } = req.body;
  try {
    await db.execute(
      `UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone),
       state=COALESCE(?,state), district=COALESCE(?,district),
       village=COALESCE(?,village), preferred_language=COALESCE(?,preferred_language)
       WHERE id=?`,
      [name || null, phone || null, state || null, district || null, village || null, preferred_language || null, req.user.id]
    );
    return res.json({ success: true, message: 'Profile updated successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not update profile.' });
  }
});

module.exports = router;
