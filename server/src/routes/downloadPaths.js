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
        const { name, path, description } = req.body;
        const db = getDB();
        const info = db.prepare('INSERT INTO download_paths (name, path, description) VALUES (?, ?, ?)').run(name, path, description);
        res.status(201).json({ id: info.lastInsertRowid, name, path, description });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update download path
router.put('/:id', (req, res) => {
    try {
        const { name, path, description } = req.body;
        const db = getDB();
        db.prepare('UPDATE download_paths SET name = ?, path = ?, description = ? WHERE id = ?').run(name, path, description, req.params.id);
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
