const axios = require('axios');
const siteService = require('./siteService');
const siteParsers = require('../utils/siteParsers');

const { getDB } = require('../db');

class SearchService {
    async search(query, days = null, page = null) {
        const sites = siteService.getAllSites();
        const enabledSites = sites.filter(s => s.enabled);

        if (enabledSites.length === 0) {
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

        const isRecentSearch = !query || query.trim() === '';
        console.log(`Starting ${isRecentSearch ? 'recent' : 'keyword'} search ${!isRecentSearch ? `for "${query}"` : ''} with page limit ${maxPages} across ${enabledSites.length} sites...`);

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

                    const response = await axios.get(searchUrl.toString(), {
                        headers,
                        timeout: 10000
                    });

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

            // Deduplicate by ID or Link
            const seen = new Set();
            const uniqueResults = flatResults.filter(item => {
                const key = item.id || item.link;
                if (!key || seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            return uniqueResults.map(r => ({ ...r, siteName: site.name }));
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
