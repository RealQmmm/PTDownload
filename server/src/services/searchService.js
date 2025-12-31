const axios = require('axios');
const siteService = require('./siteService');
const siteParsers = require('../utils/siteParsers');

const { getDB } = require('../db');

class SearchService {
    async search(query, days = null, page = null) {
        const sites = siteService.getAllSites();
        const enabledSites = sites.filter(s => {
            const isEnabled = s.enabled === 1 || s.enabled === true || s.enabled === '1';
            return isEnabled && s.url;
        });

        if (enabledSites.length === 0) {
            console.warn(`Search requested but no enabled sites found. Total sites: ${sites.length}`);
            return [];
        }

        // Determine page limit
        let maxPages = 1;
        if (page) {
            maxPages = parseInt(page);
        } else {
            try {
                const db = getDB();
                const row = db.prepare("SELECT value FROM settings WHERE key = 'search_page_limit'").get();
                if (row && row.value) {
                    maxPages = parseInt(row.value);
                }
            } catch (err) {
                console.warn('Failed to read search_page_limit setting, defaulting to 1', err);
            }
        }

        // Cap maxPages to avoid abuse/errors
        maxPages = Math.max(1, Math.min(maxPages, 50));

        const siteNames = enabledSites.map(s => s.name).join(', ');
        const isRecentSearch = !query || query.trim() === '';
        console.log(`Starting ${isRecentSearch ? 'recent' : 'keyword'} search ${!isRecentSearch ? `for "${query}"` : ''} with page limit ${maxPages} across [${siteNames}]...`);

        const searchPromises = enabledSites.map(async (site) => {
            const pageResultsPromises = Array.from({ length: maxPages }, async (_, i) => {
                const currentPage = i;
                try {
                    if (site.type === 'Mock') {
                        if (currentPage > 0) return []; // Mock only has one page
                        await new Promise(r => setTimeout(r, 500));
                        let results = siteParsers.parse('', 'Mock', site.url);
                        if (!isRecentSearch) {
                            results = results.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
                        }
                        return results;
                    }

                    // Construct search URL
                    const searchUrl = new URL('/torrents.php', site.url);
                    if (!isRecentSearch) {
                        searchUrl.searchParams.append('search', query);
                    }

                    // Add page parameter (most NexusPHP sites use 0-indexed 'page')
                    if (currentPage > 0) {
                        searchUrl.searchParams.append('page', currentPage);
                    }

                    searchUrl.searchParams.append('notsticky', '1');

                    const headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Cookie': site.cookies || ''
                    };

                    const https = require('https');
                    const response = await axios.get(searchUrl.toString(), {
                        headers,
                        timeout: 10000,
                        validateStatus: null, // Capture all statuses
                        httpsAgent: new https.Agent({
                            rejectUnauthorized: false,
                            servername: new URL(site.url).hostname // Explicitly set SNI
                        })
                    });

                    if (response.status !== 200) {
                        return [];
                    }

                    let results = siteParsers.parse(response.data, site.type, site.url);

                    // Filter by days if specified
                    if (days !== null) {
                        const cutoff = new Date();
                        cutoff.setDate(cutoff.getDate() - parseInt(days));
                        results = results.filter(item => {
                            const itemDate = new Date(item.date);
                            return !isNaN(itemDate.getTime()) && itemDate >= cutoff;
                        });
                    }
                    return results;
                } catch (err) {
                    console.error(`Search failed for ${site.name} page ${currentPage + 1}:`, err.message);
                    return [];
                }
            });

            const allPagesResults = await Promise.all(pageResultsPromises);
            const flatResults = allPagesResults.flat();

            return flatResults.map(r => ({ ...r, siteName: site.name }));
        });

        const resultsArrays = await Promise.all(searchPromises);
        const allResults = resultsArrays.flat();

        if (isRecentSearch) {
            // Sort by date desc for recent search
            return allResults.sort((a, b) => new Date(b.date) - new Date(a.date));
        } else {
            // Sort by seeders desc for keyword search
            return allResults.sort((a, b) => b.seeders - a.seeders);
        }
    }
}

module.exports = new SearchService();
