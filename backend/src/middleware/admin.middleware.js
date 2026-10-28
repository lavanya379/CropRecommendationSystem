const jwt = require('jsonwebtoken');
const db  = require('../config/database');

// ── Verify admin JWT (admins table)
const adminMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Admin access required.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Forbidden: Admin access only.' });
    }

    const [rows] = await db.query('SELECT id, name, email, role, status FROM admins WHERE id = ?', [decoded.id]);
    if (!rows.length || rows[0].status !== 'active') {
      return res.status(401).json({ success: false, message: 'Admin account not found or inactive.' });
    }
    req.admin = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Admin session expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid admin token.' });
  }
};

module.exports = adminMiddleware;
