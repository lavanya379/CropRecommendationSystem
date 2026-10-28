const express = require('express');
const db   = require('../config/database');
const adminAuth = require('../middleware/admin.middleware');

const router = express.Router();
router.use(adminAuth);

// ── GET /api/admin/dashboard — Real DB stats
router.get('/dashboard', async (req, res) => {
  try {
    const [[{ totalUsers }]] = await db.execute("SELECT COUNT(*) as totalUsers FROM users WHERE role='user'");
    const [[{ activeUsers }]] = await db.execute("SELECT COUNT(*) as activeUsers FROM users WHERE role='user' AND status='active'");
    const [[{ totalFarms }]] = await db.execute("SELECT COUNT(*) as totalFarms FROM farms");
    const [[{ totalRecommendations }]] = await db.execute("SELECT COUNT(*) as totalRecommendations FROM recommendations");
    const [[{ todayRecommendations }]] = await db.execute("SELECT COUNT(*) as todayRecommendations FROM recommendations WHERE DATE(created_at) = CURDATE()");

    let soilImages = 0;
    try {
      const [[resImg]] = await db.execute("SELECT COUNT(*) as soilImages FROM soil_images");
      soilImages = resImg ? resImg.soilImages : 0;
    } catch(e) {}

    return res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalFarms,
        totalRecommendations,
        todayRecommendations,
        soilImages
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not load dashboard stats: ' + err.message });
  }
});

// ── GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.execute("SELECT id, name, email, phone, state, district, status, created_at FROM users WHERE role='user' ORDER BY created_at DESC");
    return res.json({ success: true, users });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch users.' });
  }
});

// ── PUT /api/admin/users/:id/status (Toggle user active/inactive status)
router.put('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    await db.execute("UPDATE users SET status = ? WHERE id = ?", [status, req.params.id]);
    return res.json({ success: true, message: `User status updated to ${status}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not update user status.' });
  }
});

// ── GET /api/admin/datasets — Return dataset inventory summary
router.get('/datasets', async (req, res) => {
  try {
    const datasets = [
      { name: 'Crop_recommendation.csv', description: 'Soil chemistry & climate parameters for 22 crops', rows: 2200, size: '142 KB', status: 'Loaded in ML Model' },
      { name: 'Price_Agriculture_commodities_Week.csv', description: 'AP & TS Mandi daily commodity prices', rows: 2120, size: '210 KB', status: 'Ingested into MySQL' },
      { name: 'soil_properties_AP_TS.csv', description: 'District-level soil chemical benchmarks (N, P, K, pH)', rows: 1992, size: '185 KB', status: 'Ingested into MySQL' },
      { name: 'daily-rainfall-at-state-level.csv', description: 'State & district historical rainfall statistics', rows: 2000, size: '190 KB', status: 'Ingested into MySQL' }
    ];
    return res.json({ success: true, datasets });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Could not fetch dataset info.' });
  }
});

// ── GET /api/admin/logs — Activity logs
router.get('/logs', async (req, res) => {
  try {
    const [logs] = await db.execute("SELECT id, user_id, action, ip_address, created_at FROM activity_logs ORDER BY created_at DESC LIMIT 50");
    return res.json({ success: true, logs });
  } catch (err) {
    return res.json({ success: true, logs: [] });
  }
});

module.exports = router;
