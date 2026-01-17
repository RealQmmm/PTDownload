const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// 数据库路径智能检测逻辑：
// 1. 优先检查外部挂载路径 /external_db 是否存在
// 2. 如果存在，使用外部数据库 /external_db/ptdownload.db
// 3. 否则使用内置数据库 /data/ptdownload.db
// 
// 用户只需在 docker-compose.yml 中配置 volume 映射即可：
// volumes:
//   - /your/path:/external_db  # 配置这个就自动使用外部数据库
//
// 无需设置 USE_EXTERNAL_DB 环境变量！

let dbPath;
let useExternalDB = false;

// 检查外部数据库目录是否存在
const externalDBDir = '/external_db';
const externalDBPath = path.join(externalDBDir, 'ptdownload.db');
const internalDBPath = process.env.DB_PATH || '/data/ptdownload.db';

if (fs.existsSync(externalDBPath)) {
  // External database file exists, use it
  dbPath = externalDBPath;
  useExternalDB = true;
  console.log(`[Database] External database file found at: ${externalDBPath}`);
  console.log(`[Database] Using EXTERNAL database at: ${dbPath}`);
} else if (fs.existsSync(externalDBDir)) {
  // External directory exists but no database file, log warning and use internal
  console.log(`[Database] External directory exists at ${externalDBDir} but no database file found`);
  console.log(`[Database] Using INTERNAL database at: ${internalDBPath}`);
  dbPath = internalDBPath;
  useExternalDB = false;
} else {
  // External directory doesn't exist, use internal database
  dbPath = internalDBPath;
  useExternalDB = false;
  console.log(`[Database] External directory not found, using INTERNAL database`);
  console.log(`[Database] Using INTERNAL database at: ${dbPath}`);
}

// Ensure directory exists
const deployDir = path.dirname(dbPath);
if (!fs.existsSync(deployDir)) {
  console.log(`[Database] Creating directory: ${deployDir}`);
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
      if (!e.message.includes('duplicate column name')) {
        console.error('Migration failed for download_paths:', e.message);
      }
    }

    // Migration: Add site_id to task_history if not exists
    try {
      const columns = db.prepare("PRAGMA table_info(task_history)").all();
      if (columns.length > 0 && !columns.find(c => c.name === 'site_id')) {
        db.prepare("ALTER TABLE task_history ADD COLUMN site_id INTEGER").run();
        console.log("Migrated: Added site_id to task_history table");
      }
    } catch (migErr) {
      console.error("Migration error (task_history):", migErr);
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
      supports_checkin INTEGER DEFAULT 1,
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
      user_id INTEGER, -- User who created the task
      last_run DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(site_id) REFERENCES sites(id),
      FOREIGN KEY(client_id) REFERENCES clients(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      site_id INTEGER,
      item_guid TEXT,
      item_title TEXT,
      item_hash TEXT,
      item_size INTEGER DEFAULT 0,
      is_finished INTEGER DEFAULT 0,
      download_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      finish_time DATETIME,
      user_id INTEGER, -- Associated user who started the download
      UNIQUE(task_id, item_guid),
      FOREIGN KEY(task_id) REFERENCES tasks(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
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
      role TEXT DEFAULT 'user',
      permissions TEXT, -- JSON string for granular permissions
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS series_subscriptions (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       alias TEXT, -- Original name (e.g. English title) for matching
       season TEXT,
       quality TEXT,
       smart_regex TEXT,
       smart_switch INTEGER DEFAULT 0, -- Enable multi-site aggregation
       rss_source_id INTEGER,
       task_id INTEGER,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       poster_path TEXT,
       tmdb_id TEXT,
       overview TEXT,
       total_episodes INTEGER DEFAULT 0,
       check_interval INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS login_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      ip TEXT,
      user_agent TEXT,
      device_name TEXT,
      browser TEXT,
      os TEXT,
      status TEXT, -- success, failed
      message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS hot_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_hash TEXT UNIQUE,
      site_id INTEGER,
      title TEXT NOT NULL,
      url TEXT,
      download_url TEXT,
      size INTEGER DEFAULT 0,
      seeders INTEGER DEFAULT 0,
      leechers INTEGER DEFAULT 0,
      category TEXT,
      promotion TEXT,
      publish_time DATETIME,
      hot_score INTEGER DEFAULT 0,
      notified INTEGER DEFAULT 0,
      downloaded INTEGER DEFAULT 0,
      user_action TEXT, -- 'ignored', 'downloaded', 'pending'
      detected_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(site_id) REFERENCES sites(id)
    );
    CREATE TABLE IF NOT EXISTS pwa_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      endpoint TEXT UNIQUE NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      device_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
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
    {
      key: 'rss_filter_rules', value: JSON.stringify({
        exclude: ['movie', 'film', '电影', 'music', '音乐', 'game', '游戏', 'docu', '纪录', 'sport', '体育', 'book', '书籍', 'software', '软件'],
        include: ['series', 'tv', '剧集', 'soap', 'show', 'all', '综合', '聚合']
      })
    },
    { key: 'hot_resources_enabled', value: 'false' },
    { key: 'hot_resources_check_interval', value: '10' },
    { key: 'hot_resources_auto_download', value: 'false' },
    { key: 'hot_resources_default_client', value: '' },
    {
      key: 'hot_resources_rules', value: JSON.stringify({
        minSeeders: 0, // Lowered from 20 since RSS often doesn't provide this
        minLeechers: 0, // Lowered from 5 since RSS often doesn't provide this
        minSize: 0,
        maxSize: 0,
        scoreThreshold: 30, // Lowered from 40 to account for new scoring
        minPublishMinutes: 1440, // 24 hours
        enabledSites: [],
        categories: [],
        keywords: [], // Users can add keywords they're interested in
        excludeKeywords: [],
        enabledPromotions: ['Free', '2xFree', '2x', '50%', '30%']
      })
    },
    { key: 'notify_on_hot_resource', value: 'true' },
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(s => insertSetting.run(s.key, s.value));

  // Ensure checkpoint exists
  db.prepare('INSERT OR IGNORE INTO stats_checkpoint (id, last_total_downloaded, last_total_uploaded, historical_total_downloaded, historical_total_uploaded) VALUES (1, 0, 0, 0, 0)').run();

  // Insert default download paths only if the table is empty
  const pathCount = db.prepare('SELECT COUNT(*) as count FROM download_paths').get().count;
  if (pathCount === 0) {
    const defaultPaths = [
      { name: '电影', path: '/downloads/movies', description: '电影下载目录' },
      { name: '剧集', path: '/downloads/series', description: '电视剧下载目录' },
      { name: '动画', path: '/downloads/anime', description: '动画下载目录' },
      { name: '音乐', path: '/downloads/music', description: '音乐下载目录' },
      { name: '纪录片', path: '/downloads/documentary', description: '纪录片下载目录' },
      { name: '综艺', path: '/downloads/variety', description: '综艺节目下载目录' }
    ];

    const insertPath = db.prepare('INSERT INTO download_paths (name, path, description) VALUES (?, ?, ?)');
    defaultPaths.forEach(p => insertPath.run(p.name, p.path, p.description));
    console.log('[Database] Initialized default download paths');
  }



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
    'ALTER TABLE sites ADD COLUMN site_icon TEXT',
    'ALTER TABLE users ADD COLUMN role TEXT DEFAULT \'user\'',
    'ALTER TABLE sites ADD COLUMN supports_checkin INTEGER DEFAULT 1',
    'ALTER TABLE sites ADD COLUMN custom_config TEXT'
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

  // Migration for 2026-01-10: Add permissions to users, user_id to task_history
  try {
    db.prepare("ALTER TABLE users ADD COLUMN permissions TEXT").run();
    console.log('[Migration] Added permissions column to users table');
  } catch (e) { /* Column might already exist */ }

  try {
    db.prepare("ALTER TABLE task_history ADD COLUMN user_id INTEGER").run();
    console.log('[Migration] Added user_id column to task_history table');
  } catch (e) { /* Column might already exist */ }

  try {
    db.prepare("ALTER TABLE tasks ADD COLUMN user_id INTEGER").run();
    console.log('[Migration] Added user_id column to tasks table');
  } catch (e) { /* Column might already exist */ }

  try {
    db.prepare("ALTER TABLE series_subscriptions ADD COLUMN user_id INTEGER").run();
    console.log('[Migration] Added user_id column to series_subscriptions table');
  } catch (e) { /* Column might already exist */ }

  // Set default permissions for existing users
  try {
    const fullPermissions = JSON.stringify({
      menus: ['dashboard', 'search', 'series', 'tasks', 'sites', 'clients', 'settings', 'help'],
      settings: ['general', 'category', 'notifications', 'backup', 'maintenance', 'network', 'logs', 'security', 'about']
    });
    const defaultUserPermissions = JSON.stringify({
      menus: ['dashboard', 'search', 'series', 'help'],
      settings: ['general', 'about']
    });

    // Fix: Ensure the 'admin' user is actually an admin if we just added the role column
    db.prepare("UPDATE users SET role = 'admin' WHERE username = 'admin'").run();

    // If no admin exists after migration, make the first user an admin
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
    if (adminCount === 0) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = (SELECT id FROM users ORDER BY id ASC LIMIT 1)").run();
    }

    db.prepare("UPDATE users SET permissions = ? WHERE role = 'admin'").run(fullPermissions);
    db.prepare("UPDATE users SET permissions = ? WHERE role = 'user' AND (permissions IS NULL OR permissions = '')").run(defaultUserPermissions);
    console.log('[Migration] Updated default permissions for users (Admin fixed)');

    // Migration: Associate historical tasks with the first admin
    try {
      const firstAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").get();
      if (firstAdmin) {
        db.prepare("UPDATE tasks SET user_id = ? WHERE user_id IS NULL").run(firstAdmin.id);
        db.prepare("UPDATE task_history SET user_id = ? WHERE user_id IS NULL").run(firstAdmin.id);
        db.prepare("UPDATE series_subscriptions SET user_id = ? WHERE user_id IS NULL").run(firstAdmin.id);
        console.log(`[Migration] Associated historical tasks with admin ID: ${firstAdmin.id}`);
      }
    } catch (e) {
      console.error('[Migration] Failed to associate historical tasks:', e.message);
    }
  } catch (e) {
    console.error('[Migration] Failed to set default permissions:', e.message);
  }

  // Migration for User Status (2026-01-10)
  try {
    db.prepare("ALTER TABLE users ADD COLUMN enabled INTEGER DEFAULT 1").run();
    console.log('[Migration] Added enabled column to users table');
  } catch (e) { /* Column might already exist */ }

  // Migration for Series Score (2026-01-10)
  try {
    db.prepare("ALTER TABLE series_subscriptions ADD COLUMN vote_average REAL DEFAULT 0").run();
    console.log('[Migration] Added vote_average column to series_subscriptions table');
  } catch (e) { /* Column might already exist */ }

  // Migration for Smart Switch (2026-01-10)
  try {
    db.prepare("ALTER TABLE series_subscriptions ADD COLUMN smart_switch INTEGER DEFAULT 0").run();
    console.log('[Migration] Added smart_switch column to series_subscriptions table');
  } catch (e) { /* Column might already exist */ }

  // Migration for Douban Rating (2026-01-11)
  try {
    db.prepare("ALTER TABLE series_subscriptions ADD COLUMN douban_rating REAL DEFAULT 0").run();
    console.log('[Migration] Added douban_rating column to series_subscriptions table');
  } catch (e) { /* Column might already exist */ }

  // Migration for Check Interval (2026-01-16)
  try {
    db.prepare("ALTER TABLE series_subscriptions ADD COLUMN check_interval INTEGER DEFAULT 0").run();
    console.log('[Migration] Added check_interval column to series_subscriptions table');
  } catch (e) { /* Column might already exist */ }

  // Final settings to ensure foreign keys
  db.prepare('PRAGMA foreign_keys = ON').run();
  console.log('Database tables initialized');
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function getDBPath() {
  return dbPath;
}

module.exports = { initDB, getDB, getDBPath };
