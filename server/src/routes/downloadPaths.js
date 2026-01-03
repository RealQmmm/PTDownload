const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// Get all download paths
router.get('/', (req, res) => {
    try {
        const db = getDB();
        const paths = db.prepare('SELECT * FROM download_paths ORDER BY id ASC').all();
        res.json(paths);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create download path
router.post('/', (req, res) => {
    try {
        const { name, path, description, is_default } = req.body;
        const db = getDB();

        const insert = db.transaction(() => {
            if (is_default) {
                db.prepare('UPDATE download_paths SET is_default = 0').run();
            }
            return db.prepare('INSERT INTO download_paths (name, path, description, is_default) VALUES (?, ?, ?, ?)').run(name, path, description, is_default ? 1 : 0);
        });

        const info = insert();
        res.status(201).json({ id: info.lastInsertRowid, name, path, description, is_default: is_default ? 1 : 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update download path
router.put('/:id', (req, res) => {
    try {
        const { name, path, description, is_default } = req.body;
        const db = getDB();

        const update = db.transaction(() => {
            if (is_default) {
                db.prepare('UPDATE download_paths SET is_default = 0 WHERE id != ?').run(req.params.id);
            }
            db.prepare('UPDATE download_paths SET name = ?, path = ?, description = ?, is_default = ? WHERE id = ?').run(name, path, description, is_default ? 1 : 0, req.params.id);
        });

        update();
        res.json({ message: 'Download path updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete download path
router.delete('/:id', (req, res) => {
    try {
        const db = getDB();
        db.prepare('DELETE FROM download_paths WHERE id = ?').run(req.params.id);
        res.json({ message: 'Download path deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
