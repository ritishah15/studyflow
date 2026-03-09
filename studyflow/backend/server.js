// server.js
// StudyFlow AI — Express server entry point

require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const morgan       = require('morgan');
const rateLimit    = require('express-rate-limit');
const path         = require('path');

// ── Initialise DB (runs migrations) ──────────────────────────────────────────
require('./config/database');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/auth');
const notesRoutes    = require('./routes/notes');
const deadlineRoutes = require('./routes/deadlines');
const { studyPlansRouter, resourceRouter } = require('./routes/studyPlans');
const paymentRoutes  = require('./routes/payments');
const aiRoutes       = require('./routes/ai');           // ← NEW
const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security Headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:5500')
  .split(',').map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsers ──────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payments/webhook') return next();
  express.json({ limit: '2mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── Request Logging ───────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Global Rate Limiting ──────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
  max:       parseInt(process.env.RATE_LIMIT_MAX_REQUESTS)    || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a few minutes before retrying.' },
});
app.use('/api/', globalLimiter);

// AI endpoints stricter limit
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AI_RATE_LIMIT_MAX) || 20,
  message: { error: 'AI rate limit reached. Please wait before making more AI requests.' },
});
app.use('/api/ai/', aiLimiter);

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/notes',       notesRoutes);
app.use('/api/deadlines',   deadlineRoutes);
app.use('/api/study-plans', studyPlansRouter);
app.use('/api/resources',   resourceRouter);
app.use('/api/payments',    paymentRoutes);
app.use('/api/ai',          aiRoutes);          // ← NEW — AI proxy for frontend

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    version: '1.0.0',
    env:     process.env.NODE_ENV || 'development',
    time:    new Date().toISOString(),
    ai:      !!process.env.ANTHROPIC_API_KEY ? 'configured' : 'MISSING API KEY',
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found.` });
});

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ── Error Handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 StudyFlow AI Backend running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   AI proxy    : http://localhost:${PORT}/api/ai/*`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(`\n⚠️  WARNING: ANTHROPIC_API_KEY is not set in .env — AI features will not work!\n`);
  }
});

module.exports = app;