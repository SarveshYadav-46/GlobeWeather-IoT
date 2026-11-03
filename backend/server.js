require('dotenv').config();
const express = require('express');
const cors = require('cors');
const weatherRoutes = require('./routes/weatherRoutes');
const { initSerial, closeSerial } = require('./config/serial');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── CORS Configuration ────────────────────────────────────────────────────────
// Allow requests from React Vite frontend running on localhost / 127.0.0.1 on any dev port
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow tools, curl, and same-origin requests without origin header
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Allow dev connections
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

app.use(express.json());

// ── Simple Request Logger ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.path !== '/api/arduino/status' && req.path !== '/health') {
    console.log(`🌐 [HTTP ${req.method}] ${req.path}`);
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', weatherRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ [Server Internal Error]', err.stack || err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ── Start HTTP Server ─────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🌍 GlobeWeather Backend listening on http://localhost:${PORT}`);
  console.log(`   Local IPv4 : http://127.0.0.1:${PORT}`);
  console.log(`   COM Port   : ${process.env.COM_PORT || 'COM3'}`);
  console.log(`   Baud Rate  : ${process.env.BAUD_RATE || '9600'}`);
  console.log(`======================================================\n`);

  // Connect to Arduino Uno serial port (non-blocking)
  initSerial();
});

// ── Clean Graceful Shutdown ───────────────────────────────────────────────────
let isShuttingDown = false;
const shutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🔌 Received ${signal}. Shutting down cleanly…`);

  try {
    await closeSerial();
  } catch (e) {
    console.error('Error closing serial:', e.message);
  }

  server.close(() => {
    console.log('✅ HTTP server closed. Process exiting.');
    process.exit(0);
  });

  // Force exit after 3 seconds if server hasn't closed
  setTimeout(() => {
    console.warn('⚠️ Force exiting process.');
    process.exit(0);
  }, 3000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('💥 [Uncaught Exception]', err);
});
