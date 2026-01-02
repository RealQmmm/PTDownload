const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const notificationService = require('../services/notificationService');

// Get public settings (no auth required)
router.get('/public', (req, res) => {
    try {
        const db = getDB();
        const siteNameEntry = db.prepare("SELECT value FROM settings WHERE key = 'site_name'").get();
        res.json({
            site_name: siteNameEntry ? siteNameEntry.value : 'PT Manager'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all settings or a specific setting
router.get('/', (req, res) => {
    try {
        const db = getDB();
        const settings = db.prepare('SELECT * FROM settings').all();
        const settingsMap = {};
        settings.forEach(s => {
            settingsMap[s.key] = s.value;
        });

        res.json(settingsMap);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update settings
router.post('/', (req, res) => {
    const settings = req.body;
    try {
        const db = getDB();
        const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

        const transaction = db.transaction((items) => {
            for (const [key, value] of Object.entries(items)) {
                updateStmt.run(key, String(value));
            }
        });

        transaction(settings);

        // If cookie_check_interval was updated, restart the job
        if (settings.cookie_check_interval || settings.checkin_time) {
            const schedulerService = require('../services/schedulerService');
            if (settings.cookie_check_interval) schedulerService.startCookieCheckJob();
            if (settings.checkin_time) schedulerService.startCheckinJob();
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to update settings:', err);
        res.status(500).json({ error: err.message });
    }
});

// Export all data
router.get('/export', (req, res) => {
    try {
        const db = getDB();
        const tables = ['sites', 'clients', 'tasks', 'rss_sources', 'settings', 'daily_stats', 'task_history', 'stats_checkpoint', 'site_daily_stats', 'users', 'series_subscriptions', 'series_episodes', 'download_paths'];
        const data = {};

        tables.forEach(table => {
            let rows = db.prepare(`SELECT * FROM ${table}`).all();

            // Decrypt cookies locally for export so backup is portable
            if (table === 'sites') {
                const cryptoUtils = require('../utils/cryptoUtils');
                rows = rows.map(site => {
                    if (site.cookies && cryptoUtils.isEncrypted(site.cookies)) {
                        try {
                            // Decrypt so the exported JSON has plaintext cookies
                            // When importing, the system will re-encrypt them with its own key
                            site.cookies = cryptoUtils.decrypt(site.cookies);
                        } catch (e) {
                            // Keep as is if decryption fails
                        }
                    }
                    return site;
                });
            }

            data[table] = rows;
        });

        res.setHeader('Content-disposition', 'attachment; filename=pt_download_backup.json');
        res.setHeader('Content-type', 'application/json');
        res.send(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Export failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Import data
router.post('/import', async (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid backup data' });
    }

    try {
        const db = getDB();
        const tables = ['sites', 'clients', 'tasks', 'rss_sources', 'settings', 'daily_stats', 'task_history', 'stats_checkpoint', 'site_daily_stats', 'users', 'series_subscriptions', 'series_episodes', 'download_paths'];

        const importTransaction = db.transaction((backupContent) => {
            // Disable foreign keys temporarily to avoid issues during deletion/insertion
            db.prepare('PRAGMA foreign_keys = OFF').run();

            tables.forEach(table => {
                if (backupContent[table] && Array.isArray(backupContent[table])) {
                    // Clear existing data
                    db.prepare(`DELETE FROM ${table}`).run();

                    if (backupContent[table].length > 0) {
                        // 获取数据库中表真实的列名，防止因版本更迭导致的字段不匹配（如 rules 字段等）
                        const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all();
                        const dbColumns = tableInfo.map(info => info.name);

                        const backupColumns = Object.keys(backupContent[table][0]);
                        const validColumns = backupColumns.filter(col => dbColumns.includes(col));

                        if (validColumns.length > 0) {
                            const placeholders = validColumns.map(() => '?').join(',');
                            const insertStmt = db.prepare(`INSERT INTO ${table} (${validColumns.join(',')}) VALUES (${placeholders})`);

                            backupContent[table].forEach(row => {
                                // Special handling for sites.cookies: Auto-encrypt if plaintext
                                if (table === 'sites' && row.cookies) {
                                    const cryptoUtils = require('../utils/cryptoUtils');
                                    if (!cryptoUtils.isEncrypted(row.cookies)) {
                                        row.cookies = cryptoUtils.encrypt(row.cookies);
                                    }
                                }

                                const values = validColumns.map(col => row[col]);
                                insertStmt.run(...values);
                            });
                        }
                    }
                }
            });

            db.prepare('PRAGMA foreign_keys = ON').run();
        });

        importTransaction(data);

        // RE-INITIALIZE SERVICES
        try {
            const statsService = require('../services/statsService');
            await statsService.init();

            const schedulerService = require('../services/schedulerService');
            schedulerService.reload();
            console.log('Scheduler reloaded after import.');
        } catch (e) {
            console.error('Failed to re-init services after import:', e);
        }

        res.json({ success: true, message: '数据导入成功，统计数据已重载。' });
    } catch (err) {
        console.error('Import failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Test notification
router.post('/test-notify', async (req, res) => {
    try {
        const { title, message, config } = req.body;
        // Test with provided config (unsaved) or existing one
        const result = await notificationService.send(
            title || '🔔 PT Manager 测试通知',
            message || '如果您收到了这条消息，说明您的通知配置（Bark/Webhook）工作正常。',
            config // Pass config if present
        );

        if (result.success) {
            res.json({ success: true, message: '测试通知已成功发送', results: result.results });
        } else if (result.partial) {
            res.json({ success: true, message: '测试通知部分发送成功，请检查错误详情', results: result.results });
        } else {
            res.status(400).json({ error: result.error || '测试通知发送失败', results: result.results });
        }
    } catch (err) {
        console.error('Test notification failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Maintenance: Sync historical data with downloader
router.post('/maintenance/sync-history', async (req, res) => {
    try {
        const statsService = require('../services/statsService');
        const result = await statsService.syncHistoryWithDownloader();
        if (result.success) {
            res.json({ success: true, message: `同步完成，更新了 ${result.updatedCount} 条记录` });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (err) {
        console.error('Maintenance sync failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Maintenance: Clear task history and logs
router.post('/maintenance/clear-tasks', (req, res) => {
    try {
        const db = getDB();
        const delLogs = db.prepare('DELETE FROM task_logs').run();
        const delHistory = db.prepare('DELETE FROM task_history').run();
        res.json({
            success: true,
            message: `清理完成：删除了 ${delHistory.changes} 条任务历史和 ${delLogs.changes} 条运行日志。`
        });
    } catch (err) {
        console.error('Clear tasks failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Maintenance: Clear all heatmap data
router.post('/maintenance/clear-heatmap', (req, res) => {
    try {
        const db = getDB();
        const delHeatmap = db.prepare('DELETE FROM site_daily_stats').run();
        res.json({
            success: true,
            message: `清理完成：删除了 ${delHeatmap.changes} 条站点热力图统计记录。`
        });
    } catch (err) {
        console.error('Clear heatmap failed:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
