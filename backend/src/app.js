const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();

// ── Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

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

// ── Serve Frontend static assets & web pages (Production & Serverless Support)
const fs = require('fs');
const frontendPath = fs.existsSync(path.resolve(process.cwd(), 'frontend'))
  ? path.resolve(process.cwd(), 'frontend')
  : path.resolve(__dirname, '..', '..', 'frontend');

app.use(express.static(frontendPath));

// Web page routing & clean URLs
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(frontendPath, 'register.html'));
});

app.get('/user/:page', (req, res, next) => {
  const page = req.params.page.endsWith('.html') ? req.params.page : `${req.params.page}.html`;
  const file = path.join(frontendPath, 'user', page);
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  next();
});

app.get('/admin/:page', (req, res, next) => {
  const page = req.params.page.endsWith('.html') ? req.params.page : `${req.params.page}.html`;
  const file = path.join(frontendPath, 'admin', page);
  if (fs.existsSync(file)) {
    return res.sendFile(file);
  }
  next();
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
