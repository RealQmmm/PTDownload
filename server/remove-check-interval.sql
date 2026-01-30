-- 移除追剧周期功能的数据库清理脚本
-- 此脚本将移除 series_subscriptions 表中的 check_interval 字段
-- 保留原有任务的 cron 定时设置不变

-- 注意：SQLite 不支持 ALTER TABLE DROP COLUMN，需要重建表

-- 1. 创建新表（不包含 check_interval 字段）
CREATE TABLE series_subscriptions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    alias TEXT,
    season TEXT,
    quality TEXT,
    smart_regex TEXT,
    rss_source_id INTEGER,
    task_id INTEGER UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    poster_path TEXT,
    tmdb_id INTEGER,
    overview TEXT,
    vote_average REAL DEFAULT 0,
    total_episodes INTEGER DEFAULT 0,
    user_id INTEGER,
    smart_switch INTEGER DEFAULT 0,
    FOREIGN KEY (rss_source_id) REFERENCES rss_sources(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. 复制数据（排除 check_interval）
INSERT INTO series_subscriptions_new 
    (id, name, alias, season, quality, smart_regex, rss_source_id, task_id, created_at, 
     poster_path, tmdb_id, overview, vote_average, total_episodes, user_id, smart_switch)
SELECT 
    id, name, alias, season, quality, smart_regex, rss_source_id, task_id, created_at,
    poster_path, tmdb_id, overview, vote_average, total_episodes, user_id, smart_switch
FROM series_subscriptions;

-- 3. 删除旧表
DROP TABLE series_subscriptions;

-- 4. 重命名新表
ALTER TABLE series_subscriptions_new RENAME TO series_subscriptions;

-- 注意：不修改 tasks 表中的 cron 字段，保留原有的定时设置
-- 原先设置为每 2 小时、每小时或每 30 分钟的任务将保持不变

-- 完成
SELECT '追剧周期功能已成功移除，check_interval 字段已删除，原有任务的 cron 定时设置保持不变' AS message;
