const axios = require('axios');
const siteService = require('./siteService');
const siteParsers = require('../utils/siteParsers');

class SearchService {
    async search(query) {
        const sites = siteService.getAllSites();
        const enabledSites = sites.filter(s => s.enabled);

        if (enabledSites.length === 0) {
            return [];
        }

        console.log(`Starting search for "${query}" across ${enabledSites.length} sites...`);

        const searchPromises = enabledSites.map(async (site) => {
            try {
                if (site.type === 'Mock') {
                    // Start with a small delay for mock to simulate network
                    await new Promise(r => setTimeout(r, 500));
                    const results = siteParsers.parse('', 'Mock', site.url);
                    // Filter mock results by query
                    return results.filter(r => r.name.toLowerCase().includes(query.toLowerCase()))
                        .map(r => ({ ...r, siteName: site.name }));
                }

                // Construct search URL
                // NexusPHP standard: torrents.php?search=QUERY&notsticky=1
                const searchUrl = new URL('/torrents.php', site.url);
                searchUrl.searchParams.append('search', query);
                searchUrl.searchParams.append('notsticky', '1'); // Exclude sticky torrents if possible

                const headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Cookie': site.cookies || ''
                };

                const response = await axios.get(searchUrl.toString(), {
                    headers,
                    timeout: 10000 // 10s timeout
                });

                const results = siteParsers.parse(response.data, site.type, site.url);
                return results.map(r => ({ ...r, siteName: site.name }));

            } catch (err) {
                console.error(`Search failed for ${site.name}:`, err.message);
                return [];
            }
        });

        const resultsArrays = await Promise.all(searchPromises);
        const allResults = resultsArrays.flat();

        // Sort by seeders desc by default
        return allResults.sort((a, b) => b.seeders - a.seeders);
    }
}

module.exports = new SearchService();
