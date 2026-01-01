const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');

// Search torrents
router.get('/', async (req, res) => {
    try {
        const { q, days, page, site } = req.query;
        // q is not strictly required anymore if we want recent results
        const results = await searchService.search(q || '', days, page, site);
        res.json(results);
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error during search' });
    }
});

module.exports = router;
