const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// ── Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// ── Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logging
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── Rate limiting (global)
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,
  message: { success: false, message: 'Too many requests. Please try again later.' }
}));

// ── Serve uploaded files (soil images) — path only, not raw filesystem path
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes
app.use('/api/auth',            require('./routes/auth.routes'));
app.use('/api/users',           require('./routes/user.routes'));
app.use('/api/farms',           require('./routes/farm.routes'));
app.use('/api/soil',            require('./routes/soil.routes'));
app.use('/api/soil',            require('./routes/soil-classify.routes'));
app.use('/api/crop-history',    require('./routes/crop.routes'));
app.use('/api/weather',         require('./routes/weather.routes'));
app.use('/api/market',          require('./routes/market.routes'));
app.use('/api/recommendations', require('./routes/recommendation.routes'));
app.use('/api/insights',        require('./routes/insights.routes'));
app.use('/api/admin',           require('./routes/admin.routes'));


// ── Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CropAI API is running', timestamp: new Date() });
});

// ── 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error' : err.message
  });
});

module.exports = app;
