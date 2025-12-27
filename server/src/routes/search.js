const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');

// Search torrents
router.get('/', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const results = await searchService.search(q);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error during search' });
    }
});

module.exports = router;
