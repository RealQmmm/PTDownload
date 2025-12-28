const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

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
        const tables = ['sites', 'clients', 'tasks', 'rss_sources', 'settings', 'daily_stats', 'task_history', 'task_logs', 'stats_checkpoint'];
        const data = {};

        tables.forEach(table => {
            data[table] = db.prepare(`SELECT * FROM ${table}`).all();
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
router.post('/import', (req, res) => {
    const data = req.body;
    if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid backup data' });
    }

    try {
        const db = getDB();
        const tables = ['sites', 'clients', 'tasks', 'rss_sources', 'settings', 'daily_stats', 'task_history', 'task_logs', 'stats_checkpoint'];

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
        res.json({ success: true, message: '数据导入成功，建议重启应用以确保配置生效。' });
    } catch (err) {
        console.error('Import failed:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
