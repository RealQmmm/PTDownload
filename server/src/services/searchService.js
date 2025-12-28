const axios = require('axios');
const siteService = require('./siteService');
const siteParsers = require('../utils/siteParsers');

class SearchService {
    async search(query, days = null) {
        const sites = siteService.getAllSites();
        const enabledSites = sites.filter(s => s.enabled);

        if (enabledSites.length === 0) {
            return [];
        }

        const isRecentSearch = !query || query.trim() === '';
        console.log(`Starting ${isRecentSearch ? 'recent' : 'keyword'} search ${!isRecentSearch ? `for "${query}"` : ''} across ${enabledSites.length} sites...`);

        const searchPromises = enabledSites.map(async (site) => {
            try {
                if (site.type === 'Mock') {
                    await new Promise(r => setTimeout(r, 500));
                    let results = siteParsers.parse('', 'Mock', site.url);
                    if (!isRecentSearch) {
                        results = results.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
                    }
                    return results.map(r => ({ ...r, siteName: site.name }));
                }

                // Construct search URL
                const searchUrl = new URL('/torrents.php', site.url);
                if (!isRecentSearch) {
                    searchUrl.searchParams.append('search', query);
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

                return results.map(r => ({ ...r, siteName: site.name }));

            } catch (err) {
                console.error(`Search failed for ${site.name}:`, err.message);
                return [];
            }
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
