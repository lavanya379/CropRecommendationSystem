const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const db       = require('../config/database');

const router = express.Router();

// Strict rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' }
});

// ── POST /api/auth/register
router.post('/register', authLimiter, [
  body('name').trim().notEmpty().withMessage('Full name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().isMobilePhone(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number'),
  body('confirm_password').custom((val, { req }) => {
    if (val !== req.body.password) throw new Error('Passwords do not match');
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { name, email, phone, password, state, district, village, preferred_language } = req.body;

  try {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'This email is already registered.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users (name, email, password_hash, phone, state, district, village, preferred_language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hash, phone || null, state || null, district || null, village || null, preferred_language || 'English']
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Please log in.',
      userId: result.insertId
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Invalid email or password format.' });
  }

  const { email, password } = req.body;

  try {
    let [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    let accountType = 'user';

    if (!rows.length) {
      // Check admins table
      const [adminRows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
      if (adminRows.length) {
        rows = adminRows;
        accountType = 'admin';
      } else {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
    }

    const user = rows[0];
    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account has been deactivated. Contact admin.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const role = user.role || accountType;

    const token = jwt.sign(
      { id: user.id, email: user.email, role: role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Log activity
    try {
      await db.query(
        'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
        [user.id, role === 'admin' ? 'ADMIN_LOGIN' : 'USER_LOGIN', req.ip]
      );
    } catch (_) {}

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: role, state: user.state || null, district: user.district || null }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/admin-login
router.post('/admin-login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Invalid credentials.' });
  }

  const { email, password } = req.body;

  try {
    const [rows] = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const admin = rows[0];
    if (admin.status !== 'active') {
      return res.status(403).json({ success: false, message: 'Admin account inactive.' });
    }

    const match = await bcrypt.compare(password, admin.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      success: true,
      message: 'Admin login successful',
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

// ── GET /api/auth/me
router.get('/me', require('../middleware/auth.middleware'), async (req, res) => {
  return res.json({ success: true, user: req.user });
});

// ── POST /api/auth/logout (client-side token removal; log server-side)
router.post('/logout', require('../middleware/auth.middleware'), async (req, res) => {
  try {
    await db.query(
      'INSERT INTO activity_logs (user_id, action, ip_address) VALUES (?, ?, ?)',
      [req.user.id, 'USER_LOGOUT', req.ip]
    );
  } catch (_) {}
  return res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
