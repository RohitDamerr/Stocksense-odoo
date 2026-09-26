'use strict';

const express       = require('express');
const cookieParser  = require('cookie-parser');
const env           = require('./config/env');
const { errorMiddleware } = require('./middleware/error.middleware');

// ── Route modules ──────────────────────────────────────────────────────────────
const authRoutes         = require('./routes/auth.routes');
const categoryRoutes     = require('./routes/category.routes');
const productRoutes      = require('./routes/product.routes');
const receiptRoutes      = require('./routes/receipt.routes');
const deliveryRoutes     = require('./routes/delivery.routes');
const warehouseRoutes    = require('./routes/warehouse.routes');
const locationRoutes     = require('./routes/location.routes');
const supplierRoutes     = require('./routes/supplier.routes');
const transferRoutes     = require('./routes/transfer.routes');
const adjustmentRoutes   = require('./routes/adjustment.routes');
const notificationRoutes = require('./routes/notification.routes');
const userRoutes         = require('./routes/users.routes');
const dashboardRoutes    = require('./routes/dashboard.routes');
const stockLedgerRoutes  = require('./routes/stock-ledger.routes');
const operationsRoutes   = require('./routes/operations.routes');

// ── App factory ────────────────────────────────────────────────────────────────

function createApp() {
  const app = express();

  // ── Core middleware ──────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // ── CORS (frontend runs on a different origin, e.g. http://localhost:4000)
  // No extra deps — manual middleware. Allowed origins come from FRONTEND_URL
  // env (comma-separated). Echoes back the request origin when allowed.
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:4000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Security headers (minimal, no extra deps)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // ── Health check (no auth required) ─────────────────────────────────────────
  app.get('/health', (req, res) => {
    res.json({ success: true, message: 'StockSense API is running', env: env.NODE_ENV });
  });

  // ── API routes ───────────────────────────────────────────────────────────────
  app.use('/api/auth',            authRoutes);
  app.use('/api/categories',      categoryRoutes);
  app.use('/api/products',        productRoutes);
  app.use('/api/receipts',        receiptRoutes);
  app.use('/api/delivery-orders', deliveryRoutes);
  app.use('/api/warehouses',      warehouseRoutes);
  app.use('/api/locations',       locationRoutes);
  app.use('/api/suppliers',       supplierRoutes);
  app.use('/api/transfers',       transferRoutes);
  app.use('/api/adjustments',     adjustmentRoutes);
  app.use('/api/notifications',   notificationRoutes);
  app.use('/api/users',           userRoutes);
  app.use('/api/dashboard',       dashboardRoutes);
  app.use('/api/stock-ledger',    stockLedgerRoutes);
  app.use('/api/operations',      operationsRoutes);

  // ── 404 handler ──────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { message: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' },
    });
  });

  // ── Global error handler (must be last) ─────────────────────────────────────
  app.use(errorMiddleware);

  return app;
}

module.exports = { createApp };
