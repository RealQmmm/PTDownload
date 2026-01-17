const express = require('express');
const router = express.Router();
const searchService = require('../services/searchService');
const hotResourcesService = require('../services/hotResourcesService');
const appConfig = require('../utils/appConfig');
const { getDB } = require('../db');
const clientService = require('../services/clientService');
const siteService = require('../services/siteService');

// Aggregated initialization endpoint for SearchPage
// Combines: clients, sites, download-paths, settings into a single request
router.get('/init', async (req, res) => {
    try {
        const db = getDB();

        // Fetch all required data in parallel
        const [clients, sites, paths, settingsRows] = await Promise.all([
            Promise.resolve(clientService.getAllClients()),
            Promise.resolve(siteService.getAllSites()),
            Promise.resolve(db.prepare('SELECT * FROM download_paths ORDER BY is_default DESC, name ASC').all()),
            Promise.resolve(db.prepare('SELECT key, value FROM settings').all())
        ]);

        // Convert settings array to object
        const settings = {};
        settingsRows.forEach(row => {
            settings[row.key] = row.value;
        });

        // Extract only the settings needed by SearchPage
        const searchSettings = {
            auto_download_enabled: settings.auto_download_enabled,
            enable_category_management: settings.enable_category_management,
            match_by_category: settings.match_by_category,
            match_by_keyword: settings.match_by_keyword,
            fallback_to_default_path: settings.fallback_to_default_path,
            use_downloader_default: settings.use_downloader_default,
            default_download_path: settings.default_download_path,
            enable_multi_path: settings.enable_multi_path,
            create_series_subfolder: settings.create_series_subfolder,
            hot_resources_enabled: settings.hot_resources_enabled,
            hot_resources_rules: settings.hot_resources_rules,
            category_map: settings.category_map
        };

        res.json({
            clients,
            sites: sites.map(s => ({ id: s.id, name: s.name, url: s.url, enabled: s.enabled, site_icon: s.site_icon })),
            paths,
            settings: searchSettings
        });
    } catch (err) {
        console.error('Search init error:', err);
        res.status(500).json({ error: 'Failed to load initialization data' });
    }
});

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
