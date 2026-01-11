require('dotenv').config();
const { setupGlobalLogger } = require('./utils/logger');
setupGlobalLogger();

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const timeUtils = require('./utils/timeUtils');
const { initDB } = require('./db');
const { authMiddleware } = require('./middleware/auth');
const authService = require('./services/authService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Set to false if you have trouble with frontend assets
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Stricter Rate Limiting for Login
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: (req, res) => {
    try {
      // Lazy load DB to avoid init issues
      const { getDB } = require('./db');
      const db = getDB();
      const row = db.prepare("SELECT value FROM settings WHERE key = 'security_login_limit'").get();
      return row ? parseInt(row.value) : 5;
    } catch (e) {
      console.warn('Rate limit DB check failed:', e.message);
      return 5; // Fallback
    }
  },
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', loginLimiter);

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || '*', // Use env var or allow all
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Initialize Database
initDB();

// Initialize App Config (cache settings like log toggle)
const appConfig = require('./utils/appConfig');
appConfig.init();

// Initialize Admin User
authService.initDefaultAdmin();

// Apply Auth Middleware to all API routes
app.use('/api', authMiddleware);

// Initialize Scheduler
const schedulerService = require('./services/schedulerService');
schedulerService.init();

// Initialize Stats Collection
const statsService = require('./services/statsService');

// Update stats immediately on start (initial collect and regular intervals)
(async () => {
  await statsService.init();
  await statsService.collectStats();
})();

// Collect every 30 seconds (Memory only)
setInterval(() => {
  statsService.collectStats();
}, 30 * 1000);

// Persist to DB every 5 minutes
setInterval(() => {
  statsService.persistStats();
}, 5 * 60 * 1000);

// Basic Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: timeUtils.getLocalISOString() });
});

// Import Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sites', require('./routes/sites'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/search', require('./routes/search'));
app.use('/api/rss-sources', require('./routes/rssSources'));
app.use('/api/download', require('./routes/download'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/logs', require('./routes/logs'));
app.use('/api/series', require('./routes/series'));
app.use('/api/download-paths', require('./routes/downloadPaths'));

// Serve static files from React app
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// API Routes should be above this
// ...

// Handle client-side routing (catch-all)
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
