const express = require('express');
const router = express.Router();
const rssSourceService = require('../services/rssSourceService');

router.get('/', (req, res) => {
    try {
        const sources = rssSourceService.getAll();
        res.json(sources);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/', (req, res) => {
    try {
        const id = rssSourceService.create(req.body);
        res.status(201).json({ id, ...req.body });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/:id', (req, res) => {
    try {
        rssSourceService.update(req.params.id, req.body);
        res.json({ message: 'RSS source updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/:id', (req, res) => {
    try {
        rssSourceService.delete(req.params.id);
        res.json({ message: 'RSS source deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
