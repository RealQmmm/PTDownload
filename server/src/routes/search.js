const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const hotResourcesService = require('../services/hotResourcesService');
const appConfig = require('../utils/appConfig');
const { getDB } = require('../db');

// Search torrents
router.get('/', async (req, res) => {
    try {
        const { q, days, page, site } = req.query;
        const query = q || '';

        // Perform search
        const results = await searchService.search(query, days, page, site);

        // If no keyword (recent search), check if hot resources search integration is enabled
        if (!query.trim()) {
            // Only apply hot resources logic if search integration is enabled (checked via cache)
            if (appConfig.isHotResourcesEnabled()) {
                const config = hotResourcesService.getConfig();
                const rules = config.rules || {};

                // Convert search results to hot resource format
                const resources = results.map(result => ({
                    title: result.name,
                    seeders: result.seeders || 0,
                    leechers: result.leechers || 0,
                    size: result.size ? parseSizeToBytes(result.size) : 0,
                    promotion: result.freeType || '',
                    publishTime: result.date,
                    category: result.category,
                    siteId: result.siteId,
                    site_id: result.siteId,
                    originalResult: result
                }));

                // Apply hot resources filters
                const filtered = hotResourcesService.applyFilters(resources, rules);

                // Calculate hot score for filtered results
                const resultsWithScores = filtered.map(resource => {
                    const scoreResult = hotResourcesService.calculateHotScore(resource, rules, true);

                    return {
                        ...resource.originalResult,
                        hotScore: scoreResult.total,
                        scoreBreakdown: scoreResult.breakdown,
                        riskLabel: scoreResult.riskLabel,
                        riskLevel: scoreResult.riskLevel
                    };
                });

                // Filter by hot score threshold
                const scoreThreshold = rules.scoreThreshold || 30;
                const filteredByScore = resultsWithScores.filter(r => (r.hotScore || 0) >= scoreThreshold);

                // Sort by hot score (highest first)
                filteredByScore.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));

                res.json(filteredByScore);
            } else {
                // Hot resources search integration disabled - return results as is
                res.json(results);
            }
        } else {
            // Keyword search - return as is
            res.json(results);
        }
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error during search' });
    }
});

// Helper function to parse size string to bytes
function parseSizeToBytes(sizeStr) {
    if (!sizeStr || sizeStr === 'N/A') return 0;

    const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?B)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024
    };

    return Math.floor(value * (multipliers[unit] || 1));
}

module.exports = router;
