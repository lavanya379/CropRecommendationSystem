const express = require('express');
const axios   = require('axios');
const multer  = require('multer');
const auth    = require('../middleware/auth.middleware');

const router = express.Router();
router.use(auth);

// Multer: memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

// ── POST /api/soil/classify — send image as base64 to ML service /classify-soil
router.post('/classify', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file uploaded.' });
  }

  try {
    const base64Data = req.file.buffer.toString('base64');
    const image_base64 = `data:${req.file.mimetype};base64,${base64Data}`;

    const mlUrl = `${process.env.ML_SERVICE_URL || 'http://localhost:8000'}/classify-soil`;
    const response = await axios.post(mlUrl, { image_base64 }, {
      timeout: 15000
    });

    return res.json({ success: true, ...response.data });
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    console.error('Soil classify error:', detail);
    return res.status(503).json({
      success: false,
      message: `Soil classification failed: ${detail}`
    });
  }
});

module.exports = router;
