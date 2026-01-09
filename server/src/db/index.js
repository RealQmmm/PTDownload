const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/ptdownload.db');

// Ensure directory exists
const deployDir = path.dirname(dbPath);
if (!fs.existsSync(deployDir)) {
  fs.mkdirSync(deployDir, { recursive: true });
}

let db;

function initDB() {
  try {
    // Production mode: disable SQL query logging for cleaner output
    const isProduction = process.env.NODE_ENV === 'production';
    db = new Database(dbPath, isProduction ? {} : { verbose: console.log });
    console.log(`Connected to SQLite database at ${dbPath}`);
    createTables();

    // Migration: Add is_default to clients if not exists
    try {
      const columns = db.prepare("PRAGMA table_info(clients)").all();
      if (!columns.find(c => c.name === 'is_default')) {
        db.prepare("ALTER TABLE clients ADD COLUMN is_default INTEGER DEFAULT 0").run();
        console.log("Migrated: Added is_default to clients table");
      }
    } catch (migErr) {
      console.error("Migration error:", migErr);
    }
    // Migration: Add total_episodes to series_subscriptions if not exists
    try {
      const columns = db.prepare("PRAGMA table_info(series_subscriptions)").all();
      if (columns.length > 0 && !columns.find(c => c.name === 'total_episodes')) {
        db.prepare("ALTER TABLE series_subscriptions ADD COLUMN total_episodes INTEGER DEFAULT 0").run();
        console.log("Migrated: Added total_episodes to series_subscriptions table");
      }
    } catch (migErr) {
      console.error("Migration error (series_subscriptions):", migErr);
    }

    // Migration: Add is_default to download_paths if not exists
    try {
      db.prepare('ALTER TABLE download_paths ADD COLUMN is_default INTEGER DEFAULT 0').run();
      console.log('Migrated download_paths: added is_default column');
    } catch (e) {
      // Ignore "duplicate column name" error
      if (!e.message.includes('duplicate column name')) {
        console.error('Migration failed for download_paths:', e.message);
      }
    }
  } catch (err) {
    console.error('Error connecting to database:', err);
  }
}

function createTables() {
  const schema = `
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,

      cookies TEXT,
      api_key TEXT,
      default_rss_url TEXT,
      type TEXT DEFAULT 'NexusPHP',
      enabled INTEGER DEFAULT 1,
      cookie_status INTEGER DEFAULT 0,
      last_checked_at DATETIME,
      username TEXT,
      upload TEXT,
      download TEXT,
      ratio TEXT,
      bonus TEXT,
      level TEXT,
      stats_updated_at DATETIME,
      auto_checkin INTEGER DEFAULT 0,
      last_checkin_at DATETIME,
      site_icon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rss_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_id INTEGER,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT,
      password TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'rss', -- rss, search, etc.
      cron TEXT NOT NULL,
      site_id INTEGER,
      rss_url TEXT,
      filter_config TEXT, -- JSON: keywords, exclude, size_min, size_max
      client_id INTEGER,
      save_path TEXT,
      category TEXT,
      enabled INTEGER DEFAULT 1,
      auto_disable_on_match INTEGER DEFAULT 0, -- Auto-disable after first match (for one-time tasks like movies)
      last_run DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      item_guid TEXT,
      item_title TEXT,
      item_hash TEXT,
      item_size INTEGER DEFAULT 0,
      is_finished INTEGER DEFAULT 0,
      download_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      finish_time DATETIME,
      UNIQUE(task_id, item_guid),
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS download_paths (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      description TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );



    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT PRIMARY KEY,
      downloaded_bytes INTEGER DEFAULT 0,
      uploaded_bytes INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      run_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT, -- 'success', 'error'
      message TEXT,
      items_found INTEGER DEFAULT 0,
      items_matched INTEGER DEFAULT 0,
      FOREIGN KEY(task_id) REFERENCES tasks(id)
    );

    CREATE TABLE IF NOT EXISTS stats_checkpoint (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_total_downloaded INTEGER DEFAULT 0,
      last_total_uploaded INTEGER DEFAULT 0,
      historical_total_downloaded INTEGER DEFAULT 0,
      historical_total_uploaded INTEGER DEFAULT 0,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS site_daily_stats (
      site_id INTEGER,
      date TEXT,
      uploaded_bytes INTEGER DEFAULT 0,
      downloaded_bytes INTEGER DEFAULT 0,
      PRIMARY KEY (site_id, date),
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS series_subscriptions (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       alias TEXT, -- Original name (e.g. English title) for matching
       season TEXT,
       quality TEXT,
       smart_regex TEXT,
       rss_source_id INTEGER,
       task_id INTEGER,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       poster_path TEXT,
       tmdb_id TEXT,
       overview TEXT,
       total_episodes INTEGER DEFAULT 0,
       FOREIGN KEY(rss_source_id) REFERENCES rss_sources(id),
       FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS series_episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id INTEGER NOT NULL,
      season INTEGER NOT NULL,
      episode INTEGER NOT NULL,
      torrent_hash TEXT,
      torrent_title TEXT,
      download_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(subscription_id, season, episode),
      FOREIGN KEY(subscription_id) REFERENCES series_subscriptions(id) ON DELETE CASCADE
    );

  `;

  db.exec(schema);

  // Migration for Series Metadata
  try {
    const columns = db.prepare('PRAGMA table_info(series_subscriptions)').all();
    const hasPosterPath = columns.some(c => c.name === 'poster_path');
    if (!hasPosterPath) {
      console.log('[Migration] Adding metadata columns to series_subscriptions');
      db.prepare('ALTER TABLE series_subscriptions ADD COLUMN poster_path TEXT').run();
      db.prepare('ALTER TABLE series_subscriptions ADD COLUMN tmdb_id TEXT').run();
      db.prepare('ALTER TABLE series_subscriptions ADD COLUMN overview TEXT').run();
    }

    // Migration for alias
    const hasAlias = columns.some(c => c.name === 'alias');
    if (!hasAlias) {
      console.log('[Migration] Adding alias column to series_subscriptions');
      db.prepare('ALTER TABLE series_subscriptions ADD COLUMN alias TEXT').run();
    }

  } catch (e) {
    console.error('[Migration] Failed to check/add columns:', e.message);
  }

  // Initialize default settings
  const defaultSettings = [
    { key: 'site_name', value: 'PT Manager' },
    { key: 'log_retention_days', value: '7' },
    { key: 'log_max_count', value: '100' },
    { key: 'search_page_limit', value: '1' },
    { key: 'cookie_check_interval', value: '60' },
    { key: 'notify_on_download_start', value: 'true' },
    { key: 'checkin_time', value: '09:00' },
    { key: 'enable_system_logs', value: 'false' },
    { key: 'cleanup_enabled', value: 'false' },
    { key: 'cleanup_min_ratio', value: '2.0' },
    { key: 'cleanup_max_seeding_time', value: '336' }, // 14 days in hours
    { key: 'cleanup_delete_files', value: 'true' },
    { key: 'search_mode', value: 'browse' }, // 'browse' or 'rss'
    { key: 'tmdb_api_key', value: '107492d807d58b01d0e5104d49af4081' },
    { key: 'tmdb_base_url', value: 'https://api.themoviedb.org/3' },
    { key: 'tmdb_image_base_url', value: 'https://image.tmdb.org/t/p/w300' },
    { key: 'rss_cache_ttl', value: '300' }, // RSS cache TTL in seconds (default: 5 minutes)
    {
      key: 'category_map', value: JSON.stringify({
        '电影': ['电影', 'movie', 'movies', 'film', 'films', 'bluray', 'bd', 'dvd', '401', '402', '403', '404', '405'],
        '剧集': ['剧集', 'tv', 'series', 'tvshow', 'drama', '美剧', '日剧', '韩剧', '国产剧', 'episode', '411', '412', '413', '414', '415'],
        '动画': ['动画', 'anime', 'animation', 'cartoon', '动漫', '番剧', 'ova', 'ona', '421', '422', '423'],
        '音乐': ['音乐', 'music', 'audio', 'mp3', 'flac', 'ape', 'wav', 'album', '演唱', '演唱会', 'concert', 'live', 'mv', '431', '432', '433'],
        '综艺': ['综艺', 'variety', 'show', 'reality', '真人秀', '441', '442'],
        '纪录片': ['纪录片', 'documentary', 'docu', 'nature', 'bbc', 'discovery', '451', '452'],
        '软件': ['软件', 'software', 'app', 'application', 'program', '461', '462'],
        '游戏': ['游戏', 'game', 'games', 'gaming', 'pc', 'console', '471', '472'],
        '体育': ['体育', 'sport', 'sports', 'fitness', '481', '482'],
        '学习': ['学习', 'education', 'tutorial', 'course', 'ebook', '电子书', '491', '492'],
        '其他': ['其他', 'other', 'misc', 'miscellaneous', '499']
      })
    },
    { key: 'auto_download_enabled', value: 'false' }, // Auto download without confirmation
    { key: 'match_by_category', value: 'true' }, // Strategy 1: Exact category match
    { key: 'match_by_keyword', value: 'true' }, // Strategy 2: Keyword scoring
    { key: 'fallback_to_default_path', value: 'true' }, // Strategy 3: Default path fallback
    { key: 'use_downloader_default', value: 'true' }, // Strategy 4: Downloader default path fallback
    { key: 'enable_category_management', value: 'true' }, // Master switch for category/path feature
    { key: 'default_download_path', value: '' }, // Default download path for simple mode
    { key: 'enable_multi_path', value: 'false' }, // Multi-path management switch
    { key: 'create_series_subfolder', value: 'false' }, // Create subfolder for series downloads
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

  // Ensure checkpoint exists
  db.prepare('INSERT OR IGNORE INTO stats_checkpoint (id, last_total_downloaded, last_total_uploaded, historical_total_downloaded, historical_total_uploaded) VALUES (1, 0, 0, 0, 0)').run();

  // Insert default download paths
  const defaultPaths = [
    { name: '电影', path: '/downloads/movies', description: '电影下载目录' },
    { name: '剧集', path: '/downloads/series', description: '电视剧下载目录' },
    { name: '动画', path: '/downloads/anime', description: '动画下载目录' },
    { name: '音乐', path: '/downloads/music', description: '音乐下载目录' },
    { name: '纪录片', path: '/downloads/documentary', description: '纪录片下载目录' },
    { name: '综艺', path: '/downloads/variety', description: '综艺节目下载目录' }
  ];

  const insertPath = db.prepare('INSERT OR IGNORE INTO download_paths (id, name, path, description) VALUES (?, ?, ?, ?)');
  defaultPaths.forEach((p, index) => insertPath.run(index + 1, p.name, p.path, p.description));


  // Migrations
  const migrations = [
    'ALTER TABLE sites ADD COLUMN username TEXT',
    'ALTER TABLE sites ADD COLUMN upload TEXT',
    'ALTER TABLE sites ADD COLUMN download TEXT',
    'ALTER TABLE sites ADD COLUMN ratio TEXT',
    'ALTER TABLE sites ADD COLUMN bonus TEXT',
    'ALTER TABLE sites ADD COLUMN level TEXT',
    'ALTER TABLE sites ADD COLUMN stats_updated_at DATETIME',
    'ALTER TABLE sites ADD COLUMN cookie_status INTEGER DEFAULT 0',
    'ALTER TABLE sites ADD COLUMN last_checked_at DATETIME',
    'ALTER TABLE sites ADD COLUMN auto_checkin INTEGER DEFAULT 0',
    'ALTER TABLE sites ADD COLUMN last_checkin_at DATETIME',
    'ALTER TABLE task_history ADD COLUMN item_hash TEXT',
    'ALTER TABLE task_history ADD COLUMN item_size INTEGER DEFAULT 0',
    'ALTER TABLE task_history ADD COLUMN is_finished INTEGER DEFAULT 0',
    'ALTER TABLE task_history ADD COLUMN finish_time DATETIME',
    'ALTER TABLE stats_checkpoint ADD COLUMN historical_total_downloaded INTEGER DEFAULT 0',
    'ALTER TABLE stats_checkpoint ADD COLUMN historical_total_uploaded INTEGER DEFAULT 0',
    'ALTER TABLE task_history ADD COLUMN finish_time DATETIME',
    'ALTER TABLE stats_checkpoint ADD COLUMN historical_total_downloaded INTEGER DEFAULT 0',
    'ALTER TABLE stats_checkpoint ADD COLUMN historical_total_uploaded INTEGER DEFAULT 0',
    'ALTER TABLE clients ADD COLUMN name TEXT',
    'ALTER TABLE sites ADD COLUMN default_rss_url TEXT',
    'ALTER TABLE tasks ADD COLUMN auto_disable_on_match INTEGER DEFAULT 0',
    'ALTER TABLE sites ADD COLUMN api_key TEXT',
    'ALTER TABLE site_daily_stats ADD COLUMN downloaded_bytes INTEGER DEFAULT 0',
    'ALTER TABLE sites ADD COLUMN site_icon TEXT'
  ];

  migrations.forEach(sql => {
    try {
      db.exec(sql);
      console.log(`[Migration] Success: ${sql.substring(0, 60)}...`);
    } catch (e) {
      // Ignore "duplicate column name" errors
      if (!e.message.includes('duplicate column name')) {
        console.error(`[Migration] Failed: ${sql.substring(0, 60)}... Error: ${e.message}`);
      }
    }
  });

  // Explicit migration for site_daily_stats.downloaded_bytes (critical fix)
  try {
    const columns = db.prepare('PRAGMA table_info(site_daily_stats)').all();
    const hasDownloadedBytes = columns.some(c => c.name === 'downloaded_bytes');
    if (!hasDownloadedBytes) {
      console.log('[Migration] Adding downloaded_bytes column to site_daily_stats...');
      db.prepare('ALTER TABLE site_daily_stats ADD COLUMN downloaded_bytes INTEGER DEFAULT 0').run();
      console.log('[Migration] Added downloaded_bytes column to site_daily_stats successfully');
    }
  } catch (e) {
    console.error('[Migration] Failed to add downloaded_bytes to site_daily_stats:', e.message);
  }

  console.log('Database tables initialized');
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

module.exports = { initDB, getDB };
