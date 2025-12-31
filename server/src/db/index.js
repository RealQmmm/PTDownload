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
    db = new Database(dbPath, { verbose: console.log });
    console.log(`Connected to SQLite database at ${dbPath}`);
    createTables();
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
      type TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      username TEXT,
      password TEXT,
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
      item_size INTEGER DEFAULT 0,
      is_finished INTEGER DEFAULT 0,
      download_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      finish_time DATETIME,
      UNIQUE(task_id, item_guid),
      FOREIGN KEY(task_id) REFERENCES tasks(id)
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
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO stats_checkpoint (id, last_total_downloaded, last_total_uploaded) VALUES (1, 0, 0);

    -- Insert default settings
    INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'PT Manager');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('log_retention_days', '7');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('log_max_count', '100');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('search_page_limit', '1');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('cookie_check_interval', '60');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('notify_on_download_start', 'true');
    INSERT OR IGNORE INTO settings (key, value) VALUES ('checkin_time', '09:00');
  `;

  db.exec(schema);

  try { db.exec('ALTER TABLE sites ADD COLUMN username TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN upload TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN download TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN ratio TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN bonus TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN level TEXT'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN stats_updated_at DATETIME'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN cookie_status INTEGER DEFAULT 0'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN last_checked_at DATETIME'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN auto_checkin INTEGER DEFAULT 0'); } catch (e) { }
  try { db.exec('ALTER TABLE sites ADD COLUMN last_checkin_at DATETIME'); } catch (e) { }
  // Migrations for existing tables
  try { db.exec('ALTER TABLE task_history ADD COLUMN item_size INTEGER DEFAULT 0'); } catch (e) { }
  try { db.exec('ALTER TABLE task_history ADD COLUMN is_finished INTEGER DEFAULT 0'); } catch (e) { }
  try { db.exec('ALTER TABLE task_history ADD COLUMN finish_time DATETIME'); } catch (e) { }

  console.log('Database tables initialized');
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

module.exports = { initDB, getDB };
