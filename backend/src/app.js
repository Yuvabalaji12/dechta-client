'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const rateLimit  = require('express-rate-limit');

const authRoutes    = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes   = require('./routes/orderRoutes');
const vendorRoutes  = require('./routes/vendorRoutes');
const errorHandler  = require('./middleware/errorHandler');

const app = express();

// ── Security & Performance ────────────────────────────────────
app.use(helmet());
app.use(compression());

// ── CORS ──────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Rate Limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  message: { error: 'Too many requests. Try again in 15 minutes.' },
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 20,
  message: { error: 'Too many auth attempts. Wait 10 minutes.' },
});

// ── Body Parsing ──────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/products', apiLimiter,  productRoutes);
app.use('/api/orders',   apiLimiter,  orderRoutes);
app.use('/api/vendors',  apiLimiter,  vendorRoutes);

// ── Health Check ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const pool = require('./config/db');
    const { rows } = await pool.query('SELECT NOW() AS time');
    return res.json({ status: 'ok', dbTime: rows[0].time, server: 'dechta-client-backend' });
  } catch (e) {
    return res.status(503).json({ status: 'error', message: e.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` })
);

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

module.exports = app;
