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

module.exports = router;
