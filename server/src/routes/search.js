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

        // If hot resources integration is enabled, calculate scores for all results
        if (appConfig.isHotResourcesEnabled()) {
            const config = hotResourcesService.getConfig();
            const rules = config.rules || {};

            // --- 动态计算站点基准能力 ---
            const siteBaselines = {};
            const siteStats = {};
            results.forEach(r => {
                const sName = r.siteName || 'unknown';
                if (!siteStats[sName]) siteStats[sName] = { total: 0, count: 0 };
                siteStats[sName].total += (r.seeders || 0);
                siteStats[sName].count++;
            });
            Object.keys(siteStats).forEach(sName => {
                const avg = siteStats[sName].total / siteStats[sName].count;
                // 限制基准在 3-10 之间，防止过极端
                siteBaselines[sName] = Math.max(3, Math.min(10, avg));
            });

            const resultsWithScores = results.map(result => {
                const sName = result.siteName || 'unknown';
                const baseline = siteBaselines[sName] || 5;

                // Convert search result to the format expected by calculateHotScore
                const resource = {
                    title: result.name,
                    seeders: result.seeders || 0,
                    leechers: result.leechers || 0,
                    size: result.size ? parseSizeToBytes(result.size) : 0,
                    promotion: result.freeType || '',
                    publishTime: result.date,
                    category: result.category,
                    siteId: result.siteId,
                    site_id: result.siteId,
                };

                const scoreResult = hotResourcesService.calculateHotScore(resource, rules, true, baseline);

                return {
                    ...result,
                    hotScore: scoreResult.total,
                    scoreBreakdown: scoreResult.breakdown,
                    riskLabel: scoreResult.riskLabel,
                    riskLevel: scoreResult.riskLevel
                };
            });

            // If it's a recent search (no keyword), sort by hot score (highest first)
            if (!query.trim()) {
                resultsWithScores.sort((a, b) => (b.hotScore || 0) - (a.hotScore || 0));
            }

            return res.json(resultsWithScores);
        }

        // Return results as is if hot resources integration is disabled
        res.json(results);
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
