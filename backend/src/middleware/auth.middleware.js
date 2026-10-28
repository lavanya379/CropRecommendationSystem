const jwt = require('jsonwebtoken');
const db  = require('../config/database');

// ── Verify JWT and attach user to request
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access denied. Please log in.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch fresh user record
    const [rows] = await db.query('SELECT id, name, email, role, status FROM users WHERE id = ?', [decoded.id]);
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ success: false, message: 'Account not found or deactivated.' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = authMiddleware;
